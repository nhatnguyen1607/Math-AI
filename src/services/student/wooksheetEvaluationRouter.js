import * as InputService from './InputWorksheetEvaluationService';
import * as Output1Service from './Ouput1WooksheetEvaluationService copy';
import * as Output2Service from './Ouput2WooksheetEvaluationService';

export const getEvaluationService = (worksheet) => {
  const title = (worksheet?.title || worksheet?.name || '').toLowerCase();
  
  // Phát hiện Phiếu 1: "Bài 40: Tìm tỉ số phần trăm của hai số (tiết 2)"
  if (title.includes('bài 40') || title.includes('tỉ số phần trăm')) {
    console.log('✅ Routing to Output1WorksheetEvaluationService (Phiếu 1 - Bài 40)');
    return Output1Service;
  }
  
  // Phát hiện Phiếu 2: "Bài 59: Vận tốc của một chuyển động đều (tiết 2)"
  if (title.includes('bài 59') || title.includes('vận tốc')) {
    console.log('✅ Routing to Output2WorksheetEvaluationService (Phiếu 2 - Bài 59)');
    return Output2Service;
  }

  // Mặc định trả về InputService nếu không khớp
  console.log('❌ Routing to default InputWorksheetEvaluationService');
  return InputService;
};