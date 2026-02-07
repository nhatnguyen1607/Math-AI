/**
 * API Key Manager
 * Quản lý nhiều API keys và tự động rotate khi hết quota
 */
class APIKeyManager {
  constructor() {
    // Load tất cả API keys từ environment variables
    this.apiKeys = [
      process.env.REACT_APP_GEMINI_API_KEY_1 || '',
      process.env.REACT_APP_GEMINI_API_KEY_2 || '',
      process.env.REACT_APP_GEMINI_API_KEY_3 || '',
      process.env.REACT_APP_GEMINI_API_KEY_4 || '',
      process.env.REACT_APP_GEMINI_API_KEY_5 || '',
      process.env.REACT_APP_GEMINI_API_KEY_6 || '',
      process.env.REACT_APP_GEMINI_API_KEY_7 || '',
      process.env.REACT_APP_GEMINI_API_KEY_8 || '',
      process.env.REACT_APP_GEMINI_API_KEY_9 || '',
      process.env.REACT_APP_GEMINI_API_KEY_10 || '',
    ].filter(key => key !== ''); // Lọc ra những key có giá trị

    // Cấu hình cho từng key
    this.keyConfigs = this.apiKeys.map((key, index) => ({
      key,
      index,
      name: `KEY_${index + 1}`,
      requestCount: 0,
      quotaExceeded: false,
      lastError: null,
      lastErrorTime: null,
      isActive: true
    }));

    this.currentKeyIndex = 0;
    this.totalRequests = 0;
    this.lastResetDate = new Date().toDateString();
    this.keyRotationLog = [];
  }

  /**
   * Lấy API key hiện tại
   */
  getCurrentKey() {
    const config = this.keyConfigs[this.currentKeyIndex];
    if (!config || !config.isActive) {
      throw new Error('No active API keys available');
    }
    return config.key;
  }

  /**
   * Lấy thông tin key hiện tại
   */
  getCurrentKeyInfo() {
    return {
      ...this.keyConfigs[this.currentKeyIndex],
      key: '***' + this.keyConfigs[this.currentKeyIndex].key.slice(-4)
    };
  }

  /**
   * Tăng bộ đếm yêu cầu cho key hiện tại
   */
  incrementRequestCount() {
    this._checkAndResetDailyCount();
    const config = this.keyConfigs[this.currentKeyIndex];
    if (config) {
      config.requestCount++;
      this.totalRequests++;
    }
  }

  /**
   * Đánh dấu key hiện tại đã hết quota
   */
  markKeyAsExhausted(error = null) {
    const config = this.keyConfigs[this.currentKeyIndex];
    if (config) {
      config.quotaExceeded = true;
      config.lastError = error?.message || 'Quota exceeded';
      config.lastErrorTime = new Date();
      
      console.warn(`⚠️ [${config.name}] Marked as exhausted. Error: ${config.lastError}`);
      
      this.keyRotationLog.push({
        timestamp: new Date().toISOString(),
        keyName: config.name,
        reason: error?.message || 'Quota exceeded',
        requestCount: config.requestCount
      });
    }
  }

  /**
   * Chuyển sang key tiếp theo
   * @returns {boolean} true nếu chuyển thành công, false nếu không có key khác khả dụng
   */
  rotateToNextKey() {
    const startIndex = this.currentKeyIndex;
    let nextIndex = (this.currentKeyIndex + 1) % this.keyConfigs.length;

    // Tìm key tiếp theo chưa exhausted
    while (nextIndex !== startIndex) {
      const config = this.keyConfigs[nextIndex];
      if (config && config.isActive && !config.quotaExceeded) {
        this.currentKeyIndex = nextIndex;
        return true;
      }
      nextIndex = (nextIndex + 1) % this.keyConfigs.length;
    }

    // Nếu không tìm được key có sẵn, reset một key để thử lại
    const exhaustedKey = this.keyConfigs[startIndex];
    if (exhaustedKey) {
      console.warn(`⚠️ All keys exhausted, attempting to reset ${exhaustedKey.name}...`);
      exhaustedKey.quotaExceeded = false;
      exhaustedKey.requestCount = 0;
      return true;
    }

    console.error('❌ No keys available for rotation');
    return false;
  }

  /**
   * Reset bộ đếm nếu sang ngày mới
   */
  _checkAndResetDailyCount() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.keyConfigs.forEach(config => {
        config.requestCount = 0;
        config.quotaExceeded = false;
        config.lastError = null;
      });
      this.totalRequests = 0;
      this.lastResetDate = today;
      this.currentKeyIndex = 0;
    }
  }

  /**
   * Lấy thông tin sử dụng của tất cả keys
   */
  getUsageStats() {
    try {
      return this.keyConfigs.map(config => ({
        name: config.name,
        shortKey: '***' + config.key.slice(-4),
        requestCount: config.requestCount,
        quotaExceeded: config.quotaExceeded,
        isActive: config.isActive,
        lastError: config.lastError,
        lastErrorTime: config.lastErrorTime?.toLocaleString() || null
      }));
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return [];
    }
  }

  /**
   * Lấy log rotation key
   */
  getRotationLog() {
    return this.keyRotationLog.slice(-20); // Trả về 20 lần rotate gần nhất
  }

  /**
   * Reset toàn bộ (dùng cho testing)
   */
  reset() {
    this.keyConfigs.forEach(config => {
      config.requestCount = 0;
      config.quotaExceeded = false;
      config.lastError = null;
      config.lastErrorTime = null;
    });
    this.currentKeyIndex = 0;
    this.totalRequests = 0;
    this.keyRotationLog = [];
  }

  /**
   * Kiểm tra có key nào còn khả dụng không
   */
  hasAvailableKeys() {
    return this.keyConfigs.some(config => !config.quotaExceeded && config.isActive);
  }

  /**
   * Lấy số lượng keys còn khả dụng
   */
  getAvailableKeyCount() {
    return this.keyConfigs.filter(config => !config.quotaExceeded && config.isActive).length;
  }
}

const apiKeyManager = new APIKeyManager();
export default apiKeyManager;
