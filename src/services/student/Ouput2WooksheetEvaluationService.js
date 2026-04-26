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



// Cập nhật lại hàm kiểm tra cứng để nhận diện chính xác hơn các biến thể của học sinh
const hasCorrectRobotVelocityComputation = (text) => {
  if (!text || typeof text !== 'string') return false;
  // Chuẩn hóa: xóa khoảng trắng, đổi dấu phẩy thành dấu chấm
  const normalized = text.toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
  
  const hasAData = normalized.includes('0.36') && normalized.includes('0.05');
  const hasBData = normalized.includes('0.45') && (normalized.includes('1/12') || normalized.includes('0.0833') || normalized.includes('5phut'));
  
  // Kiểm tra kết quả vận tốc 7.2 và 5.4
  const hasAResult = /7\.2(?:[^0-9]|$)/.test(normalized);
  const hasBResult = /5\.4(?:[^0-9]|$)/.test(normalized);
  
  // Kiểm tra kết luận so sánh (A nhanh hơn)
  const hasComparison = /(a.*nhanhhon|7\.2>5\.4|5\.4<7\.2|a>b|anhanh)/i.test(normalized);
  
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
    
    // 1. Kiểm tra các điều kiện thực tế từ bài làm
    const hasFinalAnswer = hasBai3FinalAnswer(bai_lam, bai3QuestionText);
    const hasDeterministicCorrectResult = hasCorrectRobotVelocityComputation(bai_lam);


    const prompt = `Bạn là giáo viên toán cấp tiểu học chấm bài về Vận tốc. 
QUY TẮC ĐIỂM 0: Nếu học sinh không làm đủ các bước giải quan trọng VÀ không có đáp số/kết luận thì cho 0 điểm ngay lập tức.
LƯU Ý: Phép tính 0,36 / 0,05 = 7,2 (km/h) là ĐÚNG. Tuyệt đối không bắt lỗi con số 0,05 giờ.

[BÀI LÀM CỦA HỌC SINH]
Bài giải: ${bai_lam}
Giải thích: ${giai_thich}
Có đáp số rõ ràng?: ${hasFinalAnswer ? 'Có' : 'Không'}

[BAREM CHẤM ĐIỂM]
- Mức Tốt (2.5 điểm): Đúng tất cả bước giải, phép tính (7,2 và 5,4) và đơn vị; có phần Giải thích rõ ràng, hợp lý và liên quan trực tiếp đến toàn bộ các bước đã giải.
- Mức Đạt (1.75 điểm): Đúng các bước giải, phép tính cơ bản và đơn vị; trình bày rõ ràng. LƯU Ý: Nếu phần giải thích nửa vời, không đúng trọng tâm, hoặc chỉ giải thích được 1 bước trong cách giải thì CHỈ cho mức Đạt (1.75 điểm) dù tính toán đúng.
- Mức Cần cố gắng (0.75 điểm): Thực hiện đúng 2/3 bước giải.
- Mức Cần cố gắng (0.25 điểm): Thực hiện đúng 1/3 bước giải.
- Mức Cần cố gắng (0 điểm): Không làm đủ bước VÀ không có đáp án.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đối chiếu bài làm với hướng dẫn giải. Đặc biệt kiểm tra kỹ phần Giải thích: phải rõ ràng, hợp lý và liên quan tới toàn bài mới cho mức Tốt. Nếu thiếu cả bước tính lẫn đáp số, hãy chốt 0 điểm.",
  "diem": (0, 0.25, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Nhận xét kỹ về năng lực tính toán và chất lượng lập luận/giải thích. Không dùng từ 'barem'."
}`;

    const result = await geminiModelManager.generateContent(prompt);
    let parsed = extractJSON(result.response.text());
    
    // 2. LOGIC OVERRIDE CỨNG THEO YÊU CẦU NGƯỜI DÙNG
    if (parsed && !hasFinalAnswer) {
      if (!hasDeterministicCorrectResult) {
        // Trường hợp: Không đủ bước (không pass test cứng) + Không đáp án = 0 điểm
        parsed.diem = 0;
        parsed.muc_nang_luc = 'cần cố gắng';
        parsed.nhan_xet = "Học sinh chưa hoàn thành các bước tính toán cần thiết và thiếu đáp số cuối cùng cho bài toán, nên chưa đạt yêu cầu.";
      } else {
        // Trường hợp: Tính đúng hết các số (pass test cứng) nhưng quên ghi "Đáp số"
        // Giảm xuống mức 0.75 để nhắc nhở việc thiếu kết luận
        parsed.diem = 1.75;
        parsed.muc_nang_luc = 'đạt';
        parsed.nhan_xet = "Học sinh tính toán đúng kết quả vận tốc của các rô-bốt nhưng còn thiếu câu chốt đáp số hoặc kết luận so sánh cuối cùng.";
      }
    }

    // 3. ĐẢM BẢO KHÔNG BỊ AI BẮT LỖI SAI SỐ 0,05
    if (hasDeterministicCorrectResult) {
      // Nếu AI chấm thấp hơn mức Đạt (1.75) dù đã tính đúng hết các số, ta nâng lên mức Đạt.
      // Tuy nhiên, không tự động nâng lên mức Tốt (2.5) nếu AI đánh giá phần giải thích chưa đạt yêu cầu.
      const minimumScore = 1.75;
      if (!parsed || parsed.diem < minimumScore) {
        return { evaluation: { 
          diem: minimumScore, 
          muc_nang_luc: 'đạt', 
          nhan_xet: "Học sinh thực hiện rất tốt các phép tính: đổi đơn vị đúng, tính chính xác vận tốc hai rô-bốt (7,2 km/h và 5,4 km/h) và đã có kết luận so sánh. Tuy nhiên, em cần chú ý giải thích các bước làm một cách rõ ràng và sâu sắc hơn." 
        }};
      }
    }

    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } };
  } catch (error) { 
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi hệ thống trong quá trình chấm.' } }; 
  }
};

