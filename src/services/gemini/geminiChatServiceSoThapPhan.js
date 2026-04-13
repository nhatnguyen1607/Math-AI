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
    this.wrongAttemptCount = 0; // 🆕 Đếm số lần trả lời sai/không biết liên tiếp tại mỗi bước
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

  // 🆕 Xác định mức hỗ trợ theo số lần sai liên tiếp
  _getScaffoldingLevel() {
    if (this.wrongAttemptCount <= 1) return 1; // Lần 1: Động viên + kêu kiểm tra lại
    if (this.wrongAttemptCount === 2) return 2; // Lần 2: Chỉ ra lỗi sai
    return 3; // Lần 3+: Gợi ý rõ ràng
  }

  // 🆕 Tạo phản hồi theo cấp độ hỗ trợ khi HS bế tắc/sai
  _buildScaffoldedHelplessResponse() {
    const level = this._getScaffoldingLevel();
    const step = this.currentStep;

    // === CẤP ĐỘ 1: Động viên + kêu thử lại ===
    if (level === 1) {
      const responses = {
        1: "Không sao đâu, bạn cứ bình tĩnh nhé! 💪 Bạn hãy đọc lại đề bài thật chậm rồi thử nêu lại xem bài toán cho mình biết những gì nào?",
        2: "Bạn đang làm tốt lắm rồi! 💪 Bạn hãy suy nghĩ thêm một chút, dựa vào những dữ kiện vừa nêu, bạn sẽ giải bài này bằng cách nào nhé?",
        3: "Đừng lo nhé, bạn thử bình tĩnh đọc lại kế hoạch mình đã nêu rồi thử tính lại xem nào! 💪",
        4: "Không sao đâu! 💪 Bạn hãy nhìn lại kết quả mình vừa tính, đối chiếu với đề bài rồi thử trả lời lại nhé!"
      };
      return {
        message: this._fixPronouns(responses[step] || responses[1]),
        robotStatus: 'thinking'
      };
    }

    // === CẤP ĐỘ 2: Chỉ ra lỗi/vấn đề cụ thể ===
    if (level === 2) {
      const responses = {
        1: "Mình thấy bạn đang gặp khó ở phần tìm thông tin. Ở bước này, bạn cần làm 2 việc: (1) Nêu các dữ kiện đề bài cho (các con số thập phân, đơn vị), (2) Nêu yêu cầu bài toán hỏi gì (cần tìm/tính cái gì). Bạn thử nêu lại nhé!",
        2: "Mình thấy bạn đang chưa rõ cách giải. Ở bước này, bạn chỉ cần nêu: bạn sẽ làm thế nào để giải bài toán này (dùng phép tính gì, cách làm ra sao), chưa cần tính ra số cụ thể. Bạn thử nêu lại xem!",
        3: "Mình thấy bạn đang bị kẹt ở phần tính toán. Bạn cần: viết phép tính cụ thể → tính ra kết quả → nhớ dùng dấu phẩy (,) cho số thập phân → viết kết luận có đơn vị. Bạn hãy thử lại từng bước một nhé!",
        4: "Mình thấy bạn đang chưa rõ cách kiểm tra. Bạn cần: (1) Xem kết quả có hợp lý với đề bài không, (2) Dấu phẩy thập phân đã đặt đúng chưa, (3) Đơn vị đã viết đúng chưa. Bạn thử trả lời lại nhé!"
      };
      return {
        message: this._fixPronouns(responses[step] || responses[1]),
        robotStatus: 'thinking'
      };
    }

    // === CẤP ĐỘ 3+: Gợi ý rõ ràng (nhưng KHÔNG giải hộ) ===
    const responses = {
      1: "Mình gợi ý cho bạn nhé! 🌟 Bạn hãy nhìn vào đề bài và tìm: có những con số thập phân nào xuất hiện? Đề bài yêu cầu bạn tìm/tính cái gì? Bạn chỉ cần chép lại thông tin từ đề là được rồi!",
      2: "Mình gợi ý cho bạn nhé! 🌟 Dựa trên những dữ kiện bạn vừa nêu, bạn hãy nghĩ xem: cần phải làm gì với các con số thập phân đó để tìm đáp án? Bạn hãy nêu cách làm của bạn đi nhé!",
      3: "Mình gợi ý cho bạn nhé! 🌟 Bạn hãy làm theo 4 ý này: (1) Viết rõ phép tính bạn sẽ thực hiện, (2) Đặt tính thẳng hàng (nhớ dấu phẩy phải thẳng cột), (3) Tính ra kết quả bằng số (dùng dấu phẩy cho số thập phân), (4) Viết kết luận kèm đơn vị. Bạn thử làm theo từng ý một nhé!",
      4: "Mình gợi ý cho bạn nhé! 🌟 Để kiểm tra, bạn hãy: (1) Xem kết quả có hợp lý không (ví dụ: tổng phải lớn hơn từng số hạng, hiệu phải nhỏ hơn số bị trừ...), (2) Kiểm tra dấu phẩy thập phân đã đúng chưa, (3) Nếu thay đổi một số liệu ban đầu thì kết quả sẽ thay đổi như thế nào? Bạn thử trả lời theo 3 ý này nhé!"
    };
    return {
      message: this._fixPronouns(responses[step] || responses[1]),
      robotStatus: 'thinking'
    };
  }

  restoreSession(problemText, chatHistory) {
    this.currentProblem = problemText;
    this.wrongAttemptCount = 0; // Reset khi restore
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

⚠️ KIỂM TRA CÂU TRẢ LỜI CỦA HỌC SINH:
- Ở TẤT CẢ 4 BƯỚC, bạn PHẢI kiểm tra kỹ câu trả lời của học sinh để xác định ĐÚNG hay SAI.
- Phân tích cụ thể: thông tin có đúng/đủ không, phép tính có đúng không, dấu phẩy thập phân có đúng không, đáp số có chính xác không, đơn vị có phù hợp không.
- KHÔNG ĐƯỢC chấp nhận câu trả lời sai chỉ vì học sinh đã cố gắng.

🎯 QUY TẮC HỖ TRỢ THEO CẤP ĐỘ (SCAFFOLDING 3 MỨC):
Dựa vào trường "wrong_attempt_count" được cung cấp để điều chỉnh mức hỗ trợ:

📌 MỨC 1 (Lần sai/không biết thứ 1): ĐỘNG VIÊN + YÊU CẦU THỬ LẠI
- Khen ngợi tinh thần cố gắng của HS một câu ngắn gọn
- Nhắc HS kiểm tra lại câu trả lời, KHÔNG chỉ ra lỗi cụ thể
- Ví dụ: "Bạn cố gắng tốt lắm! Nhưng mình thấy chưa chính xác lắm, bạn thử kiểm tra lại nhé!"

📌 MỨC 2 (Lần sai/không biết thứ 2): CHỈ RA LỖI CỤ THỂ
- Chỉ rõ CHỖ SAI hoặc THIẾU trong câu trả lời của HS (dấu phẩy sai, thiếu đơn vị, phép tính sai...)
- Giải thích ngắn gọn tại sao sai
- Ví dụ: "Mình thấy bạn đang nhầm ở phần [chỗ sai]. Bạn cần [hướng sửa]. Bạn thử lại nhé!"

📌 MỨC 3+ (Lần sai/không biết thứ 3 trở lên): GỢI Ý RÕ RÀNG
- Đưa ra gợi ý CỤ THỂ từng bước để HS tự làm
- CÓ THỂ nêu hướng dẫn chi tiết hơn (ví dụ: nhắc quy tắc đặt dấu phẩy, liệt kê các bước cần làm)
- ⚠️ TUYỆT ĐỐI VẪN KHÔNG ĐƯỢC GIẢI HỘ hoặc nêu đáp số cụ thể
- Ví dụ: "Mình gợi ý cho bạn nhé: Bạn hãy (1)... (2)... (3)..."

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
  "reasoning_process": "Tự duy luận: 1. Đang ở bước mấy? 2. Học sinh đúng hay sai? Phân tích cụ thể chỗ đúng/sai. 3. Đây là lần sai thứ mấy (wrong_attempt_count)? Cần hỗ trợ mức nào? 4. Ở bước này được hỏi gì và BỊ CẤM hỏi gì? 5. Quyết định câu trả lời phù hợp với mức hỗ trợ.",
  "status": "CORRECT" hoặc "WRONG",
  "step_status": "STAY" hoặc "MOVE_NEXT",
  "feedback": "Lời khích lệ hoặc nhận xét kết quả, xưng 'bạn', không xưng 'em'. Phải phù hợp với mức scaffolding.",
  "next_question": "DUY NHẤT 1 câu hỏi CƠ BẢN gợi mở để HS tự làm bước tiếp theo. TUYỆT ĐỐI KHÔNG lồng ghép câu hỏi của bước cũ."
}`;
  }

  async startNewProblem(problemText) {
    this.currentProblem = problemText;
    this.currentStep = 1;
    this.isSessionComplete = false;
    this.wrongAttemptCount = 0; // 🆕 Reset bộ đếm

    const msg = `Chào bạn! Mình là trợ lý học tập của bạn. Chúng ta cùng giải bài toán này nhé!\n\nBài toán: ${problemText}\n\nTrước tiên, bạn hãy cho mình biết bài toán đã cho những thông tin gì?`;
    return { message: msg, step: 1, stepName: this._getStepName(1) };
  }

  async processStudentResponse(studentAnswer, chatHistory = []) {

    if (this.isSessionComplete)
      return { message: "Bạn đã hoàn thành bài toán này rồi!" };

    // 🆕 Kiểm tra lỗi số thập phân
    const decimalCheck = this._checkDecimalErrors(studentAnswer);
    if (decimalCheck.hasError) {
      this.wrongAttemptCount++; // 🆕 Tăng bộ đếm
      return {
        message: decimalCheck.message,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: "wrong",
      };
    }

    // Kiểm tra xem HS có nói "không biết" hay không
    const isHelpless =
      /không\s*(biết|hiểu|làm|có ý tưởng)|chẳng\s*(biết|hiểu)/i.test(
        studentAnswer,
      );

    // 🆕 LUÔN gửi qua AI kèm chatHistory đầy đủ để AI phân tích đúng bối cảnh
    // (KHÔNG return sớm vì hardcoded responses không có context của cuộc chat)

    const fullPrompt = `
