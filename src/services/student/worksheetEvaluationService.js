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

    return {
      ...evaluations,
      tongDiem,
      mucNangLucChung,
      nhanXetChung: `Học sinh đạt tổng điểm ${tongDiem} với mức năng lực ${mucNangLucChung}`
    };
  } catch (error) {
    console.error('Error evaluating worksheet:', error);
    return {
      bai_1: { evaluation: {} },
      bai_2: { evaluation: {} },
      bai_3: { evaluation: {} },
      bai_4: { evaluation: {} },
      tongDiem: 0,
      mucNangLucChung: 'Chưa đánh giá'
    };
  }
};

const evaluateBai1 = async (studentAnswers, worksheet) => {
  try {
    const prompt = `
Bài 1: ${worksheet.bai_1.text}

Cách đánh giá: ${worksheet.bai_1.explanation}

Các câu hỏi:
${(worksheet.bai_1.questions || []).map((q) => `- ${q.id}: ${q.text}`).join('\n')}

Học sinh đã chọn: ${studentAnswers.bai_1.selections.join(', ') || 'không chọn'}

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
    
    // Parse JSON từ response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        evaluation: JSON.parse(jsonMatch[0])
      };
    }

    return { evaluation: { diem: 0 } };
  } catch (error) {
    console.error('Error evaluating Bài 1:', error);
    return { evaluation: { diem: 0 } };
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
  .map(([key, arr]) => `${key}: ${arr.join(', ') || 'trống'}`)
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
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        evaluation: JSON.parse(jsonMatch[0])
      };
    }

    return { evaluation: { diem: 0 } };
  } catch (error) {
    console.error('Error evaluating Bài 2:', error);
    return { evaluation: { diem: 0 } };
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
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        evaluation: JSON.parse(jsonMatch[0])
      };
    }

    return { evaluation: { diem: 0 } };
  } catch (error) {
    console.error('Error evaluating Bài 3:', error);
    return { evaluation: { diem: 0 } };
  }
};

const evaluateBai4 = async (studentAnswers, worksheet) => {
  try {
    let questionsInfo = '';
    
    (worksheet.bai_4.questions || []).forEach((q) => {
      questionsInfo += `\n${q.label}. ${q.text}\n`;
      
      if (q.type === 'cau_hoi_nho') {
        questionsInfo += `  Loại: Câu hỏi nhỏ\n`;
        (q.subQuestions || []).forEach((sq, idx) => {
          questionsInfo += `  - Câu ${idx + 1}: ${sq.text}\n`;
          questionsInfo += `    Câu trả lời: ${studentAnswers.bai_4.answers[q.id]?.[idx] || 'trống'}\n`;
        });
      } else if (q.type === 'so_cach_giai') {
        questionsInfo += `  Loại: ${q.content} cách giải\n`;
        for (let i = 0; i < q.content; i++) {
          questionsInfo += `  - Cách ${i + 1}: ${studentAnswers.bai_4.answers[q.id]?.[i] || 'trống'}\n`;
        }
      } else {
        questionsInfo += `  Câu trả lời: ${studentAnswers.bai_4.answers[q.id] || 'trống'}\n`;
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
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        evaluation: JSON.parse(jsonMatch[0])
      };
    }

    return { evaluation: { diem: 0 } };
  } catch (error) {
    console.error('Error evaluating Bài 4:', error);
    return { evaluation: { diem: 0 } };
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
