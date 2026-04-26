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

// Tiêu chí 1: Nhận biết được vấn đề cần giải quyết
export const evaluateBai1 = async (studentAnswers, worksheet) => {
  try {
    let selections = studentAnswers?.bai_1?.selections || [];
    if (typeof selections === 'object' && !Array.isArray(selections)) selections = Object.values(selections);
    const questionsList = worksheet?.bai_1?.questions || [];
    const selectedTexts = selections.map((id) => {
      const matchedQ = questionsList.find((item) => item.id === id);
      return matchedQ ? `(${matchedQ.id}) ${matchedQ.text}` : id;
    });

    const prompt = `Bạn là giáo viên chấm Bài 1. PHẢI ĐỐI CHIẾU ID (1,2,3,4).
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
  "suy_luan": "Liệt kê các ID học sinh đã chọn. Đối chiếu với barem để xác định điểm.",
  "diem": (0, 0.25, 0.5, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo giáo viên (ngôi thứ 3). Nhận xét xem học sinh xác định được thông tin đã cho (1,2), yêu cầu (3) và mối quan hệ đại lượng (4) chưa. TUYỆT ĐỐI KHÔNG dùng từ 'barem'."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

// Tiêu chí 2: Nêu được cách thức GQVĐ
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
- Mức Tốt (2.5 điểm): Sắp xếp đúng từ 2 cách giải trở lên trong số các cách trên.
- Mức Đạt (1.75 điểm): Sắp xếp đúng hoàn chỉnh DUY NHẤT 1 cách giải.
- Mức Cần cố gắng (0.75 điểm): Xếp được ít nhất 2 vị trí đúng của các bước giải trong từng cách.
- Mức Cần cố gắng (0 điểm): Không lựa chọn chính xác và xếp sai hoàn toàn cả 3 bước trong cùng 1 cách.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đối chiếu thứ tự ID học sinh xếp với các cách giải đúng. Đếm số cách đúng hoàn toàn.",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Đánh giá việc nhận dạng dạng toán và lựa chọn phép tính. TUYỆT ĐỐI KHÔNG dùng từ 'ID', 'barem'."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

// Tiêu chí 3: Trình bày được cách thức GQVĐ
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
- Mức Tốt (2.5 điểm): Đúng tất cả bước giải, phép tính và đơn vị; trình bày rõ ràng; có giải thích/lập luận hợp lý.
- Mức Đạt (1.75 điểm): Đúng các bước giải, phép tính cơ bản và đơn vị; trình bày lời giải rõ ràng, đầy đủ.
- Mức Cần cố gắng (0.75 điểm): Thực hiện đúng 2/3 bước giải và phép tính cơ bản của bước đó.
- Mức Cần cố gắng (0.25 điểm): Thực hiện đúng 1/3 bước giải và phép tính cơ bản của bước đó.
- Mức Cần cố gắng (0 điểm): Không thực hiện được bước nào hoặc sai hoàn toàn.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đối chiếu phép tính và đơn vị với hướng dẫn giải. Kiểm tra logic trình bày và lập luận.",
  "diem": (0, 0.25, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Nhận xét tính toán, trình bày và lập luận. TUYỆT ĐỐI KHÔNG dùng từ 'barem'."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    let parsed = extractJSON(result.response.text());
    
    // Logic chốt cứng cho dữ liệu Vận tốc Rô-bốt
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

// Tiêu chí 4: Kiểm tra được giải pháp đã thực hiện
export const evaluateBai4 = async (studentAnswers, worksheet) => {
  try {
    const bai4Answers = studentAnswers?.bai_4?.answers || {};
    let questionsInfo = '';
    
    (worksheet?.bai_4?.questions || []).forEach((q) => {
      const rawAnswer = bai4Answers[q.id];
      const answer = (typeof rawAnswer === 'object' && rawAnswer !== null) ? Object.values(rawAnswer).join('; ') : (rawAnswer || 'trống');
      questionsInfo += `\n- Yêu cầu: ${q.text}\n  HS trả lời: ${answer}\n`;
    });

    const prompt = `Bạn là giáo viên chấm Bài 4. 
[HƯỚNG DẪN GIẢI]
${worksheet.bai_4.explanation}

[BÀI LÀM CỦA HỌC SINH]
${questionsInfo}

[BAREM CHẤM ĐIỂM (Tối đa 2.5 điểm)]
- Mức Tốt (2.5 điểm): Làm được đồng thời: Kiểm tra đúng kết quả (câu a); Giải đúng bài toán mở rộng (câu b); So sánh hoặc giải thích được cách giải hợp lý hơn (câu c).
- Mức Đạt (1.75 điểm): Thực hiện được MỘT trong hai yêu cầu lớn: Kiểm tra được kết quả bài toán (a) HOẶC Giải được bài toán mở rộng (b).
- Mức Cần cố gắng (0.75 điểm): Làm đúng 1 trong 2 ý của câu (a) HOẶC đúng 1 trong 2 cách của câu (b).
- Mức Cần cố gắng (0 điểm): Không kiểm tra đúng kết quả (a) và không giải được bài toán mở rộng (b).

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Xác định học sinh đã hoàn thành các phần a, b, c ở mức độ nào để cho điểm.",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Đánh giá kỹ năng tự kiểm tra và vận dụng mở rộng. TUYỆT ĐỐI KHÔNG dùng từ 'barem'."
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

    const prompt = `Bạn là trợ lý tổng hợp báo cáo giáo dục. Viết báo cáo NỘI BỘ cho giáo viên.
TỔNG ĐIỂM: ${tongDiem}/10. MỨC: ${mucNangLucChung}.
CHI TIẾT: ${feedbacks}

YÊU CẦU:
- Viết duy nhất 1 đoạn văn 4-6 câu.
- Câu đầu: "Học sinh có tổng điểm ${tongDiem}/10, mức năng lực chung ${mucNangLucChung}."
- Tổng hợp ưu/nhược điểm từ 4 tiêu chí trên. Đưa ra lời khuyên bồi dưỡng cụ thể.
- Ngôi thứ ba ('học sinh', 'em ấy'). Không xưng hô trực tiếp.
- TRÌNH BÀY VĂN BẢN THUẦN TÚY, CẤM: dấu sao (**), tiêu đề, từ 'barem', 'chào em'.`;

    const result = await geminiModelManager.generateContent(prompt);
    return result.response.text().trim() || `Học sinh đạt tổng điểm ${tongDiem}/10 với mức năng lực ${mucNangLucChung}.`;
  } catch (error) { return `Học sinh đạt tổng điểm ${tongDiem}/10 với mức năng lực ${mucNangLucChung}.`; }
};