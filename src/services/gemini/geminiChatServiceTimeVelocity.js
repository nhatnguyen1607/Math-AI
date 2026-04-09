import geminiModelManager from "./geminiModelManager";
import { EXAM_CONTEXTS } from '../../constants/examContexts';

export class GeminiChatServiceTimeVelocity {
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
      return `Bạn hãy kiểm tra lại kết quả của phép tính${expression}, có vẻ bạn đang đặt vị trí dấu phẩy chưa chính xác. Bạn thử tính lại từng bước rồi ghi lại kết quả, đồng thời kiểm tra lại đơn vị cho đúng nhé.`;
    }

    return `Bạn hãy kiểm tra lại kết quả của phép tính${expression}, hiện chưa khớp với dữ kiện bài toán. Bạn rà lại từng bước tính và nhớ kiểm tra lại đơn vị trước khi kết luận nhé.`;
  }

  _hasStep1Complete(answer = "", chatHistory = []) {
    // Kiểm tra bước 1: HS nêu được thông tin + yêu cầu
    const recentText = Array.isArray(chatHistory)
      ? chatHistory
          .filter((m) => m?.role === 'user')
          .slice(-6)
          .map((m) => m?.parts?.[0]?.text || '')
          .join(' ')
      : '';
    const fullText = `${recentText} ${String(answer || '')}`.toLowerCase();
    const hasInfo = /\d/.test(fullText);
    const hasRequirement = /(tính|tìm|xác định|cần tìm|cần tính|vận tốc|quãng\s*đường|thời\s*gian)/i.test(fullText);
    return hasInfo && hasRequirement;
  }

  _hasStep2Complete(answer = "", chatHistory = []) {
    // Kiểm tra bước 2: HS nêu sơ bộ cách giải (công thức, qui luật, hay cách dùng thông tin)
    const recentText = Array.isArray(chatHistory)
      ? chatHistory
          .filter((m) => m?.role === 'user')
          .slice(-8)
          .map((m) => m?.parts?.[0]?.text || '')
          .join(' ')
      : '';
    const fullText = `${recentText} ${String(answer || '')}`.toLowerCase();
    // Kiểm tra xem HS có nêu cách giải (sẽ dùng, chia/nhân, công thức, bằng cách, bằng...)
    const hasSolution = /(sẽ|dùng|quy tắc|công thức|bằng cách|bằng|chia|nhân|cộng|trừ|tổng|hiệu|tích|thương)/i.test(fullText);
    return hasSolution;
  }

  _hasExecutionEvidence(answer = "") {
    const text = String(answer || "").toLowerCase();
    // Nếu HS đã bắt đầu tính/ghi biểu thức thì xem như đã có ý tưởng giải.
    return /[=:+\-*/]|vận\s*tốc|quãng\s*đường|thời\s*gian|đáp\s*số|kết\s*luận/i.test(text);
  }

  _isOldStep2Prompt(text = "") {
    return /bạn\s+hãy\s+nêu\s+kế\s*hoạch\s*giải[:：]?\s*bạn\s*sẽ\s*dùng\s*thông\s*tin\s*nào\s+và\s+dùng\s*quy\s*tắc\s*\/\s*công\s*thức\s*nào\s+để\s*giải\??/i.test(String(text || ""));
  }

  _sanitizeByCurrentStep(text = "") {
    let safeText = String(text || "");
    if (this.currentStep !== 2 && this._isOldStep2Prompt(safeText)) {
      if (this.currentStep === 3) {
        safeText = "Bạn hãy trình bày lời giải đầy đủ theo kế hoạch bạn đã nêu, viết rõ từng bước tính rồi kết luận nhé.";
      } else if (this.currentStep === 4) {
        safeText = "Bạn hãy kiểm tra lại lời giải: kết quả có khớp dữ kiện, đơn vị đã đúng và kết luận đã đủ yêu cầu chưa?";
      } else {
        safeText = "Bạn hãy tiếp tục trả lời theo đúng bước hiện tại nhé.";
      }
    }
    return safeText;
  }

  _hasStep3Complete(answer = "") {
    const text = String(answer || "").toLowerCase();
    const equationCount = (text.match(/=/g) || []).length;
    const hasDistance = /quãng\s*đường|tổng\s*quãng\s*đường/.test(text);
    const hasTime = /thời\s*gian|tổng\s*thời\s*gian/.test(text);
    const hasVelocityOrConclusion = /vận\s*tốc|đáp\s*số|kết\s*luận/.test(text);
    const hasStructuredFlow = /bước\s*1|bước\s*2|bước\s*3|trước\s*hết|tiếp\s*theo|sau\s*đó|cuối\s*cùng/.test(text);

    // Bước 3 chỉ đúng khi có đủ tiến trình tính, không chấp nhận chỉ nêu đáp số cuối.
    return (equationCount >= 2 || hasStructuredFlow) && hasDistance && hasTime && hasVelocityOrConclusion;
  }

  _checkVelocityUnit(text) {
    const lower = String(text || "").toLowerCase();
    const velocityTokens = lower.match(/(?:km|m)\s*\/\s*[a-zA-ZÀ-ỹ]+/g) || [];
    if (velocityTokens.length === 0) return { hasError: false };

    const validPattern = /^(km\s*\/\s*(h|giờ|gio)|m\s*\/\s*(s|giây|giay))$/i;
    const hasInvalid = velocityTokens.some((token) => !validPattern.test(token.trim()));
    if (hasInvalid) {
      return {
        hasError: true,
        message: "Đơn vị vận tốc chưa đúng. Bạn dùng một trong các cách: km/h, m/s, km/giờ hoặc m/giây nhé!"
      };
    }

    return { hasError: false };
  }

  // 🆕 Post-processing: tự động fix xưng hô từ "em" → "bạn"
  _fixPronouns(text) {
    return text
      // Fix "em" xưng hô (em, em ơi, em hãy, etc.)
      .replace(/\bem\s+/g, 'bạn ')
      .replace(/\bem,/g, 'bạn,')
      .replace(/\bem\./g, 'bạn.')
      .replace(/\bem!/g, 'bạn!')
      .replace(/\bem\?/g, 'bạn?')
      .replace(/\bem$/gm, 'bạn')
      // Fix "học sinh" → "bạn"
      .replace(/\bHọc sinh\b/g, 'Bạn')
      .replace(/\bhọc sinh\b/g, 'bạn')
      .replace(/\bHọc sinh của mình\b/g, 'Bạn')
      .replace(/\bhọc sinh của mình\b/g, 'bạn')
      // Remove any "em ơi" patterns
      .replace(/\bem\s+ơi/g, 'bạn')
      // Fix variations like "em hãy", "em cần", etc.
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

    return `Bạn là "trợ lý học tập" dẫn dắt HS lớp 5 giải toán theo 4 bước Polya. 
Xưng hô: "mình" - "bạn". TUYỆT ĐỐI CẤMI xưng "em", "học sinh", "học sinh của mình" - PHẢI luôn xưng "bạn" ở MỌI chỗ.

VAI TRÒ CỦA BẠN: BẠN ĐANG ĐÓNG VAI LÀ "${ctx.aiRole}".
- Nhiệm vụ nhập vai: ${ctx.aiRoleDescription}
- Hãy xưng hô thân thiện, nhất quán với vai trò này.
- Trong cuộc trò chuyện, hãy nhắc đến các nhân vật Mai, Việt, Nam trong bối cảnh bài toán để tạo sự gần gũi.

⚠️ KIỂM TRA ĐƠN VỊ VẬN TỐC:
- Chỉ có 2 đơn vị vận tốc hợp lệ: km/h và m/s
- Nếu HS sử dụng đơn vị khác hoặc dùng sai → PHẢI nhắc nhở kiểm tra lại đơn vị
- VD: HS viết "km/ph" hoặc "m/p" → feedback: "Bạn kiểm tra lại đơn vị vận tốc nhé, chỉ có km/h hoặc m/s thôi"

QUY TẮC PHẢN HỒI GỢI MỞ (SIÊU SÚC TÍCH):
- Khi HS nói "không biết", "không hiểu" hoặc bế tắc:
  + Bước 1: Khích lệ tinh thần bạn ấy một câu ngắn gọn (KHÔNG gợi ý phép tính, KHÔNG gợi ý công thức).
  + Bước 2: Đặt DUY NHẤT 1 câu hỏi CƠ BẢN RẤT ĐƠN GIẢN, KHÔNG gợi ý thẳng vào công thức hoặc phép tính cụ thể.
  + TUYỆT ĐỐI CẤM: 
    * Xưng "em", "học sinh", "học sinh của mình"
    * Liệt kê danh sách câu hỏi
    * Đưa ra luồng suy luận dài dòng
    * Giải hộ
    * Hỏi về phép tính hay công thức (VD: "sẽ dùng phép tính gì", "thực hiện phép tính nào")
    * Gợi ý từ trừu tượng (VD: "bao nhiêu phần", "tổng thể", "mối quan hệ")
- Kiểm soát đa câu hỏi: HS phải giải xong toàn bộ ý (a, b...) mới được kết thúc bài.

CHI TIẾT PHẢN HỒI THEO BƯỚC:
1. 🔴 HIỂU BÀI (Bước 1 - NÊU THÔNG TIN VÀ YÊU CẦU):
   - Nếu HS bế tắc → hỏi "Bạn xem bài toán cho những thông tin nào? Và bạn cần tìm/tính cái gì?"
   - HS CÓ THỂ nêu riêng lẻ (nêu thông tin trước rồi yêu cầu sau) hoặc nêu nhiều lần
   - AI phải GÓP các câu trả lời lại cho đến khi đủ cả thông tin + yêu cầu
   - KHÔNG được hỏi về phép tính, công thức, hay mối quan hệ
   
2. 🟡 LẬP KẾ HOẠCH (Bước 2 - NÊU SƠ BỘ CÁCH GIẢI):
   - ⚠️ KHÔNG hỏi lại "bài toán có những con số nào" hay "bài toán cho những thông tin gì" - đó là câu hỏi bước 1 rồi!
   - Nếu HS không biết → hỏi "Bạn sẽ giải bài này như thế nào? Bạn dùng cách gì/quy tắc gì để tìm đáp án?"
   - HS nêu sơ bộ: ví dụ "sẽ tính vận tốc bằng quãng đường chia cho thời gian" (KHÔNG nêu cụ thể con số)
  - CHỈ hỏi kế hoạch giải, CHƯA bắt HS tính toán hay cho đáp số
   
3. 🟢 THỰC HIỆN (Bước 3 - TÍNH TOÁN):
  - Nếu HS không biết tính → đưa GỢI Ý CÓ CẤU TRÚC (không nêu số cụ thể), ví dụ: nêu công thức/qui tắc, thay dữ kiện từ đề, tính ra kết quả, rồi kết luận có đơn vị.
   - KHÔNG được nêu cụ thể các con số, KHÔNG được nêu chi tiết phép tính
  - Để HS tự thực hiện và trình bày đầy đủ theo kế hoạch đã nêu
   
4. 🔵 KIỂM TRA (Bước 4 - MỞ RỘNG):
   - Nếu HS nêu hợp lý (kết quả có đơn vị đúng, dấu hiệu logic) → MOVE_NEXT luôn
   - Không chỉ hỏi "có/không", phải giúp HS trả lời ngắn, giải thích
   - Đề xuất hỏi liên quan tới thay đổi số liệu: "Nếu thay đổi số liệu này thành ... thì kết quả sẽ như nào?"
   - ⚠️ TUYỆT ĐỐI CẤM hỏi tính lại quãng đường hoặc các phép toán phức tạp khác để kiểm tra

⚠️ LƯU Ý TUYỆT ĐỐI:
- KHÔNG ĐƯỢC xưng "em" bất kỳ ở đâu, ĐỔI THÀNH "bạn" ở mọi nơi
- KHÔNG được hỏi về phép tính hay công thức ở bước 1 (Hiểu bài)
- Gợi ý phải CỰC KỲ CƠ BẢN, tránh đề cập tới công thức hay phép tính cụ thể
- Ở bước 1, hỏi thông tin + yêu cầu (cần tìm gì)
- Ở bước 2, CHỈ hỏi sơ bộ cách giải (sẽ dùng công thức/qui luật gì), TUYỆT ĐỐI KHÔNG hỏi lại con số hay thông tin bài toán (đó là bước 1)
- Ở bước 3, để HS tính toán. TUYỆT ĐỐI KHÔNG ĐƯỢC hỏi các câu hỏi của bước 1 hay bước 2 (như "đề bài cho biết gì?", "bạn cần tìm gì?", "bạn sẽ giải bài này thế nào?"). CHỈ nhận xét lỗi tính toán và yêu cầu tính tiếp.

LUÔN TRẢ VỀ JSON:
{
  "reasoning_process": "Tự duy luận: 1. Đang ở bước mấy? 2. Học sinh đúng hay sai? 3. Ở bước này được hỏi gì và BỊ CẤM hỏi gì (ví dụ đang ở bước 3 thì cấm hỏi lại thông tin của bước 1, bước 2)? 4. Quyết định câu trả lời.",
  "status": "CORRECT" hoặc "WRONG",
  "step_status": "STAY" hoặc "MOVE_NEXT",
  "feedback": "Lời khích lệ hoặc nhận xét kết quả, xưng 'bạn', không xưng 'em'.",
  "next_question": "DUY NHẤT 1 câu hỏi CƠ BẢN gợi mở để HS tự làm bước tiếp theo. TUYỆT ĐỐI KHÔNG lồng ghép câu hỏi của bước cũ."
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

    const msg = `Chào bạn! Mình là ${ctx.aiRole}. Chúng ta cùng giải bài toán này nhé!\n\nBài toán: ${problemText}\n\nTrước tiên, bạn hãy cho mình biết bài toán đã cho những thông tin gì? Và bạn cần tìm/tính cái gì?`;
    return { message: msg, step: 1, stepName: this._getStepName(1) };
  }

  async processStudentResponse(studentAnswer, chatHistory = []) {
    
    if (this.isSessionComplete) return { message: "Bạn đã hoàn thành bài toán này rồi!" };

    // 🆕 Kiểm tra đơn vị vận tốc
    const unitCheck = this._checkVelocityUnit(studentAnswer);
    if (unitCheck.hasError) {
      return {
        message: this.currentStep === 3
          ? "Bạn hãy xem lại đơn vị của bài toán cho chính xác nhé. Ở đây bạn cần dùng đúng đơn vị vận tốc phù hợp như km/h hoặc m/s."
          : unitCheck.message,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: 'wrong'
      };
    }

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

    // 🆕 Kiểm tra xem HS có nói "không biết" hay không
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
          message: this._fixPronouns("Bạn làm tốt rồi! Ở bước này bạn chỉ cần nêu kế hoạch giải: bạn sẽ dùng thông tin nào và dùng quy tắc/công thức nào, chưa cần tính ra kết quả."),
          step: 2,
          stepName: this._getStepName(2),
          robotStatus: 'thinking',
          isSessionComplete: false
        };
      }

      if (this.currentStep === 3) {
        return {
          message: this._fixPronouns("Không sao nhé! Gợi ý cho bạn ở bước này: (1) nhắc lại quy tắc/công thức bạn đã chọn, (2) thay các dữ kiện từ đề vào, (3) tính ra kết quả, (4) viết kết luận có đơn vị phù hợp. Bạn thử làm theo 4 ý này nhé."),
          step: 3,
          stepName: this._getStepName(3),
          robotStatus: 'thinking',
          isSessionComplete: false
        };
      }

      return {
        message: this._fixPronouns("Không sao đâu nhé! Ở bước kiểm tra, bạn làm theo 3 ý này: (1) đối chiếu lại kết quả với dữ kiện đề bài, (2) kiểm tra đơn vị vận tốc đã đúng chưa, (3) kết luận đã trả lời đủ yêu cầu chưa. Bạn thử trả lời lại theo 3 ý này nhé."),
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: 'thinking',
        isSessionComplete: false
      };
    }

    const fullPrompt = `
ĐỀ BÀI: ${this.currentProblem}
BƯỚC HIỆN TẠI: ${this.currentStep} (Tên: ${this._getStepName(this.currentStep)})
LỊCH SỬ CHAT: ${JSON.stringify(chatHistory.slice(-10))}
HS VỪA NHẬP: "${studentAnswer}"
HS CÓ NÓI KHÔNG BIẾT?: ${isHelpless}

⚠️ QUY TẮC CẤM CÓ:
1. TUYỆT ĐỐI KO XỮ "em" - phải xưng "bạn" ở mọi nơi
2. TẠI BƯỚC 1 (Hiểu bài): KHÔNG hỏi phép tính, KHÔNG hỏi công thức, CHỈ hỏi về thông tin và số liệu
3. KHÔNG gợi ý từ trừu tượng ("bao nhiêu phần", "tổng thể", "mối quan hệ")
4. Gợi ý phải CỰC KỲ CƠ BẢN, KHÔNG nêu công thức hay phép tính
5. 🚫 TUYỆT ĐỐI CẤM nêu cụ thể các con số trong câu hỏi gợi ý - để HS tự tìm từ bài toán
6. ⚠️ NẾU HS nhập số có dấu chấm (0.7, 1.5), hãy nhắc nhở HS rằng ở Việt Nam ta dùng dấu phẩy (0,7, 1,5). Gợi ý format đúng cho HS.

YÊU CẦU:
1. 🚫 TUYỆT ĐỐI CẤM gợi ý về phép tính hay công thức, KHÔNG nêu tên phép tính cả
2. 🚫 TUYỆT ĐỐI CẤM nêu cụ thể các con số trong câu hỏi - để HS tự tìm từ bài toán
3. NẾU HS NÓI "KHÔNG BIẾT" HOẶC YÊU CẦU GIẢI: TUYỆT ĐỐI KHÔNG QUAY LẠI hỏi câu hỏi thông tin của Bước 1 nếu đang ở Bước 2, Bước 3, hoặc Bước 4. Thay vào đó, hãy CHIA NHỎ vấn đề hiện tại thành một câu hỏi gợi mở siêu dễ liên quan MẬT THIẾT đến con số hoặc bước tính mà HS đang kẹt.
4. Ở BƯỚC 1: Chỉ hỏi thông tin, KHÔNG hỏi phép tính
5. ⚠️ Ở BƯỚC 2: TUYỆT ĐỐI KHÔNG hỏi "bài toán cho những con số nào" hay "bài toán có những thông tin gì" - đó là bước 1. Bước 2 CHỈ hỏi kế hoạch giải.
6. Kiểm tra xem HS đã trả lời đủ hết các ý của đề không (nếu đề có a, b, c phải làm hết)
6. ⭐ BƯỚC 4 (Kiểm tra):
   - Nếu HS nêu hợp lý (có phần giải thích, đơn vị đúng) → MOVE_NEXT
   - Không chỉ hỏi "có/không", phải hỏi thêm về thay đổi số liệu: "Nếu thay đổi số liệu X thành Y thì kết quả sẽ như nào?"
   - ⚠️ TUYỆT ĐỐI CẤM hỏi tính lại quãng đường hay những phép tính phức tạp khác để kiểm tra
   - Giúp HS giải thích ngắn gọn
7. ⚠️ KIỂM TRA HOÀN THÀNH CÁC BƯỚC:
   - Bước 1 PHẢI hoàn thành: HS nêu được thông tin + yêu cầu
   - Bước 2 PHẢI hoàn thành: HS nêu được sơ bộ cách giải (công thức/qui luật)
   - Chỉ MOVE_NEXT khi HS làm đúng và đủ hết toàn bộ yêu cầu của mỗi bước
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



      // ===== BƯỚC 2: XỬ LÝ KẾ HOẠCH =====
      if (this.currentStep === 2) {
        const originalStep2Status = data.step_status;

        // ✅ MOVE_NEXT: HS đã nêu kế hoạch xong → chuyển sang bước 3
        if (originalStep2Status === "MOVE_NEXT") {
          data.next_question = "Tuyệt vời! Bây giờ bạn hãy bắt đầu giải bài theo kế hoạch nhé! Trình bày lời giải đầy đủ, viết rõ từng bước rồi kết luận nhé.";
        }
      }



      data.feedback = this._sanitizeByCurrentStep(data.feedback || "");
      data.next_question = this._sanitizeByCurrentStep(data.next_question || "");

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
    return this._fixPronouns(result.response.text());
  }
}

const geminiChatServiceTimeVelocityInstance = new GeminiChatServiceTimeVelocity();
export default geminiChatServiceTimeVelocityInstance;