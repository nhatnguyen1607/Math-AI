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
  if (score >= 7) return 'tốt';
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
      return matchedQ ? matchedQ.text : id;
    });

    const prompt = `Bạn là giáo viên chấm Bài 1 (Nhận biết thông tin - Vận tốc Rô-bốt).
[BÀI LÀM CỦA HỌC SINH]
Các ý học sinh đã chọn:
${selectedTexts.length > 0 ? selectedTexts.map(t => `- ${t}`).join('\n') : 'Không chọn gì'}

[BAREM CHẤM ĐIỂM BẮT BUỘC]
Có 4 phát biểu (1: Rô-bốt A..., 2: Rô-bốt B..., 3: Yêu cầu so sánh, 4: Vận tốc phụ thuộc S và t).
- Mức Tốt (2 điểm): Chọn ĐÚNG CẢ 4 phát biểu.
- Mức Đạt (1 điểm): Chỉ chọn đúng (1, 2, 3), thiếu ý 4.
- Mức Cần cố gắng (0 điểm): Các trường hợp còn lại.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Phân tích xem học sinh đã chọn đủ 4 ý hay thiếu ý số 4.",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu BÁO CÁO CHO GIÁO VIÊN. BẮT BUỘC dùng ngôi thứ 3 ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng hô trực tiếp với học sinh (CẤM dùng 'Chào em', 'của em'). Nêu rõ em ấy nhận biết thông số rô-bốt và yếu tố (S, t) tốt hay chưa."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi parse JSON.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

export const evaluateBai2 = async (studentAnswers, worksheet) => {
  try {
    const arrangements = studentAnswers?.bai_2?.arrangements || {};
    const questionsList = worksheet?.bai_2?.questions || [];
    
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

    const prompt = `Bạn là giáo viên chấm Bài 2 (Sắp xếp các bước tính - Vận tốc Rô-bốt).
[BÀI LÀM CỦA HỌC SINH]
${arrangementText}

[BAREM CHẤM ĐIỂM BẮT BUỘC]
Có 4 cách giải đổi đơn vị khác nhau để so sánh.
- Mức Tốt (2 điểm): Xếp ĐÚNG TỪ 2 CÁCH TRỞ LÊN.
- Mức Đạt (1 điểm): Xếp đúng ĐƯỢC 1 CÁCH.
- Mức Cần cố gắng (0 điểm): Sắp xếp sai logic.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đếm số cách học sinh xếp đúng logic.",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu BÁO CÁO CHO GIÁO VIÊN. BẮT BUỘC dùng ngôi thứ 3 ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng hô trực tiếp với học sinh (CẤM dùng 'Chào em', 'của em'). Khen ngợi nếu em ấy đề xuất nhiều hướng đổi đơn vị, hoặc nhắc nhở nếu xếp lộn xộn."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi parse JSON.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

