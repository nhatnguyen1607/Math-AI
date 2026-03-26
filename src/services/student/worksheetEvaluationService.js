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
    
    const prompt = `Bạn là một giáo viên chuyên môn cao đang chấm bài. PHẢI ĐÁNH GIÁ CHÍNH XÁC NĂNG LỰC DỰA VÀO CÂU TRẢ LỜI CỦA HỌC SINH.

[BÀI LÀM THỰC TẾ CỦA HỌC SINH]
Học sinh đã đánh dấu vào các phát biểu sau:
${selectedTexts.length > 0 ? selectedTexts.map(t => `- ${t}`).join('\n') : 'Không chọn gì'}

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Bước 1: So sánh đúng/sai. BẮT BUỘC ÁP DỤNG LUẬT SAU: Chọn đúng 3 ý đầu (1, 2, 3) -> 1 điểm. Chọn đúng đủ 4 ý (1, 2, 3, 4) -> 2 điểm. TẤT CẢ các trường hợp còn lại (chỉ chọn 1-2 ý, hoặc chọn sai ý) -> 0 điểm. Không du di.",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu SƯ PHẠM báo cáo cho giáo viên. Dùng ngôi thứ 3 ('học sinh', 'em ấy'). Chỉ rõ mức độ nhận diện vấn đề, thông tin nào em ấy đã tìm đúng, thông tin/mối quan hệ nào còn bỏ sót. TUYỆT ĐỐI KHÔNG dùng các từ: 'barem', 'mã định danh', 'ID', 'tiêu chí', 'như máy tính'."
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
    
    const arrangementText = Object.keys(arrangements).length > 0 
      ? Object.entries(arrangements).map(([key, arr]) => {
          const items = Array.isArray(arr) ? arr : Object.values(arr || {});
          const textItems = items.map(id => {
            const matchedQ = questionsList.find(q => q.id === id);
            return matchedQ ? matchedQ.text : id;
          });
          return `${key}:\n  -> ${textItems.join('\n  -> ')}`;
        }).join('\n\n')
      : 'Học sinh không có sắp xếp nào.';

    const prompt = `Bạn là một giáo viên chuyên môn cao. CẤM BỊA ĐÁP ÁN, PHẢI ĐỌC KỸ TRÌNH TỰ CÁC BƯỚC MÀ HỌC SINH ĐÃ XẾP.

[BAREM CHẤM ĐIỂM - SỐ BƯỚC TỐI THIỂU MỖI CÁCH]
${worksheet.bai_2.explanation}

[BÀI LÀM THỰC TẾ CỦA HỌC SINH]
Các cách sắp xếp học sinh đã gửi:
${arrangementText}

