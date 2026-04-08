import geminiModelManager from "./geminiModelManager";
import { EXAM_CONTEXTS } from '../../constants/examContexts';

export class GeminiChatServiceTiSo {
  constructor() {
    this.currentProblem = "";
    this.currentStep = 1;
    this.isSessionComplete = false;
    this.currentContextId = EXAM_CONTEXTS[0]?.id || '';
  }

  _getContext() {
    return EXAM_CONTEXTS.find((c) => c.id === this.currentContextId) || EXAM_CONTEXTS[0];
  }

  _getStepName(step) {
    const names = ["", "Hiểu bài toán", "Lập kế hoạch", "Thực hiện", "Kiểm tra"];
    return names[step] || "";
  }

  _normalizeMathText(text = "") {
    return String(text)
      .replace(/,/g, ".")
      .replace(/[xX×]/g, "*")
      .replace(/:/g, "/");
  }

  _evaluateSimpleExpression(expression = "") {
    const expr = String(expression || "").replace(/\s+/g, "");
    if (!expr) return null;

    const tokens = [];
    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];
      if (/\d|\./.test(ch)) {
        let num = ch;
        while (i + 1 < expr.length && /\d|\./.test(expr[i + 1])) {
          num += expr[++i];
        }
        if ((num.match(/\./g) || []).length > 1) return null;
        tokens.push(num);
      } else if ("+-*/()".includes(ch)) {
        tokens.push(ch);
      } else {
        return null;
      }
    }

    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };
    const operators = [];
    const values = [];

    const applyTopOperator = () => {
      const op = operators.pop();
      const b = values.pop();
      const a = values.pop();
      if (a === undefined || b === undefined || !op) return false;

      let result;
      if (op === "+") result = a + b;
      else if (op === "-") result = a - b;
      else if (op === "*") result = a * b;
      else {
        if (b === 0) return false;
        result = a / b;
      }

      if (!Number.isFinite(result)) return false;
      values.push(result);
      return true;
    };

    let prevToken = null;
    for (const token of tokens) {
      if (/^\d/.test(token) || token.startsWith(".")) {
        values.push(parseFloat(token));
      } else if (token === "(") {
        operators.push(token);
      } else if (token === ")") {
        while (operators.length && operators[operators.length - 1] !== "(") {
          if (!applyTopOperator()) return null;
        }
        if (operators.pop() !== "(") return null;
      } else {
        if (token === "-" && (!prevToken || "(+-*/".includes(prevToken))) {
          values.push(0);
        }
        while (
          operators.length &&
          operators[operators.length - 1] !== "(" &&
          precedence[operators[operators.length - 1]] >= precedence[token]
        ) {
          if (!applyTopOperator()) return null;
        }
        operators.push(token);
      }
      prevToken = token;
    }

    while (operators.length) {
      if (operators[operators.length - 1] === "(") return null;
      if (!applyTopOperator()) return null;
    }

    if (values.length !== 1 || !Number.isFinite(values[0])) return null;
    return values[0];
  }

  _validateStudentComputation(text = "") {
    const normalized = this._normalizeMathText(text);
    const match = normalized.match(/([\d\s.+*/()-]+)=\s*([\d.]+)/);
    if (!match) return { isValid: true };

    const lhs = (match[1] || "").replace(/\s+/g, "");
    const rhs = parseFloat(match[2]);

    if (!lhs || !Number.isFinite(rhs) || /[^\d.+*/()-]/.test(lhs)) {
      return { isValid: true };
    }

    const calculated = this._evaluateSimpleExpression(lhs);
    if (!Number.isFinite(calculated)) return { isValid: true };
    const diff = Math.abs(calculated - rhs);
    const tolerance = Math.max(1e-6, Math.abs(rhs) * 0.005);
    if (diff > tolerance) {
      const prettyCalculated = Number(calculated.toFixed(6));
      const prettyRhs = Number(rhs.toFixed(6));
      let issueType = "arithmetic";
      if (Math.abs(rhs) > 0) {
        const ratio = Math.abs(calculated / rhs);
        const decimalLikeFactors = [10, 100, 1000, 0.1, 0.01, 0.001];
        const looksLikeDecimalShift = decimalLikeFactors.some((factor) =>
          Math.abs(ratio - factor) <= factor * 0.03
        );
        if (looksLikeDecimalShift) issueType = "decimal";
      }
      return {
        isValid: false,
        issueType,
        expression: lhs,
        expected: prettyCalculated,
        actual: prettyRhs,
        message: "Mình thấy có chút sai sót ở kết quả, bạn hãy kiểm tra lại nhé!"
      };
    }
    return { isValid: true };
  }

  _buildStep3ComputationFeedback(check = {}) {
    const expression = check?.expression ? ` ${check.expression}` : "";
    if (check?.issueType === "decimal") {
      return `Bạn hãy kiểm tra lại kết quả của phép tính${expression}, có vẻ bạn đang đặt vị trí dấu phẩy chưa chính xác. Bạn thử tính lại từng bước rồi ghi lại kết quả, và nhớ kiểm tra lại đơn vị % nhé.`;
    }

    return `Bạn hãy kiểm tra lại kết quả của phép tính${expression}, hiện chưa khớp với dữ kiện bài toán. Bạn rà lại từng bước tính và nhớ kiểm tra lại đơn vị % trước khi kết luận nhé.`;
  }

  _checkPercentUnit(text = "") {
    const lower = String(text || "").toLowerCase();
    const hasPercent = /%|phần\s*trăm/.test(lower);
    const hasNumericResult = /(?:=\s*)?\d+(?:[.,]\d+)?/.test(lower);
    const isResultLike = /=|kết\s*quả|đáp\s*số|tỉ\s*số|tỷ\s*số|là\s*\d/.test(lower);

    if (hasNumericResult && isResultLike && !hasPercent) {
      return {
        hasError: true,
        message: "Ở bài tỉ số, kết quả cần kèm đơn vị %. Bạn kiểm tra và thêm % vào sau kết quả nhé!"
      };
    }

    return { hasError: false };
  }

  _hasStep1Complete(answer = "", chatHistory = []) {
    // Kiểm tra bước 1: HS nêu được thông tin + yêu cầu (có thể tách ra hoặc cùng 1 lần)
    const recentText = Array.isArray(chatHistory)
      ? chatHistory
          .filter((m) => m?.role === 'user')
          .slice(-8)
          .map((m) => m?.parts?.[0]?.text || '')
          .join(' ')
      : '';
    const fullText = `${recentText} ${String(answer || '')}`.toLowerCase();
    const hasInfo = /\d/.test(fullText);
    const hasRequirement = /(yêu cầu|cần\s*tìm|hỏi|tính|tìm\s*(tỉ\s*số|phần\s*trăm|giá\s*trị)|bao\s*nhiêu)/i.test(fullText);
    return hasInfo && hasRequirement;
  }

  _hasStep2Complete(answer = "", chatHistory = []) {
    // Kiểm tra bước 2: HS nêu sơ bộ cách giải
    const recentText = Array.isArray(chatHistory)
      ? chatHistory
          .filter((m) => m?.role === 'user')
          .slice(-8)
          .map((m) => m?.parts?.[0]?.text || '')
          .join(' ')
      : '';
    const fullText = `${recentText} ${String(answer || '')}`.toLowerCase();
    // Kiểm tra xem HS có nêu cách giải (sẽ dùng, chia/nhân, công thức, quy tắc...)
    const hasSolution = /(sẽ|dùng|quy tắc|công thức|bằng cách|bằng|chia|nhân|cộng|trừ|tỉ\s*lệ)/i.test(fullText);
    return hasSolution;
  }

  _hasExecutionEvidence(answer = "") {
    const text = String(answer || "").toLowerCase();
    // Nếu HS đã bắt đầu tính/ghi biểu thức thì xem như đã có ý tưởng giải.
    return /[=:+\-*/]|tỉ\s*số|tỷ\s*số|phần\s*trăm|đáp\s*số|kết\s*luận/i.test(text);
  }

  _isOldStep2Prompt(text = "") {
    return /bạn\s+hãy\s+nêu\s+kế\s*hoạch\s*giải[:：]?\s*bạn\s*sẽ\s*dùng\s*thông\s*tin\s*nào\s+và\s+dùng\s*quy\s*tắc\s*\/\s*công\s*thức\s*nào\s+để\s*giải\??/i.test(String(text || ""));
  }

  _sanitizeByCurrentStep(text = "") {
    let safeText = String(text || "");
    if (this.currentStep !== 2 && this._isOldStep2Prompt(safeText)) {
      if (this.currentStep === 3) {
        safeText = "Bạn hãy trình bày lời giải đầy đủ theo kế hoạch đã nêu, viết rõ từng bước rồi kết luận có đơn vị % nhé.";
      } else if (this.currentStep === 4) {
        safeText = "Bạn hãy kiểm tra lại lời giải: kết quả có khớp dữ kiện, đã có đơn vị % và kết luận đã đủ yêu cầu chưa?";
      } else {
        safeText = "Bạn hãy tiếp tục trả lời theo đúng bước hiện tại nhé.";
      }
    }
    return safeText;
  }

  _hasStep3Complete(answer = "") {
    const text = String(answer || "").toLowerCase();
    const equationCount = (text.match(/=/g) || []).length;
    const hasRatioContext = /tỉ\s*số|tỷ\s*số|phần\s*trăm/.test(text);
    const hasConclusion = /đáp\s*số|kết\s*luận|%/.test(text);
    const hasStructuredFlow = /bước\s*1|bước\s*2|bước\s*3|trước\s*hết|tiếp\s*theo|sau\s*đó|cuối\s*cùng/.test(text);

    return (equationCount >= 1 || hasStructuredFlow) && hasRatioContext && hasConclusion;
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

  restoreSession(problemText, chatHistory, examContextId = '') {
    this.currentProblem = problemText;
    if (examContextId) {
      this.currentContextId = examContextId;
    }
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
    const ctx = this._getContext();

    return `Bạn là "trợ lý học tập" dẫn dắt HS lớp 5 giải toán tỉ số theo 4 bước Polya. 
Xưng hô: "mình" - "bạn". TUYỆT ĐỐI CẤM xưng "em", "học sinh" - PHẢI luôn xưng "bạn" ở MỌI chỗ.

VAI TRÒ CỦA BẠN: BẠN ĐANG ĐÓNG VAI LÀ "${ctx.aiRole}".
- Nhiệm vụ nhập vai: ${ctx.aiRoleDescription}
- Hãy xưng hô thân thiện, nhất quán với vai trò này.
- Trong cuộc trò chuyện, hãy nhắc đến các nhân vật Mai, Việt, Nam trong bối cảnh bài toán để tạo sự gần gũi.

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
  - Hỏi kế hoạch giải: "Bạn sẽ dùng thông tin nào và quy tắc/công thức nào để giải?"
  - CHỈ hỏi kế hoạch, CHƯA yêu cầu tính toán hay cho đáp số.
3. 🟢 THỰC HIỆN (Bước 3):
  - Yêu cầu HS trình bày lời giải đầy đủ theo kế hoạch đã nêu.
  - KHÔNG đưa số cụ thể vào gợi ý.
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

  async startNewProblem(problemText, isApplicationProblem = false, examContextId = '') {
    this.currentProblem = problemText;
    this.currentStep = 1;
    this.isSessionComplete = false;
    if (examContextId) {
      this.currentContextId = examContextId;
    }

    const ctx = this._getContext();

    const msg = `Chào bạn! Mình là ${ctx.aiRole}. Chúng ta cùng giải bài toán tỉ số này nhé!\n\nBài toán: ${problemText}\n\nTrước tiên, bạn hãy cho mình biết bài toán đã cho những thông tin gì? Và bạn cần tìm/tính cái gì?`;
    return { message: msg, step: 1, stepName: this._getStepName(1) };
  }

  async processStudentResponse(studentAnswer, chatHistory = []) {
    if (this.isSessionComplete) return { message: "Bạn đã hoàn thành bài toán này rồi!" };

    const computationCheck = this._validateStudentComputation(studentAnswer);
    if (!computationCheck.isValid) {
      return {
        message: this.currentStep === 3
          ? this._buildStep3ComputationFeedback(computationCheck)
          : computationCheck.message,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: 'wrong',
        isSessionComplete: false
      };
    }

    // Với chủ đề tỉ số: khi HS đã nêu kết quả dạng số thì cần có đơn vị %
    if (this.currentStep >= 3) {
      const percentCheck = this._checkPercentUnit(studentAnswer);
      if (percentCheck.hasError) {
        return {
          message: this.currentStep === 3
            ? "Bạn hãy xem lại đơn vị của bài toán cho chính xác nhé. Ở bài tỉ số, kết quả cần ghi kèm đơn vị %."
            : percentCheck.message,
          step: this.currentStep,
          stepName: this._getStepName(this.currentStep),
          robotStatus: 'wrong',
          isSessionComplete: false
        };
      }
    }

    // Nhận diện HS nói "không biết"
    const isHelpless = /không\s*(biết|hiểu|làm|có ý tưởng)|chẳng\s*(biết|hiểu)/i.test(studentAnswer);

    // Gợi mở khi HS bế tắc ở mọi bước, không đưa số cụ thể
    if (isHelpless) {
      if (this.currentStep === 1) {
        return {
          message: this._fixPronouns("Đừng lo nhé! Bạn hãy nêu các thông tin đề bài đã cho và yêu cầu cần tìm là gì nhé."),
          step: 1,
          stepName: this._getStepName(1),
          robotStatus: 'thinking',
          isSessionComplete: false
        };
      }

      if (this.currentStep === 2) {
        return {
          message: this._fixPronouns("Bạn làm tốt rồi! Ở bước này bạn chỉ cần nêu kế hoạch giải: sẽ dùng thông tin nào và quy tắc/công thức nào, chưa cần tính ra kết quả."),
          step: 2,
          stepName: this._getStepName(2),
          robotStatus: 'thinking',
          isSessionComplete: false
        };
      }

      if (this.currentStep === 3) {
        return {
          message: this._fixPronouns("Không sao nhé! Bạn hãy trình bày lời giải đầy đủ theo kế hoạch đã nêu, viết lần lượt từng bước rồi kết luận có đơn vị %."),
          step: 3,
          stepName: this._getStepName(3),
          robotStatus: 'thinking',
          isSessionComplete: false
        };
      }

      return {
        message: this._fixPronouns("Không sao đâu nhé! Ở bước kiểm tra, bạn làm theo 3 ý này: (1) đối chiếu lại kết quả với dữ kiện đề bài, (2) kiểm tra kết quả đã có đơn vị % chưa, (3) kết luận đã trả lời đúng yêu cầu chưa. Bạn thử trả lời lại theo 3 ý này nhé."),
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
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
2. TẠI BƯỚC 1: NÓI THÔNG TIN + YÊU CẦU, KHÔNG nêu phép tính, KHÔNG giới hạn HS chỉ nêu 1 lần.
3. TẠI BƯỚC 2: Hỏi cách giải
4. TẠI BƯỚC 3 (THỰC HIỆN): 🚫 TUYỆT ĐỐI CẤM nêu cụ thể số trong câu hỏi gợi ý
5. KHÔNG gợi ý từ trừu tượng.
6. Chỉ MOVE_NEXT khi HS trả lời đúng và đủ ý.
7. ⚠️ NẾU HS nhập số có dấu chấm (0.7, 1.5), hãy nhắc nhở HS rằng ở Việt Nam ta dùng dấu phẩy (0,7, 1,5). Gợi ý format đúng cho HS.
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
        data.next_question = "Bạn hãy cho mình biết bài toán cho những con số nào và bạn cần tìm cái gì?";
      }

      // ⚠️ POST-FIX: Chặn AI nêu cụ thể số ở Bước 2
      if (this.currentStep === 2 && /\d+|\[|\]|kết\s*quả|đáp\s*số|tính\s*toán|=|ra\s*bao\s*nhiêu/i.test(data.next_question)) {
        data.step_status = "STAY";
        data.next_question = "Bạn hãy nêu kế hoạch giải: bạn sẽ dùng thông tin nào và dùng quy tắc/công thức nào để giải?";
      }

      if (this.currentStep === 2 && data.step_status === "MOVE_NEXT") {
        data.next_question = "Bạn hãy trình bày lời giải đầy đủ theo kế hoạch bạn đã nêu, viết rõ từng bước rồi kết luận có đơn vị % nhé.";
      }

      // ⚠️ POST-FIX: Ở bước 3 không được quay lại hỏi kiểu bước 2
      if (this.currentStep === 3 && (/kế\s*hoạch|sẽ\s*dùng|dùng\s*thông\s*tin\s*nào|quy\s*tắc|công\s*thức|phép\s*tính|giá\s*trị\s*số|tính\s*toán|chia|nhân|cộng|trừ|\[|\d+/i.test(data.next_question))) {
        data.next_question = "Bạn hãy trình bày lời giải đầy đủ theo kế hoạch bạn nêu ở trên, rồi viết kết luận có đơn vị % nhé.";
      }

      // 🆕 CHECK: Bước 1 phải hoàn thành (có thông tin + yêu cầu)
      if (
        this.currentStep === 1 &&
        data.step_status === "MOVE_NEXT" &&
        !this._hasStep1Complete(studentAnswer, chatHistory)
      ) {
        data.step_status = "STAY";
        data.status = "WRONG";
        data.feedback = "Bạn đã nêu được thông tin rồi, rất tốt.";
        data.next_question = "Bây giờ bạn nói thêm yêu cầu của bài toán là cần tìm gì nhé?";
      }

      // 🆕 CHECK: Bước 2 phải hoàn thành (nêu cách giải)
      if (
        this.currentStep === 2 &&
        data.step_status === "MOVE_NEXT" &&
        !this._hasStep2Complete(studentAnswer, chatHistory) &&
        !this._hasExecutionEvidence(studentAnswer)
      ) {
        data.step_status = "STAY";
        data.status = "WRONG";
        data.feedback = "Bạn cần nêu sơ bộ cách giải bài toán.";
        data.next_question = "Bạn sẽ dùng những gì (công thức, quy tắc) để tìm được câu trả lời?";
      }

      // Bước 3: HS phải trình bày đầy đủ các bước tính theo kế hoạch đã nêu.
      if (
        this.currentStep === 3 &&
        data.step_status === "MOVE_NEXT" &&
        !this._hasStep3Complete(studentAnswer)
      ) {
        data.step_status = "STAY";
        data.status = "WRONG";
        data.feedback = "Bạn mới nêu một phần kết quả, chưa đủ các bước tính theo kế hoạch.";
        data.next_question = "Bạn hãy trình bày đầy đủ từng bước tính rồi viết kết luận cuối cùng có đơn vị % nhé.";
      }

      // Bước 4: chỉ được hoàn thành khi trả lời đúng.
      if (this.currentStep === 4) {
        const isCorrect = String(data.status || "").toUpperCase() === "CORRECT";
        if (!isCorrect) {
          data.step_status = "STAY";
          data.status = "WRONG";
          data.feedback = data.feedback || "Không sao đâu, mình cùng kiểm tra lại nhé.";
          data.next_question = "Bạn hãy rà lại theo 3 ý: kết quả có khớp dữ kiện không, kết quả đã có đơn vị chưa, và kết luận đã trả lời đủ yêu cầu đề bài chưa?";
        }
      }

      data.feedback = this._sanitizeByCurrentStep(data.feedback || "");
      data.next_question = this._sanitizeByCurrentStep(data.next_question || "");

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
    const result = await model.generateContent(`Đưa ra duy nhất 1 câu hỏi gợi ý cho HS lớp 5 ở bước ${this.currentStep} (${this._getStepName(this.currentStep)}) bài toán tỉ số: ${this.currentProblem}. Không giải thích, xưng bạn, KHÔNG nêu cụ thể số.`);
    return this._fixPronouns(result.response.text());
  }
}

const geminiChatServiceTiSoInstance = new GeminiChatServiceTiSo();
export default geminiChatServiceTiSoInstance;