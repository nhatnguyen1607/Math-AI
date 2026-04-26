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

const hasBai3FinalAnswer = (text) => {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.toLowerCase().replace(/\r/g, '').trim();
  if (!normalized || normalized === 'không có' || normalized === '(không có)') return false;
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  const lastPart = lines.slice(-2).join(' ');
  const hasConclusionKeyword = /(kết\s*luận|đáp\s*số|vậy|nên|do\s*đó|suy\s*ra|kết\s*quả)/i.test(lastPart);
  const hasComparisonConclusion = /(nhanh\s*hơn|chậm\s*hơn|lớn\s*hơn|nhỏ\s*hơn|nhiều\s*hơn|ít\s*hơn)/i.test(lastPart);
  const hasFinalStatementWithValue = /(là|bằng|chiếm|còn)\s*-?\d+(?:[.,]\d+)?(?:\s*%|\s*[a-zà-ỹ]+)/i.test(lastPart);
  if (hasComparisonConclusion) return true;
  if (hasConclusionKeyword && /\d+(?:[.,]\d+)?/.test(lastPart)) return true;
  if (hasFinalStatementWithValue) return true;
  return false;
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
    console.error('Error evaluating Output 1:', error);
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

    const prompt = `Bạn là giáo viên chuyên môn cao. CẤM BỊA ĐÁP ÁN. PHẢI ĐỐI CHIẾU ID (1,2,3,4).
[BÀI LÀM CỦA HỌC SINH]
${selectedTexts.length > 0 ? selectedTexts.join('\n') : 'Học sinh không chọn gì'}

[BAREM CHẤM ĐIỂM BẮT BUỘC (Tối đa 2.5 điểm)]
- Mức Tốt (2.5 điểm): Chọn đúng cả 4 ý: (1), (2), (3) và (4).
- Mức Đạt (1.75 điểm): Chỉ chọn đúng 3 ý đầu: (1), (2) và (3).
- Mức Cần cố gắng (0.75 điểm): Chọn đúng 3 ý bất kỳ nhưng THIẾU ít nhất một trong các ý (1), (2) hoặc (3).
- Mức Cần cố gắng (0.5 điểm): Chọn đúng đúng 2 ý bất kỳ trong 4 ý.
- Mức Cần cố gắng (0.25 điểm): Chọn đúng đúng 1 ý bất kỳ trong 4 ý.
- Mức Cần cố gắng (0 điểm): Không chọn được ý nào hoặc sai hết.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Liệt kê các ID học sinh chọn. Đối chiếu với barem (1,2,3,4). Xác định mức điểm phù hợp.",
  "diem": (0, 0.25, 0.5, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Nhận xét xem học sinh đã xác định được thông tin (1,2), yêu cầu (3) và mối quan hệ đại lượng (4) chưa. TUYỆT ĐỐI KHÔNG dùng từ 'ID', 'barem'."
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

    const prompt = `Bạn là giáo viên chuyên môn cao. PHẢI ĐỐI CHIẾU CHÍNH XÁC THỨ TỰ ID.
[QUY TRÌNH CHUẨN]
${worksheet.bai_2.explanation}
- Cách giải 1: (2) → (3) → (1)
- Cách giải 2: (4) → (1) → (5)

[BÀI LÀM CỦA HỌC SINH]
${arrangementText || 'Không thực hiện sắp xếp.'}

[BAREM CHẤM ĐIỂM (Tối đa 2.5 điểm)]
- Mức Tốt (2.5 điểm): Sắp xếp đúng hoàn chỉnh cả 2 cách giải nêu trên.
- Mức Đạt (1.75 điểm): Sắp xếp đúng thứ tự giải của DUY NHẤT 1 CÁCH: hoặc (2)→(3)→(1) hoặc (4)→(1)→(5).
- Mức Cần cố gắng (0.75 điểm): Chưa xong cách nào nhưng xếp được ít nhất 2 vị trí đúng trong tiến trình giải.
- Mức Cần cố gắng (0 điểm): Không lựa chọn chính xác và xếp sai thứ tự cả 3 bước, hoặc không làm.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Phân tích thứ tự ID học sinh đã xếp so với (2-3-1) và (4-1-5). Đếm số cách hoàn thành hoặc số vị trí đúng.",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Nhận xét việc nhận dạng dạng toán và lựa chọn phép tính phù hợp. TUYỆT ĐỐI KHÔNG dùng từ 'ID', 'barem'."
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
    const hasFinalAnswer = hasBai3FinalAnswer(bai_lam);

    const prompt = `Bạn là giáo viên chuyên môn cao chấm bài tự luận.
[HƯỚNG DẪN GIẢI CHUẨN]
${worksheet.bai_3.explanation}

[BÀI LÀM CỦA HỌC SINH]
- Bài giải: ${bai_lam}
- Giải thích: ${giai_thich}
- Có đáp số/kết luận?: ${hasFinalAnswer ? 'Có' : 'Không'}

[BAREM CHẤM ĐIỂM (Tối đa 2.5 điểm)]
- Mức Tốt (2.5 điểm): Thực hiện đúng các bước giải, phép tính và đơn vị; trình bày rõ ràng; CÓ phần Giải thích rõ ràng, hợp lý và liên quan trực tiếp đến toàn bộ các bước đã giải.
- Mức Đạt (1.75 điểm): Thực hiện đúng các bước giải và phép tính cơ bản; trình bày lời giải rõ ràng, đầy đủ. LƯU Ý: Nếu phần giải thích nửa vời, không đúng trọng tâm, hoặc chỉ giải thích được 1 bước trong cách giải thì CHỈ được cho mức Đạt (1.75 điểm) dù tính toán đúng.
- Mức Cần cố gắng (0.75 điểm): Thực hiện đúng 2/3 bước giải và phép tính tương ứng.
- Mức Cần cố gắng (0.25 điểm): Thực hiện đúng 1/3 bước giải và phép tính tương ứng.
- Mức Cần cố gắng (0 điểm): Không thực hiện được bước nào hoặc sai hoàn toàn.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "So sánh các phép tính với hướng dẫn giải. Đặc biệt kiểm tra kỹ phần Giải thích: phải rõ ràng, hợp lý và liên quan tới toàn bài mới cho mức Tốt (2.5). Nếu giải thích sơ sài hoặc nửa vời, hãy chốt mức Đạt (1.75) hoặc thấp hơn.",
  "diem": (0, 0.25, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu báo cáo (ngôi thứ 3). Nhận xét kỹ về năng lực tính toán, cách trình bày và đặc biệt là tính logic của phần giải thích. TUYỆT ĐỐI KHÔNG dùng từ 'barem'."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

// Tiêu chí 4: Kiểm tra được giải pháp đã thực hiện
export const evaluateBai4 = async (studentAnswers, worksheet) => {
  try {
    const bai4Answers = studentAnswers?.bai_4?.answers || {};
    let questionsInfo = '';
    let validationWarnings = '';
    
    (worksheet?.bai_4?.questions || []).forEach((q) => {
      const rawAnswer = bai4Answers[q.id];
      const answer = (typeof rawAnswer === 'object' && rawAnswer !== null) ? Object.values(rawAnswer).join('; ') : (rawAnswer || 'trống');
      questionsInfo += `\n- Nội dung yêu cầu: ${q.text}\n  HS trả lời: ${answer}\n`;
      if (requiresCalculation(q.text) && isAnswerOnlyResult(answer)) {
        validationWarnings += `⚠️ CẢNH BÁO: Mục [${q.text}] yêu cầu phép tính nhưng HS chỉ ghi đáp số.\n`;
      }
    });

    const prompt = `Bạn là giáo viên chuyên môn cao.
[HƯỚNG DẪN GIẢI]
${worksheet.bai_4.explanation}

[BÀI LÀM CỦA HỌC SINH]
${questionsInfo}
${validationWarnings}

[BAREM CHẤM ĐIỂM (Tối đa 2.5 điểm)]
- Mức Tốt (2.5 điểm): Làm được đồng thời: Kiểm tra đúng kết quả (câu a); Giải đúng bài toán mở rộng (câu b); So sánh hoặc giải thích được cách giải hợp lý hơn (câu c).
- Mức Đạt (1.75 điểm): Thực hiện được MỘT trong hai yêu cầu lớn: Kiểm tra được kết quả bài toán bằng phép tính (a) HOẶC Giải được bài toán mở rộng (b).
- Mức Cần cố gắng (0.75 điểm): Làm được 2 ý đầu của câu (a) HOẶC làm đúng 1 trong 2 cách của câu (b).
- Mức Cần cố gắng (0 điểm): Không kiểm tra đúng kết quả (a) và không giải được bài toán mở rộng (b), hoặc sai hoàn toàn.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Xác định xem HS đã hoàn thành phần (a), (b) hay (c). Đối chiếu lỗi thiếu phép tính nếu có.",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 4-5 câu báo cáo (ngôi thứ 3). Đánh giá kỹ năng tự kiểm tra và vận dụng mở rộng kiến thức. TUYỆT ĐỐI KHÔNG dùng từ 'barem'."
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