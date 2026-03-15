/**
 * Service Router - Chọn service phù hợp dựa trên chủ đề
 * Educational Architect 2026
 */

import { GeminiPracticeServiceTimeVelocity } from "./geminiPracticeServiceTimeVelocity";
import { GeminiPracticeServiceTiSo } from "./geminiPracticeServiceTiSo";
import { GeminiPracticeService } from "./geminiPracticeService";

import { GeminiChatServiceTimeVelocity } from "./geminiChatServiceTimeVelocity";
import { GeminiChatServiceTiSo } from "./geminiChatServiceTiSo";

/**
 * Router cho Practice Service
 * Phát hiện chủ đề và chọn service tương ứng
 */
export class PracticeServiceRouter {
  _detectTopic(topicName) {
    console.log('🔍 [PracticeRouter] Detecting topic:', topicName);
    
    if (!topicName || typeof topicName !== 'string') {
      console.warn('⚠️ [PracticeRouter] Invalid topic name, using default');
      return 'default';
    }
    
    const topic = topicName.toLowerCase().trim();
    console.log('📝 [PracticeRouter] Normalized topic:', topic);
    
    // Topics liên quan Chuyển động đều
    if (topic.includes('vận tốc') || topic.includes('quãng đường') || 
        topic.includes('thời gian') || topic.includes('chuyển động')) {
      console.log('✅ [PracticeRouter] → Detected: TIME-VELOCITY');
      return 'time-velocity';
    }
    
    // Topics liên quan Tỉ số
    if (topic.includes('tỉ số') || topic.includes('chia theo tỉ') || 
        topic.includes('tỉ lệ') || topic.includes('phần trăm') ||
        topic.includes('so sánh tỉ')) {
      console.log('✅ [PracticeRouter] → Detected: TỈ SỐ');
      return 'ti-so';
    }
    
    console.log('✅ [PracticeRouter] → Detected: DEFAULT');
    return 'default';
  }

  getService(topicName) {
    const topic = this._detectTopic(topicName);
    console.log(`🎯 [PracticeRouter] Getting service for topic: ${topic}`);
    
    let service;
    switch (topic) {
      case 'time-velocity':
        service = new GeminiPracticeServiceTimeVelocity();
        console.log('✅ [PracticeRouter] → Instantiated: GeminiPracticeServiceTimeVelocity');
        return service;
      case 'ti-so':
        service = new GeminiPracticeServiceTiSo();
        console.log('✅ [PracticeRouter] → Instantiated: GeminiPracticeServiceTiSo');
        return service;
      default:
        service = new GeminiPracticeService();
        console.log('✅ [PracticeRouter] → Instantiated: GeminiPracticeService (default)');
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
    console.log('🔍 [ChatRouter] Detecting topic:', topicName);
    
    if (!topicName || typeof topicName !== 'string') {
      console.warn('⚠️ [ChatRouter] Invalid topic name, using default');
      return 'default';
    }
    
    const topic = topicName.toLowerCase().trim();
    console.log('📝 [ChatRouter] Normalized topic:', topic);
    
    // Topics liên quan Chuyển động đều
    const isVelocity = topic.includes('vận tốc') || topic.includes('quãng đường') || 
        topic.includes('thời gian') || topic.includes('chuyển động');
    console.log('🚗 [ChatRouter] Velocity check:', isVelocity, {
      'vận tốc': topic.includes('vận tốc'),
      'quãng đường': topic.includes('quãng đường'),
      'thời gian': topic.includes('thời gian'),
      'chuyển động': topic.includes('chuyển động')
    });
    
    if (isVelocity) {
      console.log('✅ [ChatRouter] → Detected: TIME-VELOCITY');
      return 'time-velocity';
    }
    
    // Topics liên quan Tỉ số
    const isTiSo = topic.includes('tỉ số') || topic.includes('chia theo tỉ') || 
        topic.includes('tỉ lệ') || topic.includes('phần trăm') ||
        topic.includes('so sánh tỉ');
    console.log('📊 [ChatRouter] TiSo check:', isTiSo, {
      'tỉ số': topic.includes('tỉ số'),
      'chia theo tỉ': topic.includes('chia theo tỉ'),
      'tỉ lệ': topic.includes('tỉ lệ'),
      'phần trăm': topic.includes('phần trăm'),
      'so sánh tỉ': topic.includes('so sánh tỉ')
    });
    
    if (isTiSo) {
      console.log('✅ [ChatRouter] → Detected: TỈ SỐ');
      return 'ti-so';
    }
    
    console.log('✅ [ChatRouter] → Detected: DEFAULT');
    return 'default';
  }

  getService(topicName) {
    const topic = this._detectTopic(topicName);
    console.log(`🎯 [ChatRouter] Getting service for topic: ${topic}`);
    
    let service;
    switch (topic) {
      case 'time-velocity':
        service = new GeminiChatServiceTimeVelocity();
        console.log('✅ [ChatRouter] → Instantiated: GeminiChatServiceTimeVelocity');
        console.log('🔧 [ChatRouter] Service object:', service);
        return service;
      case 'ti-so':
        service = new GeminiChatServiceTiSo();
        console.log('✅ [ChatRouter] → Instantiated: GeminiChatServiceTiSo');
        console.log('🔧 [ChatRouter] Service object methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(service)));
        return service;
      default:
        console.log('⚠️ [ChatRouter] → No service found, returning null (default)');
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
