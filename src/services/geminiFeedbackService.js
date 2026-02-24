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
Viết TỪ NĂM ĐẾN NỬA NĂM LỜI NHẬN XÉT CHI TIẾT cho mỗi câu hỏi. Nhận xét phải:
- Chỉ rõ học sinh làm đúng/sai điểm nào cụ thể
- Giải thích TẠI SAO câu trả lời đó đúng hoặc sai
- Đưa ra gợi ý xây dựng nếu học sinh trả lời sai
- Khích lệ và chia sẻ những điểm tốt của học sinh
- Tránh để nhận xét quá chung chung

## QUY TẮC NGÔN NGỮ TIẾNG VIỆT:
- LƯU Ý: Dùng "bạn", "mình", hoặc tên gọi thân thiết - KHÔNG dùng "em", "học sinh"
- Ví dụ: "Bạn trả lời rất tốt, bạn đã xác định đúng..."
- Viết trang trọng nhưng thân thiện, gần gũi

## Định dạng JSON (PHẢI ĐÚNG):
{
  "questionComments": [
    {
      "questionNum": 1,
      "comment": "Nhận xét CHI TIẾT dài 5-8 câu (80-150 từ), giải thích rõ ràng vì sao đúng/sai, nêu gợi ý nếu cần"
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
      
      return competencyEvaluation;
    } catch (error) {
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
   * Tạo overallAssessment từ TC1-4 nhận xét
   * @param {Object} evaluation - Evaluation object with TC1-4
   * @returns {Object} - Overall assessment with strengths, weaknesses, areas to improve, recommendations
   */
  async generateOverallAssessment(evaluation) {
    try {
      const tc1Comment = evaluation.TC1?.nhanXet || '';
      const tc2Comment = evaluation.TC2?.nhanXet || '';
      const tc3Comment = evaluation.TC3?.nhanXet || '';
      const tc4Comment = evaluation.TC4?.nhanXet || '';
      const totalComment = evaluation.tongNhanXet || '';

      const prompt = `Dựa vào nhận xét chi tiết từ 4 tiêu chí đánh giá năng lực sau:

TC1 (Nhận biết vấn đề): ${tc1Comment}

TC2 (Nêu cách giải): ${tc2Comment}

TC3 (Trình bày giải): ${tc3Comment}

TC4 (Kiểm tra và vận dụng): ${tc4Comment}

NHẬN XÉT TỔNG THỂ: ${totalComment}
`;

      const result = await this._rateLimitedGenerate(prompt);
      const responseText = result ? result.response.text().trim() : '';

      // Parse JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          strengths: ['Không thể tạo đánh giá chi tiết'],
          weaknesses: ['Vui lòng tải lại trang'],
          recommendations: ['Liên hệ hỗ trợ'],
          encouragement: 'Hãy cố gắng thêm, bạn sẽ thành công!'
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        recommendations: parsed.recommendations || [],
        encouragement: parsed.encouragement || 'Bạn đang trên đúng con đường!'
      };
    } catch (error) {
      return {
        strengths: ['Không thể tạo đánh giá chi tiết'],
        weaknesses: ['Vui lòng tải lại trang'],
        recommendations: ['Liên hệ hỗ trợ'],
        encouragement: 'Hãy cố gắng thêm, bạn sẽ thành công!'
      };
    }
  }
}

const geminiFeedbackServiceInstance = new GeminiFeedbackService();
export default geminiFeedbackServiceInstance;
