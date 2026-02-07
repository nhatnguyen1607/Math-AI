import geminiModelManager from "./geminiModelManager";
import apiKeyManager from "./apiKeyManager";
import { GoogleGenerativeAI } from "@google/generative-ai";
import competencyEvaluationService from "./competencyEvaluationService";

// System prompt cho AI trợ lý học toán
const SYSTEM_PROMPT = `Mình là trợ lý học tập ảo thân thiện, hỗ trợ bạn lớp 5 giải toán theo 4 bước Polya.

NGUYÊN TẮC QUAN TRỌNG:
- KHÔNG BAO GIỜ giải bài toán thay bạn
- KHÔNG đưa ra đáp án dù bạn làm sai
- CHỈ đặt câu hỏi gợi mở, định hướng để bạn tự suy nghĩ
- MỖI LẦN CHỈ HỎI 1 CÂU duy nhất
- Phát hiện lỗi sai của bạn và gợi ý để bạn tự sửa
- Ngôn ngữ thân thiện, dễ thương như người bạn của bạn
- Khi bạn trả lời đúng, khen ngợi cụ thể và chuyển bước tiếp theo

4 BƯỚC GIẢI TOÁN:
1. HIỂU BÀI TOÁN: Giúp bạn xác định dữ kiện đã cho và yêu cầu bài toán
2. LẬP KẾ HOẠCH: Hỏi bạn nên làm gì, cần phép tính nào (KHÔNG tính cụ thể)
3. THỰC HIỆN: Hỏi bạn tính toán từng bước, kiểm tra lỗi tính toán nếu có
4. KIỂM TRA & MỞ RỘNG: Hỏi bạn liệu kết quả có hợp lý, có cách giải nào khác không

CÁC LOẠI CÂU HỎI GỢI MỞ:
- Để HIỂU BÀI: "Em thấy bài toán đang yêu cầu gì?"
- Để LẬP KẾ HOẠCH: "Để tìm ..., em cần làm phép tính nào?"
- Để THỰC HIỆN: "Em thử tính ... và xem kết quả nhé"
- Để KIỂM TRA: "Kết quả này có hợp lý không? Vì sao?"

NHỮNG GÌ KHÔNG NÊN LÀM:
- Không hỏi "em làm đúng không?" → hỏi "vậy tiếp theo là gì?"
- Không nói "sai" trực tiếp → nói "hãy xem lại..."
- Không giải hoặc cho đáp án → chỉ hỏi câu để em suy nghĩ lại

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

    const maxRetries = 3; // Tối đa 3 lần retry (tổng 4 attempts)
    let attemptCount = 0;
    let lastError = null;

    while (attemptCount < maxRetries) {
      attemptCount++;
      
      try {
        // Gửi đề bài và bắt đầu bước 1 - dùng generateContent() có dual-level retry
        const initialPrompt = `Đây là bài toán mà bạn cần giải: ${problemText}

Hãy bắt đầu BƯỚC 1: HIỂU BÀI TOÁN
Đặt 1 câu hỏi gợi mở để giúp bạn xác định:
- Thông tin đã cho trong bài toán là gì?
- Yêu cầu của bài toán là gì?

