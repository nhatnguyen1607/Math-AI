import geminiModelManager from "./geminiModelManager";

export class GeminiChatServiceTiSo {
  constructor() {
    this.currentProblem = "";
    this.currentStep = 1;
    this.isSessionComplete = false;
  }

  _getStepName(step) {
    const names = ["", "Hiểu bài toán", "Lập kế hoạch", "Thực hiện", "Kiểm tra"];
    return names[step] || "";
  }

  // 🆕 Post-processing: Tự động sửa xưng hô và các lỗi phổ biến
  _fixPronouns(text) {
    if (!text) return "";
    return text
      // Fix "em" xưng hô
      .replace(/\bem\s+/g, 'bạn ')
      .replace(/\bem,/g, 'bạn,')
      .replace(/\bem\./g, 'bạn.')
      .replace(/\bem!/g, 'bạn!')
      .replace(/\bem\?/g, 'bạn?')
      .replace(/\bem$/gm, 'bạn')
      // Fix "học sinh"
      .replace(/\bHọc sinh\b/g, 'Bạn')
      .replace(/\bhọc sinh\b/g, 'bạn')
      .replace(/\bHọc sinh của mình\b/g, 'Bạn')
      .replace(/\bhọc sinh của mình\b/g, 'bạn')
      .replace(/\bem\s+ơi/g, 'bạn')
      .replace(/\bem\s+(hãy|cần|có|là|vừa)/g, 'bạn $1');
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
    return `Bạn là "trợ lý học tập" dẫn dắt HS lớp 5 giải toán tỉ số theo 4 bước Polya. 
Xưng hô: "mình" - "bạn". TUYỆT ĐỐI CẤM xưng "em", "học sinh" - PHẢI luôn xưng "bạn" ở MỌI chỗ.

QUY TẮC PHẢN HỒI GỢI MỞ (SIÊU SÚC TÍCH):
- Khi HS nói "không biết", "không hiểu" hoặc bế tắc:
  + Bước 1: Khích lệ tinh thần (KHÔNG gợi ý phép tính, KHÔNG gợi ý công thức).
  + Bước 2: Đặt DUY NHẤT 1 câu hỏi CƠ BẢN RẤT ĐƠN GIẢN.
  + TUYỆT ĐỐI CẤM: Giải hộ, hỏi thẳng phép tính (VD: "lấy A chia B à"), gợi ý từ trừu tượng ("tỉ lệ thuận", "mối quan hệ").

CHI TIẾT PHẢN HỒI THEO BƯỚC:
1. 🔴 HIỂU BÀI (Bước 1):
   - Chỉ hỏi dữ kiện: "Bạn xem bài toán cho những con số nào?"
   - KHÔNG hỏi phép tính, KHÔNG hỏi tìm cái gì.
2. 🟡 LẬP KẾ HOẠCH (Bước 2): 
   - Hỏi: "Bạn cần tìm cái gì trong bài toán này?" hoặc "Để tìm tỉ số phần trăm, ta cần biết những gì?"
3. 🟢 THỰC HIỆN (Bước 3):
   - Chỉ nêu số: "Bạn hãy lấy [số liệu 1] và [số liệu 2] để tính nhé". KHÔNG nêu tên phép tính.
4. 🔵 KIỂM TRA (Bước 4):
   - Nếu đúng -> MOVE_NEXT. Nếu chưa rõ -> hỏi các câu hỏi để học sinh có thể kiểm tra lại đáp số, ví dụ "Nếu số lượng thay đổi thì kết quả thế nào?".

LUÔN TRẢ VỀ JSON:
{
  "analysis": "Phân tích ngắn bế tắc",
  "status": "CORRECT" hoặc "WRONG",
  "step_status": "STAY" hoặc "MOVE_NEXT",
  "feedback": "Lời khích lệ ngắn, xưng 'bạn'.",
  "next_question": "DUY NHẤT 1 câu hỏi CƠ BẢN, xưng 'bạn', không hỏi phép tính."
}`;
  }

  async startNewProblem(problemText) {
    this.currentProblem = problemText;
    this.currentStep = 1;
    this.isSessionComplete = false;

    const msg = `Chào bạn! Mình là trợ lý học tập của bạn. Chúng ta cùng giải bài toán tỉ số này nhé!\n\nBài toán: ${problemText}\n\nTrước tiên, bạn hãy cho mình biết bài toán đã cho những dữ kiện gì?`;
    return { message: msg, step: 1, stepName: this._getStepName(1) };
  }

