/**
 * examGeneratorRouter.js
 * 
 * Router để tự động chọn service phù hợp dựa trên lessons/topics
 * Nếu lesson thuộc chủ đề TỈ SỐ → dùng examGeneratorTiSoService
 * Nếu lesson thuộc chủ đề CHUYỂN ĐỘNG → dùng examGeneratorChuyenDongService
 * Các lesson khác → dùng examGeneratorService (default)
 */

import examGeneratorServiceInstance from './examGeneratorService';
import examGeneratorTiSoServiceInstance from './examGeneratorTiSoService';
import examGeneratorChuyenDongServiceInstance from './examGeneratorChuyenDongService';

/**
 * Mapping Lesson Name → Chủ đề
 * Sử dụng lowercase để tìm kiếm case-insensitive
 */
const LESSON_TOPIC_MAP = {
  // TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN (BÀI 36-44)
  'tỉ số': 'tiso',
  'tỉ lệ bản đồ': 'tiso',
  'tìm hai số khi biết tổng và tỉ số': 'tiso',
  'tìm hai số khi biết hiệu và tỉ số': 'tiso',
  'tìm tỉ số phần trăm': 'tiso',
  'tìm giá trị phần trăm': 'tiso',
  'luyện tập tỉ số': 'tiso',
  'ôn tập tỉ số': 'tiso',
  'bài 36': 'tiso',
  'bài 37': 'tiso',
  'bài 38': 'tiso',
  'bài 39': 'tiso',
  'bài 40': 'tiso',
  'bài 41': 'tiso',
  'bài 42': 'tiso',
  'bài 43': 'tiso',
  'bài 44': 'tiso',

  // THỜI GIAN VÀ VẬN TỐC (BÀI 56-60) - SỬ DỤNG CHUYENVDONGSERVICE (LINH HOẠT)
  'đơn vị đo thời gian': 'chuyendong',
  'cộng trừ thời gian': 'chuyendong',
  'nhân chia thời gian': 'chuyendong',
  'vận tốc': 'chuyendong',
  'quãng đường thời gian': 'chuyendong',
  'thời gian': 'chuyendong',
  'chuyển động đều': 'chuyendong',
  's = v × t': 'chuyendong',
  'bài 56': 'chuyendong',
  'bài 57': 'chuyendong',
  'bài 58': 'chuyendong',
  'bài 59': 'chuyendong',
  'bài 60': 'chuyendong',
};

/**
 * Determine which exam generator service to use
 * @param {string} lessonName - Name of the lesson
 * @returns {string} - Service identifier: 'tiso', 'chuyendong', or 'default'
 */
const getTopic = (lessonName) => {
  if (!lessonName) return 'default';

  const normalized = lessonName.toLowerCase().trim();

  // Check for exact or partial match in map
  for (const [keyword, topic] of Object.entries(LESSON_TOPIC_MAP)) {
    if (normalized.includes(keyword)) {
      return topic;
    }
  }

  return 'default';
};

/**
 * Get appropriate exam generator service based on lesson name
 * @param {string} lessonName - Name of the lesson
 * @returns {Object} - Service instance
 */
const getExamGeneratorService = (lessonName) => {
  const topic = getTopic(lessonName);

  switch (topic) {
    case 'tiso':
      return examGeneratorTiSoServiceInstance;
    case 'chuyendong':
      return examGeneratorChuyenDongServiceInstance;
    case 'default':
    default:
      return examGeneratorServiceInstance;
  }
};

/**
 * Generate exam using appropriate service
 * @param {Object} params
 * @param {string} params.topicName - Topic name (e.g., "TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN")
 * @param {string} params.lessonName - Lesson name (e.g., "Bài 36. Tỉ số")
 * @param {Array} params.sampleExams - Sample exams
 * @returns {Promise<Object>} - Generated exam
 */
export const generateExam = async (params) => {
  const { lessonName } = params;
  const service = getExamGeneratorService(lessonName);

  // Initialize if needed
  await service.initialize();

  // Generate exam
  return service.generateExamFromSamples(params);
};

/**
 * Get service info for debugging/logging
 * @param {string} lessonName - Lesson name
 * @returns {Object} - Service info
 */
export const getServiceInfo = (lessonName) => {
  const topic = getTopic(lessonName);
  const service = getExamGeneratorService(lessonName);

  const serviceNames = {
    'tiso': 'ExamGeneratorTiSoService (Tỉ số)',
    'chuyendong': 'ExamGeneratorChuyenDongService (Thời gian - Vận tốc - Chuyển động)',
    'default': 'ExamGeneratorService (Default)'
  };

  return {
    topic,
    serviceName: serviceNames[topic] || 'Unknown',
    service
  };
};

const examGeneratorRouterExport = {
  generateExam,
  getServiceInfo,
  getTopic,
  getExamGeneratorService
};

export default examGeneratorRouterExport;