Câu hỏi phải thân thiện, không quá phức tạp, giúp bạn suy nghĩ về những gì bài toán đang hỏi.`;

        // Sử dụng generateContent() để có dual-level retry (tries all models, then rotates key)
        const initialResponse = await geminiModelManager.generateContent(initialPrompt);
        const response = initialResponse.response.text();

        // Khởi tạo chat mới với key/model đang work
        const model = geminiModelManager.getModel();
        this.chat = model.startChat({
          history: [
            {
              role: "user",
              parts: [{ text: SYSTEM_PROMPT }],
            },
            {
              role: "model",
              parts: [{ text: "Chào bạn! 👋 Mình là trợ lý học toán của bạn. Hôm nay chúng ta sẽ giải toán theo 4 bước Polya nhé! Mình sẽ không giải hộ bạn, mà sẽ hỏi các câu gợi ý để bạn tự suy nghĩ và tìm ra cách giải. Bạn sẵn sàng chưa? 😊" }],
            },
            {
              role: "user",
              parts: [{ text: initialPrompt }],
            },
            {
              role: "model",
              parts: [{ text: response }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });

        return {
          message: response,
          step: 1,
          stepName: "Hiểu bài toán"
        };
      } catch (error) {
        lastError = error;
        console.error(`Error in startNewProblem (attempt ${attemptCount}/${maxRetries}):`, error);
        
        // Kiểm tra nếu là lỗi 429 (quota exceeded)
        const isQuotaError = error.message?.includes("429") || 
                             error.message?.includes("quota") ||
                             error.message?.includes("exceeded");
        
        if (isQuotaError && attemptCount < maxRetries) {

          // generateContent() đã tự handle key rotation
          continue;
        } else if (isQuotaError && attemptCount >= maxRetries) {
          const totalKeys = apiKeyManager.keyConfigs.length;
          console.error(`❌ All ${totalKeys} API keys are exhausted or hit quota limits`);
          throw new Error(`Tất cả ${totalKeys} API keys đã hết quota free tier. Vui lòng chờ cho đến hôm sau hoặc nâng cấp tài khoản Google Cloud.`);
        } else {
          // Lỗi khác - không retry, throw ngay
          throw error;
        }
      }
    }

    // Nếu vượt quá số lần retry
    console.error(`❌ Failed after ${maxRetries} retries`);
    throw new Error(`Không thể khởi tạo bài toán sau ${maxRetries} lần thử. Error: ${lastError?.message || 'Unknown error'}`);
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
      console.error("Error in chat.sendMessage, attempting recovery:", error);
      
      // Kiểm tra nếu là lỗi 429 (quota exceeded)
      const isQuotaError = error.message?.includes("429") || 
                           error.message?.includes("quota") ||
                           error.message?.includes("exceeded");
      
      if (isQuotaError) {
        // Force mark key as exhausted và rotate
        apiKeyManager.markKeyAsExhausted(error);
        const hasRotated = apiKeyManager.rotateToNextKey();
        
        if (!hasRotated) {
          throw new Error("Tất cả API keys đã hết quota");
        }
        
        // Recreate chat với key mới
        const newGeminiInstance = new GoogleGenerativeAI(apiKeyManager.getCurrentKey());
        const newModel = newGeminiInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        this.chat = newModel.startChat({
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });
        
        // Retry với chat mới
        result = await this.chat.sendMessage(contextPrompt);
      } else {
        // Với lỗi khác, thử fallback model
        const newModel = geminiModelManager.getNextAvailableModel();
        if (!newModel) {
          throw error;
        }
        
        this.chat = newModel.startChat({
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });
        
        result = await this.chat.sendMessage(contextPrompt);
      }
    }
    
    let response = result.response.text();

    // Phân tích xem AI có muốn chuyển bước không
    let nextStep = null;
    let evaluation = null;

    // Kiểm tra các dấu hiệu chuyển bước trong response (không phân biệt hoa thường)
    const lowerResponse = response.toLowerCase();
    
    
    if ((lowerResponse.includes("bước 2") || lowerResponse.includes("lập kế hoạch")) && this.currentStep === 1) {
      nextStep = 2;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(1, evaluation || 'pass');
      this.currentStep = 2;
    } else if ((lowerResponse.includes("bước 3") || lowerResponse.includes("thực hiện kế hoạch")) && this.currentStep === 2) {
      nextStep = 3;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(2, evaluation || 'pass');
      this.currentStep = 3;
    } else if ((lowerResponse.includes("bước 4") || lowerResponse.includes("kiểm tra & mở rộng")) && this.currentStep === 3) {
      nextStep = 4;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(3, evaluation || 'pass');
      this.currentStep = 4;
    } else if ((lowerResponse.includes("hoàn thành bài toán") || lowerResponse.includes("hoàn tất bài toán") || lowerResponse.includes("🎉")) && this.currentStep === 4) {
      nextStep = 5; // Đã hoàn thành bước 4, bài toán xong
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(4, evaluation || 'pass');

    }

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
        prompt += `BƯỚC 1: HIỂU BÀI TOÁN