[LUẬT CHẤM ĐIỂM BẮT BUỘC]
QUAN TRỌNG: Mỗi cách PHẢI CÓ ĐỦ tất cả các bước cần thiết. Nếu một cách thiếu bước hoặc chỉ có 1-2 bước -> cách đó được tính là SAI HOÀN TOÀN.
- Yêu cầu: Tối thiểu 2 CÁCH đầy đủ bước và đúng logic thứ tự.
- Mức Tốt (2 điểm): Xếp đúng ≥2 cách (mỗi cách đầy đủ bước + thứ tự logic đúng).
- Mức Đạt (1 điểm): ếp đúng 1 cách (đầy đủ bước + thứ tự logic đúng).
- Mức Cần cố gắng (0 điểm): Xếp < 1 cách đầy đủ, HOẶC các cách bị thiếu bước, HOẶC thứ tự logic sai.

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Bước 1: ĐỌC KỸ 4 CÁCH GIẢI ĐÚNG: Cách 1: (1) → (2) → (3), Cách 2: (1) → (3) → (2), Cách 3: (1) → (2) → (4), Cách 4: (1) → (3) → (5). Bước 2: ĐỐI CHIẾU bài làm của HS với 4 cách đúng trên. Cách nào của HS khớp với một trong 4 cách đúng thì tính là XẾP ĐÚNG. Cách nào không khớp hoặc thiếu bước thì tính là SAI. Bước 3: Đếm có bao nhiêu cách HS xếp đúng. Kết luận: Nếu HS xếp đúng >= 2 cách (mỗi cách đầy đủ bước + thứ tự logic trùng 1 trong 4 cách đúng) -> 2 điểm. Nếu HS xếp đúng 1 cách -> 1 điểm. Nếu không có cách nào đúng -> 0 điểm.",
  "diem": (0 ,1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu SƯ PHẠM báo cáo cho giáo viên bằng ngôi thứ 3 ('học sinh', 'em ấy'). Nêu rõ: học sinh sắp xếp được mấy cách đầy đủ, những cách nào bị thiếu bước (và thiếu bước nào cụ thể). Nhắc nhở HS rằng mỗi cách phải trình bày đủ các phép tính từ đầu đến cuối. TUYỆT ĐỐI KHÔNG dùng từ 'barem', 'ID'."
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    
    if (parsed) return { evaluation: { ...parsed, muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng').toLowerCase() } };
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

    const prompt = `Bạn là một giáo viên chuyên môn cao.

[BÀI LÀM CỦA HỌC SINH]
Bài giải:
${bai_lam}
Giải thích:
${giai_thich}

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Đọc kỹ phần bài làm và giải thích. LƯU Ý QUAN TRỌNG: Học sinh BẮT BUỘC phải giải thích được chi tiết ý nghĩa các bước tính toán (Ví dụ: tại sao phải tìm tổng số phần, tại sao dùng phép chia/nhân đó...). Nếu giải thích hời hợt kiểu 'vì nó dễ/ngắn hơn' hoặc không có giải thích toán học cụ thể -> KHÔNG ĐƯỢC 2 ĐIỂM (chỉ cho tối đa 1 điểm nếu phép tính bài giải đúng). Đánh giá điểm chính xác (0, 1 hoặc 2).",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu SƯ PHẠM báo cáo cho giáo viên bằng ngôi thứ 3 ('học sinh', 'em ấy'). Nhận xét trực tiếp năng lực tính toán và đánh giá xem phần lập luận/giải thích của em ấy có thực sự hiểu bản chất không. TUYỆT ĐỐI KHÔNG dùng từ 'barem', 'quy định'."
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    
    if (parsed) return { evaluation: { ...parsed, muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng').toLowerCase() } };
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi không thể phân tích kết quả.' } };
  } catch (error) {
    console.error('Error evaluating Bài 3:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi trong quá trình chấm.' } };
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
            validationWarnings += `⚠️ LỖI NGHIÊM TRỌNG Câu ${q.label}.${idx + 1}: Học sinh CHỈ ghi kết quả, thiếu phép tính.\n`;
          }
        });
      } else if (q.type === 'so_cach_giai') {
        for (let i = 0; i < q.content; i++) {
          const answer = getAnswerValue(bai4Answers[q.id], i);
          questionsInfo += `  - Cách ${i + 1}: ${answer || 'trống'}\n`;
          if (requiresCalculation(q.text) && isAnswerOnlyResult(answer)) {
            validationWarnings += `⚠️ LỖI NGHIÊM TRỌNG Câu ${q.label} - Cách ${i + 1}: Yêu cầu trình bày chi tiết nhưng HS chỉ ghi kết quả.\n`;
          }
        }
      } else {
        const answer = bai4Answers[q.id];
        questionsInfo += `  Trả lời: ${answer || 'trống'}\n`;
        if (requiresCalculation(q.text) && isAnswerOnlyResult(answer)) {
          validationWarnings += `⚠️ LỖI NGHIÊM TRỌNG Câu ${q.label}: Yêu cầu trình bày phép tính nhưng HS chỉ ghi kết quả.\n`;
        }
      }
    });

    const warningContext = validationWarnings ? `\n[CẢNH BÁO KIỂM TRA ĐỊNH DẠNG ĐÁP ÁN]\n${validationWarnings}\n` : '';

    const prompt = `Bạn là một giáo viên chuyên môn cao.

[BÀI LÀM CỦA HỌC SINH]
${questionsInfo || 'Học sinh không làm bài.'}
${warningContext}

[LUẬT CHẤM ĐIỂM BẮT BUỘC (QUAN TRỌNG)]
- Câu a: Bắt buộc học sinh phải trình bày ĐẦY ĐỦ phép tính (VD: 28+56=84, 28/56=1/2). NẾU CHỈ GHI MỖI KẾT QUẢ (như 84, 1/2) HOẶC BỊ ĐÁNH DẤU "LỖI NGHIÊM TRỌNG" BÊN TRÊN -> TÍNH LÀ LÀM SAI CÂU A.
- Câu b: Bắt buộc trình bày CẢ 2 CÁCH giải chi tiết từng bước. NẾU CHỈ GHI ĐÁP ÁN -> TÍNH LÀ LÀM SAI CÂU B.
- TIÊU CHÍ ĐIỂM:
  + Mức Tốt (2 điểm): Làm đúng câu a (có phép tính) VÀ làm đúng câu b (trình bày đủ các bước cho 2 cách) VÀ giải thích/nhận xét được câu c.
  + Mức Đạt (1 điểm): CHỈ làm đúng câu a (có phép tính) HOẶC CHỈ làm đúng câu b (trình bày đủ bước).
  + Mức Cần cố gắng (0 điểm): Không làm được bài HOẶC làm sai cả a và b HOẶC chỉ ghi kết quả mà không có phép tính/bước giải cho cả a và b.

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Đối chiếu bài làm với [LUẬT CHẤM ĐIỂM BẮT BUỘC]. Kiểm tra chặt chẽ việc ghi phép tính câu a và ghi đủ các bước câu b. Từ đó đưa ra quyết định điểm cuối cùng.",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 4-5 câu SƯ PHẠM báo cáo cho giáo viên bằng ngôi thứ 3 ('học sinh', 'em ấy'). Đánh giá rõ: (1) HS kiểm tra lại được kết quả hay không; (2) HS vận dụng kiến thức mở rộng đến mức độ nào và có thể giải quyết được bài toán mở rộng; (3) HS có so sánh được các phương pháp giải khác nhau mà mình đã thực hiện. ĐẶC BIỆT lưu ý nhắc nhở nếu em ấy có thói quen chỉ ghi đáp án mà không trình bày phép tính. TUYỆT ĐỐI KHÔNG dùng từ 'barem', 'tiêu chí'."
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    
    if (parsed) return { evaluation: { ...parsed, muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng').toLowerCase() } };
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi không thể phân tích kết quả.' } };
  } catch (error) {
    console.error('Error evaluating Bài 4:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi trong quá trình chấm.' } };
  }
};

const calculateOverallLevel = (score) => {
  if (score >= 7) {
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

    const prompt = `Bạn là một trợ lý tổng hợp báo cáo đánh giá năng lực học sinh.

TỔNG ĐIỂM: ${tongDiem}/8
MỨC NĂNG LỰC CHUNG: ${mucNangLucChung}
CHI TIẾT:
- Bài 1: ${bai_1_feedback}
- Bài 2: ${bai_2_feedback}
- Bài 3: ${bai_3_feedback}
- Bài 4: ${bai_4_feedback}

YÊU CẦU: 
- Viết một đoạn văn 4-6 câu tổng hợp tình hình làm bài để BÁO CÁO CHO GIÁO VIÊN.
- NGÔI XƯNG: Bắt buộc dùng ngôi thứ ba ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng 'con', 'cô/thầy'.
- Nêu rõ các kỹ năng em ấy nắm vững và những kỹ năng/kiến thức nào giáo viên cần chú ý bồi dưỡng thêm. KHÔNG dùng từ 'barem'.`;

    const result = await geminiModelManager.generateContent(prompt);
    return result.response.text().trim() || `Học sinh đạt tổng điểm ${tongDiem}/8 với mức năng lực ${mucNangLucChung}.`;
  } catch (error) {
    console.error('Error generating overall comment:', error);
    return `Học sinh đạt tổng điểm ${tongDiem}/8 với mức năng lực ${mucNangLucChung}.`;
  }
};