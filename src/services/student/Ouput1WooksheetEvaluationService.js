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

    return { ...evaluations, tongDiem, mucNangLucChung, nhanXetChung };
  } catch (error) {
    console.error('Error evaluating Output 1:', error);
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

    const prompt = `Bạn là giáo viên chấm Bài 1 (Nhận biết thông tin - Tỉ số phần trăm).
[BÀI LÀM CỦA HỌC SINH]
Các ý học sinh đã chọn:
${selectedTexts.length > 0 ? selectedTexts.map(t => `- ${t}`).join('\n') : 'Không chọn gì'}

[BAREM CHẤM ĐIỂM BẮT BUỘC (Tối đa 2.5 điểm)]
Bài toán có 4 phát biểu (1, 2, 3, 4).
- Mức Tốt (2.5 điểm): Chọn đúng 1, 2, 3, 4.
- Mức Đạt (1.75 điểm): Chỉ chọn đúng 3 ý đầu (1, 2, 3).
- Mức Cần cố gắng (0 - 0.75 điểm):
  + Chọn đúng 3 ý trong 4 ý nhưng thiếu (1), (2) hoặc (3) -> 0.75 điểm.
  + Chọn đúng 2 ý trong 4 ý -> 0.5 điểm.
  + Chọn đúng 1 ý trong 4 ý -> 0.25 điểm.
  + Không chọn được ý nào hoặc chọn sai hết -> 0 điểm.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đối chiếu bài làm với barem. Chỉ ra em ấy chọn đúng/thiếu ý nào và áp dụng điểm tương ứng.",
  "diem": (0, 0.25, 0.5, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu BÁO CÁO CHO GIÁO VIÊN đọc. BẮT BUỘC dùng ngôi thứ 3 ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng hô trực tiếp với học sinh (CẤM dùng 'Chào em', 'của em', 'em nhé'). Nêu rõ học sinh xác định được thông tin nào, có tìm được mối quan hệ đại lượng (ý số 4) không."
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

    const prompt = `Bạn là giáo viên chấm Bài 2 (Sắp xếp các bước tính - Tỉ số phần trăm).
[BÀI LÀM CỦA HỌC SINH]
${arrangementText}

[BAREM CHẤM ĐIỂM BẮT BUỘC (Tối đa 2.5 điểm)]
Có 2 cách giải chuẩn logic:
- Cách 1: Tính số sách khoa học -> Tìm thương (18:40) -> Nhân 100 -> Thêm %
- Cách 2: Lấy thương sách thiếu nhi -> Nhân 100 -> Thêm % -> Lấy 100% trừ đi
- Mức Tốt (2.5 điểm): Xếp đúng chính xác CẢ 2 cách giải.
- Mức Đạt (1.75 điểm): Chỉ xếp đúng 1 cách giải (cách 1 hoặc cách 2).
- Mức Cần cố gắng (0 - 0.75 điểm):
  + Xếp được 2 vị trí đúng của các bước giải trong từng cách -> 0.75 điểm.
  + Không xếp đúng cách nào, xếp thiếu bước, hoặc xếp sai logic -> 0 điểm.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đếm số cách học sinh xếp đúng hoàn toàn logic hoặc đúng một số vị trí để đưa ra điểm số (0, 0.75, 1.75 hoặc 2.5).",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu BÁO CÁO CHO GIÁO VIÊN. BẮT BUỘC dùng ngôi thứ 3 ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng hô trực tiếp với học sinh (CẤM dùng 'Chào em', 'của em'). Đánh giá xem học sinh đã đề xuất được bao nhiêu cách giải, có lỗi sai logic nào không."
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
    const hasFinalAnswer = hasBai3FinalAnswer(bai_lam);

    const prompt = `Bạn là giáo viên chấm Bài 3 (Trình bày bài giải - Tỉ số phần trăm).
[BÀI LÀM CỦA HỌC SINH]
Bài giải: ${bai_lam}
Giải thích: ${giai_thich}
CÓ ĐÁP SỐ/KẾT LUẬN CUỐI CÙNG?: ${hasFinalAnswer ? 'Có' : 'Không'}

[BAREM CHẤM ĐIỂM BẮT BUỘC (Tối đa 2.5 điểm)]
- Điều kiện tiên quyết: Bài làm PHẢI có đáp số hoặc kết luận cuối cùng. Nếu chưa có kết luận cuối thì CHỈ CHẤM 0 ĐIỂM.
- Mức Tốt (2.5 điểm): Thực hiện đúng các bước giải/phép tính, trình bày rõ ràng VÀ CÓ GIẢI THÍCH/lập luận hợp lý cho các bước.
- Mức Đạt (1.75 điểm): Thực hiện đúng các phép tính cơ bản, trình bày rõ nhưng thiếu giải thích hoặc giải thích hời hợt/thiếu logic.
- Mức Cần cố gắng (0 - 0.75 điểm):
  + Thực hiện đúng 2/3 bước giải và phép tính cơ bản -> 0.75 điểm.
  + Thực hiện đúng 1/3 bước giải và phép tính cơ bản -> 0.25 điểm.
  + Tính toán sai nhiều, lời giải thiếu logic -> 0 điểm.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Bắt buộc kiểm tra có đáp số/kết luận cuối cùng trước; nếu chưa có thì chấm 0 điểm ngay. Nếu có thì đối chiếu barem để cho điểm 0, 0.25, 0.75, 1.75 hoặc 2.5.",
  "diem": (0, 0.25, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu BÁO CÁO CHO GIÁO VIÊN. BẮT BUỘC dùng ngôi thứ 3 ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng 'em', 'của em'. Nhận xét năng lực tính toán và đánh giá xem lập luận giải thích của học sinh có hợp lí không."
}`;
    const result = await geminiModelManager.generateContent(prompt);
    const parsed = extractJSON(result.response.text());
    const evaluation = parsed || { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi parse JSON.' };

    if (!hasFinalAnswer) {
      return {
        evaluation: {
          ...evaluation,
          diem: 0,
          muc_nang_luc: 'cần cố gắng',
          nhan_xet: "Học sinh chưa nêu đáp số hoặc kết luận cuối cùng của bài toán nên chưa đạt yêu cầu tối thiểu. Bài làm có thể có một số bước tính trung gian nhưng chưa trả lời dứt điểm câu hỏi của đề. Giáo viên cần nhắc học sinh luôn chốt bài bằng câu kết luận rõ ràng ở cuối."
        }
      };
    }

    return { evaluation };
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

    const prompt = `Bạn là giáo viên chấm Bài 4 (Vận dụng mở rộng - Tỉ số phần trăm).
[BÀI LÀM CỦA HỌC SINH]
${questionsInfo || 'Học sinh không làm bài.'}
${validationWarnings ? `\n[CẢNH BÁO ĐỊNH DẠNG]\n${validationWarnings}\n` : ''}

[BAREM CHẤM ĐIỂM BẮT BUỘC (Tối đa 2.5 điểm)]
Bài có 3 yêu cầu: a (Kiểm tra lại kết quả), b (Giải bài toán mở rộng), c (Nhận xét/so sánh).
- Mức Tốt (2.5 điểm): Làm được ĐỒNG THỜI cả a, b và c.
- Mức Đạt (1.75 điểm): Thực hiện được một trong hai yêu cầu: Kiểm tra được kết quả bài toán bằng phép tính HOẶC Giải được bài toán mở rộng.
- Mức Cần cố gắng (0 - 0.75 điểm):
  + HS làm được 2 ý đầu của câu a hoặc làm đúng 1 trong 2 cách của câu b -> 0.75 điểm.
  + Không kiểm tra đúng kết quả và không giải được bài toán mở rộng -> 0 điểm.

[YÊU CẦU ĐẦU RA JSON]
{
  "suy_luan": "Đánh giá sự xuất hiện và tính đúng đắn của phần a, b và c để đối chiếu barem cho điểm (0, 0.75, 1.75 hoặc 2.5).",
  "diem": (0, 0.75, 1.75 hoặc 2.5),
  "muc_nang_luc": "(cần cố gắng / đạt / tốt)",
  "nhan_xet": "Viết 3-4 câu BÁO CÁO CHO GIÁO VIÊN. BẮT BUỘC dùng ngôi thứ 3 ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng hô trực tiếp với học sinh. Đánh giá việc học sinh có biết kiểm tra lại kết quả và khả năng giải toán mở rộng."
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

    const prompt = `Bạn là một trợ lý tổng hợp báo cáo đánh giá năng lực học sinh về chủ đề TỈ SỐ PHẦN TRĂM. ĐÂY LÀ BÁO CÁO NỘI BỘ DÀNH RIÊNG CHO GIÁO VIÊN ĐỌC.

TỔNG ĐIỂM: ${tongDiem}/10
MỨC NĂNG LỰC CHUNG: ${mucNangLucChung}
CHI TIẾT CÁC BÀI:
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
- NGÔI XƯNG: Bắt buộc dùng ngôi thứ ba ('học sinh', 'em ấy'). TUYỆT ĐỐI KHÔNG xưng hô trực tiếp với học sinh.
- CẤM: TUYỆT ĐỐI KHÔNG được dùng các từ: 'Chào em', 'của em', 'em nhé', 'cố gắng nhé', 'barem'.`;

    const result = await geminiModelManager.generateContent(prompt);
    return result.response.text().trim() || `Học sinh đạt tổng điểm ${tongDiem}/10 với mức năng lực ${mucNangLucChung}.`;
  } catch (error) {
    console.error('Error generating overall comment for Output 1:', error);
    return `Học sinh đạt tổng điểm ${tongDiem}/10 với mức năng lực ${mucNangLucChung}.`;
  }
};