import geminiModelManager from '../gemini/geminiModelManager';

// Evaluate worksheet answers using Gemini API
export const evaluateWorksheet = async (studentAnswers, worksheet) => {
  try {
    // Prepare evaluation prompts for each bài
    const evaluations = {
      bai_1: await evaluateBai1(studentAnswers, worksheet),
      bai_2: await evaluateBai2(studentAnswers, worksheet),
      bai_3: await evaluateBai3(studentAnswers, worksheet),
      bai_4: await evaluateBai4(studentAnswers, worksheet)
    };

    // Calculate overall score
    const tongDiem =
      (evaluations.bai_1?.evaluation?.diem || 0) +
      (evaluations.bai_2?.evaluation?.diem || 0) +
      (evaluations.bai_3?.evaluation?.diem || 0) +
      (evaluations.bai_4?.evaluation?.diem || 0);

    const mucNangLucChung = calculateOverallLevel(
      [
        evaluations.bai_1?.evaluation?.muc_nang_luc,
        evaluations.bai_2?.evaluation?.muc_nang_luc,
        evaluations.bai_3?.evaluation?.muc_nang_luc,
        evaluations.bai_4?.evaluation?.muc_nang_luc
      ].filter(Boolean)
    );

    // Generate detailed overall comment from AI
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
      bai_1: { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } },
      bai_2: { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } },
      bai_3: { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } },
      bai_4: { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } },
      tongDiem: 0,
      mucNangLucChung: 'Chưa đánh giá'
    };
  }
};

const evaluateBai1 = async (studentAnswers, worksheet) => {
  try {
    // Handle selections as either array or object format
    let selections = studentAnswers.bai_1.selections || [];
    if (typeof selections === 'object' && !Array.isArray(selections)) {
      selections = Object.values(selections);
    }
    
    const prompt = `
Bài 1: ${worksheet.bai_1.text}

Cách đánh giá: ${worksheet.bai_1.explanation}

Các câu hỏi:
${(worksheet.bai_1.questions || []).map((q) => `- ${q.id}: ${q.text}`).join('\n')}

Học sinh đã chọn: ${selections.join(', ') || 'không chọn'}

Vui lòng đánh giá:
1. Dựa vào các tiêu chí trong "Cách đánh giá"
2. Cho điểm (0, 1 hoặc 2)
3. Xác định mức năng lực (cần cố gắng, đạt, tốt)
4. Viết nhận xét ngắn

Trả lời dưới dạng JSON:
{
  "diem": number,
  "muc_nang_luc": "string",
  "nhan_xet": "string"
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse JSON from response - more robust
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          evaluation: {
            diem: Number(parsed.diem) || 0,
            muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng'),
            nhan_xet: String(parsed.nhan_xet || '')
          }
        };
      }
    } catch (parseError) {
      console.warn('JSON parse error for Bài 1:', parseError);
    }

    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } };
  } catch (error) {
    console.error('Error evaluating Bài 1:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } };
  }
};

const evaluateBai2 = async (studentAnswers, worksheet) => {
  try {
    const prompt = `
Bài 2: ${worksheet.bai_2.text}

Số cách giải: ${worksheet.bai_2.so_cach_giai}

Cách đánh giá: ${worksheet.bai_2.explanation}

Các bước có sẵn:
${(worksheet.bai_2.questions || []).map((q) => `- ${q.id}: ${q.text}`).join('\n')}

Sắp xếp của học sinh:
${Object.entries(studentAnswers.bai_2.arrangements)
  .map(([key, arr]) => {
    // Handle both array and object formats (object if converted from array for Firestore)
    const items = Array.isArray(arr) ? arr : Object.values(arr);
    return `${key}: ${items.join(', ') || 'trống'}`;
  })
  .join('\n')}

Vui lòng đánh giá:
1. Dựa vào các tiêu chí trong "Cách đánh giá"
2. Cho điểm (0, 1 hoặc 2)
3. Xác định mức năng lực (cần cố gắng, đạt, tốt)
4. Viết nhận xét ngắn

Trả lời dưới dạng JSON:
{
  "diem": number,
  "muc_nang_luc": "string",
  "nhan_xet": "string"
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          evaluation: {
            diem: Number(parsed.diem) || 0,
            muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng'),
            nhan_xet: String(parsed.nhan_xet || '')
          }
        };
      }
    } catch (parseError) {
      console.warn('JSON parse error for Bài 2:', parseError);
    }

    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } };
  } catch (error) {
    console.error('Error evaluating Bài 2:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } };
  }
};

