import geminiModelManager from "./geminiModelManager";
import competencyEvaluationService from "./competencyEvaluationService";

// simple delay helper used by rate-limited wrapper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GeminiFeedbackService
 * Chứa các phương thức đánh giá và nhận xét
 */
export class GeminiFeedbackService {
  constructor() {
    // queue for rate-limited generate calls
    this._pending = Promise.resolve();
  }

  /**
   * Rate‑limited wrapper around geminiModelManager.generateContent
   */
  async _rateLimitedGenerate(prompt) {
    this._pending = this._pending.then(async () => {
      try {
        const res = await geminiModelManager.generateContent(prompt);
        await delay(2000);
        return res;
      } catch (err) {
        const is429 = err.status === 429 || (err.message && err.message.includes('429')) || (err.message && err.message.toLowerCase().includes('rate limit'));
        if (is429) {
          await delay(10000);
          try {
            const res2 = await geminiModelManager.generateContent(prompt);
            await delay(2000);
            return res2;
          } catch (err2) {
            console.warn('Second attempt failed for prompt, returning null', err2);
            await delay(2000);
            return null;
          }
        }
        throw err;
      }
    });
    return this._pending;
  }

  // Tính mức độ chung (mucDoChinh) dựa trên tổng điểm
  _calculateMucDoChinh(totalScore) {
    // 0-3 điểm: Cần cố gắng
    // 4-6 điểm: Đạt
    // 7-8 điểm: Tốt
    if (totalScore <= 3) {
      return 'Cần cố gắng';
    } else if (totalScore <= 6) {
      return 'Đạt';
    } else {
      return 'Tốt';
    }
  }

  /**
   * Evaluate question comments only (for displaying feedback to student)
   * Lightweight version - no competence assessment
   * @param {Array} studentAnswers - Array of answers
   * @param {Array} questions - Array of question objects
   * @returns {Object} - { questionComments: [...] }
   */
  async evaluateQuestionComments(studentAnswers, questions) {
    try {
      // Chuẩn bị dữ liệu câu hỏi kèm giải thích cho AI
      const questionsContext = questions.map((q, idx) => ({
        questionNum: idx + 1,
        text: q.text || q.question,
        options: q.options || [],
        studentAnswerIndex: studentAnswers[idx]?.answer,
        isCorrect: studentAnswers[idx]?.isCorrect,
        explanation: q.explanation || 'Không có giải thích'
      }));

      const prompt = `Bạn là giáo viên toán lớp 5 có kinh nghiệm trong việc cung cấp phản hồi chi tiết và khích lệ cho học sinh.

## Dữ liệu học sinh:
${JSON.stringify(questionsContext, null, 2)}

## Nhiệm vụ:
Viết NGẮN GỌN từ 2-4 câu (khoảng 30-40 chữ) nhận xét cho mỗi câu hỏi. Nhận xét phải:
- Chỉ rõ học sinh làm đúng hay sai
- Giải thích ngắn gọn TẠI SAO hoặc gợi ý cải thiện
- Tránh dài dòng, tập trung vào điểm chính

## QUY TẮC NGÔN NGỮ TIẾNG VIỆT:
- LƯU Ý: Dùng "bạn", "mình", hoặc tên gọi thân thiết - KHÔNG dùng "em", "học sinh"
- Ví dụ: "Bạn trả lời đúng! Lý do là..."
- Viết ngắn gọn, thân thiện, dễ hiểu

## Định dạng JSON (PHẢI ĐÚNG):
{
  "questionComments": [
    {
      "questionNum": 1,
      "comment": "Nhận xét NGẮN GỌN 2-4 câu (30-40 chữ), chỉ rõ đúng/sai và gợi ý nếu cần"
    }
  ]
}`;

      const result = await this._rateLimitedGenerate(prompt);
      const responseText = result ? result.response.text() : '';

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      const assessment = JSON.parse(jsonMatch[0]);
      return assessment.questionComments || [];
    } catch (error) {
      return []; // Return empty array on error
    }
  }

