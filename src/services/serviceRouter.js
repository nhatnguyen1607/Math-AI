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
      console.log('🔴 [PracticeServiceRouter._detectTopic] Invalid topicName:', topicName, 'typeof:', typeof topicName);
      return 'default';
    }
    
    const topic = topicName.toLowerCase().trim();
    console.log('🟡 [PracticeServiceRouter._detectTopic] Input topicName:', topicName);
    console.log('🟡 [PracticeServiceRouter._detectTopic] Normalized topic:', topic);
    
    // Topics liên quan Chuyển động đều
    if (topic.includes('vận tốc') || topic.includes('quãng đường') || 
        topic.includes('thời gian') || topic.includes('chuyển động')) {
      console.log('🟢 [PracticeServiceRouter._detectTopic] Detected topic: time-velocity');
      return 'time-velocity';
    }
    
    // Topics liên quan Tỉ số
    if (topic.includes('tỉ số') || topic.includes('chia theo tỉ') || 
        topic.includes('tỉ lệ') || topic.includes('phần trăm') ||
        topic.includes('so sánh tỉ')) {
      console.log('🟢 [PracticeServiceRouter._detectTopic] Detected topic: ti-so');
      return 'ti-so';
    }

    // Topics liên quan Số thập phân
    if (topic.includes('số thập phân') || topic.includes('thập phân') || 
        topic.includes('decimal') || topic.includes('phép tính thập phân') ||
        topic.includes('cộng thập phân') || topic.includes('trừ thập phân') ||
        topic.includes('nhân thập phân') || topic.includes('chia thập phân') ||
        topic.includes('dấu phẩy')) {
      console.log('🟢 [PracticeServiceRouter._detectTopic] Detected topic: decimal');
      return 'decimal';
    }
    
    console.log('🟠 [PracticeServiceRouter._detectTopic] No match found, returning: default');
    return 'default';
  }

  getService(topicName) {
    const topic = this._detectTopic(topicName);
    console.log('🔵 [PracticeServiceRouter.getService] Returning service for topic:', topic);
    
    let service;
    switch (topic) {
      case 'time-velocity':
        service = new GeminiPracticeServiceTimeVelocity();
        console.log('✅ [PracticeServiceRouter.getService] Instantiated GeminiPracticeServiceTimeVelocity');
        return service;
      case 'ti-so':
        service = new GeminiPracticeServiceTiSo();
        console.log('✅ [PracticeServiceRouter.getService] Instantiated GeminiPracticeServiceTiSo');
        return service;
      case 'decimal':
        service = new GeminiPracticeServiceSoThapPhan();
        console.log('✅ [PracticeServiceRouter.getService] Instantiated GeminiPracticeServiceSoThapPhan');
        return service;
      default:
        service = new GeminiPracticeService();
        console.log('⚠️ [PracticeServiceRouter.getService] Instantiated DEFAULT GeminiPracticeService');
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
      console.log('🔴 [ChatServiceRouter._detectTopic] Invalid topicName:', topicName);
      return 'default';
    }
    
    const topic = topicName.toLowerCase().trim();
    console.log('🟡 [ChatServiceRouter._detectTopic] Input topicName:', topicName);
    console.log('🟡 [ChatServiceRouter._detectTopic] Normalized topic:', topic);
    
    // Topics liên quan Chuyển động đều
    const isVelocity = topic.includes('vận tốc') || topic.includes('quãng đường') || 
        topic.includes('thời gian') || topic.includes('chuyển động');
    
    if (isVelocity) {
      console.log('🟢 [ChatServiceRouter._detectTopic] Detected topic: time-velocity');
      return 'time-velocity';
    }
    
    // Topics liên quan Tỉ số
    const isTiSo = topic.includes('tỉ số') || topic.includes('chia theo tỉ') || 
        topic.includes('tỉ lệ') || topic.includes('phần trăm') ||
        topic.includes('so sánh tỉ');
    
    if (isTiSo) {
      console.log('🟢 [ChatServiceRouter._detectTopic] Detected topic: ti-so');
      return 'ti-so';
    }
    
    // Topics liên quan Số thập phân
    const isDecimal = topic.includes('số thập phân') || topic.includes('thập phân') || 
        topic.includes('decimal') || topic.includes('phép tính thập phân') ||
        topic.includes('cộng thập phân') || topic.includes('trừ thập phân') ||
        topic.includes('nhân thập phân') || topic.includes('chia thập phân') ||
        topic.includes('dấu phẩy');
    
    if (isDecimal) {
      console.log('🟢 [ChatServiceRouter._detectTopic] Detected topic: decimal');
      return 'decimal';
    }
    
    console.log('🟠 [ChatServiceRouter._detectTopic] No match found, returning: default');
    return 'default';
  }

  getService(topicName) {
    const topic = this._detectTopic(topicName);
    console.log('🔵 [ChatServiceRouter.getService] Returning service for topic:', topic);
    
    let service;
    switch (topic) {
      case 'time-velocity':
        service = new GeminiChatServiceTimeVelocity();
        console.log('✅ [ChatServiceRouter.getService] Instantiated GeminiChatServiceTimeVelocity');
        return service;
      case 'ti-so':
        service = new GeminiChatServiceTiSo();
        console.log('✅ [ChatServiceRouter.getService] Instantiated GeminiChatServiceTiSo');
        return service;
      case 'decimal':
        service = new GeminiChatServiceSoThapPhan();
        console.log('✅ [ChatServiceRouter.getService] Instantiated GeminiChatServiceSoThapPhan');
        return service;
      default:
        console.log('⚠️ [ChatServiceRouter.getService] No specialized service, returning null (caller will use fallback)');
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
