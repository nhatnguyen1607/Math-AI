// Sử dụng Vertex AI REST API từ browser
// Không cần import Google Generative AI SDK vì giờ dùng REST API trực tiếp

// Model names hỗ trợ trong Vertex AI
const MODELS = [
  {
    name: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    rpdLimit: 20,
    type: "text"
  },
  {
    name: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    rpdLimit: 20,
    type: "text"
  },
  {
    name: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    rpdLimit: 10,
    type: "text"
  }
];

class GeminiModelManager {
  constructor() {
    this.currentModelIndex = 0;
    this.modelUsageCount = {}; // Theo dõi số lần sử dụng mỗi model trong ngày
    this.lastResetDate = new Date().toDateString();
    this.vertexAIInstance = null;
    
    // Khởi tạo bộ đếm cho từng model
    MODELS.forEach(model => {
      this.modelUsageCount[model.name] = 0;
    });

    // Queue promise used to serialize calls and avoid rate limit bursts
    this._queue = Promise.resolve();
    
    // Khởi tạo Vertex AI instance
    this._initializeVertexAI();
  }

  /**
   * Khởi tạo Vertex AI instance với API key từ env
   * Sử dụng Vertex AI REST API thay vì SDK vì SDK không tương thích với browser
   */
  _initializeVertexAI() {
    try {
      const apiKey = process.env.REACT_APP_VERTEX_AI_API_KEY;
      const projectId = process.env.REACT_APP_GCP_PROJECT_ID;
      const location = process.env.REACT_APP_GCP_LOCATION || 'us-central1';

      console.log('🔍 Vertex AI Init - API Key exists:', !!apiKey);
      console.log('🔍 Vertex AI Init - Project ID:', projectId);
      console.log('🔍 Vertex AI Init - Location:', location);
      console.log('🔍 All env vars:', Object.keys(process.env).filter(k => k.includes('VERTEX') || k.includes('GCP')));

      if (!apiKey || !projectId) {
        console.warn('❌ Vertex AI credentials not fully configured.');
        console.warn('   - API Key present:', !!apiKey);
        console.warn('   - Project ID present:', !!projectId);
        return;
      }

      this.vertexAIInstance = {
        apiKey,
        projectId,
        location,
        isVertexAI: true
      };
      
      console.log('✅ Vertex AI initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Vertex AI:', error);
    }
  }

  /**
   * Lấy Vertex AI instance hoặc khởi tạo lại nếu cần
   */
  _getVertexAIInstance() {
    if (!this.vertexAIInstance) {
      this._initializeVertexAI();
    }
    return this.vertexAIInstance;
  }