ĐỀ BÀI: ${this.currentProblem}
BƯỚC HIỆN TẠI: ${this.currentStep} (${this._getStepName(this.currentStep)})
LỊCH SỬ CHAT (ĐỌC KỸ ĐỂ HIỂU BỐI CẢNH): ${JSON.stringify(chatHistory.slice(-12))}
HS VỪA NHẬP: "${studentAnswer}"
HS CÓ NÓI KHÔNG BIẾT/BẾ TẮC?: ${isHelpless}
SỐ LẦN SAI/KHÔNG BIẾT LIÊN TIẾP TẠI BƯỚC NÀY (wrong_attempt_count): ${this.wrongAttemptCount}

⚠️ PHẢI ĐỌC KỸ LỊCH SỬ CHAT ĐỂ XÁC ĐỊNH:
- HS đang ở bước nào trong 4 bước Polya?
- HS đã hoàn thành những bước nào rồi? (Nếu đã qua bước 1 và 2 thì TUYỆT ĐỐI KHÔNG quay lại hỏi bước 1/2)
- HS đang bế tắc ở CHỖ NÀO CỤ THỂ tại bước hiện tại?

⚠️ HƯỚNG DẪN HỖ TRỢ THEO CẤP ĐỘ (dựa vào wrong_attempt_count):
- wrong_attempt_count = 0: Lần sai ĐẦU TIÊN → MỨC 1: Động viên + kêu kiểm tra lại. KHÔNG chỉ ra lỗi cụ thể.
- wrong_attempt_count = 1: Lần sai thứ 2 → MỨC 2: CHỈ RA LỖI CỤ THỂ hoặc chỉ rõ HS đang thiếu gì. Nói rõ sai ở đâu.
- wrong_attempt_count >= 2: Lần sai thứ 3+ → MỨC 3: GỢI Ý RÕ RÀNG từng bước cụ thể để HS tự làm. NHƯNG TUYỆT ĐỐI KHÔNG giải hộ hay nêu đáp số.

