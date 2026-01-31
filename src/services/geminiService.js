import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// Khởi tạo model Gemini - sử dụng Gemini 2.5 Flash Native Audio Dialog (unlimited requests)
const model = genAI.getGenerativeModel({ 
  model: "models/gemini-2.5-flash-lite"
});

// System prompt cho AI trợ lý học toán
const SYSTEM_PROMPT = `Bạn là trợ lý học tập ảo thân thiện, hỗ trợ học sinh lớp 5 giải toán theo 4 bước Polya.

NGUYÊN TẮC QUAN TRỌNG:
- KHÔNG BAO GIỜ giải bài toán thay học sinh
- KHÔNG đưa ra đáp án dù học sinh làm sai
- CHỈ đặt câu hỏi gợi mở, định hướng
- MỖI LẦN CHỈ HỎI 1 CÂU
- Phát hiện lỗi sai của học sinh và gợi ý để học sinh tự sửa
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
    this.chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }],
        },
        {
          role: "model",
          parts: [{ text: "Chào em! Mình là trợ lý học toán, sẽ đồng hành cùng em giải quyết bài toán theo 4 bước nhé! Mình sẽ không giải hộ em mà chỉ hỏi các câu để em tự tìm ra cách giải. Sẵn sàng bắt đầu chưa? 😊" }],
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
Đặt 1 câu hỏi đầu tiên để giúp học sinh xác định dữ kiện hoặc yêu cầu của bài toán.
Nhớ: Chỉ hỏi 1 câu, ngôn ngữ thân thiện.`;

    const result = await this.chat.sendMessage(initialPrompt);
    const response = result.response.text();

    return {
      message: response,
      step: 1,
      stepName: "Hiểu bài toán"
    };
  }

  // Xử lý phản hồi của học sinh
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

    const result = await this.chat.sendMessage(contextPrompt);
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

  // Gửi câu trả lời của học sinh (giữ để tương thích)
  async sendStudentResponse(studentAnswer) {
    return this.processStudentResponse(studentAnswer);
  }

  // Xây dựng prompt theo từng bước
  _buildContextPrompt(studentAnswer) {
    let prompt = `Câu trả lời của học sinh: "${studentAnswer}"\n\n`;

    switch (this.currentStep) {
      case 1: // Hiểu bài toán
        prompt += `Đang ở BƯỚC 1: HIỂU BÀI TOÁN
Phân tích câu trả lời:
- Học sinh đã xác định đúng/đủ dữ kiện chưa?
- Học sinh đã hiểu đúng yêu cầu bài toán chưa?
- Có nhầm lẫn về đại lượng, đơn vị không?

Nếu chưa đủ/đúng: Đặt câu hỏi gợi ý để học sinh tự phát hiện và bổ sung.
Nếu đã đủ/đúng: 
  - Khen ngợi học sinh
  - Kết thúc tin nhắn bằng cụm: "Bây giờ chúng ta sang BƯỚC 2 nhé!"
  - Đặt câu hỏi đầu tiên cho bước 2

CHỈ HỎI 1-2 CÂU. Không giải hộ.`;
        break;

      case 2: // Lập kế hoạch
        prompt += `Đang ở BƯỚC 2: LẬP KẾ HOẠCH GIẢI
Phân tích:
- Học sinh đã đề xuất phép tính/công thức phù hợp chưa?
- Các bước giải có đầy đủ, đúng thứ tự không?
- Học sinh chỉ nêu ý tưởng, CHƯA TÍNH CỤ THỂ chứ?

QUAN TRỌNG: 
- KHÔNG cho học sinh thực hiện phép tính ở bước này
- CHỈ yêu cầu nêu KẾ HOẠCH (làm gì trước, làm gì sau)
- Khi học sinh đã nêu ĐẦY ĐỦ các bước:
  - Khen ngợi
  - Kết thúc tin nhắn bằng: "Tuyệt! Bây giờ sang BƯỚC 3 nhé!"
  - Yêu cầu học sinh thực hiện bước đầu tiên

CHỈ HỎI 1-2 CÂU để định hướng kế hoạch.`;
        break;

      case 3: // Thực hiện kế hoạch
        prompt += `Đang ở BƯỚC 3: THỰC HIỆN KẾ HOẠCH
Phân tích:
- Học sinh tính toán đúng chưa?
- Có sai sót về phép tính số thập phân, đơn vị không?
- Trình bày lời giải có rõ ràng không?

Nếu SAI:
- KHÔNG đưa đáp án đúng
- Chỉ ra dấu hiệu sai (vd: "Kết quả này có vẻ không hợp lý...")
- Đặt câu hỏi để học sinh tự kiểm tra và sửa

Nếu ĐÚNG: 
- Khen ngợi
- Khi hoàn thành tất cả phép tính, kết thúc bằng: "Tuyệt vời! Sang BƯỚC 4 kiểm tra nhé!"
- Hỏi câu đầu tiên cho bước 4

CHỈ HỎI 1-2 CÂU. Không tính hộ.`;
        break;

      case 4: // Kiểm tra & mở rộng
        prompt += `Đang ở BƯỚC 4: KIỂM TRA & MỞ RỘNG
Hỏi học sinh:
- Kết quả có hợp lý không? Vì sao?
- Có cách giải nào khác không?
- Nếu thay đổi dữ liệu, cách giải có đổi không?

Sau khi học sinh trả lời đầy đủ:
- Đánh giá tổng thể 4 bước (Cần cố gắng/Đạt/Tốt)
- Khen ngợi và động viên
- Kết thúc bằng: "Chúc mừng em đã HOÀN THÀNH! 🎉"

CHỈ HỎI 1-2 CÂU.`;
        break;

      default:
        prompt += 'Vui lòng hỗ trợ học sinh theo bước hiện tại.';
        break;
    }

    return prompt;
  }

  // Lấy gợi ý khi học sinh gặp khó khăn
  async getHint() {
    if (!this.chat) {
      throw new Error("Chưa khởi tạo bài toán.");
    }

    const hintPrompt = `Học sinh đang gặp khó khăn ở BƯỚC ${this.currentStep}.
Hãy đưa ra 1 gợi ý NHẸ NHÀNG (KHÔNG giải hộ, KHÔNG đưa đáp án).
Chỉ gợi ý hướng suy nghĩ hoặc 1 câu hỏi dẫn dắt ngắn gọn.`;

    const result = await this.chat.sendMessage(hintPrompt);
    return result.response.text();
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
}

const geminiServiceInstance = new GeminiService();
export default geminiServiceInstance;