  /**
   * Gọi Backend API (sử dụng Vertex AI service account credentials)
   * Endpoint có thể là local (http://localhost:3001) hoặc production (Vercel)
   */
  async _callVertexAIAPI(modelName, prompt) {
    // Get API endpoint - local dev hoặc production
    const apiEndpoint = process.env.REACT_APP_BACKEND_API_URL || 'http://localhost:8080';
    
    const requestBody = {
      modelName: modelName,
      prompt: prompt,
      maxOutputTokens: 16384
    };

    console.log(`📤 Calling Backend API - Model: ${modelName}, Endpoint: ${apiEndpoint}`);

    try {
      const response = await fetch(`${apiEndpoint}/api/vertexai-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(
          errorData.error || `API Error: ${response.status}`
        );
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API returned error');
      }

      const content = data.content || '';
      const finishReason = data.finishReason;
      const usage = data.usage;

      console.log(`✅ Response - Length: ${content.length}, finishReason: ${finishReason}, tokens: ${usage?.totalTokenCount}/${usage?.promptTokenCount}+${usage?.candidatesTokenCount}`);
      if (finishReason !== 'STOP') {
        console.warn(`⚠️ Response may be incomplete. Finish reason: ${finishReason}`);
      }

      return {
        response: {
          text: () => content
        }
      };

    } catch (error) {
      console.error('❌ Backend API Error:', error.message);
      throw error;
    }
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
  // Trả về một object giả lập interface của GenerativeModel từ Google AI SDK
  getModel() {
    this._checkAndResetDailyCount();
    
    // Tìm model đầu tiên chưa vượt limit
    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[i];
      const usageCount = this.modelUsageCount[model.name];
      
      if (usageCount < model.rpdLimit) {
        this.currentModelIndex = i;
        // Trả về wrapped model interface
        return this._wrapModelInterface(model.name);
      }
    }
    
    // Nếu tất cả model đã vượt limit, dùng model đầu tiên (sẽ nhận lỗi từ API)
    return this._wrapModelInterface(MODELS[0].name);
  }

  /**
   * Tạo wrapper interface tương thích với GenerativeModel
   */
  _wrapModelInterface(modelName) {
    const manager = this;
    return {
      async generateContent(prompt) {
        // Nếu là string, chuyển đổi thành format tương thích
        const processedPrompt = typeof prompt === 'string' ? prompt : 
          (prompt.parts ? prompt.parts.map(p => p.text).join('') : JSON.stringify(prompt));
        
        return manager._callVertexAIAPI(modelName, processedPrompt);
      }
    };
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
        return this._wrapModelInterface(model.name);
      }
    }
    
    // Nếu không tìm được model nào từ vị trí hiện tại, quay lại từ đầu
    for (let i = 0; i < startIndex; i++) {
      const model = MODELS[i];
      const usageCount = this.modelUsageCount[model.name];
      
      if (usageCount < model.rpdLimit) {
        this.currentModelIndex = i;
        return this._wrapModelInterface(model.name);
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
      projectId: process.env.REACT_APP_GCP_PROJECT_ID,
      location: process.env.REACT_APP_GCP_LOCATION || 'us-central1',
      isVertexAI: true
    };
  }

  // Gọi model với tự động fallback nếu hết RPD
  async generateContent(prompt) {
    // ---------- queueing/throttling logic ----------
    await this._queue;

    let resolveQueue;
    const queuePromise = new Promise(res => {
      resolveQueue = res;
    });
    this._queue = queuePromise;

    try {
      // Add a small inter-request delay to avoid burst limit
      await this._delay(500);

      // ---------- Vertex AI generateContent body ----------
      let lastError = null;

      // Thử các model theo thứ tự ưu tiên
      for (let i = 0; i < MODELS.length; i++) {
        const model = MODELS[i];
        
        // Bỏ qua model đã vượt limit
        if (this.modelUsageCount[model.name] >= model.rpdLimit) {
          continue;
        }
        
        try {
          const result = await this._callVertexAIAPI(model.name, prompt);
          
          // Tăng bộ đếm khi thành công
          this.modelUsageCount[model.name]++;
          this.currentModelIndex = i;
          
          return result;
          
        } catch (error) {
          lastError = error;
          
          // Log lỗi để debug
          console.error(`Error with model ${model.name}:`, error.message);
          
          // Kiểm tra loại lỗi
          const isQuotaError = error.message?.includes("Rate limit") || 
                                error.message?.includes("quota") ||
                                error.message?.includes("429") ||
                                error.status === 429;
          
          const isNotFoundError = error.message?.includes("404") || 
                                   error.message?.includes("not found") ||
                                   error.status === 404;
          
          if (isQuotaError || isNotFoundError) {
            // Đánh dấu model này đã vượt hạn cho ngày hôm nay
            this.modelUsageCount[model.name] = model.rpdLimit;
          }
        }
      }

      // Nếu tất cả models đã không khả dụng
      throw new Error(`Tất cả Vertex AI models đã hết quota hoặc bị lỗi. Last error: ${lastError?.message}`);

    } finally {
      // resolve the queue after a short delay to maintain spacing
      setTimeout(() => resolveQueue(), 0);
    }
  }

  // Utility delay helper (ms)
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
