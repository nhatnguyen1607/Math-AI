/**
 * Service Router - Chọn service phù hợp dựa trên chủ đề
 * Educational Architect 2026
 */

import { GeminiPracticeServiceTimeVelocity } from "./gemini/geminiPracticeServiceTimeVelocity";
import { GeminiPracticeServiceTiSo } from "./gemini/geminiPracticeServiceTiSo";
import { GeminiPracticeServiceSoThapPhan } from "./gemini/geminiPracticeServiceSoThapPhan";
import { GeminiPracticeService } from "./gemini/geminiPracticeService";

import { GeminiChatServiceTimeVelocity } from "./gemini/geminiChatServiceTimeVelocity";
import { GeminiChatServiceTiSo } from "./gemini/geminiChatServiceTiSo";
import { GeminiChatServiceSoThapPhan } from "./gemini/geminiChatServiceSoThapPhan";

/**
 * Router cho Practice Service
 * Phát hiện chủ đề và chọn service tương ứng
 */
export class PracticeServiceRouter {
  _detectTopic(topicName) {
    
    if (!topicName || typeof topicName !== 'string') {
      return 'default';
    }
    
    const topic = topicName.toLowerCase().trim();
    
    // Topics liên quan Chuyển động đều
    if (topic.includes('vận tốc') || topic.includes('quãng đường') || 
        topic.includes('thời gian') || topic.includes('chuyển động')) {
      return 'time-velocity';
    }
    
    // Topics liên quan Tỉ số
    if (topic.includes('tỉ số') || topic.includes('chia theo tỉ') || 
        topic.includes('tỉ lệ') || topic.includes('phần trăm') ||
        topic.includes('so sánh tỉ')) {
      return 'ti-so';
    }

    // Topics liên quan Số thập phân
    if (topic.includes('số thập phân') || topic.includes('thập phân') || 
        topic.includes('decimal') || topic.includes('phép tính thập phân') ||
        topic.includes('cộng thập phân') || topic.includes('trừ thập phân') ||
        topic.includes('nhân thập phân') || topic.includes('chia thập phân') ||
        topic.includes('dấu phẩy')) {
      return 'decimal';
    }
    
    return 'default';
  }

  getService(topicName) {
    const topic = this._detectTopic(topicName);
    
    let service;
    switch (topic) {
      case 'time-velocity':
        service = new GeminiPracticeServiceTimeVelocity();
        return service;
      case 'ti-so':
        service = new GeminiPracticeServiceTiSo();
        return service;
      case 'decimal':
        service = new GeminiPracticeServiceSoThapPhan();
        return service;
      default:
        service = new GeminiPracticeService();
        return service;
    }
  }
}

/**
 * Router cho Chat Service
 * Phát hiện chủ đề và chọn service tương ứng
 */
export class ChatServiceRouter {
  _detectTopic(topicName) {
    
    if (!topicName || typeof topicName !== 'string') {
      return 'default';
    }
    
    const topic = topicName.toLowerCase().trim();
    
    // Topics liên quan Chuyển động đều
    const isVelocity = topic.includes('vận tốc') || topic.includes('quãng đường') || 
        topic.includes('thời gian') || topic.includes('chuyển động');
    
    if (isVelocity) {
      return 'time-velocity';
    }
    
    // Topics liên quan Tỉ số
    const isTiSo = topic.includes('tỉ số') || topic.includes('chia theo tỉ') || 
        topic.includes('tỉ lệ') || topic.includes('phần trăm') ||
        topic.includes('so sánh tỉ');
    
    if (isTiSo) {
      return 'ti-so';
    }
    
    // Topics liên quan Số thập phân
    const isDecimal = topic.includes('số thập phân') || topic.includes('thập phân') || 
        topic.includes('decimal') || topic.includes('phép tính thập phân') ||
        topic.includes('cộng thập phân') || topic.includes('trừ thập phân') ||
        topic.includes('nhân thập phân') || topic.includes('chia thập phân') ||
        topic.includes('dấu phẩy');
    
    if (isDecimal) {
      return 'decimal';
    }
    
    return 'default';
  }

  getService(topicName) {
    const topic = this._detectTopic(topicName);
    
    let service;
    switch (topic) {
      case 'time-velocity':
        service = new GeminiChatServiceTimeVelocity();
        return service;
      case 'ti-so':
        service = new GeminiChatServiceTiSo();
        return service;
      case 'decimal':
        service = new GeminiChatServiceSoThapPhan();
        return service;
      default:
        return null;
    }
  }
}

// Export singletons
export const practiceServiceRouter = new PracticeServiceRouter();
export const chatServiceRouter = new ChatServiceRouter();

// Export default with variable assignment (ESLint best practice)
const serviceRouters = {
  practiceServiceRouter,
  chatServiceRouter,
  PracticeServiceRouter,
  ChatServiceRouter
};

export default serviceRouters;