  /**
   * Evaluate competency using structured rubric (4 criteria: TC1-TC4)
   * @param {Array} studentAnswers - Array of answers
   * @param {Array} questions - Array of question objects
   * @returns {Object} - Competency evaluation with TC1-TC4 scores
   */
  async evaluateCompetencyFramework(studentAnswers, questions) {
    try {
      // Build problem statement from questions and context
      let problemStatement = '';
      if (questions && questions.length > 0) {
        const firstQuestion = questions[0];
        if (firstQuestion.exerciseContext) {
          problemStatement += `BÀI TOÁN:\n${firstQuestion.exerciseContext}\n\n`;
        }
        
        problemStatement += 'CÁC CÂU HỎI:\n';
        questions.forEach((q, idx) => {
          problemStatement += `${idx + 1}. ${q.text || q.question || 'Câu hỏi không rõ'}\n`;
          if (q.options && q.options.length > 0) {
            q.options.forEach((opt, optIdx) => {
              problemStatement += `   ${String.fromCharCode(65 + optIdx)}. ${opt}\n`;
            });
          }
        });
      } else {
        problemStatement = 'Không có thông tin bài toán';
      }

      // Build student responses from answers
      const studentResponses = studentAnswers.map((answer, idx) => {
        const question = questions[idx];
        if (!question) return `Câu ${idx + 1}: Không có thông tin`;
        
        const questionText = question.text || question.question || 'Câu hỏi không rõ';
        
        if (!answer) {
          return `Câu ${idx + 1} (${questionText}): Không trả lời`;
        }
        
        let responseText = `Câu ${idx + 1} (${questionText}): `;
        
        if (Array.isArray(answer.answer)) {
          const optionLetters = answer.answer.map(o => String.fromCharCode(65 + o));
          responseText += optionLetters.join(', ');
          if (question.options && answer.answer.length > 0) {
            const selectedOptions = answer.answer.map(o => question.options[o]);
            responseText += ` (${selectedOptions.join(', ')})`;
          }
        } else if (answer.answer !== null && answer.answer !== undefined) {
          const optionLetter = String.fromCharCode(65 + answer.answer);
          const optionText = question.options?.[answer.answer] || 'Lựa chọn không xác định';
          responseText += `${optionLetter} (${optionText})`;
        } else {
          responseText += 'Không trả lời';
        }
        
        if (answer.isCorrect !== undefined) {
          responseText += answer.isCorrect ? ' ✓ [Đúng]' : ' ✗ [Sai]';
        }
        
        return responseText;
      });

      // Generate the prompt for competency evaluation
      const prompt = competencyEvaluationService.generateCompetencyEvaluationPrompt(
        studentResponses,
        problemStatement
      );

      // Call Gemini API with key rotation for quota resilience
      const result = await this._rateLimitedGenerate(prompt);
      const responseText = result ? result.response.text() : '';

      // Parse the JSON response and translate to Vietnamese
      const competencyEvaluation = competencyEvaluationService.parseCompetencyEvaluation(responseText);
      
      // Validate the evaluation against correct/incorrect count
      const correctCount = studentAnswers.filter(answer => answer?.isCorrect === true).length;
      const totalCount = studentAnswers.length;
      const validation = competencyEvaluationService.validateCompetencyScore(
        competencyEvaluation,
        correctCount,
        totalCount
      );
      
      // Add validation info to evaluation result
      competencyEvaluation._validation = validation;
      
      // Log warnings if any (for debugging)
      if (!validation.isValid) {
        console.warn('⚠ Competency Evaluation Validation Warnings:', validation.warnings);
      }
      
      // Ensure all required fields exist
      if (!competencyEvaluation.tongDiem && competencyEvaluation.totalCompetencyScore) {
        competencyEvaluation.tongDiem = competencyEvaluation.totalCompetencyScore;
      }
      
      console.log('✅ Competency Evaluation Successfully Generated:', {
        tongDiem: competencyEvaluation.tongDiem,
        TC1: competencyEvaluation.TC1?.diem,
        TC2: competencyEvaluation.TC2?.diem,
        TC3: competencyEvaluation.TC3?.diem,
        TC4: competencyEvaluation.TC4?.diem
      });
      
      return competencyEvaluation;
    } catch (error) {
      console.error('❌ Error in evaluateCompetencyFramework:', error);
      return competencyEvaluationService.createEmptyEvaluation();
    }
  }

