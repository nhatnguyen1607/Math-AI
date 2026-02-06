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
  async evaluateCompetence(studentAnswers, questions, frameworkText) {
    try {
      const model = geminiModelManager.getModel();

      // Chuẩn bị dữ liệu câu hỏi kèm giải thích cho AI
      const questionsContext = questions.map((q, idx) => ({
        questionNum: idx + 1,
        text: q.text || q.question,
        options: q.options || [],
        studentAnswerIndex: studentAnswers[idx]?.answer,
        isCorrect: studentAnswers[idx]?.isCorrect,
        correctAnswerIndex: q.correctAnswerIndex,
        explanation: q.explanation || 'Không có giải thích'
      }));

      const prompt = `You are an expert mathematics educator evaluating a 5th-grade student's exam performance.

## Competence Assessment Framework (Vietnamese):
${frameworkText}

## Student's Answers:
${JSON.stringify(questionsContext, null, 2)}

## CRITICAL Evaluation Criteria:

### For each competence level:

**TỐT (Good/Excellent)** - Assign when:
- Student answers 80%+ of questions CORRECTLY
- Demonstrates clear understanding of concepts
- Shows logical problem-solving approach
- Answers are well-reasoned and complete

**ĐẠT (Pass/Basic)** - Assign when:
- Student answers 50-79% correctly
- Shows partial understanding
- Some reasoning is present but may have gaps
- Makes occasional mistakes

**CẦN CỐ GẮNG (Needs Effort)** - Assign when:
- Student answers less than 50% correctly
- Shows limited understanding
- Lacks clear reasoning
- Many fundamental errors

## Task:
1. For EACH question: Analyze what the student chose, compare with correct answer, and based on the explanation, write ONE meaningful comment about what they did right/wrong. Store this as a comment for that question.

2. Calculate accuracy rate: (correct answers / total questions) × 100
   - If accuracy ≥ 80%: Strongly consider "Tốt" for that competence
   - If accuracy 50-79%: Consider "Đạt"
   - If accuracy < 50%: Consider "Cần cố gắng"

3. Assess the student's competence across three dimensions (TC1, TC2, TC3) using the accuracy rate as PRIMARY indicator.

4. Provide an overall assessment with specific strengths, areas to improve, and recommendations.

## IMPORTANT: Vietnamese Language Rules:
- ALWAYS use "bạn" instead of "học sinh" or "em"
- ALWAYS use "mình" instead of "em"
- Example: "Bạn xác định được..." NOT "Học sinh xác định được..."
- Example: "Bạn còn cần cải thiện..." NOT "Em còn cần cải thiện..."
- Example: "Mình thấy bạn..." NOT "Em..."

## Response Format (JSON - ALL text MUST be in Vietnamese using "bạn/mình" pronouns):
{
  "questionComments": [
    {
      "questionNum": 1,
      "comment": "Nhận xét chi tiết về câu trả lời này (what they did right/wrong, dựa trên explanation) - dùng 'bạn/mình' không dùng 'em/học sinh'"
    }
  ],
  "competenceAssessment": {
    "TC1": {
      "level": "Tốt|Đạt|Cần cố gắng",
      "reason": "Lý do đánh giá mức này dựa trên tỷ lệ câu trả lời chính xác và mức độ hiểu biết của bạn - dùng 'bạn/mình' không dùng 'em/học sinh'"
    },
    "TC2": {
      "level": "Tốt|Đạt|Cần cố gắng",
      "reason": "Lý do đánh giá mức này dựa trên tỷ lệ câu trả lời chính xác và mức độ hiểu biết của bạn - dùng 'bạn/mình' không dùng 'em/học sinh'"
    },
    "TC3": {
      "level": "Tốt|Đạt|Cần cố gắng",
      "reason": "Lý do đánh giá mức này dựa trên tỷ lệ câu trả lời chính xác và mức độ hiểu biết của bạn - dùng 'bạn/mình' không dùng 'em/học sinh'"
    }
  },
  "overallAssessment": {
    "level": "Tốt|Đạt|Cần cố gắng",
    "summary": "Tóm tắt mức năng lực chung của bạn (2-3 câu). Nếu tỷ lệ câu đúng ≥80% thì xứng đáng 'Tốt'. LUÔN dùng 'bạn' hoặc 'mình', KHÔNG dùng 'em' hoặc 'học sinh'",
    "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
    "areasToImprove": ["Cần cải thiện 1", "Cần cải thiện 2"],
    "recommendations": "Lời khuyên cụ thể để bạn cải thiện (2-3 câu) - Dùng 'bạn/mình' không dùng 'em/học sinh'"
  }
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      const assessment = JSON.parse(jsonMatch[0]);
      return assessment;
    } catch (error) {
      console.error('Error evaluating competence:', error);
      throw error;
    }
  }
}

const geminiServiceInstance = new GeminiService();
export default geminiServiceInstance;
