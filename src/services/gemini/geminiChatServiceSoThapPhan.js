import geminiModelManager from "./geminiModelManager";

/**
 * GeminiChatServiceSoThapPhan - Phiên bản Polya 4 Bước 2026
 * Chuyên dụng cho chủ đề Số thập phân (cộng, trừ, nhân, chia)
 */
export class GeminiChatServiceSoThapPhan {
  constructor() {
    this.currentProblem = "";
    this.currentStep = 1;
    this.isSessionComplete = false;
  }

  _getStepName(step) {
    const names = [
      "",
      "Hiểu bài toán",
      "Lập kế hoạch",
      "Thực hiện",
      "Kiểm tra",
    ];
    return names[step] || "";
  }

  // 🆕 Post-processing: Tự động sửa xưng hô từ "em" → "bạn"
  _fixPronouns(text) {
    if (!text) return "";
    return (
      text
        // Fix "em" xưng hô
        .replace(/\bem\s+/g, "bạn ")
        .replace(/\bem,/g, "bạn,")
        .replace(/\bem\./g, "bạn.")
        .replace(/\bem!/g, "bạn!")
        .replace(/\bem\?/g, "bạn?")
        .replace(/\bem$/gm, "bạn")
        // Fix "học sinh"
        .replace(/\bHọc sinh\b/g, "Bạn")
        .replace(/\bhọc sinh\b/g, "bạn")
        .replace(/\bHọc sinh của mình\b/g, "Bạn")
        .replace(/\bhọc sinh của mình\b/g, "bạn")
        .replace(/\bem\s+ơi/g, "bạn")
        .replace(/\bem\s+(hãy|cần|có|là|vừa)/g, "bạn $1")
    );
  }

  // 🆕 Kiểm tra lỗi phổ biến với số thập phân
  _checkDecimalErrors(text) {
    if (!text) return { hasError: false };

    // Kiểm tra xem có số liệu thập phân không
    const hasDecimalNumber = /\d+[.,]\d+|\d+,\d+|\d+\.\d+/i.test(text);
    if (!hasDecimalNumber) return { hasError: false };

    // Kiểm tra sử dụng dấu chấm thay vì dấu phẩy
    if (/\d+\.\d+/.test(text) && !/\d+,\d+/.test(text)) {
      return {
        hasError: true,
        message:
          "Bạn sử dụng dấu chấm (.) nhưng ở Việt Nam ta dùng dấu phẩy (,) để viết số thập phân. Ví dụ: 0,5 chứ không phải 0.5. Bạn kiểm tra lại nhé!",
      };
    }

    return { hasError: false };
  }

  restoreSession(problemText, chatHistory) {
    this.currentProblem = problemText;
    const model = geminiModelManager.getModel();
    if (model && chatHistory && chatHistory.length > 0) {
      let fixedHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
      if (fixedHistory.length > 0 && fixedHistory[0].role !== "user") {
        fixedHistory.unshift({ role: "user", parts: [{ text: problemText }] });
      }
      const fullText = fixedHistory
        .map((m) => m.parts[0]?.text || "")
        .join(" ");
      if (fullText.includes("Kiểm tra")) this.currentStep = 4;
      else if (fullText.includes("Thực hiện")) this.currentStep = 3;
      else if (fullText.includes("Lập kế hoạch")) this.currentStep = 2;
      else if (fullText.includes("Hiểu bài")) this.currentStep = 1;
    }
  }

