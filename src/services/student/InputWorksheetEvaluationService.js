import geminiModelManager from '../gemini/geminiModelManager';

// Hàm hỗ trợ bóc tách JSON an toàn từ phản hồi của AI
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
  const looksLikeOnlyComputation = /[+\-*/×÷:]=?/.test(lastPart) && !hasConclusionKeyword;

  if (hasComparisonConclusion) return true;
  if (hasConclusionKeyword && /\d+(?:[.,]\d+)?/.test(lastPart)) return true;
  if (hasFinalStatementWithValue && !looksLikeOnlyComputation) return true;
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

    return {
      ...evaluations,
      tongDiem,
      mucNangLucChung,
      nhanXetChung
    };
  } catch (error) {
    console.error('Error evaluating worksheet:', error);
    return {
      bai_1: { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi hệ thống' } },
      bai_2: { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi hệ thống' } },
      bai_3: { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi hệ thống' } },
      bai_4: { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi hệ thống' } },
      tongDiem: 0,
      mucNangLucChung: 'Chưa đánh giá',
      nhanXetChung: 'Đã xảy ra lỗi trong quá trình chấm bài.'
    };
  }
};

export const evaluateBai1 = async (studentAnswers, worksheet) => {
  try {
    let selections = studentAnswers?.bai_1?.selections || [];
    if (typeof selections === 'object' && !Array.isArray(selections)) {
      selections = Object.values(selections);
    }
    
    // MAPPING: Dịch ID sang nội dung Text để AI hiểu
    const questionsList = worksheet.bai_1.questions || [];
    const selectedTexts = selections.map((id) => {
      const matchedQ = questionsList.find((item) => item.id === id);
      return matchedQ ? matchedQ.text : id; // Trả về nội dung câu văn, nếu không tìm thấy thì giữ id
    });
    
    // Cung cấp danh sách đầy đủ các phát biểu để AI đối chiếu (1), (2), (3), (4)
    const allQuestionsText = questionsList.map((q, idx) => `(${idx + 1}) ${q.text}`).join('\n');
    
    const prompt = `Bạn là một giáo viên chuyên môn cao đang chấm bài. PHẢI ĐÁNH GIÁ CHÍNH XÁC NĂNG LỰC DỰA VÀO CÂU TRẢ LỜI CỦA HỌC SINH.

[DANH SÁCH CÁC PHÁT BIỂU ĐÚNG CẦN CHỌN]
${allQuestionsText}
Ghi chú: 
- (1) và (2) là thông tin đã cho.
- (3) là yêu cầu của bài toán.
- (4) là mối quan hệ giữa các đại lượng.

[BÀI LÀM THỰC TẾ CỦA HỌC SINH]
Học sinh đã đánh dấu vào các phát biểu sau:
${selectedTexts.length > 0 ? selectedTexts.map(t => `- ${t}`).join('\n') : 'Không chọn gì'}

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Bước 1: Đối chiếu các phát biểu học sinh chọn với danh sách (1, 2, 3, 4). Bước 2: ÁP DỤNG LUẬT CHẤM ĐIỂM SAU:
  - Chọn đúng đủ 4 ý (1, 2, 3, 4) -> 2.5 điểm (Mức tốt).
  - Chọn đúng 3 ý (1, 2, 3) -> 1.75 điểm (Mức đạt).
  - Chọn 3 ý trong 4 ý nhưng thiếu (1) hoặc (2) hoặc (3) -> 0.75 điểm (Mức cần cố gắng).
  - Chọn 2 ý trong 4 ý -> 0.5 điểm (Mức cần cố gắng).
  - Chọn 1 ý trong 4 ý -> 0.25 điểm (Mức cần cố gắng).
  - Không chọn ý nào -> 0 điểm (Mức cần cố gắng).
  Không du di.",
  "diem": (0, 0.25, 0.5, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu SƯ PHẠM báo cáo cho giáo viên. Dùng ngôi thứ 3 ('học sinh', 'em ấy').
  - Nếu đạt 2.5 điểm: 'HS đã xác định được đầy đủ các thông tin đã cho (1,2), yêu cầu của bài toán (3), mối quan hệ giữa các đại lượng (4)'.
  - Nếu đạt 1.75 điểm: 'HS đã xác định được các thông tin đã cho (1,2), yêu cầu của bài toán (3), nhưng chưa chỉ ra được mối quan hệ giữa các đại lượng (4)'.
  - Nếu đạt từ 0 đến 0.75 điểm: 'HS chưa xác định được các thông tin đã cho (1,2), yêu cầu của bài toán (3), mối quan hệ giữa các đại lượng (4)'.
  TUYỆT ĐỐI KHÔNG dùng các từ: 'barem', 'mã định danh', 'ID', 'tiêu chí', 'như máy tính'."
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    
    if (parsed) return { evaluation: { ...parsed, muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng').toLowerCase() } };
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi không thể phân tích kết quả.' } };
  } catch (error) {
    console.error('Error evaluating Bài 1:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi trong quá trình chấm.' } };
  }
};

export const evaluateBai2 = async (studentAnswers, worksheet) => {
  try {
    const arrangements = studentAnswers?.bai_2?.arrangements || {};
    const questionsList = worksheet.bai_2.questions || [];
    
    // Chuyển đổi dữ liệu sắp xếp của học sinh sang dạng text kèm ID để AI đối chiếu chính xác
    const arrangementText = Object.keys(arrangements).length > 0 
      ? Object.entries(arrangements).map(([key, arr]) => {
          const items = Array.isArray(arr) ? arr : Object.values(arr || {});
          const textItems = items.map(id => {
            const matchedQ = questionsList.find(q => q.id === id);
            // Gắn ID vào text để AI khớp với (1), (2), (3)... trong phần giải thích
            return matchedQ ? `(${matchedQ.id}) ${matchedQ.text}` : id;
          });
          return `${key}:\n  -> ${textItems.join('\n  -> ')}`;
        }).join('\n\n')
      : 'Học sinh không có sắp xếp nào.';

    const prompt = `Bạn là một giáo viên chuyên môn cao. CẤM BỊA ĐÁP ÁN. 
Bạn phải dựa vào trình tự các bước giải được quy định dưới đây để chấm bài.

[DỮ LIỆU GỐC & CÁC CÁCH GIẢI ĐÚNG]
${worksheet.bai_2.explanation}

[BÀI LÀM THỰC TẾ CỦA HỌC SINH]
${arrangementText}

[LUẬT CHẤM ĐIỂM BẮT BUỘC]
1. Mức Tốt (2.5 điểm): Sắp xếp đúng hoàn chỉnh từ 2 cách giải trở lên (đúng thứ tự logic và đủ các bước).
2. Mức Đạt (1.75 điểm): Sắp xếp đúng hoàn chỉnh duy nhất 1 cách giải.
3. Mức Cần cố gắng (0.75 điểm): Chưa có cách nào hoàn chỉnh nhưng xếp được ít nhất 2 vị trí đúng trong tiến trình giải.
4. Mức Cần cố gắng (0 điểm): Xếp sai hoàn toàn, thiếu bước trầm trọng hoặc không làm bài.

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Bước 1: Đối chiếu các ID học sinh đã xếp với quy trình trong phần giải thích. Bước 2: Kiểm tra tính đầy đủ của các bước (phải đủ các bước của 1 chu trình mới tính là 1 cách đúng). Bước 3: Đếm số cách đúng và số vị trí đúng để quyết định điểm (0, 0.75, 1.75, 2.5).",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu nhận xét sư phạm ở ngôi thứ ba ('học sinh', 'em ấy'). Nêu rõ em ấy đúng được mấy cách, cách nào còn thiếu bước hoặc sai trình tự. Khuyến khích hoặc nhắc nhở học sinh về việc nhận diện dạng toán 'Tổng - Tỉ'. TUYỆT ĐỐI KHÔNG dùng từ 'barem', 'ID', 'JSON'."
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    
    if (parsed) {
      return { 
        evaluation: { 
          ...parsed, 
          muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng').toLowerCase() 
        } 
      };
    }
    
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi không thể phân tích kết quả.' } };
  } catch (error) {
    console.error('Error evaluating Bài 2:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi trong quá trình chấm.' } };
  }
};

export const evaluateBai3 = async (studentAnswers, worksheet) => {
  try {
    const bai_lam = studentAnswers?.bai_3?.bai_lam || 'Không có';
    const giai_thich = studentAnswers?.bai_3?.giai_thich || 'Không có';
    
    // Kiểm tra sơ bộ sự hiện diện của đáp số/kết luận (giữ nguyên logic check của bạn)
    const hasFinalAnswer = hasBai3FinalAnswer(bai_lam);

    const prompt = `Bạn là một giáo viên chuyên môn cao. Hãy chấm bài tập tự luận của học sinh dựa trên hướng dẫn giải và thang điểm dưới đây.
PHẢI ĐỐI CHIẾU CHÍNH XÁC NỘI DUNG GIẢI THÍCH.

[HƯỚNG DẪN GIẢI CHUẨN (Dùng để đối chiếu)]
${worksheet.bai_3.explanation}

[BÀI LÀM CỦA HỌC SINH]
- Bài giải: ${bai_lam}
- Phần giải thích/Lập luận: ${giai_thich}
- Có đáp số/kết luận cuối cùng không?: ${hasFinalAnswer ? 'Có' : 'Không'}

[THANG ĐIỂM VÀ TIÊU CHÍ (Tối đa 2.5 điểm)]
1. Mức Tốt (2.5 điểm): 
   - Thực hiện đúng tất cả các bước giải và phép tính.
   - Trình bày rõ ràng, đầy đủ.
   - CÓ phần "Giải thích/Lập luận" rõ ràng, hợp lý và liên quan trực tiếp đến toàn bộ các bước đã giải trong bài.
2. Mức Đạt (1.75 điểm): 
   - Thực hiện đúng các bước giải và phép tính cơ bản.
   - Trình bày lời giải rõ ràng, đầy đủ. 
   - LƯU Ý: Nếu phần giải thích nửa vời, không đúng trọng tâm, hoặc chỉ giải thích được 1 bước trong cách giải thì CHỈ được chấm ở mức Đạt (1.75 điểm) dù các bước tính toán khác đều đúng.
3. Mức Cần cố gắng (0 - 0.75 điểm):
   - Thực hiện đúng 2/3 bước giải và phép tính cơ bản -> 0.75 điểm.
   - Thực hiện đúng 1/3 bước giải và phép tính cơ bản -> 0.25 điểm.
   - Không thực hiện được bước nào hoặc tính toán sai hoàn toàn -> 0 điểm.
* LƯU Ý QUAN TRỌNG: Nếu học sinh hoàn toàn không có đáp số hoặc kết luận cuối cùng, hãy trừ điểm nặng hoặc đánh giá ở mức Cần cố gắng tùy theo mức độ hoàn thành các bước trung gian.

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON:
{
  "suy_luan": "Phân tích kỹ phần Bài giải và Giải thích. Kiểm tra xem giải thích có rõ ràng, hợp lý và bao quát toàn bài không. Nếu giải thích sơ sài hoặc nửa vời, tuyệt đối không cho mức Tốt (2.5).",
  "diem": (0, 0.25, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu sư phạm báo cáo cho giáo viên về học sinh (ngôi thứ 3). Nhận xét cụ thể về năng lực tính toán và đặc biệt là chất lượng lập luận/giải thích. TUYỆT ĐỐI KHÔNG dùng từ 'barem', 'quy định', 'tiêu chí'."
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    
    if (parsed) {
      return { 
        evaluation: { 
          ...parsed, 
          muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng').toLowerCase() 
        } 
      };
    }
    
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi không thể phân tích kết quả bài 3.' } };
  } catch (error) {
    console.error('Error evaluating Bài 3:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi trong quá trình chấm điểm tự luận.' } };
  }
};

const requiresCalculation = (questionText) => {
  if (!questionText) return false;
  const keywords = [
    'trình bày', 'phép tính', 'cách giải', 'chi tiết', 
    'bước', 'giải', 'tính', 'biểu diễn', 'thể hiện', 'mô tả', 'theo các bước'
  ];
  const lowerText = questionText.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
};

const isAnswerOnlyResult = (answer) => {
  if (!answer || typeof answer !== 'string') return false;
  const trimmed = answer.trim();
  
  if (trimmed.length < 5) return true;
  const shortAnswers = ['có', 'không', 'yes', 'no', 'đúng', 'sai', 'a', 'b', 'c', 'd'];
  if (shortAnswers.includes(trimmed.toLowerCase())) return true;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return true;
  
  const calculationMarkers = ['+', '-', '×', '*', '÷', '/', '=', '→', 'x'];
  const hasMarkers = calculationMarkers.some(marker => trimmed.includes(marker));
  if (!hasMarkers && trimmed.split(/\s+/).length < 3) return true;
  
  return false;
};

export const evaluateBai4 = async (studentAnswers, worksheet) => {
  try {
    const getAnswerValue = (answers, idx) => {
      if (Array.isArray(answers)) return answers[idx] || '';
      if (typeof answers === 'object' && answers !== null) return answers[idx.toString()] || answers[idx] || '';
      return '';
    };

    const bai4Answers = studentAnswers?.bai_4?.answers || {};
    let questionsInfo = '';
    let validationWarnings = '';
    
    (worksheet.bai_4.questions || []).forEach((q) => {
      questionsInfo += `\n${q.label}. ${q.text}\n`;
      if (q.type === 'cau_hoi_nho') {
        (q.subQuestions || []).forEach((sq, idx) => {
          const answer = getAnswerValue(bai4Answers[q.id], idx);
          questionsInfo += `  - Câu ${idx + 1}: ${sq.text}\n    Trả lời: ${answer || 'trống'}\n`;
          if (requiresCalculation(sq.text) && isAnswerOnlyResult(answer)) {
            validationWarnings += `⚠️ LỖI: Câu ${q.label}.${idx + 1} chỉ ghi kết quả, thiếu phép tính.\n`;
          }
        });
      } else if (q.type === 'so_cach_giai') {
        for (let i = 0; i < q.content; i++) {
          const answer = getAnswerValue(bai4Answers[q.id], i);
          questionsInfo += `  - Cách ${i + 1}: ${answer || 'trống'}\n`;
          if (requiresCalculation(q.text) && isAnswerOnlyResult(answer)) {
            validationWarnings += `⚠️ LỖI: Câu ${q.label} - Cách ${i + 1} thiếu trình bày phép tính.\n`;
          }
        }
      } else {
        const answer = bai4Answers[q.id];
        questionsInfo += `  Trả lời: ${answer || 'trống'}\n`;
        if (requiresCalculation(q.text) && isAnswerOnlyResult(answer)) {
          validationWarnings += `⚠️ LỖI: Câu ${q.label} thiếu trình bày phép tính.\n`;
        }
      }
    });

    const warningContext = validationWarnings ? `\n[CẢNH BÁO TRÌNH BÀY]\n${validationWarnings}\n` : '';

    const prompt = `Bạn là một giáo viên chuyên môn cao. Hãy chấm Bài 4 dựa trên hướng dẫn giải và tiêu chí sau.

[HƯỚNG DẪN GIẢI CHUẨN]
${worksheet.bai_4.explanation}

[BÀI LÀM CỦA HỌC SINH]
${questionsInfo || 'Học sinh không làm bài.'}
${warningContext}

[THANG ĐIỂM BẮT BUỘC (Tối đa 2.5 điểm)]
1. Mức Tốt (2.5 điểm): 
   - Làm được ĐỒNG THỜI 3 yêu cầu: (a) Kiểm tra đúng kết quả; (b) Giải đúng bài toán mở rộng; (c) So sánh hoặc giải thích được cách giải hợp lý (câu c).
2. Mức Đạt (1.75 điểm): 
   - Thực hiện được MỘT trong hai yêu cầu lớn: Kiểm tra được kết quả (câu a) HOẶC Giải được bài toán mở rộng (câu b).
3. Mức Cần cố gắng (0.75 điểm): 
   - Làm được một phần nhỏ: Chỉ đúng 1 trong 2 ý kiểm tra ở câu a HOẶC chỉ giải được bài toán mở rộng bằng 1 cách (nếu câu b yêu cầu 2 cách) nhưng chưa hoàn thiện.
4. Mức Cần cố gắng (0 điểm): 
   - Không kiểm tra đúng và không giải được bài toán mở rộng, hoặc chỉ ghi đáp số mà không có phép tính ở các phần yêu cầu tính toán.

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON:
{
  "suy_luan": "Đánh giá từng câu a, b, c của học sinh so với hướng dẫn giải. Lưu ý lỗi thiếu phép tính sẽ bị hạ mức điểm. Tổng hợp để chọn mức 0, 0.75, 1.75 hoặc 2.5.",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 4-5 câu sư phạm (ngôi thứ 3). Đánh giá cụ thể: (1) Khả năng kiểm tra lại kết quả; (2) Mức độ vận dụng vào bài toán mở rộng; (3) Khả năng so sánh các giải pháp. Nhắc nhở nếu em ấy thiếu trình bày phép tính chi tiết. TUYỆT ĐỐI KHÔNG dùng từ 'barem', 'quy định', 'tiêu chí'."
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    
    if (parsed) return { evaluation: { ...parsed, muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng').toLowerCase() } };
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi không thể phân tích kết quả bài 4.' } };
  } catch (error) {
    console.error('Error evaluating Bài 4:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi trong quá trình chấm điểm bài 4.' } };
  }
};

const calculateOverallLevel = (score) => {
  if (score >= 7.5) {
    return 'tốt';
  } else if (score >= 4) {
    return 'đạt';
  } else {
    return 'cần cố gắng';
  }
};

export const generateOverallComment = async (evaluations, tongDiem, mucNangLucChung) => {
  try {
    const bai_1_feedback = evaluations.bai_1?.evaluation?.nhan_xet || '';
    const bai_2_feedback = evaluations.bai_2?.evaluation?.nhan_xet || '';
    const bai_3_feedback = evaluations.bai_3?.evaluation?.nhan_xet || '';
    const bai_4_feedback = evaluations.bai_4?.evaluation?.nhan_xet || '';

    const prompt = `Bạn là một trợ lý tổng hợp báo cáo đánh giá năng lực học sinh. ĐÂY LÀ BÁO CÁO NỘI BỘ DÀNH RIÊNG CHO GIÁO VIÊN ĐỌC.

TỔNG ĐIỂM: ${tongDiem}/10
MỨC NĂNG LỰC CHUNG: ${mucNangLucChung}
CHI TIẾT:
- Bài 1: ${bai_1_feedback}
- Bài 2: ${bai_2_feedback}
- Bài 3: ${bai_3_feedback}
- Bài 4: ${bai_4_feedback}

YÊU CẦU QUAN TRỌNG VỀ ĐỊNH DẠNG VÀ VĂN PHONG:
- TRÌNH BÀY: Viết duy nhất một đoạn văn từ 4-6 câu, văn phong tự nhiên, mạch lạc. 
- CẤU TRÚC ĐOẠN VĂN:
    + Câu đầu tiên: Phải bắt đầu bằng "Học sinh có tổng điểm ${tongDiem}/10, mức năng lực chung ${mucNangLucChung}."
    + Các câu tiếp theo: Tổng hợp tình hình làm bài từ chi tiết các bài 1, 2, 3, 4 ở trên. Kết nối các ý một cách tự nhiên (ví dụ: "Trong khi bài 1 em ấy làm tốt thì bài 2 còn lúng túng...").
    + Các câu cuối: Đưa ra kiến nghị cụ thể cho giáo viên về những kỹ năng/kiến thức cần bồi dưỡng thêm.
- ĐỊNH DẠNG: TRÌNH BÀY VĂN BẢN THUẦN TÚY, TUYỆT ĐỐI KHÔNG SỬ DỤNG DẤU SAO (**) ĐỂ IN ĐẬM, KHÔNG DÙNG TIÊU ĐỀ HAY CÁC NHÃN (như **TỔNG QUAN**, **CHI TIẾT**...).
- NGÔI XƯNG: Bắt buộc dùng ngôi thứ ba ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng 'con', 'cô/thầy' hay chào hỏi học sinh.
- CẤM: Không dùng từ 'barem', 'tiêu chí', 'ID'.`;

    const result = await geminiModelManager.generateContent(prompt);
    return result.response.text().trim() || `Học sinh đạt tổng điểm ${tongDiem}/10 với mức năng lực ${mucNangLucChung}.`;
  } catch (error) {
    console.error('Error generating overall comment:', error);
    return `Học sinh đạt tổng điểm ${tongDiem}/10 với mức năng lực ${mucNangLucChung}.`;
  }
};