Phân tích câu trả lời:
- Bạn đã xác định đúng những thông tin chưa? (Dữ kiện: chiều dài, chiều rộng, yêu cầu)
- Bạn hiểu đúng bài toán đang yêu cầu gì không?

HÀNH ĐỘNG:
- Nếu câu trả lời chưa đủ hoặc chưa rõ: Đặt 1 câu hỏi gợi ý để bạn tự phát hiện ra điều còn thiếu
- Nếu câu trả lời đủ và đúng:
  * Khen ngợi bạn cụ thể (ví dụ: "Tuyệt! Em đã xác định đúng dữ kiện và yêu cầu")
  * QUAN TRỌNG: Phải viết rõ ràng: "Bây giờ chúng mình sang **BƯỚC 2: LẬP KẾ HOẠCH GIẢI** nhé!"
  * Đặt 1 câu hỏi đầu tiên cho bước 2

NHẮC NHỐ: CHỈ HỎI 1 CÂU. Câu hỏi phải gợi mở, không kiểm tra "em đúng không".`;
        break;

      case 2: // Lập kế hoạch
        prompt += `BƯỚC 2: LẬP KẾ HOẠCH GIẢI
Phân tích:
- Bạn nêu được phải làm gì (phép tính nào) không? (Ví dụ: nhân chiều dài với chiều rộng)
- Bước giải có đầy đủ, đúng logic không?
- QUAN TRỌNG: Bạn CHỈ nêu kế hoạch, CHƯA tính cụ thể số phải chứ?

HÀNH ĐỘNG:
- Nếu chưa có kế hoạch rõ ràng: Đặt 1 câu hỏi gợi ý (ví dụ: "Vậy để tính diện tích, em cần làm phép tính nào?")
- Nếu kế hoạch đã đầy đủ:
  * Khen ngợi: "Rất tốt! Em đã nêu đúng kế hoạch"
  * QUAN TRỌNG: Phải viết rõ ràng: "Tuyệt! Bây giờ chúng mình sang **BƯỚC 3: THỰC HIỆN KẾ HOẠCH** nhé!"
  * Yêu cầu bạn thực hiện phép tính đầu tiên

NHẮC NHỐ: CHỈ HỎI 1 CÂU. Không cho bạn tính cụ thể ở bước này!`;
        break;

      case 3: // Thực hiện kế hoạch
        prompt += `BƯỚC 3: THỰC HIỆN KẾ HOẠCH
Phân tích:
- Phép tính có đúng không?
- Cách tính với số thập phân có chính xác không?
- Trình bày từng bước có rõ ràng không?

HÀNH ĐỘNG:
- Nếu câu trả lời cho thấy sai sót:
  * KHÔNG đưa ra đáp án đúng
  * Chỉ ra dấu hiệu sai ("Kết quả này có vẻ lớn quá..." hoặc "Hãy kiểm tra lại phép tính...")
  * Đặt 1 câu hỏi để bạn tự kiểm tra: "Em thử tính lại xem sao?"
- Nếu tính toán đúng:
  * Khen ngợi: "Chính xác rồi!"
  * Nếu còn phép tính khác, hỏi bạn tiếp: "Vậy tiếp theo..."
  * Nếu hoàn tất hết: QUAN TRỌNG: Phải viết rõ ràng: "Tuyệt vời! Bây giờ chúng mình sang **BƯỚC 4: KIỂM TRA & MỞ RỘNG** nhé!"

NHẮC NHỐ: CHỈ HỎI 1 CÂU. Không tính hộ hoặc gợi ý cách tính!`;
        break;

      case 4: // Kiểm tra & mở rộng
        prompt += `BƯỚC 4: KIỂM TRA & MỞ RỘNG
