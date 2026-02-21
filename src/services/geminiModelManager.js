import { GoogleGenerativeAI } from "@google/generative-ai";
import apiKeyManager from "./apiKeyManager";

// Danh sách các model với thứ tự ưu tiên
const MODELS = [
    {
    name: "gemini-2.5-flash-lite",
    displayName: "Gemini 2.5 Flash Lite",
    rpdLimit: 20,
    type: "text"
  },
  {
    name: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    rpdLimit: 20,
    type: "text"
  },
];

class GeminiModelManager {
  constructor() {
    this.currentModelIndex = 0;
    this.modelUsageCount = {}; // Theo dõi số lần sử dụng mỗi model trong ngày
    this.lastResetDate = new Date().toDateString();
    
    // Khởi tạo bộ đếm cho từng model
    MODELS.forEach(model => {
      this.modelUsageCount[model.name] = 0;
    });

    // Queue promise used to serialize calls and avoid rate limit bursts
    // Always resolved by default so first call proceeds immediately.
    this._queue = Promise.resolve();
  }

  /**
   * Lấy instance GoogleGenerativeAI với API key hiện tại
   */
  _getGeminiInstance() {
    const apiKey = apiKeyManager.getCurrentKey();
    return new GoogleGenerativeAI(apiKey);
  }

