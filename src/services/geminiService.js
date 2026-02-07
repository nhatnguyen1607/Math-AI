import geminiModelManager from "./geminiModelManager";

// System prompt cho AI trợ lý học toán
const SYSTEM_PROMPT = `Mình là trợ lý học tập ảo thân thiện, hỗ trợ bạn lớp 5 giải toán theo 4 bước Polya.

NGUYÊN TẮC QUAN TRỌNG:
- KHÔNG BAO GIỜ giải bài toán thay bạn
- KHÔNG đưa ra đáp án dù bạn làm sai
- CHỈ đặt câu hỏi gợi mở, định hướng
- MỖI LẦN CHỈ HỎI 1 CÂU
- Phát hiện lỗi sai của bạn và gợi ý để bạn tự sửa
- Ngôn ngữ thân thiện, dễ thương như người bạn

4 BƯỚC GIẢI TOÁN:
1. HIỂU BÀI TOÁN: Xác định dữ kiện đã cho và yêu cầu bài toán
2. LẬP KẾ HOẠCH: Đề xuất các bước giải, phép tính phù hợp
3. THỰC HIỆN: Thực hiện phép tính, trình bày lời giải
4. KIỂM TRA & MỞ RỘNG: Kiểm tra kết quả, tìm cách giải khác

ĐÁNH GIÁ MỨC ĐỘ:
- Cần cố gắng: Chưa hiểu rõ, nhiều sai sót
- Đạt: Hiểu cơ bản, làm đúng một phần
- Tốt: Hiểu rõ, làm đúng, trình bày tốt`;

export class GeminiService {
  constructor() {
    this.chat = null;
    this.currentStep = 1;
    this.currentProblem = "";
    this.studentResponses = [];
    this.stepEvaluations = {
      step1: null, // Hiểu bài toán
      step2: null, // Lập kế hoạch
      step3: null, // Thực hiện
      step4: null  // Kiểm tra
    };
  }