Hỏi bạn:
- Kết quả có hợp lý không? (Ví dụ: diện tích của khu vườn, có lớn hợp lý không?)
- Có cách nào giải khác không?

HÀNH ĐỘNG:
- Đặt 1 câu hỏi về việc kiểm tra hoặc mở rộng
- Sau khi bạn trả lời:
  * Đánh giá tổng thể 4 bước (Cần cố gắng/Đạt/Tốt)
  * Khen ngợi và động viên
  * QUAN TRỌNG: Phải viết rõ ràng: "Chúc mừng bạn đã **HOÀN THÀNH BÀI TOÁN**! 🎉"

NHẮC NHỐ: CHỈ HỎI 1 CÂU.`;
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
      console.error("Error getting hint, attempting recovery:", error);
      
      // Kiểm tra nếu là lỗi 429 (quota exceeded)
      const isQuotaError = error.message?.includes("429") || 
                           error.message?.includes("quota") ||
                           error.message?.includes("exceeded");
      
      if (isQuotaError) {
        // Force mark key as exhausted và rotate
        apiKeyManager.markKeyAsExhausted(error);
        const hasRotated = apiKeyManager.rotateToNextKey();
        
        if (!hasRotated) {
          throw new Error("Tất cả API keys đã hết quota");
        }
        
        // Recreate chat với key mới
        const newGeminiInstance = new GoogleGenerativeAI(apiKeyManager.getCurrentKey());
        const newModel = newGeminiInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        this.chat = newModel.startChat({
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });
        
        // Retry với chat mới
        const result = await this.chat.sendMessage(hintPrompt);
        return result.response.text();
      } else {
        // Với lỗi khác, thử fallback model
        const newModel = geminiModelManager.getNextAvailableModel();
        if (!newModel) {
          throw error;
        }
        
        this.chat = newModel.startChat({
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });
        
        const result = await this.chat.sendMessage(hintPrompt);
        return result.response.text();
      }
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

      const result = await geminiModelManager.generateContent(prompt);
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
      // Import service for competency evaluation prompt generation
      
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



      // Generate the prompt for competency evaluation
      const prompt = competencyEvaluationService.generateCompetencyEvaluationPrompt(
        studentResponses,
        problemStatement
      );

      // Call Gemini API with key rotation for quota resilience
      const result = await geminiModelManager.generateContent(prompt);
      const responseText = result.response.text();

      // Parse the JSON response and translate to Vietnamese
      const competencyEvaluation = competencyEvaluationService.parseCompetencyEvaluation(responseText);
      
      return competencyEvaluation;
    } catch (error) {
      console.error('❌ Error evaluating competency framework:', error);
      // Return empty evaluation on error so as not to block submission
      return competencyEvaluationService.createEmptyEvaluation();
    }
  }

  /**
   * Tạo bài toán luyện tập dựa trên bài khởi động tương ứng
   * @param {string} startupProblem1 - Bài 1 phần khởi động
   * @param {string} startupProblem2 - Bài 2 phần khởi động
   * @param {string} context - Bối cảnh/dạng toán
   * @param {number} problemNumber - Số thứ tự bài luyện tập (1 hoặc 2)
   * @returns {Promise<string>} - Bài toán luyện tập
   */
  async generateSimilarProblem(startupProblem1, startupProblem2, context = '', problemNumber = 1) {
    try {
      
      let referenceProblem = '';
      let difficultyGuidance = '';
      
      if (problemNumber === 1) {
        referenceProblem = startupProblem1;
        difficultyGuidance = `
MỨC ĐỘ CỦA BÀI 1 LUYỆN TẬP:
- Phải là MỨC ĐỘ DỄ, ĐƠN GIẢN, CHỈ CẦN 1-2 PHÉP TÍNH
- Ít dữ kiện, không có khuyến mãi phức tạp hay điều kiện rắc rối
- Ví dụ mức độ: "Cô giáo cần mua vải để may khăn quàng cho 19 bạn, mỗi khăn 0,75 m vải. Hỏi tổng số mét vải cần mua?"
- Đây là bài để học sinh luyện tập đầu tiên, phải cơ bản và dễ hiểu`;
      } else if (problemNumber === 2) {
        referenceProblem = startupProblem2;
        difficultyGuidance = `