  // Reset bộ đếm nếu sang ngày mới
  _checkAndResetDailyCount() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      MODELS.forEach(model => {
        this.modelUsageCount[model.name] = 0;
      });
      this.lastResetDate = today;
      this.currentModelIndex = 0;
    }
  }

  // Lấy model hiện tại (có kiểm tra RPD limit)
  getModel() {
    this._checkAndResetDailyCount();
    
    // Tìm model đầu tiên chưa vượt limit
    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[i];
      const usageCount = this.modelUsageCount[model.name];
      
      if (usageCount < model.rpdLimit) {
        this.currentModelIndex = i;
        return this._getGeminiInstance().getGenerativeModel({ model: model.name });
      }
    }
    
    // Nếu tất cả model đã vượt limit, dùng model đầu tiên (sẽ nhận lỗi từ API)
    return this._getGeminiInstance().getGenerativeModel({ model: MODELS[0].name });
  }

  // Tăng bộ đếm khi sử dụng model
  incrementUsage() {
    const currentModel = MODELS[this.currentModelIndex];
    this.modelUsageCount[currentModel.name]++;
  }

  // Lấy model tiếp theo (fallback)
  getNextAvailableModel() {
    this._checkAndResetDailyCount();
    
    const startIndex = this.currentModelIndex;
    
    // Tìm model tiếp theo
    for (let i = this.currentModelIndex + 1; i < MODELS.length; i++) {
      const model = MODELS[i];
      const usageCount = this.modelUsageCount[model.name];
      
      if (usageCount < model.rpdLimit) {
        this.currentModelIndex = i;
        return this._getGeminiInstance().getGenerativeModel({ model: model.name });
      }
    }
    
    // Nếu không tìm được model nào từ vị trí hiện tại, quay lại từ đầu
    for (let i = 0; i < startIndex; i++) {
      const model = MODELS[i];
      const usageCount = this.modelUsageCount[model.name];
      
      if (usageCount < model.rpdLimit) {
        this.currentModelIndex = i;
        return this._getGeminiInstance().getGenerativeModel({ model: model.name });
      }
    }
    
    return null; // Không có model nào khả dụng
  }

  // Lấy thông tin sử dụng RPD
  getUsageInfo() {
    this._checkAndResetDailyCount();
    
    return {
      models: MODELS.map(model => ({
        name: model.displayName,
        used: this.modelUsageCount[model.name],
        limit: model.rpdLimit,
        available: this.modelUsageCount[model.name] < model.rpdLimit
      })),
      apiKeys: apiKeyManager.getUsageStats(),
      totalRequests: apiKeyManager.totalRequests,
      availableKeys: apiKeyManager.getAvailableKeyCount(),
      totalKeys: apiKeyManager.keyConfigs.length
    };
  }

  // Gọi model với tự động fallback nếu hết RPD
  // Logic: Thử tất cả models trước, chỉ đổi key khi tất cả models đã hết quota
  // Hỗ trợ hàng đợi để tránh gửi nhiều request cùng lúc (đã gây lỗi 429)
  async generateContent(prompt) {
    // ---------- queueing/throttling logic ----------
    // Wait for any previous request to complete (including post-delay)
    await this._queue;

    // Prepare a new queue promise that will be resolved after this call finishes
    let resolveQueue;
    const queuePromise = new Promise(res => {
      resolveQueue = res;
    });
    // set _queue to the new placeholder so calls coming after will await it
    this._queue = queuePromise;

    try {
      // Add a small inter-request delay to avoid burst limit
      await this._delay(500);

      // ---------- original generateContent body ----------
      let lastError = null;
      let maxKeyAttempts = apiKeyManager.keyConfigs.length; // Số key khả dụng
      let keyAttempts = 0;

      while (keyAttempts < maxKeyAttempts) {
        const modelsNotAvailableForThisKey = new Set(); // Track models hết quota/404 với key hiện tại
        let modelAttempts = 0;

        // Thử các model theo thứ tự ưu tiên với key hiện tại
        for (let i = 0; i < MODELS.length; i++) {
          const model = MODELS[i];
          
          // Bỏ qua model đã vượt limit (toàn cục) hoặc đã không khả dụng với key này
          if (this.modelUsageCount[model.name] >= model.rpdLimit || 
              modelsNotAvailableForThisKey.has(model.name)) {
            continue;
          }

          modelAttempts++;
          
          try {
            const geminiInstance = this._getGeminiInstance();
            const currentModel = geminiInstance.getGenerativeModel({ model: model.name });
            const result = await currentModel.generateContent(prompt);
            
            // Tăng bộ đếm khi thành công
            this.modelUsageCount[model.name]++;
            apiKeyManager.incrementRequestCount();
            this.currentModelIndex = i;
            
            return result;
            
          } catch (error) {
            lastError = error;
            
            // Kiểm tra loại lỗi
            const isQuotaError = error.message?.includes("Rate limit") || 
                                  error.message?.includes("quota") ||
                                  error.message?.includes("429") ||
                                  error.status === 429;
            
            const isNotFoundError = error.message?.includes("404") || 
                                     error.message?.includes("not found") ||
                                     error.status === 404;
            
            // Cả quota error lẫn not found error đều đánh dấu model không khả dụng
            if (isQuotaError) {
              modelsNotAvailableForThisKey.add(model.name);
            } else if (isNotFoundError) {
              modelsNotAvailableForThisKey.add(model.name);
            }
            // Các lỗi khác không đánh dấu, chỉ bỏ qua model này lần này
          }
        }

        // Kiểm tra nếu tất cả models đã không khả dụng với key hiện tại
        const allModelsUnavailableOrOverLimit = MODELS.every(model => 
          this.modelUsageCount[model.name] >= model.rpdLimit || 
          modelsNotAvailableForThisKey.has(model.name)
        );

        if (allModelsUnavailableOrOverLimit) {
          apiKeyManager.markKeyAsExhausted(lastError);
          
          // Thử rotate sang key khác
          if (apiKeyManager.rotateToNextKey()) {
            keyAttempts++;
          } else {
            break;
          }
        } else if (modelAttempts === 0) {
          // Không thử được model nào (tất cả vượt limit hoặc hết quota)
          break;
        } else {
          apiKeyManager.markKeyAsExhausted(lastError);
          
          if (apiKeyManager.rotateToNextKey()) {
            keyAttempts++;
            
            // Chờ một chút trước khi retry
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            break;
          }
        }
      }
      
      const availableKeys = apiKeyManager.getAvailableKeyCount();
      throw new Error(`Tất cả API keys đã hết quota hoặc bị lỗi. Keys available: ${availableKeys}/${apiKeyManager.keyConfigs.length}. Last error: ${lastError?.message}`);

    } finally {
      // resolve the queue after a short delay to maintain spacing
      setTimeout(() => resolveQueue(), 0);
    }
  }

  // Utility delay helper (ms)
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Lấy log rotation API key
  getKeyRotationLog() {
    return apiKeyManager.getRotationLog();
  }

  // Reset usage (dùng cho testing)
  resetUsage() {
    MODELS.forEach(model => {
      this.modelUsageCount[model.name] = 0;
    });
    this.currentModelIndex = 0;
    apiKeyManager.reset();
  }
}

const geminiModelManager = new GeminiModelManager();
export default geminiModelManager;
export { MODELS };
