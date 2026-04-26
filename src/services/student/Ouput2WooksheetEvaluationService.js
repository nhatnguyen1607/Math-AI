import geminiModelManager from '../gemini/geminiModelManager';

const extractJSON = (text) => {
  try {
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonString = text.substring(startIndex, endIndex + 1);
      return JSON.parse(jsonString);
    }
    return null;
  } catch (error) {
    console.warn('Lỗi khi parse JSON:', error);
    return null;
  }
};

const calculateOverallLevel = (score) => {
  if (score >= 7.5) return 'tốt';
  if (score >= 4) return 'đạt';
  return 'cần cố gắng';
};

const requiresCalculation = (questionText) => {
  if (!questionText) return false;
  const keywords = ['trình bày', 'phép tính', 'cách giải', 'chi tiết', 'bước', 'giải', 'tính', 'biểu diễn'];
  const lowerText = questionText.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
};

const isAnswerOnlyResult = (answer) => {
  if (!answer || typeof answer !== 'string') return false;
  const trimmed = answer.trim();
  if (trimmed.length < 5) return true;
  const shortAnswers = ['có', 'không', 'đúng', 'sai', 'a', 'b', 'c', 'd'];
  if (shortAnswers.includes(trimmed.toLowerCase())) return true;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return true;
  
  const calculationMarkers = ['+', '-', '×', '*', '÷', '/', '=', '→', 'x'];
  const hasMarkers = calculationMarkers.some(marker => trimmed.includes(marker));
  if (!hasMarkers && trimmed.split(/\s+/).length < 3) return true;
  return false;
};

const hasBai3FinalAnswer = (text, questionText = '') => {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.toLowerCase().replace(/\r/g, '').trim();
  if (!normalized || normalized === 'không có') return false;
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return false;

  const lastPart = lines.slice(-2).join(' ');
  const hasConclusionKeyword = /(kết\s*luận|đáp\s*số|vậy|nên|do\s*đó|suy\s*ra|kết\s*quả)/i.test(lastPart);
  const hasComparisonConclusion = /(nhanh\s*hơn|chậm\s*hơn|lớn\s*hơn|nhỏ\s*hơn|nhiều\s*hơn|ít\s*hơn)/i.test(lastPart);
  const hasFinalStatementWithValue = /(là|bằng|chiếm|còn)\s*-?\d+(?:[.,]\d+)?(?:\s*%|\s*[a-zà-ỹ]+)/i.test(lastPart);

  const questionNormalized = String(questionText || '').toLowerCase();
  const requiresComparison = /(so\s*sánh|nhanh\s*hơn|chậm\s*hơn|ai\s+.*nhanh|rô-bốt\s*nào)/i.test(questionNormalized);

  if (requiresComparison) return hasComparisonConclusion;
  return hasConclusionKeyword || hasComparisonConclusion || hasFinalStatementWithValue;
};

const hasMeaningfulExplanation = (text) => {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.toLowerCase().trim();
  if (!normalized || normalized === 'không có' || normalized === '(không có)') return false;
  return normalized.length >= 20;
};

const hasCorrectRobotVelocityComputation = (text) => {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
  const hasAData = normalized.includes('0.36') && normalized.includes('0.05');
  const hasBData = normalized.includes('0.45') && (normalized.includes('1/12') || normalized.includes('0.0833'));
  const hasAResult = /7\.2(?:[^0-9]|$)/.test(normalized);
  const hasBResult = /5\.4(?:[^0-9]|$)/.test(normalized);
  const hasComparison = /(a.*nhanhhon|7\.2>5\.4|5\.4<7\.2|a>b)/i.test(normalized);
  return hasAData && hasBData && hasAResult && hasBResult && hasComparison;
};

export const evaluateWorksheet = async (studentAnswers, worksheet) => {
  try {
    const evaluations = {
      bai_1: await evaluateBai1(studentAnswers, worksheet),
      bai_2: await evaluateBai2(studentAnswers, worksheet),
      bai_3: await evaluateBai3(studentAnswers, worksheet),
      bai_4: await evaluateBai4(studentAnswers, worksheet)
    };

    const tongDiem =
      (evaluations.bai_1?.evaluation?.diem || 0) +
      (evaluations.bai_2?.evaluation?.diem || 0) +
      (evaluations.bai_3?.evaluation?.diem || 0) +
      (evaluations.bai_4?.evaluation?.diem || 0);

    const mucNangLucChung = calculateOverallLevel(tongDiem);
    const nhanXetChung = await generateOverallComment(evaluations, tongDiem, mucNangLucChung);

    return { ...evaluations, tongDiem, mucNangLucChung, nhanXetChung };
  } catch (error) {
    console.error('Error evaluating Output 2:', error);
    return { tongDiem: 0, mucNangLucChung: 'Chưa đánh giá', nhanXetChung: 'Đã xảy ra lỗi trong quá trình chấm bài.' };
  }
};