⚠️ KHI HS NÓI "KHÔNG BIẾT" Ở BƯỚC 3:
- KHÔNG được quay lại hỏi "đề bài cho biết gì" (bước 1) hay "bạn giải thế nào" (bước 2)
- Phải HỖ TRỢ ĐÚNG ở bước 3: chia nhỏ phép tính, gợi ý cách bắt đầu trình bày lời giải
- Ví dụ mức 1: "Bạn đã biết cách giải rồi đấy! Bạn thử viết phép tính ra xem nào" 
- Ví dụ mức 2: "Ở bước trước bạn nói sẽ [nhắc lại kế hoạch HS đã nêu]. Vậy bạn thử viết phép tính đó ra nhé"
- Ví dụ mức 3: "Mình gợi ý nhé: (1) Viết phép tính, (2) Tính kết quả, (3) Viết kết luận kèm đơn vị"

⚠️ QUY TẮC CỐT LÕI:
1. TUYỆT ĐỐI KHÔNG xưng "em".
2. TẠI BƯỚC 1: KHÔNG hỏi phép tính. CHỈ hỏi dữ kiện.
3. TẠI BƯỚC 2: KHÔNG hỏi lại dữ kiện. CHỈ hỏi cách giải.
4. TẠI BƯỚC 3: KHÔNG hỏi lại bước 1/2. CHỈ yêu cầu trình bày lời giải hoặc hỗ trợ tính toán.
5. TẠI BƯỚC 4: KHÔNG bảo trình bày lại. CHỈ hỏi kiểm tra kết quả.
6. Chỉ MOVE_NEXT khi HS trả lời đúng và đủ ý.
7. ⚠️ NẾU HS nhập số có dấu chấm (0.7, 1.5), nhắc dùng dấu phẩy (0,7  1,5).
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

      // 🆕 Cập nhật bộ đếm sai: nếu WRONG thì tăng, nếu CORRECT thì reset
      if (data.status === "WRONG") {
        this.wrongAttemptCount++;
      } else if (data.status === "CORRECT") {
        this.wrongAttemptCount = 0; // Reset khi đúng
      }

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

      // ⚠️ POST-FIX: Bước 4 (Kiểm tra) - XỬ LÝ HOÀN THÀNH PHIÊN
      if (this.currentStep === 4) {
        const isStatusCorrect = data.status && data.status.toLowerCase() === "correct";

        // 🔴 Kiểm tra CẢ feedback VÀ next_question cho step 3 contamination
        const combinedText = `${data.feedback || ''} ${data.next_question || ''}`;
        const containsStep3Text = /trình bày.*lời giải|thực hiện.*kế hoạch|bắt đầu.*giải.*bài|hãy.*giải.*bài/i.test(combinedText);
        const containsStep2Text = /bạn sẽ.*giải.*thế nào|nêu.*cách giải|lập.*kế hoạch/i.test(combinedText);
        const containsStep1Text = /bài toán.*cho.*thông tin|đề bài.*cho.*biết/i.test(combinedText);

        // ✅ Nếu AI trả MOVE_NEXT ở bước 4 → LUÔN hoàn thành phiên
        if (data.step_status === "MOVE_NEXT") {
          data.feedback = "🎉 Xuất sắc! Bạn đã hoàn thành bài toán theo đầy đủ 4 bước của Polya rồi đó!";
          data.next_question = "Bạn hãy nộp bài luyện tập này bằng cách nhấn nút 'Nộp bài' ở dưới để mình chấm điểm nhé!";
        }
        // ✅ Nếu AI dính câu hỏi bước 1/2/3 vào response ở bước 4 → sửa lại
        else if (containsStep3Text || containsStep2Text || containsStep1Text) {
          // Nếu CORRECT nhưng STAY + dính text sai bước → kết thúc luôn
          if (isStatusCorrect) {
            data.step_status = "MOVE_NEXT";
            data.feedback = "🎉 Xuất sắc! Bạn đã hoàn thành bài toán theo đầy đủ 4 bước của Polya rồi đó!";
            data.next_question = "Bạn hãy nộp bài luyện tập này bằng cách nhấn nút 'Nộp bài' ở dưới để mình chấm điểm nhé!";
          } else {
            // WRONG + dính text sai bước → chỉ sửa câu hỏi, giữ STAY
            data.next_question = "Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi một trong các số liệu ban đầu thì kết quả sẽ thay đổi như thế nào?";
          }
        }
        // ✅ Nếu HS đã xác nhận đúng → kết thúc
        else if (isStatusCorrect) {
          const hasConfirmedCorrect = /đúng|hợp lý|hợp lí|được|ok|ổn|tốt|chính xác|xác nhận|xong|vâng|rồi|có thể|lược bỏ|bỏ đi|đúng rồi|được rồi/i.test(studentAnswer);
          if (hasConfirmedCorrect) {
            data.step_status = "MOVE_NEXT";
            data.feedback = "🎉 Xuất sắc! Bạn đã hoàn thành bài toán theo đầy đủ 4 bước của Polya rồi đó!";
            data.next_question = "Bạn hãy nộp bài luyện tập này bằng cách nhấn nút 'Nộp bài' ở dưới để mình chấm điểm nhé!";
          }
        }
        // ✅ Nếu STAY nhưng câu hỏi quá ngắn/generic → thay bằng câu hỏi kiểm tra
        else {
          if (!data.next_question || data.next_question.length < 20 ||
              !/nếu|thay đổi|kiểm tra|hợp lý/i.test(data.next_question)) {
            data.next_question = "Bạn hãy kiểm tra lại kết quả của bạn nhé. Bạn hãy suy nghĩ xem: nếu thay đổi một trong các số liệu ban đầu thì kết quả sẽ thay đổi như thế nào?";
          }
        }
      }

      // Logic chuyển bước
      if (data.step_status === "MOVE_NEXT") {
        if (this.currentStep < 4) {
          this.currentStep++;
          this.wrongAttemptCount = 0; // 🆕 Reset bộ đếm khi chuyển bước
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
