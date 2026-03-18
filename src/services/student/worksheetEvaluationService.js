import geminiModelManager from '../gemini/geminiModelManager';

// Evaluate worksheet answers using 4-criteria rubric
export const evaluateWorksheet = async (studentAnswers, worksheet) => {
  try {
    // Evaluate based on 4 criteria (gợi ý từ rubric)
    const tieuchis = {
      tieuchi_1: await evaluateTieuChi1(studentAnswers, worksheet), // Nhận biết được vấn đề
      tieuchi_2: await evaluateTieuChi2(studentAnswers, worksheet), // Nêu được cách thức GQVĐ
      tieuchi_3: await evaluateTieuChi3(studentAnswers, worksheet), // Trình bày được cách thức GQVĐ
      tieuchi_4: await evaluateTieuChi4(studentAnswers, worksheet)  // Kiểm tra được giải pháp
    };

    // Calculate overall score (max 8 points: 4 criteria x 2 points each)
    const tongDiem =
      (tieuchis.tieuchi_1?.diem || 0) +
      (tieuchis.tieuchi_2?.diem || 0) +
      (tieuchis.tieuchi_3?.diem || 0) +
      (tieuchis.tieuchi_4?.diem || 0);

    // Determine overall competency level
    const mucNangLucChung = calculateOverallLevel([
      tieuchis.tieuchi_1?.muc_nang_luc,
      tieuchis.tieuchi_2?.muc_nang_luc,
      tieuchis.tieuchi_3?.muc_nang_luc,
      tieuchis.tieuchi_4?.muc_nang_luc
    ].filter(Boolean));

    // Generate detailed overall comment
    const nhanXetChung = await generateOverallComment(tieuchis, tongDiem, mucNangLucChung);

    return {
      tieuchis,
      tongDiem,
      mucNangLucChung,
      nhanXetChung
    };
  } catch (error) {
    console.error('Error evaluating worksheet:', error);
    return {
      tieuchis: {
        tieuchi_1: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' },
        tieuchi_2: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' },
        tieuchi_3: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' },
        tieuchi_4: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' }
      },
      tongDiem: 0,
      mucNangLucChung: 'Chưa đánh giá',
      nhanXetChung: 'Có lỗi khi đánh giá. Vui lòng thử lại.'
    };
  }
};