const evaluateBai3 = async (studentAnswers, worksheet) => {
  try {
    const prompt = `
Bài 3: ${worksheet.bai_3.text}

Cách đánh giá: ${worksheet.bai_3.explanation}

Bài làm của học sinh:
${studentAnswers.bai_3.bai_lam || 'không có'}

Giải thích:
${studentAnswers.bai_3.giai_thich || 'không có'}

Vui lòng đánh giá:
1. Dựa vào các tiêu chí trong "Cách đánh giá"
2. Cho điểm (0, 1 hoặc 2)
3. Xác định mức năng lực (cần cố gắng, đạt, tốt)
4. Viết nhận xét ngắn

Trả lời dưới dạng JSON:
{
  "diem": number,
  "muc_nang_luc": "string",
  "nhan_xet": "string"
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          evaluation: {
            diem: Number(parsed.diem) || 0,
            muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng'),
            nhan_xet: String(parsed.nhan_xet || '')
          }
        };
      }
    } catch (parseError) {
      console.warn('JSON parse error for Bài 3:', parseError);
    }

    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } };
  } catch (error) {
    console.error('Error evaluating Bài 3:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } };
  }
};

const evaluateBai4 = async (studentAnswers, worksheet) => {
  try {
    // Helper to get value from both array and object formats
    const getAnswerValue = (answers, idx) => {
      if (Array.isArray(answers)) {
        return answers[idx] || '';
      } else if (typeof answers === 'object' && answers !== null) {
        return answers[idx.toString()] || answers[idx] || '';
      }
      return '';
    };

    let questionsInfo = '';
    
    (worksheet.bai_4.questions || []).forEach((q) => {
      questionsInfo += `\n${q.label}. ${q.text}\n`;
      
      if (q.type === 'cau_hoi_nho') {
        questionsInfo += `  Loại: Câu hỏi nhỏ\n`;
        (q.subQuestions || []).forEach((sq, idx) => {
          const answer = getAnswerValue(studentAnswers.bai_4.answers[q.id], idx);
          questionsInfo += `  - Câu ${idx + 1}: ${sq.text}\n`;
          questionsInfo += `    Câu trả lời: ${answer || 'trống'}\n`;
        });
      } else if (q.type === 'so_cach_giai') {
        questionsInfo += `  Loại: ${q.content} cách giải\n`;
        for (let i = 0; i < q.content; i++) {
          const answer = getAnswerValue(studentAnswers.bai_4.answers[q.id], i);
          questionsInfo += `  - Cách ${i + 1}: ${answer || 'trống'}\n`;
        }
      } else {
        const answer = studentAnswers.bai_4.answers[q.id];
        questionsInfo += `  Câu trả lời: ${answer || 'trống'}\n`;
      }
    });

    const prompt = `
Bài 4:

${questionsInfo}

Cách đánh giá: ${worksheet.bai_4.explanation}

Vui lòng đánh giá:
1. Dựa vào các tiêu chí trong "Cách đánh giá"
2. Cho điểm (0, 1 hoặc 2)
3. Xác định mức năng lực (cần cố gắng, đạt, tốt)
4. Viết nhận xét ngắn

Trả lời dưới dạng JSON:
{
  "diem": number,
  "muc_nang_luc": "string",
  "nhan_xet": "string"
}`;

    const result = await geminiModelManager.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          evaluation: {
            diem: Number(parsed.diem) || 0,
            muc_nang_luc: String(parsed.muc_nang_luc || 'cần cố gắng'),
            nhan_xet: String(parsed.nhan_xet || '')
          }
        };
      }
    } catch (parseError) {
      console.warn('JSON parse error for Bài 4:', parseError);
    }

    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } };
  } catch (error) {
    console.error('Error evaluating Bài 4:', error);
    return { evaluation: { diem: 0, muc_nang_luc: 'cần cố gắng', nhan_xet: '' } };
  }
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

const generateOverallComment = async (evaluations, tongDiem, mucNangLucChung) => {
  try {
    const bai_1_feedback = evaluations.bai_1?.evaluation?.nhan_xet || '';
    const bai_2_feedback = evaluations.bai_2?.evaluation?.nhan_xet || '';
    const bai_3_feedback = evaluations.bai_3?.evaluation?.nhan_xet || '';
    const bai_4_feedback = evaluations.bai_4?.evaluation?.nhan_xet || '';

    const bai_1_level = evaluations.bai_1?.evaluation?.muc_nang_luc || 'Chưa đánh giá';
    const bai_2_level = evaluations.bai_2?.evaluation?.muc_nang_luc || 'Chưa đánh giá';
    const bai_3_level = evaluations.bai_3?.evaluation?.muc_nang_luc || 'Chưa đánh giá';
    const bai_4_level = evaluations.bai_4?.evaluation?.muc_nang_luc || 'Chưa đánh giá';

    const prompt = `Dựa vào kết quả đánh giá của học sinh ở 4 bài, viết một nhận xét chung chi tiết và khuyến khích:

TỔNG ĐIỂM: ${tongDiem}/8
MỨC NĂNG LỰC CHUNG: ${mucNangLucChung}

CHI TIẾT TỪNG BÀI:
- Bài 1 (${bai_1_level}): ${bai_1_feedback}
- Bài 2 (${bai_2_level}): ${bai_2_feedback}
- Bài 3 (${bai_3_level}): ${bai_3_feedback}
- Bài 4 (${bai_4_level}): ${bai_4_feedback}

HÃY VIẾT MỘT NHẬN XÉT CHUNG CHI TIẾT (5-7 câu) bao gồm:
1. Tổng hợp kết quả học tập
2. Điểm mạnh của học sinh
3. Hạn chế cần cải thiện
4. Lời khuyến khích cụ thể

Trả lời chỉ nhận xét (không có JSON, không có định dạng đặc biệt, chỉ dắc chữ).`;

    const result = await geminiModelManager.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    return responseText || `Học sinh đạt tổng điểm ${tongDiem}/8 với mức năng lực ${mucNangLucChung}`;
  } catch (error) {
    console.error('Error generating overall comment:', error);
    return `Học sinh đạt tổng điểm ${tongDiem}/8 với mức năng lực ${mucNangLucChung}`;
  }
};