export const evaluateBai3 = async (studentAnswers, worksheet) => {
  try {
    const bai_lam = studentAnswers?.bai_3?.bai_lam || 'Không có';
    const giai_thich = studentAnswers?.bai_3?.giai_thich || 'Không có';

    const prompt = `Bạn là giáo viên chấm Bài 3 (Trình bày bài giải - Vận tốc Rô-bốt).
[BÀI LÀM CỦA HỌC SINH]
Bài giải: ${bai_lam}
Giải thích: ${giai_thich}

[BAREM CHẤM ĐIỂM BẮT BUỘC]
- Mức Tốt (2 điểm): Tính vận tốc đúng, so sánh đúng VÀ CÓ GIẢI THÍCH hợp lý (VD: tại sao phải đổi đơn vị).
- Mức Đạt (1 điểm): Tính đúng NHƯNG thiếu phần giải thích hoặc hời hợt.
- Mức Cần cố gắng (0 điểm): Tính sai nhiều, đổi sai đơn vị.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Kiểm tra kỹ quy đổi đơn vị. Bắt buộc đọc phần Giải thích, nếu sơ sài -> tối đa 1 điểm.",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu BÁO CÁO CHO GIÁO VIÊN. BẮT BUỘC dùng ngôi thứ 3 ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng hô trực tiếp với học sinh. Đánh giá kỹ năng đổi đơn vị và tư duy lập luận của học sinh."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi parse JSON.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
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
    
    (worksheet?.bai_4?.questions || []).forEach((q) => {
      questionsInfo += `\n${q.label}. ${q.text}\n`;
      if (q.type === 'cau_hoi_nho') {
        (q.subQuestions || []).forEach((sq, idx) => {
          const answer = getAnswerValue(bai4Answers[q.id], idx);
          questionsInfo += `  - Câu ${idx + 1}: ${sq.text}\n    Trả lời: ${answer || 'trống'}\n`;
          if (requiresCalculation(sq.text) && isAnswerOnlyResult(answer)) {
            validationWarnings += `⚠️ CẢNH BÁO: Câu ${q.label}.${idx + 1} yêu cầu phép tính nhưng HS chỉ ghi kết quả.\n`;
          }
        });
      } else {
        const answer = bai4Answers[q.id];
        questionsInfo += `  Trả lời: ${answer || 'trống'}\n`;
      }
    });

    const prompt = `Bạn là giáo viên chấm Bài 4 (Vận dụng mở rộng - Vận tốc Rô-bốt).
[BÀI LÀM CỦA HỌC SINH]
${questionsInfo || 'Học sinh không làm bài.'}
${validationWarnings ? `\n[CẢNH BÁO ĐỊNH DẠNG]\n${validationWarnings}\n` : ''}

[BAREM CHẤM ĐIỂM BẮT BUỘC]
Yêu cầu gồm: a (Kiểm tra lại), b (Giải bài mở rộng: tăng/giảm thời gian hoặc quãng đường), c (Nhận xét).
- Mức Tốt (2 điểm): Làm ĐỒNG THỜI cả a, b và c.
- Mức Đạt (1 điểm): Chỉ làm được a HOẶC b.
- Mức Cần cố gắng (0 điểm): Không làm được cả a, b và c.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đánh giá chi tiết bước 'thử lại' (câu a), và giải quyết sự biến thiên của s và t (câu b).",
  "diem": (0, 1 hoặc 2),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu BÁO CÁO CHO GIÁO VIÊN. BẮT BUỘC dùng ngôi thứ 3 ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng hô trực tiếp với học sinh. Đánh giá khả năng hiểu sâu bản chất vận tốc khi s/t thay đổi."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    return { evaluation: parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi parse JSON.' } };
  } catch (error) { return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi chấm bài.' } }; }
};

export const generateOverallComment = async (evaluations, tongDiem, mucNangLucChung) => {
  try {
    const bai_1_feedback = evaluations.bai_1?.evaluation?.nhan_xet || '';
    const bai_2_feedback = evaluations.bai_2?.evaluation?.nhan_xet || '';
    const bai_3_feedback = evaluations.bai_3?.evaluation?.nhan_xet || '';
    const bai_4_feedback = evaluations.bai_4?.evaluation?.nhan_xet || '';

    const prompt = `Bạn là một trợ lý tổng hợp báo cáo đánh giá năng lực học sinh về chủ đề CHUYỂN ĐỘNG ĐỀU (VẬN TỐC). ĐÂY LÀ BÁO CÁO NỘI BỘ DÀNH RIÊNG CHO GIÁO VIÊN ĐỌC.

TỔNG ĐIỂM: ${tongDiem}/8
MỨC NĂNG LỰC CHUNG: ${mucNangLucChung}
CHI TIẾT CÁC BÀI:
- Bài 1: ${bai_1_feedback}
- Bài 2: ${bai_2_feedback}
- Bài 3: ${bai_3_feedback}
- Bài 4: ${bai_4_feedback}

YÊU CẦU BẮT BUỘC: 
- ĐỐI TƯỢNG ĐỌC: Báo cáo này để GIÁO VIÊN đọc. TUYỆT ĐỐI KHÔNG viết dưới dạng thư gửi học sinh.
- CẤM: TUYỆT ĐỐI KHÔNG được dùng các từ: 'Chào em', 'của em', 'em nhé', 'cố gắng nhé'.
- NGÔI XƯNG: Bắt buộc dùng ngôi thứ ba ('học sinh', 'em ấy').
- NỘI DUNG: Viết 4-6 câu tổng hợp khả năng nắm bắt mối quan hệ S-v-t, sự cẩn thận khi đổi đơn vị và tư duy linh hoạt. Chỉ ra phần kiến thức giáo viên cần lưu ý củng cố thêm.`;

    const result = await geminiModelManager.generateContent(prompt);
    return result.response.text().trim() || `Học sinh đạt tổng điểm ${tongDiem}/8 với mức năng lực ${mucNangLucChung}.`;
  } catch (error) {
    console.error('Error generating overall comment for Output 2:', error);
    return `Học sinh đạt tổng điểm ${tongDiem}/8 với mức năng lực ${mucNangLucChung}.`;
  }
};