  async processStudentResponse(studentAnswer, chatHistory = []) {
    if (this.isSessionComplete) return { message: "Bạn đã hoàn thành bài toán này rồi!" };

    // Nhận diện HS nói "không biết"
    const isHelpless = /không\s*(biết|hiểu|làm|có ý tưởng)|chẳng\s*(biết|hiểu)/i.test(studentAnswer);

    // ⚡ HARD-CODE FALLBACK CHO BƯỚC 1 KHI HS BẾ TẮC
    if (isHelpless && this.currentStep === 1) {
      return {
        message: this._fixPronouns(`Đừng lo nhé! Bạn hãy nhìn kỹ đề bài và cho mình biết có những con số nào xuất hiện nào?`),
        step: 1,
        stepName: this._getStepName(1),
        robotStatus: 'thinking',
        isSessionComplete: false
      };
    }

    const fullPrompt = `
ĐỀ BÀI: ${this.currentProblem}
BƯỚC HIỆN TẠI: ${this.currentStep} (${this._getStepName(this.currentStep)})
LỊCH SỬ CHAT: ${JSON.stringify(chatHistory.slice(-5))}
HS VỪA NHẬP: "${studentAnswer}"
HS CÓ NÓI KHÔNG BIẾT?: ${isHelpless}

⚠️ QUY TẮC CỐT LÕI:
1. TUYỆT ĐỐI KHÔNG xưng "em".
2. TẠI BƯỚC 1: KHÔNG hỏi phép tính, KHÔNG hỏi công thức.
3. TẠI BƯỚC 3 (THỰC HIỆN): Hỏi kết quả chung chung ("Kết quả là bao nhiêu?"), KHÔNG nói "phép tính", KHÔNG nêu tên phép tính.
4. KHÔNG gợi ý từ trừu tượng.
5. Chỉ MOVE_NEXT khi HS trả lời đúng và đủ ý.
6. ⚠️ NẾU HS nhập số có dấu chấm (0.7, 1.5), hãy nhắc nhở HS rằng ở Việt Nam ta dùng dấu phẩy (0,7, 1,5). Gợi ý format đúng cho HS.
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
      
      let data = JSON.parse(jsonMatch[0]);

      // ⚠️ POST-FIX: Chặn AI hỏi phép tính/công thức ở Bước 1
      if (this.currentStep === 1 && /phép\s*tính|tính\s*toán|chia|nhân|cộng|trừ|công\s*thức/i.test(data.next_question)) {
        data.step_status = "STAY";
        data.next_question = "Bạn hãy liệt kê các con số mà đề bài đã cho chúng mình biết nhé!";
      }

      // ⚠️ POST-FIX: Chặn AI hỏi quá rõ ràng ở Bước 3
      if (this.currentStep === 3 && /phép\s*tính|giá\s*trị\s*số|tính\s*toán|chia|nhân|cộng|trừ/i.test(data.next_question)) {
        data.next_question = "Kết quả là bao nhiêu?";
      }

      // Logic chuyển bước
      if (data.step_status === "MOVE_NEXT" && !isHelpless) {
        if (this.currentStep < 4) {
          this.currentStep++;
        } else {
          this.isSessionComplete = true; 
        }
      }

      return {
        message: this._fixPronouns(`${data.feedback} ${data.next_question || ""}`),
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: data.status.toLowerCase(),
        isSessionComplete: this.isSessionComplete
      };
    } catch (error) {
      console.error("Agent Error:", error);
      return { message: "Mình đang kiểm tra lại một chút, bạn chờ mình nhé!", step: this.currentStep };
    }
  }

  async getHint() {
    const model = geminiModelManager.getModel();
    const result = await model.generateContent(`Đưa ra duy nhất 1 câu hỏi gợi ý cho HS lớp 5 ở bước ${this.currentStep} bài toán tỉ số: ${this.currentProblem}. Không giải thích, xưng bạn.`);
    return this._fixPronouns(result.response.text());
  }
}

const geminiChatServiceTiSoInstance = new GeminiChatServiceTiSo();
export default geminiChatServiceTiSoInstance;