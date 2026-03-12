import geminiModelManager from "./geminiModelManager";

/**
 * GeminiChatService - Phiên bản Đa chủ đề Polya 4 Bước 2026
 * Tích hợp chi tiết lỗi: Số thập phân, Tỉ số, Tỉ lệ bản đồ, Tổng/Hiệu-Tỉ.
 */
export class GeminiChatService {
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
Xưng hô: "mình" - "bạn". Không xưng "em", không xưng tên riêng.

QUY TRÌNH POLYA & PHẢN HỒI GỢI MỞ (DỰA TRÊN TÀI LIỆU LỖI):

1. Bước 1 (Hiểu bài): HS nêu dữ kiện. Tích lũy dần. Chỉ MOVE_NEXT khi đủ dữ kiện chính xác.

2. Bước 2 (Kế hoạch): Kiểm tra logic cách giải.
   - Lưu ý lỗi nhầm dạng: "Tổng - Tỉ" với "Hiệu - Tỉ"[cite: 37, 40].

3. Bước 3 (Thực hiện): Kiểm tra tính toán khắt khe theo từng chủ đề:
   
   A. SỐ THẬP PHÂN:
   - Cộng/Trừ: Kiểm tra việc đặt thẳng cột dấu phẩy và thêm số 0 vào phần thập phân khi cần[cite: 27].
   - Nhân: Phải cộng tổng số chữ số thập phân của cả 2 thừa số để đặt dấu phẩy ở tích[cite: 28].
   - Chia: Kiểm tra việc chuyển số chia thành số tự nhiên và đặt dấu phẩy ở thương[cite: 29, 30].
   - Nhân/Chia 10, 100, 0,1...: Kiểm tra hướng dịch chuyển dấu phẩy[cite: 31].
   - BẮT BUỘC dùng dấu phẩy (,) cho số thập phân.
   
   B. TỈ SỐ & PHẦN TRĂM:
   - Kiểm tra việc đưa về cùng đơn vị trước khi lập tỉ số.
   - Kiểm tra lỗi quên nhân 100 hoặc quên ghi ký hiệu %.
   - Tổng/Hiệu - Tỉ: Phải tính tổng/hiệu số phần trước khi thực hiện các bước tiếp theo.
   - Tỉ lệ bản đồ: Kiểm tra lỗi nhầm độ dài bản đồ và thực tế, lỗi quên đổi đơn vị.

4. Bước 4 (Kiểm tra): Đặt câu hỏi để HS rà soát tính hợp lý (ví dụ: số lớn đã thực sự lớn hơn số bé chưa? ).

LUÔN TRẢ VỀ JSON:
{
  "analysis": "Phân tích lỗi cụ thể dựa trên tài liệu (ví dụ: nhầm công thức, quên dấu phẩy...)",
  "status": "CORRECT" hoặc "WRONG",
  "step_status": "STAY" hoặc "MOVE_NEXT",
  "feedback": "Lời nhắn gợi mở, thân thiện (mình-bạn). Nếu HS bế tắc, dùng câu hỏi dẫn dắt kiến thức.",
  "next_question": "Câu hỏi tiếp theo dẫn dắt HS"
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
    if (this.isSessionComplete) return { message: "Bạn đã hoàn thành bài toán này rồi! Hãy bấm nộp bài nhé." };

    const fullPrompt = `
ĐỀ BÀI: ${this.currentProblem}
BƯỚC HIỆN TẠI: ${this.currentStep}
LỊCH SỬ TƯƠNG TÁC: ${JSON.stringify(chatHistory.slice(-10))}
HS VỪA NHẬP: "${studentAnswer}"

YÊU CẦU PHẢN HỒI:
1. Tự thực hiện phép tính/quy trình đúng để đối chiếu.
2. Nếu HS sai, đặt câu hỏi gợi ý dựa trên tài liệu lỗi (ví dụ: mượn đơn vị, dịch dấu phẩy, tính tổng số phần...)[cite: 27, 36, 42].
3. MOVE_NEXT chỉ khi kết quả đúng, đơn vị đủ và format chuẩn (dấu phẩy).
4. Bước 4: Luôn yêu cầu kiểm tra tính hợp lý trước khi chúc mừng và kết thúc[cite: 19, 34].
`;

    try {
      const model = geminiModelManager.getModel();
      const result = await model.generateContent([
        { text: this._buildSystemPrompt() },
        { text: fullPrompt }
      ]);

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid JSON format from AI");
      
      const data = JSON.parse(jsonMatch[0]);

      if (data.step_status === "MOVE_NEXT") {
        if (this.currentStep < 4) {
          this.currentStep++;
        } else {
          this.isSessionComplete = true; 
        }
      }

      return {
        message: `${data.feedback}\n\n${data.next_question || ""}`,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: data.status.toLowerCase(),
        isSessionComplete: this.isSessionComplete
      };
    } catch (error) {
      console.error("Agent Error:", error);
      return { message: "Mình đang xem lại các dữ kiện một chút, bạn chờ mình tí nhé!", step: this.currentStep };
    }
  }

  async getHint() {
    const model = geminiModelManager.getModel();
    const result = await model.generateContent(
      `Dựa trên tài liệu lỗi (nhầm Tổng-Tỉ/Hiệu-Tỉ, quên dấu phẩy, không đổi đơn vị...), đưa ra gợi ý gợi mở cho bước ${this.currentStep} của bài toán: ${this.currentProblem}. Sử dụng câu hỏi dẫn dắt, không cho đáp án.`
    );
    return result.response.text();
  }
}

const geminiChatServiceInstance = new GeminiChatService();
export default geminiChatServiceInstance;