  _buildSystemPrompt() {
    return `Bạn là "trợ lý học tập" dẫn dắt HS lớp 5 giải toán theo 4 bước Polya.
Xưng hô: "mình" - "bạn". TUYỆT ĐỐI CẤM xưng "em", "học sinh" - PHẢI luôn xưng "bạn" ở MỌI chỗ.

QUY TẮC PHẢN HỒI GỢI MỞ (SIÊU SÚC TÍCH):
- NẾU HS NÓI "KHÔNG BIẾT" HOẶC YÊU CẦU GIẢI: TUYỆT ĐỐI KHÔNG quay lại hỏi câu hỏi về "thông tin bài toán" (Bước 1) nếu đang ở Bước 2, Bước 3, hoặc Bước 4.
  + Tùy vào bước hiện tại, hãy CHIA NHỎ vấn đề hiện tại thành một câu hỏi gợi mở siêu dễ liên quan MẬT THIẾT đến con số hoặc bước tính mà HS đang kẹt.
  + TUYỆT ĐỐI CẤM: Giải hộ, hỏi thẳng phép tính, gợi ý từ khóa trừu tượng.

CHI TIẾT PHẢN HỒI THEO BƯỚC:
1. 🔴 HIỂU BÀI (Bước 1 - NÊU THÔNG TIN VÀ YÊU CẦU):
   - Hỏi HS nêu thông tin đề bài + yêu cầu cần tìm: "Bạn hãy cho mình biết bài toán cho những thông tin gì? Và bạn cần tìm/tính cái gì?"
   - KHÔNG hỏi phép tính, KHÔNG hỏi công thức, CHỈ hỏi về thông tin và yêu cầu.

2. 🟡 LẬP KẾ HOẠCH (Bước 2 - NÊU CÁCH GIẢI):
   - ⚠️ KHÔNG hỏi lại "bài toán có những con số nào" hay "bài toán cho những thông tin gì" - đó là câu hỏi bước 1 rồi!
   - Hỏi: "Để giải bài toán này, bạn sẽ làm thế nào?" hoặc "Bạn hãy nêu cách giải bài toán này nhé"
   - KHÔNG nêu công thức hay phép tính
   - KHÔNG nêu liệu phải cộng hay trừ - chỉ hỏi phương pháp chung
   - Chỉ MOVE_NEXT khi HS nêu được ý tưởng (dù chưa nêu phép tính cụ thể)

3. 🟢 THỰC HIỆN (Bước 3):
   - ⚠️ CHỦ ĐỀ SỐ THẬP PHÂN - KIỂM TRA KHẮT KHE:
     * Cộng/Trừ: Đặt dấu phẩy thẳng hàng? Thêm số 0 phần thập phân khi cần?
     * Nhân: Đã cộng tổng chữ số thập phân của 2 thừa số để đặt dấu phẩy ở tích chưa?
     * Chia: Đã chuyển số chia thành số tự nhiên? Đặt dấu phẩy ở thương đúng chưa?
     * Nhân/Chia 10, 100, 0,1: Dịch dấu phẩy đúng hướng chưa?
     * ⭐ BẮT BUỘC sử dụng dấu phẩy (,), KHÔNG dấu chấm (.)
     * ⭐ BẮT BUỘC có đơn vị (kg, m, v.v.)
   - Nêu số: "Bạn hãy lấy [số 1] và [số 2] để tính nhé". KHÔNG nêu tên phép tính (cộng/trừ/nhân/chia).
   - CHỈ hỏi kết quả chung chung: "Kết quả là bao nhiêu?"
   - TUYỆT ĐỐI KHÔNG ĐƯỢC lặp lại các câu hỏi của bước 1 hay bước 2 (như "đề bài cho biết gì?", "bạn cần tìm gì?", "bạn sẽ giải bài này thế nào?").
   - ⚠️ PHÁT HIỆN LỖI CỤ THỂ: Nếu HS sai, chỉ rõ lỗi (dấu phẩy sai, thiếu đơn vị, v.v.) để HS biết sửa và yêu cầu tính lại.

4. 🔵 KIỂM TRA (Bước 4 - CẬP NHẬT):
   - KIỂM TRA CHẶT CHẼ từng bước:
     * Hỏi: "Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi một trong các số liệu ban đầu thì kết quả sẽ thay đổi như thế nào?"
     * Hỏi về logic: "Kết quả có hợp lý không? Bạn hãy kiểm tra lại: đơn vị có đúng? Dấu phẩy có đúng? Độ lớn của kết quả có hợp lý?"
   - Chỉ MOVE_NEXT khi HS giải thích được hoặc trả lời được câu hỏi kiểm tra

⚠️ LƯU Ý TUYỆT ĐỐI:
- CHẶN: Không xưng "em", "học sinh", "học sinh của mình"
- CHẶN: Không gợi ý phép tính hay công thức ở bước 1
- CHẶN: Không gợi ý từ trừu tượng
- CHẶN: Đặt quá 1 câu hỏi
- ⭐ BƯỚC 4 PHẢI HỎI KỸ: Đặt nhiều câu để HS kiểm tra lại (nêu cách làm → hỏi "nếu thay đổi" → kiểm tra logic/đơn vị)
- BẮTBUỘC: Dấu phẩy (,) cho số thập phân, không dấu chấm (.)

LUÔN TRẢ VỀ JSON:
{
  "reasoning_process": "Tự duy luận: 1. Đang ở bước mấy? 2. Học sinh đúng hay sai? 3. Ở bước này được hỏi gì và BỊ CẤM hỏi gì (ví dụ đang ở bước 3 thì cấm hỏi lại thông tin của bước 1, bước 2)? 4. Quyết định câu trả lời.",
  "status": "CORRECT" hoặc "WRONG",
  "step_status": "STAY" hoặc "MOVE_NEXT",
  "feedback": "Lời khích lệ hoặc nhận xét kết quả, xưng 'bạn', không xưng 'em'.",
  "next_question": "DUY NHẤT 1 câu hỏi CƠ BẢN gợi mở để HS tự làm bước tiếp theo. TUYỆT ĐỐI KHÔNG lồng ghép câu hỏi của bước cũ."
}`;
  }

