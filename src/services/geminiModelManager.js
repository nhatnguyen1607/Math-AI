import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

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
    displayName: "Gemini 2.5 Flash TTS",
    rpdLimit: 10,
    type: "multimodal"
  },
  {
    name: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    rpdLimit: 20,
    type: "text"
  },
  {
    name: "gemini-3-flash",
    displayName: "Gemini 3 Flash",
    rpdLimit: 20,
    type: "text"
  }
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
        return genAI.getGenerativeModel({ model: model.name });
      }
    }
    
    // Nếu tất cả model đã vượt limit, dùng model đầu tiên (sẽ nhận lỗi từ API)
    console.warn("Tất cả model đã vượt RPD limit!");
    return genAI.getGenerativeModel({ model: MODELS[0].name });
  }

  // Tăng bộ đếm khi sử dụng model
  incrementUsage() {
    const currentModel = MODELS[this.currentModelIndex];
    this.modelUsageCount[currentModel.name]++;
    
    console.log(`Model: ${currentModel.displayName}, Usage: ${this.modelUsageCount[currentModel.name]}/${currentModel.rpdLimit}`);
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
        console.log(`Fallback to: ${model.displayName}`);
        return genAI.getGenerativeModel({ model: model.name });
      }
    }
    
    // Nếu không tìm được model nào từ vị trí hiện tại, quay lại từ đầu
    for (let i = 0; i < startIndex; i++) {
      const model = MODELS[i];
      const usageCount = this.modelUsageCount[model.name];
      
      if (usageCount < model.rpdLimit) {
        this.currentModelIndex = i;
        console.log(`Fallback to: ${model.displayName}`);
        return genAI.getGenerativeModel({ model: model.name });
      }
    }
    
    return null; // Không có model nào khả dụng
  }

  // Lấy thông tin sử dụng RPD
  getUsageInfo() {
    this._checkAndResetDailyCount();
    
    return MODELS.map(model => ({
      name: model.displayName,
      used: this.modelUsageCount[model.name],
      limit: model.rpdLimit,
      available: this.modelUsageCount[model.name] < model.rpdLimit
    }));
  }

  // Gọi model với tự động fallback nếu hết RPD
  async generateContent(prompt) {
    let lastError = null;
    
    // Thử các model theo thứ tự ưu tiên
    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[i];
      const usageCount = this.modelUsageCount[model.name];
      
      // Bỏ qua model đã vượt limit
      if (usageCount >= model.rpdLimit) {
        console.log(`${model.displayName} đã vượt limit, bỏ qua...`);
        continue;
      }
      
      try {
        const currentModel = genAI.getGenerativeModel({ model: model.name });
        const result = await currentModel.generateContent(prompt);
        
        // Tăng bộ đếm khi thành công
        this.modelUsageCount[model.name]++;
        this.currentModelIndex = i;
        
        console.log(`✓ Sử dụng ${model.displayName} (${this.modelUsageCount[model.name]}/${model.rpdLimit})`);
        return result;
        
      } catch (error) {
        lastError = error;
        console.warn(`✗ ${model.displayName} lỗi: ${error.message}`);
        
        // Kiểm tra nếu lỗi do vượt RPD limit
        if (error.message?.includes("Rate limit") || 
            error.message?.includes("quota") ||
            error.status === 429) {
          console.log(`${model.displayName} đã hết RPD, chuyển sang model khác...`);
          this.modelUsageCount[model.name] = model.rpdLimit; // Đánh dấu là đã hết
          continue;
        }
        
        // Nếu lỗi khác, tiếp tục thử model tiếp theo
        continue;
      }
    }
    
    // Nếu tất cả model đều lỗi
    throw new Error(`Tất cả model đã vượt RPD hoặc bị lỗi. Lỗi cuối: ${lastError?.message}`);
  }

  // Reset usage (dùng cho testing)
  resetUsage() {
    MODELS.forEach(model => {
      this.modelUsageCount[model.name] = 0;
    });
    this.currentModelIndex = 0;
  }
}

const geminiModelManager = new GeminiModelManager();
export default geminiModelManager;
export { MODELS };