MỨC ĐỘ CỦA BÀI 2 LUYỆN TẬP:
- Phải có độ khó TƯƠNG ĐƯƠNG với bài 2 khởi động
- Có nhiều dữ kiện, có thể có khuyến mãi, điều kiện phức tạp hơn
- Cùng số lượng phép tính và cấp độ suy luận với bài 2 khởi động
- Đây là bài để học sinh luyện tập sau khi hoàn thành bài 1`;
      }
      
      const prompt = `Bạn là giáo viên toán lớp 5 chuyên tạo bài tập luyện tập.

BÀI KHỞI ĐỘNG (mẫu):
${referenceProblem}

${context ? `CHỦ ĐỀ/DẠNG TOÁN:
${context}

` : ''}

NHIỆM VỤ:
Tạo BÀI ${problemNumber} LUYỆN TẬP dựa vào bài khởi động trên:
${difficultyGuidance}

YÊU CẦU TỐI QUAN TRỌNG:
1. ✅ KIỂM TRA KỸ NĂNG TOÁN HỌC: 
   - Nếu bài khởi động dùng số thập phân → bài luyện tập PHẢI có số thập phân
   - Nếu bài khởi động là phép nhân/chia/cộng/trừ → bài luyện tập PHẢI có cùng phép tính đó
   - Nếu bài khởi động so sánh giá cả/chọn cửa hàng → bài luyện tập PHẢI là so sánh tương tự

2. ✅ CHỈ MỘT CÂU HỎI CUỐI (không phải 2-3 câu):
   - ĐÚNG: "Tổng số mét vải cần mua là bao nhiêu?"
   - ĐÚNG: "Mua ở cửa hàng nào sẽ tiết kiệm hơn?"
   - SAI: "Nội dung nào mô tả đúng bài toán? Để giải cần phép tính nào?"
   - SAI: "Mua ở đâu tiết kiệm? Tại sao? Chênh lệch bao nhiêu?"

3. ✅ THAY ĐỔI BỐI CẢNH: Tên nhân vật khác, tình huống khác, nhưng cấu trúc giữ nguyên

4. ✅ NỘI DUNG THỰC TẾ: Bài toán phải sống động, dễ hình dung, liên quan đến cuộc sống học sinh

HƯỚNG DẪN:
- CHỈ trả về nội dung bài toán (không có "Bài toán mới:", không có lời giải)
- Bài toán phải là một đoạn văn liền mạch, tự nhiên

Bài toán mới:`;

      // Sử dụng generateContent từ geminiModelManager (hỗ trợ auto-rotate key)
      const result = await geminiModelManager.generateContent(prompt);
      const similarProblem = result.response.text().trim();
      return similarProblem;
    } catch (error) {
      console.error('❌ Error generating similar problem:', error);
      throw error;
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

      const evaluationPrompt = `Bạn là giáo viên toán lớp 5 chuyên về đánh giá năng lực giải quyết vấn đề toán học.

${chatText}

NHIỆM VỤ: Dựa trên lịch sử hội thoại trên, hãy đánh giá học sinh theo RUBRIC 4 TIÊU CHÍ:

**TC1. NHẬN BIẾT ĐƯỢC VẤN ĐỀ CẦN GIẢI QUYẾT (Max 2 điểm)**
Mục tiêu: Đánh giá xem học sinh đã xác định đầy đủ dữ kiện và yêu cầu bài toán chưa?
- 0 điểm: Không xác định được đầy đủ cái đã cho và cái cần tìm, cần nhiều hỗ trợ từ AI
- 1 điểm: Xác định đầy đủ dữ kiện và yêu cầu bài toán với gợi ý từ AI
- 2 điểm: Xác định chính xác dữ kiện, yêu cầu bài toán và mối quan hệ giữa chúng