// Tiêu chí 1: Nhận biết được vấn đề cần giải quyết
// Đánh giá: xác định được thông tin đã cho, yêu cầu, mối quan hệ
const evaluateTieuChi1 = async (studentAnswers, worksheet) => {
  try {
    // Collect all student answers to understand comprehension
    const allAnswers = formatAllAnswers(studentAnswers, worksheet);
    
    const prompt = `
TIÊU CHÍ 1: NHẬN BIẾT ĐƯỢC VẤN ĐỀ CẦN GIẢI QUYẾT

Bài toán: ${worksheet.bai_3?.text || worksheet.bai_1?.text || 'N/A'}

Bài làm của học sinh:
${allAnswers}

HƯỚNG DẪN ĐÁNH GIÁ:
- 0 điểm (Cần cố gắng): Học sinh chưa xác định được các thông tin đã cho, yêu cầu của bài toán, mối quan hệ giữa cái đã cho và cái cần tìm. Bài làm thiếu logic hoặc không phù hợp.
- 1 điểm (Đạt): Học sinh đã xác định được các thông tin đã cho, yêu cầu của bài toán, nhưng chưa chỉ ra được mối quan hệ giữa cái đã cho và cái cần tìm một cách rõ ràng.
- 2 điểm (Tốt): Học sinh đã xác định được đầy đủ các thông tin đã cho, yêu cầu của bài toán, mối quan hệ giữa cái đã cho và cái cần tìm một cách rõ ràng và chính xác.

Vui lòng:
1. Đánh giá xem học sinh có hiểu được bài toán không
2. Cho điểm (0, 1 hoặc 2)
3. Ghi mức năng lực: "cần cố gắng", "đạt", hoặc "tốt"
4. Viết nhận xét ngắn (1-2 câu) về điểm mạnh/hạn chế

Trả lời dưới dạng JSON (KHÔNG có markdown):
{"diem": number, "muc_nang_luc": "string", "nhan_xet": "string"}`;

    return await parseEvaluationResponse(prompt);
  } catch (error) {
    console.error('Error evaluating Tiêu chí 1:', error);
    return { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi khi đánh giá' };
  }
};

// Tiêu chí 2: Nêu được cách thức giải quyết vấn đề
// Đánh giá: lựa chọn,sắp xếp các bước, nhận dạng dạng toán, số cách giải
const evaluateTieuChi2 = async (studentAnswers, worksheet) => {
  try {
    const bai2Info = formatBai2Info(studentAnswers, worksheet);
    const allAnswers = formatAllAnswers(studentAnswers, worksheet);
    
    const prompt = `
TIÊU CHÍ 2: NÊU ĐƯỢC CÁCH THỨC GIẢI QUYẾT VẤN ĐỀ

Bài toán: ${worksheet.bai_3?.text || worksheet.bai_1?.text || 'N/A'}

Phương pháp sắp xếp (Bài 2):
${bai2Info}

Tất cả bài làm của học sinh:
${allAnswers}

HƯỚNG DẪN ĐÁNH GIÁ:
- 0 điểm (Cần cố gắng): Học sinh không lựa chọn chính xác, sắp xếp sai thứ tự. Không nhận dạng được dạng toán.
- 1 điểm (Đạt): Học sinh lựa chọn đúng các bước và sắp xếp đúng 1 cách giải phù hợp. Nhận dạng được dạng toán và áp dụng vào bài toán.
- 2 điểm (Tốt): Học sinh lựa chọn đúng, hiểu được đầy đủ quá trình giải bài toán, sắp xếp đúng từ 2 cách giải trở lên. Đề xuất được các cách giải khác nhau.

Vui lòng:
1. Đánh giá chiến lược giải của học sinh
2. Cho điểm (0, 1 hoặc 2)
3. Ghi mức năng lực: "cần cố gắng", "đạt", hoặc "tốt"
4. Viết nhận xét ngắn (1-2 câu)

Trả lời dưới dạng JSON (KHÔNG có markdown):
{"diem": number, "muc_nang_luc": "string", "nhan_xet": "string"}`;

    return await parseEvaluationResponse(prompt);
  } catch (error) {
    console.error('Error evaluating Tiêu chí 2:', error);
    return { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi khi đánh giá' };
  }
};

// Tiêu chí 3: Trình bày được cách thức giải quyết vấn đề
// Đánh giá: thực hiện đúng các bước, phép tính, trình bày rõ ràng, giải thích logic
const evaluateTieuChi3 = async (studentAnswers, worksheet) => {
  try {
    const allAnswers = formatAllAnswers(studentAnswers, worksheet);
    
    const prompt = `
TIÊU CHÍ 3: TRÌNH BÀY ĐƯỢC CÁCH THỨC GIẢI QUYẾT VẤN ĐỀ

Bài toán: ${worksheet.bai_3?.text || worksheet.bai_1?.text || 'N/A'}

Lời giải của học sinh (Bài 3 - Tự do):
${studentAnswers.bai_3?.bai_lam || 'Không có'}

Giải thích của học sinh:
${studentAnswers.bai_3?.giai_thich || 'Không có'}

Tất cả bài làm:
${allAnswers}

HƯỚNG DẪN ĐÁNH GIÁ:
- 0 điểm (Cần cố gắng): Tính toán sai nhiều, lời giải thiếu logic hoặc chưa đầy đủ, trình bày không rõ ràng.
- 1 điểm (Đạt): Thực hiện đúng các bước giải và phép tính cơ bản, trình bày lời giải rõ ràng và đầy đủ.
- 2 điểm (Tốt): Thực hiện đúng và đầy đủ các bước giải, phép tính chính xác, trình bày lời giải mạch lạc, có giải thích hợp lý cho các bước giải.

Vui lòng:
1. Đánh giá chất lượng trình bày và phép tính
2. Cho điểm (0, 1 hoặc 2)
3. Ghi mức năng lực: "cần cố gắng", "đạt", hoặc "tốt"
4. Viết nhận xét ngắn (1-2 câu)

Trả lời dưới dạng JSON (KHÔNG có markdown):
{"diem": number, "muc_nang_luc": "string", "nhan_xet": "string"}`;

    return await parseEvaluationResponse(prompt);
  } catch (error) {
    console.error('Error evaluating Tiêu chí 3:', error);
    return { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi khi đánh giá' };
  }
};

// Tiêu chí 4: Kiểm tra được giải pháp đã thực hiện
// Đánh giá: kiểm tra tính đúng, vận dụng vào bài mở rộng, so sánh các cách giải
const evaluateTieuChi4 = async (studentAnswers, worksheet) => {
  try {
    const allAnswers = formatAllAnswers(studentAnswers, worksheet);
    
    const prompt = `
TIÊU CHÍ 4: KIỂM TRA ĐƯỢC GIẢI PHÁP ĐÃ THỰC HIỆN

Bài toán: ${worksheet.bai_3?.text || worksheet.bai_1?.text || 'N/A'}

Bài làm của học sinh:
${allAnswers}

Bài 4 (Kiểm tra & mở rộng):
${formatBai4Info(studentAnswers, worksheet)}

HƯỚNG DẪN ĐÁNH GIÁ:
- 0 điểm (Cần cố gắng): Không kiểm tra kết quả bài toán, không vận dụng được vào bài toán mở rộng, thiếu suy luận logic.
- 1 điểm (Đạt): Thực hiện được một trong hai: (a) Kiểm tra được kết quả bài toán bằng phép tính, hoặc (b) Giải được bài toán mở rộng bằng cách cơ bản.
- 2 điểm (Tốt): Kiểm tra đúng kết quả bài toán, giải đúng bài toán mở rộng, so sánh hoặc giải thích được cách giải nào hợp lý hơn.

Vui lòng:
1. Đánh giá khả năng kiểm tra và vận dụng
2. Cho điểm (0, 1 hoặc 2)
3. Ghi mức năng lực: "cần cố gắng", "đạt", hoặc "tốt"
4. Viết nhận xét ngắn (1-2 câu)

Trả lời dưới dạng JSON (KHÔNG có markdown):
{"diem": number, "muc_nang_luc": "string", "nhan_xet": "string"}`;

    return await parseEvaluationResponse(prompt);
  } catch (error) {
    console.error('Error evaluating Tiêu chí 4:', error);
    return { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: 'Lỗi khi đánh giá' };
  }
};

// Helper function to parse evaluation response
const parseEvaluationResponse = async (prompt) => {
  try {
    const result = await geminiModelManager.generateContent(prompt);
    const responseText = result.response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        diem: Math.min(2, Math.max(0, Number(parsed.diem) || 0)),
        muc_nang_luc: normalizeLevel(String(parsed.muc_nang_luc || 'cần cố gắng')),
        nhan_xet: String(parsed.nhan_xet || '')
      };
    }
  } catch (error) {
    console.warn('Error parsing evaluation response:', error);
  }
  
  return { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' };
};

// Helper function to normalize level names
const normalizeLevel = (level) => {
  const normalized = level.toLowerCase().trim();
  if (normalized.includes('tốt')) return 'tốt';
  if (normalized.includes('đạt')) return 'đạt';
  return 'cần cố gắng';
};

// Helper function to format all answers for context
const formatAllAnswers = (studentAnswers, worksheet) => {
  let formatted = '';
  
  if (studentAnswers.bai_1?.selections) {
    const selections = Array.isArray(studentAnswers.bai_1.selections) 
      ? studentAnswers.bai_1.selections 
      : Object.values(studentAnswers.bai_1.selections);
    formatted += `Bài 1 (Nhận biết): ${selections.join(', ') || 'không chọn'}\n`;
  }
  
  if (studentAnswers.bai_2?.arrangements) {
    formatted += `Bài 2 (Sắp xếp): Xem chi tiết dưới đây\n`;
  }
  
  if (studentAnswers.bai_3?.bai_lam) {
    formatted += `Bài 3 (Tự do): ${studentAnswers.bai_3.bai_lam}\n`;
  }
  
  if (studentAnswers.bai_4?.answers) {
    formatted += `Bài 4 (Kiểm tra & mở rộng): Xem chi tiết dưới đây\n`;
  }
  
  return formatted || 'Không có bài làm';
};

// Helper function to format Bài 2 info
const formatBai2Info = (studentAnswers, worksheet) => {
  if (!studentAnswers.bai_2?.arrangements || !worksheet.bai_2) {
    return 'Không có dữ liệu';
  }
  
  let formatted = '';
  Object.entries(studentAnswers.bai_2.arrangements).forEach(([key, arr]) => {
    const items = Array.isArray(arr) ? arr : Object.values(arr);
    formatted += `${key}: ${items.join(' → ') || 'trống'}\n`;
  });
  
  return formatted;
};

// Helper function to format Bài 4 info
const formatBai4Info = (studentAnswers, worksheet) => {
  if (!studentAnswers.bai_4?.answers || !worksheet.bai_4) {
    return 'Không có dữ liệu';
  }
  
  let formatted = '';
  (worksheet.bai_4.questions || []).forEach((q) => {
    formatted += `${q.label}. ${q.text}\n`;
    
    if (q.type === 'cau_hoi_nho') {
      (q.subQuestions || []).forEach((sq, idx) => {
        const answer = studentAnswers.bai_4.answers[q.id]?.[idx] || '';
        formatted += `  - Câu ${idx + 1}: ${answer}\n`;
      });
    } else if (q.type === 'so_cach_giai') {
      for (let i = 0; i < q.content; i++) {
        const answer = studentAnswers.bai_4.answers[q.id]?.[i] || '';
        formatted += `  - Cách ${i + 1}: ${answer}\n`;
      }
    } else {
      const answer = studentAnswers.bai_4.answers[q.id] || '';
      formatted += `  Câu trả lời: ${answer}\n`;
    }
  });
  
  return formatted;
};

const calculateOverallLevel = (levels) => {
  const levelPriority = { tốt: 3, đạt: 2, 'cần cố gắng': 1 };
  
  let maxPriority = 0;
  let overallLevel = 'cần cố gắng';

  levels.forEach((level) => {
    const priority = levelPriority[level?.toLowerCase()] || 0;
    if (priority > maxPriority) {
      maxPriority = priority;
      overallLevel = level;
    }
  });

  return overallLevel;
};

// Generate detailed overall comment based on 4 criteria
const generateOverallComment = async (tieuchis, tongDiem, mucNangLucChung) => {
  try {
    const tieuchi1_feedback = tieuchis.tieuchi_1?.nhan_xet || '';
    const tieuchi2_feedback = tieuchis.tieuchi_2?.nhan_xet || '';
    const tieuchi3_feedback = tieuchis.tieuchi_3?.nhan_xet || '';
    const tieuchi4_feedback = tieuchis.tieuchi_4?.nhan_xet || '';

    const tieuchi1_level = tieuchis.tieuchi_1?.muc_nang_luc || 'Chưa đánh giá';
    const tieuchi2_level = tieuchis.tieuchi_2?.muc_nang_luc || 'Chưa đánh giá';
    const tieuchi3_level = tieuchis.tieuchi_3?.muc_nang_luc || 'Chưa đánh giá';
    const tieuchi4_level = tieuchis.tieuchi_4?.muc_nang_luc || 'Chưa đánh giá';

    const prompt = `Dựa vào kết quả đánh giá của học sinh theo 4 tiêu chí, viết một nhận xét chung chi tiết và khuyến khích:

TỔNG ĐIỂM: ${tongDiem}/8
MỨC NĂNG LỰC CHUNG: ${mucNangLucChung}

CHI TIẾT 4 TIÊU CHÍ:
1. Nhận biết được vấn đề (${tieuchi1_level}): ${tieuchi1_feedback}
2. Nêu được cách thức GQVĐ (${tieuchi2_level}): ${tieuchi2_feedback}
3. Trình bày được cách thức GQVĐ (${tieuchi3_level}): ${tieuchi3_feedback}
4. Kiểm tra được giải pháp (${tieuchi4_level}): ${tieuchi4_feedback}

HÃY VIẾT MỘT NHẬN XÉT CHUNG CHI TIẾT (5-7 câu) THEO TIÊU CHÍ bao gồm:
1. Tổng hợp mức độ hiểu biết (Tiêu chí 1-2) và khả năng trình bày (Tiêu chí 3-4)
2. Điểm mạnh chính: ở tiêu chí nào học sinh có điểm cao nhất
3. Hạn chế chính: ở tiêu chí nào học sinh cần cải thiện  
4. Lời khuyến khích cụ thể dựa vào điểm yếu nhất

Trả lời chỉ nhận xét (không có markdown, không có JSON).`;

    const result = await geminiModelManager.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    return responseText || `Học sinh đạt tổng điểm ${tongDiem}/8 với mức năng lực ${mucNangLucChung}. Cần tiếp tục cố gắng để nâng cao độ hiểu biết và khả năng trình bày.`;
  } catch (error) {
    console.error('Error generating overall comment:', error);
    return `Học sinh đạt tổng điểm ${tongDiem}/8 với mức năng lực ${mucNangLucChung}`;
  }
};