  async startNewProblem(problemText) {
    this.currentProblem = problemText;
    this.currentStep = 1;
    this.isSessionComplete = false;

    const msg = `Chào bạn! Mình là trợ lý học tập của bạn. Chúng ta cùng giải bài toán này nhé!\n\nBài toán: ${problemText}\n\nTrước tiên, bạn hãy cho mình biết bài toán đã cho những thông tin gì?`;
    return { message: msg, step: 1, stepName: this._getStepName(1) };
  }

  async processStudentResponse(studentAnswer, chatHistory = []) {

    if (this.isSessionComplete)
      return { message: "Bạn đã hoàn thành bài toán này rồi!" };

    // 🆕 Kiểm tra lỗi số thập phân
    const decimalCheck = this._checkDecimalErrors(studentAnswer);
    if (decimalCheck.hasError) {
      return {
        message: decimalCheck.message,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: "wrong",
      };
    }

    // 🆕 Kiểm tra xem HS có nói "không biết" hay không
    const isHelpless =
      /không\s*(biết|hiểu|làm|có ý tưởng)|chẳng\s*(biết|hiểu)/i.test(
        studentAnswer,
      );

    // 🆕 HARD-CODE FALLBACK CHO BƯỚC 2 KHI HS NÓI "KHÔNG BIẾT"
    if (isHelpless && this.currentStep === 2) {
      return {
        message: this._fixPronouns(
          `Không sao đâu! Bạn hãy suy nghĩ đơn giản thôi. Dựa trên những dữ kiện mà bạn vừa nêu, bạn cần phải làm gì để giải bài toán này? Bạn hãy nêu cách làm của bạn đi nhé!`,
        ),
        step: 2,
        stepName: this._getStepName(2),
        robotStatus: "thinking",
        isSessionComplete: false,
      };
    }

    // 🆕 HARD-CODE FALLBACK CHO BƯỚC 1 KHI HS NÓI "KHÔNG BIẾT"
    if (isHelpless && this.currentStep === 1) {
      return {
        message: this._fixPronouns(
          `Đừng lo nhé! Bạn hãy nhìn kỹ đề bài và cho mình biết có những con số nào xuất hiện nào?`,
        ),
        step: 1,
        stepName: this._getStepName(1),
        robotStatus: "thinking",
        isSessionComplete: false,
      };
    }

    // 🆕 HARD-CODE FALLBACK CHO BƯỚC 4 KHI HS BẾ TẮC
    if (isHelpless && this.currentStep === 4) {
      return {
        message: this._fixPronouns(
          `Không sao đâu! Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi một trong các số liệu ban đầu thì kết quả sẽ thay đổi như thế nào?`,
        ),
        step: 4,
        stepName: this._getStepName(4),
        robotStatus: "thinking",
        isSessionComplete: false,
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
2. TẠI BƯỚC 1 (Hiểu bài): KHÔNG hỏi phép tính, KHÔNG hỏi công thức. CHỈ hỏi dữ kiện.
3. TẠI BƯỚC 2 (Lập kế hoạch): Hỏi "Bạn sẽ giải thế nào?" - KHÔNG gợi ý phép tính cụ thể, KHÔNG hỏi dữ kiện nữa. Chỉ MOVE_NEXT khi HS nêu được phương pháp.
4. TẠI BƯỚC 3 (THỰC HIỆN - SỐ THẬP PHÂN - CỰC KỲ QUAN TRỌNG): 
   - NẾU BƯỚC 3 HS MỚI BẮT ĐẦU: Hỏi "Bạn hãy trình bày lời giải của bạn nhé!"
   - NẾU BƯỚC 3 HS ĐÃ TRÌNH BÀY PHÉP TÍNH (kiểu "a - b = c"): Kiểm tra xem kết quả c có đúng không?
     * NẾU SAI: Chỉ rõ lỗi (tính sai, dấu phẩy sai, thiếu đơn vị, v.v.) và hỏi "Bạn hãy kiểm tra lại phép tính nhé!"
     * NẾU ĐÚNG: Nói "Được rồi!" và MOVE_NEXT sang Bước 4
   - KHÔNG trong trường hợp nào hỏi lại "nêu cách làm" hay "định giải như thế nào" ở Bước 3
5. TẠI BƯỚC 4 (Kiểm tra): Hỏi "Bạn hãy kiểm tra lại kết quả nhé" - KHÔNG bảo "trình bày lại lời giải"
   - Hỏi "nếu thay đổi số liệu" hoặc "kết quả có hợp lý không"
6. KHÔNG gợi ý từ trừu tượng.
7. Chỉ MOVE_NEXT khi HS trả lời đúng và đủ ý.
8. ⚠️ NẾU HS nhập số có dấu chấm (0.7, 1.5), hãy nhắc nhở HS rằng ở Việt Nam ta dùng dấu phẩy (0,7, 1,5).
`;

    try {
      const model = geminiModelManager.getModel();
      const result = await model.generateContent([
        { text: this._buildSystemPrompt() },
        { text: fullPrompt },
      ]);

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI response format error");

      let data = JSON.parse(jsonMatch[0]);



      // ===== BƯỚC 2: XỬ LÝ KẾ HOẠCH =====
      if (this.currentStep === 2) {
        const originalStep2Status = data.step_status;

        // ✅ MOVE_NEXT: HS đã nêu kế hoạch xong → chuyển sang bước 3
        if (originalStep2Status === "MOVE_NEXT") {
          data.feedback = data.feedback || "Bạn đã lên kế hoạch rất tốt rồi đó!";
          data.next_question = "Tuyệt vời! Bây giờ bạn hãy bắt đầu thực hiện kế hoạch nhé! Trình bày lời giải đầy đủ của bạn.";
        }
      }

      // ⚠️ POST-FIX: Sau Bước 3 thành công → Chúc mừng + Chuyển sang Bước 4 với câu hỏi cụ thể
      if (this.currentStep === 3 && data.step_status === "MOVE_NEXT") {
        data.feedback = data.feedback || "Tuyệt vời! Bạn tính toán rất chính xác!";
        
        // Extract số từ bài toán để tạo câu hỏi cụ thể
        if (this.currentProblem && this.currentProblem.trim()) {
          const numberMatches = this.currentProblem.match(/\d+(?:[,.]\d+)?/g);
          // Lọc chỉ những số hợp lệ (không phải NaN)
          const validNumbers = numberMatches 
            ? numberMatches.filter(num => {
                const parsed = parseFloat(num.replace(',', '.'));
                return !isNaN(parsed) && num.length > 0;
              })
            : [];
          
          if (validNumbers && validNumbers.length > 0) {
            // Chọn ngẫu nhiên 1 số từ bài toán
            const randomNumber = validNumbers[Math.floor(Math.random() * validNumbers.length)];
            // Tạo số mới (thêm 5)
            const numValue = parseFloat(randomNumber.replace(',', '.'));
            
            // Double-check không phải NaN
            if (!isNaN(numValue)) {
              const newValue = numValue + 5;
              const newNumber = newValue.toFixed(2).replace('.', ',');
              data.next_question = 
                `Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi ${randomNumber} thành ${newNumber}, kết quả sẽ là bao nhiêu?`;
            } else {
              // Fallback nếu parse fail
              data.next_question =
                "Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi một trong các số liệu ban đầu thì kết quả sẽ thay đổi như thế nào?";
            }
          } else {
            // Fallback nếu không extract được số
            data.next_question =
              "Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi một trong các số liệu ban đầu thì kết quả sẽ thay đổi như thế nào?";
          }
        } else {
          // Fallback nếu không có bài toán
          data.next_question =
            "Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi một trong các số liệu ban đầu thì kết quả sẽ thay đổi như thế nào?";
        }
      }

      // ⚠️ POST-FIX: Bước 4 (Kiểm tra) - KẾT THÚC PHIÊN khi học sinh xác nhận kiểm tra xong
      if (this.currentStep === 4) {
        // Detect nếu học sinh đã xác nhận kiểm tra xong (nêu các yếu tố đúng)
        const hasConfirmedCorrect = /đúng|hợp|được|ok|ổn|tốt|chính xác|xác nhận|xong|thế|vâng|đúng rồi|được rồi/i.test(
          studentAnswer
        );
        
        // Normalize status để so sánh case-insensitive
        const isStatusCorrect = data.status && data.status.toLowerCase() === "correct";
        
        // 🔴 KIỂM TRA: Nếu câu trả lời chứa "trình bày lời giải" → CÓ LẼ AI NHẦM bước 2 vào bước 4
        // Hoặc nếu học sinh đã xác nhận chính xác → KẾT THÚC NGAY
        const containsPresentSolution = /trình bày|nêu.*lời giải/i.test(data.next_question);
        
        if ((hasConfirmedCorrect && isStatusCorrect) || hasConfirmedCorrect || containsPresentSolution) {
          // Nếu phát hiện bất kỳ dấu hiệu hoàn thành → KẾT THÚC PHIÊN
          data.step_status = "MOVE_NEXT";
          data.feedback = 
            "🎉 Xuất sắc! Bạn đã hoàn thành bài toán theo đầy đủ 4 bước của Polya rồi đó!";
          data.next_question = 
            "Bạn hãy nộp bài luyện tập này bằng cách nhấn nút 'Nộp bài' ở dưới để mình chấm điểm nhé!";
        } else {
          // Không nên bảo "trình bày lại lời giải"
          if (/trình bày|nêu lại.*cách|giải thích.*cách|làm thế nào/i.test(
            data.next_question,
          )) {
            data.next_question =
              "Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi một trong các số liệu ban đầu thì kết quả sẽ thay đổi như thế nào?";
          }

          // Nếu câu hỏi quá ngắn hoặc không có "nếu thay đổi" → tăng độ sâu
          if (
            data.next_question.length < 20 ||
            !/nếu|thay đổi|sửa|1 số|con số khác|kiểm tra/i.test(
              data.next_question,
            )
          ) {
            data.next_question =
              "Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi một trong các số liệu ban đầu thì kết quả sẽ thay đổi như thế nào?";
          }
        }
      }

      // Logic chuyển bước
      if (data.step_status === "MOVE_NEXT" && !isHelpless) {
        if (this.currentStep < 4) {
          this.currentStep++;
        } else {
          this.isSessionComplete = true;
        }
      }

      // Tạo câu phản hồi chuẩn từ feedback và next_question, không cắt ráp từ khóa nữa
      let finalMessage = this._fixPronouns(`${data.feedback} ${data.next_question || ""}`).trim();

      return {
        message: finalMessage,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: data.status.toLowerCase(),
        isSessionComplete: this.isSessionComplete,
      };
    } catch (error) {
      console.error("Agent Error:", error);
      return {
        message: "Mình đang kiểm tra lại một chút, bạn chờ mình nhé!",
        step: this.currentStep,
      };
    }
  }

  async getHint() {
    const model = geminiModelManager.getModel();
    const result = await model.generateContent(
      `Dựa trên chủ đề SỐ THẬP PHÂN (cộng/trừ/nhân/chia), đưa ra duy nhất 1 câu hỏi gợi ý cho HS lớp 5 ở bước ${this.currentStep} của bài toán: ${this.currentProblem}. 
      - Bước 1: Hỏi dữ kiện - không cho đáp án, xưng "bạn".
      - Bước 2: Hỏi "bạn sẽ giải thế nào" - không gợi ý phép tính, xưng "bạn".
      - Bước 3: Hỏi "bạn hãy trình bày lời giải" - nếu HS sai PHẢI CHỈ RÕ lỗi (dấu phẩy sai, thiếu đơn vị, tính sai...) để HS biết sửa, xưng "bạn".
      - Bước 4: Hỏi "bạn hãy kiểm tra lại kết quả" hoặc "nếu thay đổi số liệu thì kết quả thay đổi như thế nào" - không sử dụng ví dụ cụ thể, xưng "bạn".`,
    );
    return this._fixPronouns(result.response.text());
  }
}

const geminiChatServiceSoThapPhanInstance = new GeminiChatServiceSoThapPhan();
export default geminiChatServiceSoThapPhanInstance;