export const evaluateBai4 = async (studentAnswers, worksheet) => {
  try {
    const bai4Answers = studentAnswers?.bai_4?.answers || {};
    let questionsInfo = '';
    let validationWarnings = '';
    
    (worksheet?.bai_4?.questions || []).forEach((q) => {
      const rawAnswer = bai4Answers[q.id];
      const answer = (typeof rawAnswer === 'object' && rawAnswer !== null) ? Object.values(rawAnswer).join('; ') : (rawAnswer || 'trống');
      questionsInfo += `\n- Yêu cầu: ${q.text}\n  HS trả lời: ${answer}\n`;

      if (requiresCalculation(q.text) && isAnswerOnlyResult(answer)) {
        validationWarnings += `⚠️ CẢNH BÁO: Mục [${q.text}] yêu cầu phép tính nhưng HS chỉ ghi đáp số.\n`;
      }
    });

    const prompt = `Bạn là giáo viên chuyên môn cao chấm bài toán Vận tốc nâng cao.
[HƯỚNG DẪN GIẢI CHUẨN]
${worksheet.bai_4.explanation}
- Câu a: HS dùng phép tính ngược (7,2 x 0,05 = 0,36) -> ĐÚNG.
- Câu b: HS phải đề xuất phương án chỉnh thông số. 
  + Cách 1: Giảm thời gian đi 75 giây (hoặc còn 225 giây).
  + Cách 2: Tăng quãng đường thêm 150 m (hoặc thành 600 m).
Nếu thấy HS nêu các con số 75 hoặc 150 kèm theo lập luận tăng/giảm thì đó là phương án ĐÚNG, không được nhận xét là em ấy chỉ mới đổi đơn vị.

[BÀI LÀM CỦA HỌC SINH]
${questionsInfo}
${validationWarnings ? `\n[CẢNH BÁO TRÌNH BÀY]\n${validationWarnings}\n` : ''}

[BAREM CHẤM ĐIỂM]
- Mức Tốt (2.5 điểm): Làm đúng ĐỒNG THỜI cả a, b và c.
- Mức Đạt (1.75 điểm): Thực hiện được MỘT trong hai yêu cầu lớn: (a) Kiểm tra đúng HOẶC (b) Giải được bài toán mở rộng (đề xuất được phương án).
- Mức Cần cố gắng (0.75 điểm): Chỉ làm được một phần nhỏ, chưa hoàn thiện yêu cầu nào.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Phân tích kỹ câu b: Học sinh đã tính ra việc giảm 75 giây và tăng 150m chưa? Nếu rồi thì đây là đề xuất giải pháp đúng. Đối chiếu với yêu cầu tổng thể để cho điểm.",
  "diem": (0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Nhận xét rõ học sinh đã biết dùng phép tính ngược để kiểm tra (câu a) và đã đề xuất được các phương án điều chỉnh thông số thời gian, quãng đường cụ thể (câu b). Nếu câu c trống thì nhắc nhở cần hoàn thiện nốt. TUYỆT ĐỐI KHÔNG nhận xét 'chỉ dừng lại ở đổi đơn vị' nếu em ấy đã tính ra 75 hoặc 150."
}`;

    const result = await geminiModelManager.generateContent(prompt);
    let parsed = extractJSON(result.response.text());
    
    // Logic override: Nếu học sinh có các con số giải pháp của câu b (75 hoặc 150)
    const hasSolutionB = questionsInfo.includes('75') || questionsInfo.includes('150') || questionsInfo.includes('225') || questionsInfo.includes('600');
    const hasCheckA = questionsInfo.includes('7.2') && questionsInfo.includes('0.05') && questionsInfo.includes('0.36');

    if (hasCheckA || hasSolutionB) {
      if (!parsed || parsed.diem < 1.75) {
        return {
          evaluation: {
            diem: 1.75,
            muc_nang_luc: 'đạt',
            nhan_xet: "Học sinh đã thực hiện tốt việc kiểm tra lại kết quả bài toán và đề xuất được các phương án điều chỉnh thông số cụ thể (giảm thời gian hoặc tăng quãng đường) để hai rô-bốt có cùng vận tốc. Tuy nhiên, em ấy cần chú ý hoàn thành nốt phần nhận xét so sánh ở câu cuối để đạt kết quả tối ưu."
          }
        };
      }
    }

    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } };
  } catch (error) { 
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi trong quá trình chấm điểm.' } }; 
  }
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