  // Bắt đầu bài toán mới
  async startNewProblem(problemText) {
    this.currentProblem = problemText;
    this.currentStep = 1;
    this.studentResponses = [];
    this.stepEvaluations = {
      step1: null,
      step2: null,
      step3: null,
      step4: null
    };

    // Khởi tạo chat mới
    const model = geminiModelManager.getModel();
    this.chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }],
        },
        {
          role: "model",
          parts: [{ text: "Chào bạn! Mình là trợ lý học toán, sẽ đồng hành cùng bạn giải toán theo 4 bước nhé! Mình sẽ không giải hộ bạn mà chỉ hỏi các câu để bạn tự tìm ra cách giải. Sẵn sàng bắt đầu chưa? 😊" }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    // Gửi đề bài và bắt đầu bước 1
    const initialPrompt = `Đề bài: ${problemText}

Hãy bắt đầu BƯỚC 1: HIỂU BÀI TOÁN
Đặt 1 câu hỏi đầu tiên để giúp bạn xác định dữ kiện hoặc yêu cầu của bài toán.
Nhớ: Chỉ hỏi 1 câu, ngôn ngữ thân thiện.`;

    try {
      const result = await this.chat.sendMessage(initialPrompt);
      const response = result.response.text();

      return {
        message: response,
        step: 1,
        stepName: "Hiểu bài toán"
      };
    } catch (error) {
      console.error("Error in startNewProblem:", error);
      throw error;
    }
  }

  // Xử lý phản hồi của bạn
  async processStudentResponse(studentAnswer) {
    if (!this.chat) {
      throw new Error("Chưa khởi tạo bài toán. Vui lòng gọi startNewProblem() trước.");
    }

    this.studentResponses.push({
      step: this.currentStep,
      answer: studentAnswer,
      timestamp: new Date()
    });

    // Tạo context cho AI dựa vào bước hiện tại
    let contextPrompt = this._buildContextPrompt(studentAnswer);

    let result;
    try {
      result = await this.chat.sendMessage(contextPrompt);
    } catch (error) {
      console.error("Error in chat.sendMessage, attempting fallback:", error);
      
      // Nếu chat session lỗi, thử tạo chat mới với model fallback
      const newModel = geminiModelManager.getNextAvailableModel();
      if (!newModel) {
        throw new Error("Không có model nào khả dụng");
      }
      
      this.chat = newModel.startChat({
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });
      
      result = await this.chat.sendMessage(contextPrompt);
    }
    
    let response = result.response.text();

    // Phân tích xem AI có muốn chuyển bước không
    let nextStep = null;
    let evaluation = null;

    // Kiểm tra các dấu hiệu chuyển bước trong response (không phân biệt hoa thường)
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes("bước 2") && this.currentStep === 1) {
      nextStep = 2;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(1, evaluation || 'pass');
      this.currentStep = 2;
    } else if (lowerResponse.includes("bước 3") && this.currentStep === 2) {
      nextStep = 3;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(2, evaluation || 'pass');
      this.currentStep = 3;
    } else if (lowerResponse.includes("bước 4") && this.currentStep === 3) {
      nextStep = 4;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(3, evaluation || 'pass');
      this.currentStep = 4;
    } else if ((lowerResponse.includes("hoàn thành") || lowerResponse.includes("hoàn tất")) && this.currentStep === 4) {
      nextStep = 5;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(4, evaluation || 'pass');
    }

    console.log(`Bước hiện tại: ${this.currentStep}, Next step: ${nextStep}`);

    return {
      message: response,
      step: this.currentStep,
      stepName: this._getStepName(this.currentStep),
      nextStep: nextStep,
      evaluation: evaluation
    };
  }

  // Trích xuất đánh giá từ response
  _extractEvaluation(response) {
    if (response.includes("tốt") || response.includes("xuất sắc") || response.includes("rất tốt")) {
      return 'good';
    } else if (response.includes("đạt") || response.includes("khá tốt")) {
      return 'pass';
    } else if (response.includes("cần cố gắng") || response.includes("chưa tốt")) {
      return 'need_effort';
    }
    return 'pass'; // Mặc định
  }

  // Gửi câu trả lời của bạn (giữ để tương thích)
  async sendStudentResponse(studentAnswer) {
    return this.processStudentResponse(studentAnswer);
  }

  // Xây dựng prompt theo từng bước
  _buildContextPrompt(studentAnswer) {
    let prompt = `Câu trả lời của bạn: "${studentAnswer}"\n\n`;

    switch (this.currentStep) {
      case 1: // Hiểu bài toán
        prompt += `Đang ở BƯỚC 1: HIỂU BÀI TOÁN
Phân tích câu trả lời:
- Bạn đã xác định đúng/đủ dữ kiện chưa?
- Bạn đã hiểu đúng yêu cầu bài toán chưa?
- Có nhầm lẫn về đại lượng, đơn vị không?

Nếu chưa đủ/đúng: Đặt câu hỏi gợi ý để bạn tự phát hiện và bổ sung.
Nếu đã đủ/đúng: 
  - Khen ngợi bạn
  - Kết thúc tin nhắn bằng cụm: "Bây giờ chúng mình sang BƯỚC 2 nhé!"
  - Đặt câu hỏi đầu tiên cho bước 2

CHỈ HỎI 1-2 CÂU. Không giải hộ.`;
        break;

      case 2: // Lập kế hoạch
        prompt += `Đang ở BƯỚC 2: LẬP KẾ HOẠCH GIẢI
Phân tích:
- Bạn đã đề xuất phép tính/công thức phù hợp chưa?
- Các bước giải có đầy đủ, đúng thứ tự không?
- Bạn chỉ nêu ý tưởng, CHƯA TÍNH CỤ THỂ chứ?

QUAN TRỌNG: 
- KHÔNG cho bạn thực hiện phép tính ở bước này
- CHỈ yêu cầu nêu KẾ HOẠCH (làm gì trước, làm gì sau)
- Khi bạn đã nêu ĐẦY ĐỦ các bước:
  - Khen ngợi
  - Kết thúc tin nhắn bằng: "Tuyệt! Bây giờ sang BƯỚC 3 nhé!"
  - Yêu cầu bạn thực hiện bước đầu tiên

CHỈ HỎI 1-2 CÂU để định hướng kế hoạch.`;
        break;

      case 3: // Thực hiện kế hoạch
        prompt += `Đang ở BƯỚC 3: THỰC HIỆN KẾ HOẠCH
Phân tích:
- Bạn tính toán đúng chưa?
- Có sai sót về phép tính số thập phân, đơn vị không?
- Trình bày lời giải có rõ ràng không?

Nếu SAI:
- KHÔNG đưa đáp án đúng
- Chỉ ra dấu hiệu sai (vd: "Kết quả này có vẻ không hợp lý...")
- Đặt câu hỏi để bạn tự kiểm tra và sửa

Nếu ĐÚNG: 
- Khen ngợi
- Khi hoàn thành tất cả phép tính, kết thúc bằng: "Tuyệt vời! Sang BƯỚC 4 kiểm tra nhé!"
- Hỏi câu đầu tiên cho bước 4

CHỈ HỎI 1-2 CÂU. Không tính hộ.`;
        break;

      case 4: // Kiểm tra & mở rộng
        prompt += `Đang ở BƯỚC 4: KIỂM TRA & MỞ RỘNG
Hỏi bạn:
- Kết quả có hợp lý không? Vì sao?
- Có cách giải nào khác không?
- Nếu thay đổi dữ liệu, cách giải có đổi không?

Sau khi bạn trả lời đầy đủ:
- Đánh giá tổng thể 4 bước (Cần cố gắng/Đạt/Tốt)
- Khen ngợi và động viên
- Kết thúc bằng: "Chúc mừng bạn đã HOÀN THÀNH! 🎉"

CHỈ HỎI 1-2 CÂU.`;
        break;

      default:
        prompt += 'Vui lòng hỗ trợ bạn theo bước hiện tại.';
        break;
    }

    return prompt;
  }

  // Lấy gợi ý khi bạn gặp khó khăn
  async getHint() {
    if (!this.chat) {
      throw new Error("Chưa khởi tạo bài toán.");
    }

    const hintPrompt = `Bạn đang gặp khó khăn ở BƯỚC ${this.currentStep}.
Hãy đưa ra 1 gợi ý NHẸ NHÀNG (KHÔNG giải hộ, KHÔNG đưa đáp án).
Chỉ gợi ý hướng suy nghĩ hoặc 1 câu hỏi dẫn dắt ngắn gọn.`;

    try {
      const result = await this.chat.sendMessage(hintPrompt);
      return result.response.text();
    } catch (error) {
      console.error("Error getting hint, attempting fallback:", error);
      
      const newModel = geminiModelManager.getNextAvailableModel();
      if (!newModel) {
        throw new Error("Không có model nào khả dụng");
      }
      
      this.chat = newModel.startChat({
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });
      
      const result = await this.chat.sendMessage(hintPrompt);
      return result.response.text();
    }
  }

  // Chuyển sang bước tiếp theo
  moveToNextStep() {
    if (this.currentStep < 4) {
      this.currentStep++;
      return true;
    }
    return false;
  }

  // Lấy tên bước hiện tại
  _getStepName(step) {
    const stepNames = {
      1: "Hiểu bài toán",
      2: "Lập kế hoạch giải",
      3: "Thực hiện kế hoạch",
      4: "Kiểm tra & mở rộng"
    };
    return stepNames[step] || "";
  }

  // Đánh giá mức độ cho từng bước
  evaluateStep(step, level) {
    const stepKey = `step${step}`;
    this.stepEvaluations[stepKey] = level; // 'need_effort', 'pass', 'good'
  }

  // Lấy tổng kết đánh giá
  getSummary() {
    return {
      problem: this.currentProblem,
      evaluations: this.stepEvaluations,
      responses: this.studentResponses,
      currentStep: this.currentStep
    };
  }

  /**
   * Đánh giá năng lực giải quyết vấn đề toán học dựa trên Khung đánh giá
   * Input: studentAnswers, questions (với explanation), frameworkText (nội dung khung đánh giá)
   * Output: JSON với per-question comments và competence assessment (TC1, TC2, TC3)
   */
  /**
   * Evaluate question comments only (for displaying feedback to student)
   * Lightweight version - no competence assessment
   * @param {Array} studentAnswers - Array of answers
   * @param {Array} questions - Array of question objects
   * @returns {Object} - { questionComments: [...] }
   */
  async evaluateQuestionComments(studentAnswers, questions) {
    try {
      const model = geminiModelManager.getModel();

      // Chuẩn bị dữ liệu câu hỏi kèm giải thích cho AI
      const questionsContext = questions.map((q, idx) => ({
        questionNum: idx + 1,
        text: q.text || q.question,
        options: q.options || [],
        studentAnswerIndex: studentAnswers[idx]?.answer,
        isCorrect: studentAnswers[idx]?.isCorrect,
        explanation: q.explanation || 'Không có giải thích'
      }));

      const prompt = `You are a math educator providing brief feedback on each answer.

## Student's Answers:
${JSON.stringify(questionsContext, null, 2)}

## Task:
For EACH question: Write ONE meaningful comment about what the student did right/wrong.

## IMPORTANT: Vietnamese Language Rules:
- ALWAYS use "bạn" or "mình" instead of "em" or "học sinh"
- Example: "Bạn xác định được..." NOT "Em..."

## Response Format (JSON ONLY):
{
  "questionComments": [
    {
      "questionNum": 1,
      "comment": "Brief feedback using bạn/mình (30-50 words)"
    }
  ]
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      const assessment = JSON.parse(jsonMatch[0]);
      return assessment.questionComments || [];
    } catch (error) {
      console.error('Error evaluating question comments:', error);
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
      // Import here to avoid circular dependency
      const competencyEvaluationService = (await import('./competencyEvaluationService.js')).default;
      
      // Build problem statement from questions and context
      let problemStatement = '';
      if (questions && questions.length > 0) {
        // Get the exercise context if available
        const firstQuestion = questions[0];
        if (firstQuestion.exerciseContext) {
          problemStatement += `BÀI TOÁN:\n${firstQuestion.exerciseContext}\n\n`;
        }
        
        // Add all questions
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
          // Multiple choice answers
          const optionLetters = answer.answer.map(o => String.fromCharCode(65 + o));
          responseText += optionLetters.join(', ');
          if (question.options && answer.answer.length > 0) {
            const selectedOptions = answer.answer.map(o => question.options[o]);
            responseText += ` (${selectedOptions.join(', ')})`;
          }
        } else if (answer.answer !== null && answer.answer !== undefined) {
          // Single choice answer
          const optionLetter = String.fromCharCode(65 + answer.answer);
          const optionText = question.options?.[answer.answer] || 'Lựa chọn không xác định';
          responseText += `${optionLetter} (${optionText})`;
        } else {
          responseText += 'Không trả lời';
        }
        
        // Add correctness info if available
        if (answer.isCorrect !== undefined) {
          responseText += answer.isCorrect ? ' ✓ [Đúng]' : ' ✗ [Sai]';
        }
        
        return responseText;
      });

      console.log('🎯 Competency Evaluation Input:', {
        studentResponsesCount: studentResponses.length,
        problemStatementLength: problemStatement.length,
        firstResponse: studentResponses[0],
        problemStart: problemStatement.substring(0, 200)
      });

      // Generate the prompt for competency evaluation
      const prompt = competencyEvaluationService.generateCompetencyEvaluationPrompt(
        studentResponses,
        problemStatement
      );

      console.log('📝 Generated prompt (first 500 chars):', prompt.substring(0, 500));

      // Call Gemini API
      const model = geminiModelManager.getModel();
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      console.log('Competency evaluation response:', responseText);

      // Parse the JSON response and translate to Vietnamese
      const competencyEvaluation = competencyEvaluationService.parseCompetencyEvaluation(responseText);
      
      return competencyEvaluation;
    } catch (error) {
      console.error('❌ Error evaluating competency framework:', error);
      // Return empty evaluation on error so as not to block submission
      const competencyEvaluationService = (await import('./competencyEvaluationService.js')).default;
      return competencyEvaluationService.createEmptyEvaluation();
    }
  }
}

const geminiServiceInstance = new GeminiService();
export default geminiServiceInstance;