**TC2. NÊU ĐƯỢC CÁCH THỨC GIẢI QUYẾT VẤN ĐỀ (Max 2 điểm)**
Mục tiêu: Đánh giá xem học sinh đã nhận dạng dạng toán và chọn được phép toán phù hợp chưa?
- 0 điểm: Không nhận dạng được dạng toán, hoặc không chọn được phép toán phù hợp
- 1 điểm: Nhận dạng được dạng toán và chọn được phép toán cơ bản phù hợp với gợi ý từ AI
- 2 điểm: Nhận dạng đúng dạng toán, đề xuất được cách giải hợp lý, chọn phép toán/chiến lược tối ưu

**TC3. TRÌNH BÀY ĐƯỢC CÁCH THỨC GIẢI QUYẾT (Max 2 điểm)**
Mục tiêu: Đánh giá xem học sinh đã thực hiện đúng các phép tính và lời giải chưa?
- 0 điểm: Thực hiện phép tính còn sai nhiều, lời giải không đầy đủ/thiếu logic
- 1 điểm: Thực hiện đúng các bước giải và phép tính cơ bản, trình bày lời giải đầy đủ từ phản hồi của AI
- 2 điểm: Thực hiện đúng đầy đủ các phép tính, trình bày lời giải rõ ràng mạch lạc

**TC4. KIỂM TRA ĐƯỢC GIẢI PHÁP ĐÃ THỰC HIỆN (Max 2 điểm)**
Mục tiêu: Đánh giá xem học sinh đã kiểm tra lại kết quả và vận dụng được chưa?
- 0 điểm: Không kiểm tra lại kết quả, không điều chỉnh hoặc không vận dụng vào bài toán tương tự
- 1 điểm: Kiểm tra lại kết quả, điều chỉnh đúng khi có gợi ý từ AI
- 2 điểm: Kiểm tra lại bằng các cách khác nhau, vận dụng vào bài toán mở rộng/nâng cao

HƯỚNG DẪN TRẢ LỜI:
- Cho MỖI tiêu chí, viết nhận xét CHI TIẾT (2-3 câu), giải thích rõ ràng tại sao học sinh được điểm đó
- NHẤT ĐỊNH trả về JSON đúng format
- Các comment phải cụ thể, dựa trên lịch sử hội thoại, không chung chung

FORMAT JSON (PHẢI ĐÚNG):
{
  "TC1": {
    "nhanXet": "Nhận xét chi tiết cụ thể về khía cạnh nhận biết (2-3 câu giải thích)",
    "diem": 0
  },
  "TC2": {
    "nhanXet": "Nhận xét chi tiết cụ thể về khía cạnh nêu cách giải (2-3 câu giải thích)",
    "diem": 0
  },
  "TC3": {
    "nhanXet": "Nhận xét chi tiết cụ thể về khía cạnh trình bày giải (2-3 câu giải thích)",
    "diem": 0
  },
  "TC4": {
    "nhanXet": "Nhận xét chi tiết cụ thể về khía cạnh kiểm tra (2-3 câu giải thích)",
    "diem": 0
  },
  "tongNhanXet": "Nhận xét tổng thể 2-3 câu về bài làm của học sinh",
  "tongDiem": 0,
  "mucDoChinh": "Cần cố gắng"
}`;

      // Sử dụng generateContent từ geminiModelManager
      const result = await geminiModelManager.generateContent(evaluationPrompt);
      const responseText = result.response.text().trim();
      
      // Parse JSON từ response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ No JSON found in response. Response:', responseText.substring(0, 200));
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
        mucDoChinh: evaluation.mucDoChinh || 'Cần cố gắng'
      };
      
      return validatedEval;
    } catch (error) {
      console.error('❌ Error evaluating competencies:', error.message);
      // Return default evaluation on error
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
}

const geminiServiceInstance = new GeminiService();
export default geminiServiceInstance;
