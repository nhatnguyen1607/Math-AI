import geminiModelManager from "./geminiModelManager";

/**
 * GeminiChatServiceTimeVelocity - Phiên bản Tối ưu hóa Gợi mở súc tích 2026
 */
export class GeminiChatServiceTimeVelocity {
  constructor() {
    this.currentProblem = "";
    this.currentStep = 1;
    this.isSessionComplete = false;
  }

  _getStepName(step) {
    const names = ["", "Hiểu bài toán", "Lập kế hoạch", "Thực hiện", "Kiểm tra"];
    return names[step] || "";
  }

  restoreSession(problemText, chatHistory) {
    this.currentProblem = problemText;
    const model = geminiModelManager.getModel();
    if (model && chatHistory && chatHistory.length > 0) {
      let fixedHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
      if (fixedHistory.length > 0 && fixedHistory[0].role !== 'user') {
        fixedHistory.unshift({ role: 'user', parts: [{ text: problemText }] });
      }
      const fullText = fixedHistory.map(m => m.parts[0]?.text || '').join(' ');
      if (fullText.includes("Kiểm tra")) this.currentStep = 4;
      else if (fullText.includes("Thực hiện")) this.currentStep = 3;
      else if (fullText.includes("Lập kế hoạch")) this.currentStep = 2;
      else if (fullText.includes("Hiểu bài")) this.currentStep = 1;
    }
  }

  _buildSystemPrompt() {
    return `Bạn là "trợ lý học tập" dẫn dắt HS lớp 5 giải toán theo 4 bước Polya. 
Xưng hô: "mình" - "bạn". Tuyệt đối không xưng "em", "học sinh".

QUY TẮC PHẢN HỒI GỢI MỞ (SIÊU SÚC TÍCH):
- Khi HS nói "không biết", "không hiểu" hoặc bế tắc:
  + Bước 1: Khích lệ tinh thần bạn ấy một câu ngắn gọn.
  + Bước 2: Đặt DUY NHẤT 1 câu hỏi gợi mở để bạn ấy tự tìm con số hoặc phép tính. 
  + TUYỆT ĐỐI CẤM: Liệt kê danh sách câu hỏi, đưa ra luồng suy luận dài dòng, hoặc giải hộ.
- Kiểm soát đa câu hỏi: HS phải giải xong toàn bộ ý (a, b...) mới được kết thúc bài.

CHI TIẾT PHẢN HỒI THEO BƯỚC:
1. Hiểu bài: Nếu thiếu dữ kiện, hỏi "Bạn xem còn con số nào trong đề mà mình chưa nêu không?".
2. Lập kế hoạch: HS sai dạng, hỏi "Để tìm quãng đường khi biết vận tốc và thời gian, mình dùng phép tính gì nhỉ?".
3. Thực hiện: HS không biết tính, hãy gợi ý chia nhỏ phép tính hoặc nhắc lại quy tắc mượn đơn vị (60 phút).
4. Kiểm tra: Hỏi "Bạn thử xem kết quả này có khớp với thực tế không?".

LUÔN TRẢ VỀ JSON:
{
  "analysis": "Phân tích ngắn gọn bế tắc của HS",
  "status": "CORRECT" hoặc "WRONG",
  "step_status": "STAY" hoặc "MOVE_NEXT",
  "feedback": "Lời khích lệ ngắn (1 câu).",
  "next_question": "DUY NHẤT 1 câu hỏi gợi mở để HS tự làm bước tiếp theo."
}`;
  }

  async startNewProblem(problemText) {
    this.currentProblem = problemText;
    this.currentStep = 1;
    this.isSessionComplete = false;

    const msg = `Chào bạn! Mình là trợ lý học tập của bạn. Chúng ta cùng giải bài toán này nhé!\n\nBài toán: ${problemText}\n\nTrước tiên, bạn hãy cho mình biết bài toán đã cho những dữ kiện gì và yêu cầu tìm gì?`;
    return { message: msg, step: 1, stepName: this._getStepName(1) };
  }

  async processStudentResponse(studentAnswer, chatHistory = []) {
    if (this.isSessionComplete) return { message: "Bạn đã hoàn thành bài toán này rồi!" };

    const fullPrompt = `
ĐỀ BÀI: ${this.currentProblem}
BƯỚC HIỆN TẠI: ${this.currentStep}
LỊCH SỬ CHAT: ${JSON.stringify(chatHistory.slice(-10))}
HS VỪA NHẬP: "${studentAnswer}"

YÊU CẦU:
1. Nếu HS bế tắc, chỉ trả về 1 lời khích lệ và 1 câu hỏi gợi ý. Không giải thích dông dài.
2. Kiểm tra xem đề có mấy yêu cầu. HS đã tính xong hết chưa?
3. Chỉ MOVE_NEXT khi HS làm đúng và đủ.
`;

    try {
      const model = geminiModelManager.getModel();
      const result = await model.generateContent([
        { text: this._buildSystemPrompt() },
        { text: fullPrompt }
      ]);

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI response format error");
      
      const data = JSON.parse(jsonMatch[0]);

      if (data.step_status === "MOVE_NEXT") {
        if (this.currentStep < 4) {
          this.currentStep++;
        } else {
          this.isSessionComplete = true; 
        }
      }

      return {
        message: `${data.feedback} ${data.next_question || ""}`,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: data.status.toLowerCase(),
        isSessionComplete: this.isSessionComplete
      };
    } catch (error) {
      console.error("Agent Error:", error);
      return { message: "Mình đang xem lại một chút, bạn chờ mình tí nhé!", step: this.currentStep };
    }
  }

  async getHint() {
    const model = geminiModelManager.getModel();
    const result = await model.generateContent(`Đưa ra duy nhất 1 câu hỏi gợi ý cho HS lớp 5 ở bước ${this.currentStep} bài: ${this.currentProblem}. Không giải thích.`);
    return result.response.text();
  }
}

const geminiChatServiceTimeVelocityInstance = new GeminiChatServiceTimeVelocity();
export default geminiChatServiceTimeVelocityInstance;