  /**
   * Đánh giá bài làm của học sinh theo khung năng lực 4 tiêu chí (TC1-TC4)
   * Mỗi TC tối đa 2 điểm, tổng tối đa 8 điểm
   * @param {Array} chatHistory - Lịch sử hội thoại giữa AI và học sinh
   * @param {string} problem - Nội dung bài toán
   * @returns {Promise<Object>} - Đánh giá chi tiết theo rubric
   */
  async evaluatePolyaStep(chatHistory, problem) {
    try {
      
      // Định dạng chatHistory để gửi cho Gemini
      let chatText = `BÀI TOÁN: ${problem}\n\n`;
      chatText += `LỊCH SỬ HỘI THOẠI:\n`;
      
      if (!chatHistory || chatHistory.length === 0) {
        chatText += '(Không có lịch sử hội thoại)';
      } else {
        chatHistory.forEach((msg, idx) => {
          const sender = msg.role === 'user' ? 'HỌC SINH' : 'AI';
          const text = msg.parts?.[0]?.text || msg.text || '';
          chatText += `${sender}: ${text}\n`;
        });
      }

      const evaluationPrompt = `Bạn là giáo viên toán lớp 5 có kinh nghiệm đánh giá năng lực giải quyết vấn đề toán học theo khung quy chuẩn.

${chatText}

NHIỆM VỤ: Dựa trên lịch sử hội thoại trên, đánh giá chi tiết năng lực học sinh theo 4 TIÊU CHÍ.

**TC1. NHẬN BIẾT ĐƯỢC VẤN ĐỀ CẦN GIẢI QUYẾT (Max 2 điểm)**
Mục tiêu: Xác định xem học sinh đã xác định đầy đủ dữ kiện, yêu cầu bài toán và mối liên hệ chưa?
- 0 điểm: Không xác định được đầy đủ thông tin, cần nhiều gợi ý từ trợ lí AI
- 1 điểm: Xác định được phần lớn dữ kiện và yêu cầu, nhưng có thể bỏ sót 1-2 chi tiết, cần gợi ý
- 2 điểm: Xác định chính xác toàn bộ dữ kiện, yêu cầu, và hiểu rõ mối quan hệ giữa chúng

**TC2. NÊU ĐƯỢC CÁCH THỨC GIẢI QUYẾT VẤN ĐỀ (Max 2 điểm)**
Mục tiêu: Đánh giá việc nhận dạng dạng toán, đề xuất phương pháp và chọn phép toán phù hợp
- 0 điểm: Không nhận dạng được dạng toán hoặc đề xuất phương pháp sai, không chọn được phép toán phù hợp
- 1 điểm: Nhận dạng được dạng toán cơ bản, chọn được phép toán phù hợp nhưng cần gợi ý
- 2 điểm: Nhận dạng đúng dạng toán, đề xuất được cách giải hợp lý, lựa chọn phép toán tối ưu

**TC3. TRÌNH BÀY ĐƯỢC CÁCH THỨC GIẢI QUYẾT (Max 2 điểm)**
Mục tiêu: Đánh giá tính chính xác của các phép tính, bước giải, và sự rõ ràng của trình bày
- 0 điểm: Các phép tính hay bước giải còn sai, lời giải không đầy đủ hoặc không logic
- 1 điểm: Thực hiện đúng các bước giải cơ bản, phép tính chủ yếu đúng, trình bày khá đầy đủ
- 2 điểm: Thực hiện đúng toàn bộ phép tính, trình bày lời giải logic, rõ ràng, dễ hiểu

**TC4. KIỂM TRA ĐƯỢC GIẢI PHÁP ĐÃ THỰC HIỆN (Max 2 điểm)**
Mục tiêu: Đánh giá việc kiểm tra lại kết quả và vận dụng vào các tình huống khác
- 0 điểm: Không kiểm tra lại kết quả, không điều chỉnh hoặc không vận dụng được
- 1 điểm: Kiểm tra lại kết quả, có điều chỉnh khi cần nhưng còn cần gợi ý; vận dụng có hạn
- 2 điểm: Kiểm tra lại kết quả bằng nhiều cách, vận dụng được vào bài toán tương tự hoặc nâng cao

HƯỚNG DẪN VIẾT NHẬN XÉT:
- Cho MỖI tiêu chí (TC1-4): Viết 6-8 câu nhận xét RẤT CHI TIẾT, CỤ THỂ, DÀI
- NHẬN XÉT TỔNG THỂ (tongNhanXet): Viết 6-8 câu TỔNG HỢP (DÀI, CHI TIẾT)

ĐỊNH DẠNG JSON (PHẢI ĐÚNG):
{
  "TC1": {
    "nhanXet": "Nhận xét RẤT CHI TIẾT 6-8 câu về nhận biết vấn đề",
    "diem": 0
  },
  "TC2": {
    "nhanXet": "Nhận xét RẤT CHI TIẾT 6-8 câu về cách thức giải quyết",
    "diem": 0
  },
  "TC3": {
    "nhanXet": "Nhận xét RẤT CHI TIẾT 6-8 câu về trình bày giải quyết",
    "diem": 0
  },
  "TC4": {
    "nhanXet": "Nhận xét RẤT CHI TIẾT 6-8 câu về kiểm tra và vận dụng",
    "diem": 0
  },
  "tongNhanXet": "Nhận xét TỔNG THỂ 6-8 câu",
  "tongDiem": 0,
  "mucDoChinh": "Cần cố gắng"
}`;

      // Sử dụng generateContent từ geminiModelManager
      const result = await this._rateLimitedGenerate(evaluationPrompt);
      const responseText = result.response.text().trim();
      
      // Parse JSON từ response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse evaluation response');
      }
      
      const evaluation = JSON.parse(jsonMatch[0]);
      
      // Validate structure và fill missing fields
      const validatedEval = {
        TC1: evaluation.TC1 || { nhanXet: 'Chưa đánh giá', diem: 0 },
        TC2: evaluation.TC2 || { nhanXet: 'Chưa đánh giá', diem: 0 },
        TC3: evaluation.TC3 || { nhanXet: 'Chưa đánh giá', diem: 0 },
        TC4: evaluation.TC4 || { nhanXet: 'Chưa đánh giá', diem: 0 },
        tongNhanXet: evaluation.tongNhanXet || 'Lỗi khi đánh giá',
        tongDiem: evaluation.tongDiem || 0,
        mucDoChinh: this._calculateMucDoChinh(evaluation.tongDiem || 0)
      };
      
      return validatedEval;
    } catch (error) {
      return {
        TC1: { nhanXet: 'Không thể đánh giá - Vui lòng thử lại', diem: 0 },
        TC2: { nhanXet: 'Không thể đánh giá - Vui lòng thử lại', diem: 0 },
        TC3: { nhanXet: 'Không thể đánh giá - Vui lòng thử lại', diem: 0 },
        TC4: { nhanXet: 'Không thể đánh giá - Vui lòng thử lại', diem: 0 },
        tongNhanXet: `Lỗi: ${error.message}. Vui lòng tải lại trang hoặc liên hệ hỗ trợ.`,
        tongDiem: 0,
        mucDoChinh: 'Cần cố gắng'
      };
    }
  }

  /**
   * Tạo nhận xét chung dựa trên điểm 4TC và chủ đề
   * @param {Object} currentEval - Đánh giá hiện tại với TC1-TC4
   * @param {string} topic - Chủ đề (ví dụ: "cộng số thập phân")
   * @param {string} deBai - Đề bài
   * @returns {Promise<string>} - Nhận xét chung
   */
  async generateGeneralComment(currentEval, topic, deBai) {
    try {
      const scores = {
        TC1: currentEval?.TC1?.diem || 0,
        TC2: currentEval?.TC2?.diem || 0,
        TC3: currentEval?.TC3?.diem || 0,
        TC4: currentEval?.TC4?.diem || 0,
      };
      
      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
      const topicText = `${topic || ''} ${deBai || ''}`.toLowerCase();

      // Infer the exact skill focus to keep feedback tied to the current lesson title.
      let lessonFocus = topic || 'toán học';
      let focusKeywords = 'phân tích đề, chọn phép tính phù hợp, trình bày bài giải rõ ràng';
      let focusRule = 'thực hiện đúng quy tắc của dạng toán hiện tại và kiểm tra lại kết quả';

      if (topicText.includes('cộng') && topicText.includes('thập phân')) {
        lessonFocus = 'cộng số thập phân';
        focusKeywords = 'đặt tính theo cột dọc, thẳng cột các hàng, dấu phẩy thẳng hàng, cộng lần lượt từ phải sang trái';
        focusRule = 'khi số chữ số thập phân khác nhau có thể thêm 0 vào bên phải phần thập phân trước khi cộng';
      } else if (topicText.includes('trừ') && topicText.includes('thập phân')) {
        lessonFocus = 'trừ số thập phân';
        focusKeywords = 'đặt tính theo cột dọc, thẳng cột các hàng, dấu phẩy thẳng hàng, mượn đúng khi trừ';
        focusRule = 'khi số chữ số thập phân khác nhau có thể thêm 0 vào bên phải phần thập phân trước khi trừ';
      } else if (topicText.includes('nhân') && topicText.includes('thập phân')) {
        lessonFocus = 'nhân số thập phân';
        focusKeywords = 'nhân như số tự nhiên, đếm tổng chữ số phần thập phân, đặt dấu phẩy đúng vị trí ở tích';
        focusRule = 'trình bày rõ bước nhân từng hàng và kiểm tra lại vị trí dấu phẩy ở kết quả cuối cùng';
      } else if (topicText.includes('chia') && topicText.includes('thập phân')) {
        lessonFocus = 'chia số thập phân';
        focusKeywords = 'dịch dấu phẩy để đưa về phép chia phù hợp, chia tuần tự, hạ chữ số đúng quy tắc';
        focusRule = 'xử lý dấu phẩy ở số bị chia/số chia chính xác trước khi thực hiện chia';
      }
      
      // Build detailed evaluation context based on TC scores
      let evaluationContext = `\nPhân tích chi tiết:\n`;
      evaluationContext += `- TC1 (Nhận biết vấn đề): ${scores.TC1}/2 - ${scores.TC1 === 2 ? 'Học sinh đã nắm vững' : scores.TC1 === 1 ? 'Học sinh hiểu phần lớn' : 'Học sinh cần cải thiện'}\n`;
      evaluationContext += `- TC2 (Cách thức giải): ${scores.TC2}/2 - ${scores.TC2 === 2 ? 'Lựa chọn phương pháp tối ưu' : scores.TC2 === 1 ? 'Chọn phương pháp nhưng còn vấn đề' : 'Còn khó khăn trong phương pháp'}\n`;
      evaluationContext += `- TC3 (Trình bày giải): ${scores.TC3}/2 - ${scores.TC3 === 2 ? 'Trình bày rõ ràng, logic' : scores.TC3 === 1 ? 'Trình bày tạm ổn nhưng chưa chi tiết' : 'Trình bày chưa rõ ràng'}\n`;
      evaluationContext += `- TC4 (Kiểm tra kết quả): ${scores.TC4}/2 - ${scores.TC4 === 2 ? 'Đáp số chính xác, kiểm chứng tốt' : scores.TC4 === 1 ? 'Đáp số chủ yếu đúng' : 'Đáp số sai'}\n`;
      
      const prompt = `Bạn là một giáo viên toán lớp 5 có kinh nghiệm, đang viết nhận xét chuyên môn cho trang báo cáo kết quả.

THÔNG TIN ĐÁNH GIÁ:
Chủ đề hiển thị: ${topic}
Trọng tâm bài hiện tại: ${lessonFocus}
Đề bài: ${deBai}
Điểm 4TC: TC1=${scores.TC1}/2, TC2=${scores.TC2}/2, TC3=${scores.TC3}/2, TC4=${scores.TC4}/2
Tổng điểm: ${totalScore}/8
Từ khóa bắt buộc bám sát: ${focusKeywords}
Quy tắc cần nhấn mạnh: ${focusRule}
${evaluationContext}

HƯỚNG DẪN VIẾT NHẬN XÉT CHUNG:
Hãy viết nhận xét (6-8 câu) từ góc độ giáo viên, bám sát CHÍNH XÁC trọng tâm "${lessonFocus}" và các điểm mạnh/yếu cụ thể:

1️⃣ NHẬN XÉT TÍCH CỰC (Điểm mạnh):
- Nêu rõ điều gì học sinh đã làm tốt trong chủ đề ${lessonFocus}
- Dùng ví dụ cụ thể liên quan đến quy tắc/khái niệm của ${lessonFocus}
- Ví dụ: "Học sinh đã đọc hiểu đúng của bài toán", "Học sinh tính toán chính xác", v.v.

2️⃣ NHẬN XÉT CẦN CẢI THIỆN (Điểm yếu):
- Nêu cụ thể những lỗi hoặc thiếu sót liên quan đến "${lessonFocus}"
- Không nói chung chung, mà phải cụ thể về quy tắc/bước làm
- Ví dụ cho cộng số thập phân: "Cần chú ý đặt dấu phẩy thẳng hàng", "Nên thêm số 0 vào bên phải", v.v.

3️⃣ GỢI Ý CẢI THIỆN:
- Đưa ra cách cụ thể để học sinh tránh lỗi
- Khuyến khích luyện tập thêm các dạng bài tương tự

NGÔN NGỮ:
- TUYỆT ĐỐI KHÔNG mở đầu bằng lời chào như "Chào phụ huynh", "Chào phụ huynh và học sinh", "Kính gửi", ...
- Bắt đầu trực tiếp bằng nhận định chuyên môn.
- Viết từ góc độ giáo viên (không xưng "em", không xưng "cô", ưu tiên dùng "học sinh").
- Bám sát chủ đề: dùng từ khóa, quy tắc, khái niệm của ${lessonFocus}
- Thân thiện, tích cực, nhưng chuyên nghiệp
- Dễ hiểu cho phụ huynh lớp 5`;

      const result = await this._rateLimitedGenerate(prompt);
      const rawComment = result?.response?.text?.() || result?.text?.() || '';
      const comment = String(rawComment)
        .replace(/^\s*(chào|kính gửi)[^\n]*\n?/i, '')
        .replace(/^\s*(thưa)[^\n]*\n?/i, '')
        .trim();
      
      return comment;
    } catch (error) {
      console.error('Error generating general comment:', error);
      return 'Không thể tạo nhận xét chung. Vui lòng thử lại.';
    }
  }

}

const geminiFeedbackServiceInstance = new GeminiFeedbackService();
export default geminiFeedbackServiceInstance;
