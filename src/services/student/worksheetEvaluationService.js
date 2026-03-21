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

[BAREM CHẤM ĐIỂM]
${worksheet.bai_1.explanation}

[BÀI LÀM THỰC TẾ CỦA HỌC SINH]
Học sinh đã đánh dấu vào các phát biểu sau:
${selectedTexts.length > 0 ? selectedTexts.map(t => `- ${t}`).join('\n') : 'Không chọn gì'}

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Bước 1: Liệt kê các nội dung HS đã chọn. Bước 2: So sánh xem các nội dung đó có đủ các ý 1, 2, 3, 4 như Barem yêu cầu không. Kết luận điểm (Nếu thiếu hoặc sai -> 0 điểm, đúng 1,2,3 -> 1 điểm, đúng cả 4 -> 2 điểm).",
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
    
    // MAPPING: Dịch ID sang nội dung Text các bước tính toán
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

[BAREM CHẤM ĐIỂM]
${worksheet.bai_2.explanation}

[BÀI LÀM THỰC TẾ CỦA HỌC SINH]
Các cách sắp xếp học sinh đã gửi:
${arrangementText}

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Đọc từng nội dung bước tính mà HS đã xếp. So sánh trình tự các phép tính này với trình tự trong Barem. Đếm số cách mà HS xếp đúng hoàn toàn trình tự logic (Từ 2 cách đúng -> 2 điểm, 1 cách đúng -> 1 điểm).",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu SƯ PHẠM báo cáo cho giáo viên bằng ngôi thứ 3 ('học sinh', 'em ấy'). Nhận xét năng lực nhận dạng dạng toán, khả năng sắp xếp logic các phép tính. Ghi rõ học sinh làm tốt chỗ nào và xếp sai logic ở chỗ nào (dựa trên nội dung phép tính). TUYỆT ĐỐI KHÔNG dùng từ 'barem', 'ID'."
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

[BAREM CHẤM ĐIỂM]
${worksheet.bai_3.explanation}

[BÀI LÀM CỦA HỌC SINH]
Bài giải:
${bai_lam}
Giải thích:
${giai_thich}

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Đọc kỹ các phép tính cơ bản trong bài giải và tính hợp lý của lời giải thích. Đối chiếu với yêu cầu điểm số.",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu SƯ PHẠM báo cáo cho giáo viên bằng ngôi thứ 3 ('học sinh', 'em ấy'). Nhận xét trực tiếp năng lực tính toán và tư duy lập luận của em ấy. TUYỆT ĐỐI KHÔNG dùng từ 'barem', 'quy định'."
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

// Helper function: Kiểm tra xem câu hỏi có yêu cầu "phép tính/trình bày" không
const requiresCalculation = (questionText) => {
  if (!questionText) return false;
  const keywords = [
    'trình bày',
    'phép tính',
    'cách giải',
    'chi tiết',
    'bước',
    'giải',
    'tính',
    'biểu diễn',
    'thể hiện',
    'mô tả',
    'theo các bước'
  ];
  const lowerText = questionText.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
};

// Helper function: Kiểm tra xem đáp án có vẻ chỉ là kết quả (quá ngắn/chỉ định dạng đơn giản)
const isAnswerOnlyResult = (answer) => {
  if (!answer || typeof answer !== 'string') return false;
  const trimmed = answer.trim();
  
  // Nếu đáp án quá ngắn (< 5 ký tự hoặc quá ít từ)
  if (trimmed.length < 5) return true;
  
  // Nếu chỉ là "có/không" hoặc "yes/no" hay số đơn giản
  const shortAnswers = ['có', 'không', 'yes', 'no', 'đúng', 'sai', 'a', 'b', 'c', 'd'];
  if (shortAnswers.includes(trimmed.toLowerCase())) return true;
  
  // Nếu chỉ là số
  if (/^\d+(\.\d+)?$/.test(trimmed)) return true;
  
  // Nếu quá ít dấu ngăn cách (không có bước, không có phép tính)
  const calculationMarkers = ['+', '-', '×', '*', '÷', '/', '=', '→', 'x'];
  const hasMarkers = calculationMarkers.some(marker => trimmed.includes(marker));
  
  // Nếu không có dấu phép tính và quá ngắn
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
          
          // Kiểm tra: Nếu câu hỏi yêu cầu phép tính nhưng học sinh chỉ ghi kết quả
          if (requiresCalculation(sq.text) && isAnswerOnlyResult(answer)) {
            validationWarnings += `⚠️ Câu ${q.label}.${idx + 1}: Yêu cầu trình bày phép tính nhưng HS chỉ ghi kết quả/đáp án đơn giản.\n`;
          }
        });
      } else if (q.type === 'so_cach_giai') {
        for (let i = 0; i < q.content; i++) {
          const answer = getAnswerValue(bai4Answers[q.id], i);
          questionsInfo += `  - Cách ${i + 1}: ${answer || 'trống'}\n`;
          
          if (requiresCalculation(q.text) && isAnswerOnlyResult(answer)) {
            validationWarnings += `⚠️ Câu ${q.label} - Cách ${i + 1}: Yêu cầu trình bày chi tiết nhưng HS chỉ ghi tóm tắt.\n`;
          }
        }
      } else {
        const answer = bai4Answers[q.id];
        questionsInfo += `  Trả lời: ${answer || 'trống'}\n`;
        
        if (requiresCalculation(q.text) && isAnswerOnlyResult(answer)) {
          validationWarnings += `⚠️ Câu ${q.label}: Yêu cầu trình bày phép tính nhưng HS chỉ ghi kết quả.\n`;
        }
      }
    });

    const warningContext = validationWarnings ? `\n[CẢNH BÁO KIỂM TRA]\n${validationWarnings}\n` : '';

    const prompt = `Bạn là một giáo viên chuyên môn cao.

[BAREM CHẤM ĐIỂM]
${worksheet.bai_4.explanation}

[BÀI LÀM CỦA HỌC SINH]
${questionsInfo || 'Học sinh không làm bài.'}
${warningContext}

[YÊU CẦU ĐẦU RA]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Xác định HS đã làm được phần nào (kiểm tra kết quả, giải toán mở rộng, nhận xét). QUY CHIẾU CHẶT: Nếu câu hỏi yêu cầu trình bày phép tính mà HS chỉ ghi kết quả/đáp án → chưa hoàn thành, tính điểm thấp hơn. Quy chiếu sang điểm.",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu SƯ PHẠM báo cáo cho giáo viên bằng ngôi thứ 3 ('học sinh', 'em ấy'). Chỉ rõ HS đã vận dụng được kiến thức mở rộng đến mức độ nào, và nêu rõ những chỗ HS chưa trình bày đầy đủ bước giải. TUYỆT ĐỐI KHÔNG dùng từ 'barem', 'tiêu chí'."
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