export const evaluateBai1 = async (studentAnswers, worksheet) => {
  try {
    let selections = studentAnswers?.bai_1?.selections || [];
    if (typeof selections === 'object' && !Array.isArray(selections)) selections = Object.values(selections);
    const questionsList = worksheet?.bai_1?.questions || [];
    const selectedTexts = selections.map((id) => {
      const matchedQ = questionsList.find((item) => item.id === id);
      return matchedQ ? `(${matchedQ.id}) ${matchedQ.text}` : id;
    });

    const prompt = `Bạn là giáo viên chuyên môn cao. PHẢI ĐỐI CHIẾU ID (1,2,3,4).
[BÀI LÀM CỦA HỌC SINH]
${selectedTexts.length > 0 ? selectedTexts.join('\n') : 'Không chọn gì'}

[BAREM CHẤM ĐIỂM (Tối đa 2.5 điểm)]
- Mức Tốt (2.5 điểm): Chọn đúng cả 4 ý: (1), (2), (3), (4).
- Mức Đạt (1.75 điểm): Chỉ chọn đúng 3 ý đầu: (1), (2), (3).
- Mức Cần cố gắng:
  + Chọn đúng 3 ý bất kỳ nhưng thiếu (1) hoặc (2) hoặc (3) -> 0.75 điểm.
  + Chọn đúng 2 ý bất kỳ -> 0.5 điểm.
  + Chọn đúng 1 ý bất kỳ -> 0.25 điểm.
  + Không chọn ý nào -> 0 điểm.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Liệt kê ID học sinh chọn. Đối chiếu barem xác định điểm.",
  "diem": (0, 0.25, 0.5, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Nhận xét xem HS xác định thông số và mối quan hệ đại lượng tốt chưa. Không dùng từ 'barem'."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

export const evaluateBai2 = async (studentAnswers, worksheet) => {
  try {
    const arrangements = studentAnswers?.bai_2?.arrangements || {};
    const questionsList = worksheet?.bai_2?.questions || [];
    const arrangementText = Object.entries(arrangements).map(([key, arr]) => {
      const items = Array.isArray(arr) ? arr : Object.values(arr || {});
      const textItems = items.map(id => {
        const matchedQ = questionsList.find(q => q.id === id);
        return matchedQ ? `(${matchedQ.id}) ${matchedQ.text}` : id;
      });
      return `${key}: ${textItems.join(' → ')}`;
    }).join('\n');

    const prompt = `Bạn là giáo viên chuyên môn cao. CẤM BỊA ĐÁP ÁN.
[CÁC CÁCH LÀM ĐÚNG]
1. (2) → (4) → (8) → (1)
2. (2) → (8) → (4) → (1)
3. (3) → (5) → (7) → (1)
4. (3) → (7) → (5) → (1)

[BÀI LÀM CỦA HỌC SINH]
${arrangementText || 'Không làm bài.'}

[BAREM CHẤM ĐIỂM (Tối đa 2.5 điểm)]
- Mức Tốt (2.5 điểm): Sắp xếp đúng từ 2 cách giải trở lên.
- Mức Đạt (1.75 điểm): Sắp xếp đúng hoàn chỉnh DUY NHẤT 1 cách giải.
- Mức Cần cố gắng (0.75 điểm): Xếp được ít nhất 2 vị trí đúng của các bước giải trong từng cách.
- Mức Cần cố gắng (0 điểm): Không lựa chọn chính xác và xếp sai hoàn toàn cả 3 bước.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đối chiếu thứ tự ID học sinh xếp với các cách giải đúng.",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Đánh giá việc nhận dạng dạng toán. Không dùng từ 'ID', 'barem'."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

export const evaluateBai3 = async (studentAnswers, worksheet) => {
  try {
    const bai_lam = studentAnswers?.bai_3?.bai_lam || 'Không có';
    const giai_thich = studentAnswers?.bai_3?.giai_thich || 'Không có';
    const bai3QuestionText = worksheet?.bai_3?.question || '';
    const hasFinalAnswer = hasBai3FinalAnswer(bai_lam, bai3QuestionText);
    const hasDeterministicCorrectResult = hasCorrectRobotVelocityComputation(bai_lam);
    const explanationOk = hasMeaningfulExplanation(giai_thich);

    const prompt = `Bạn là giáo viên chấm Bài 3. 
[HƯỚNG DẪN GIẢI]
${worksheet.bai_3.explanation}

[BÀI LÀM CỦA HỌC SINH]
Bài giải: ${bai_lam}
Giải thích: ${giai_thich}
Có đáp số/đơn vị?: ${hasFinalAnswer ? 'Có' : 'Không'}

[BAREM CHẤM ĐIỂM (Tối đa 2.5 điểm)]
- Mức Tốt (2.5 điểm): Đúng tất cả bước giải, phép tính và đơn vị; có giải thích hợp lý.
- Mức Đạt (1.75 điểm): Đúng các bước giải, phép tính cơ bản và đơn vị; trình bày rõ ràng.
- Mức Cần cố gắng (0.75 điểm): Thực hiện đúng 2/3 bước giải và phép tính cơ bản.
- Mức Cần cố gắng (0.25 điểm): Thực hiện đúng 1/3 bước giải và phép tính cơ bản.
- Mức Cần cố gắng (0 điểm): Không thực hiện được bước nào hoặc sai hoàn toàn.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đối chiếu phép tính/đơn vị với hướng dẫn. Kiểm tra lập luận.",
  "diem": (0, 0.25, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Nhận xét tính toán và lập luận. Không dùng từ 'barem'."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    let parsed = extractJSON(result.response.text());
    
    if (hasDeterministicCorrectResult && (!parsed || parsed.diem < 1.75)) {
      const score = explanationOk ? 2.5 : 1.75;
      return { evaluation: { 
        diem: score, 
        muc_nang_luc: score === 2.5 ? 'tốt' : 'đạt', 
        nhan_xet: "Học sinh tính đúng vận tốc Rô-bốt A (7,2 km/h) và B (5,4 km/h), kết luận đúng." 
      }};
    }

    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

export const evaluateBai4 = async (studentAnswers, worksheet) => {
  try {
    const bai4Answers = studentAnswers?.bai_4?.answers || {};
    let questionsInfo = '';
    let validationWarnings = ''; // Thêm biến chứa cảnh báo
    
    (worksheet?.bai_4?.questions || []).forEach((q) => {
      const rawAnswer = bai4Answers[q.id];
      const answer = (typeof rawAnswer === 'object' && rawAnswer !== null) ? Object.values(rawAnswer).join('; ') : (rawAnswer || 'trống');
      questionsInfo += `\n- Yêu cầu: ${q.text}\n  HS trả lời: ${answer}\n`;

      // Khôi phục logic sử dụng các hàm bổ trợ để hết lỗi ESLint
      if (requiresCalculation(q.text) && isAnswerOnlyResult(answer)) {
        validationWarnings += `⚠️ CẢNH BÁO: Mục [${q.text}] yêu cầu phép tính nhưng HS chỉ ghi đáp số.\n`;
      }
    });

    const prompt = `Bạn là giáo viên chấm Bài 4. 
[HƯỚNG DẪN GIẢI]
${worksheet.bai_4.explanation}

[BÀI LÀM CỦA HỌC SINH]
${questionsInfo}
${validationWarnings ? `\n[CẢNH BÁO TRÌNH BÀY]\n${validationWarnings}\n` : ''}

[BAREM CHẤM ĐIỂM (Tối đa 2.5 điểm)]
- Mức Tốt (2.5 điểm): Làm được đồng thời cả 3 phần: (a) Kiểm tra đúng; (b) Giải đúng bài toán mở rộng; (c) So sánh hợp lý.
- Mức Đạt (1.75 điểm): Thực hiện được (a) Kiểm tra đúng HOẶC (b) Giải được bài toán mở rộng.
- Mức Cần cố gắng (0.75 điểm): Làm đúng 1 trong 2 ý của câu (a) HOẶC đúng 1 trong 2 cách của câu (b).
- Mức Cần cố gắng (0 điểm): Không làm được (a) và (b), hoặc thiếu trình bày phép tính chi tiết.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Xác định HS hoàn thành các phần a, b, c thế nào. Chú ý cảnh báo thiếu phép tính.",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Đánh giá kỹ năng tự kiểm tra và vận dụng mở rộng. Không dùng từ 'barem'."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

export const generateOverallComment = async (evaluations, tongDiem, mucNangLucChung) => {
  try {
    const feedbacks = [
      evaluations.bai_1?.evaluation?.nhan_xet,
      evaluations.bai_2?.evaluation?.nhan_xet,
      evaluations.bai_3?.evaluation?.nhan_xet,
      evaluations.bai_4?.evaluation?.nhan_xet
    ].filter(Boolean).join(' ');

    const prompt = `Bạn là trợ lý tổng hợp báo cáo. Viết báo cáo NỘI BỘ cho giáo viên.
TỔNG ĐIỂM: ${tongDiem}/10. MỨC: ${mucNangLucChung}.
CHI TIẾT: ${feedbacks}

YÊU CẦU:
- Viết duy nhất 1 đoạn văn 4-6 câu.
- Câu đầu: "Học sinh có tổng điểm ${tongDiem}/10, mức năng lực chung ${mucNangLucChung}."
- Tổng hợp ưu/nhược điểm. Ngôi thứ ba ('học sinh', 'em ấy').
- CẤM: dấu sao (**), tiêu đề, từ 'barem', 'chào em'.`;

    const result = await geminiModelManager.generateContent(prompt);
    return result.response.text().trim() || `Học sinh có tổng điểm ${tongDiem}/10, mức năng lực chung ${mucNangLucChung}.`;
  } catch (error) { return `Học sinh có tổng điểm ${tongDiem}/10, mức năng lực chung ${mucNangLucChung}.`; }
};