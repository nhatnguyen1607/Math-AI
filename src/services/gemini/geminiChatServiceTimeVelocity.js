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
      return {
        isValid: false,
        message: "Mình thấy phép tính của bạn chưa khớp kết quả sau dấu '='. Bạn kiểm tra lại từng bước tính nhé!"
      };
    }
    return { isValid: true };
  }

  _hasStep1DataAndRequirement(answer = "") {
    const text = String(answer || "").toLowerCase();
    const hasData = /\d/.test(text);
    const hasRequirement = /(yêu cầu|cần\s*tìm|hỏi|tính|tìm\s*(vận tốc|quãng\s*đường|thời\s*gian)|bao\s*nhiêu)/i.test(text);
    return hasData && hasRequirement;
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
1. 🔴 HIỂU BÀI (Bước 1 - CỰC KỲ ĐƠN GIẢN):
   - Nếu HS bế tắc → hỏi "Bạn xem bài toán cho những con số nào?"
   - KHÔNG được hỏi về phép tính, công thức, hay mối quan hệ
   - KHÔNG được hỏi "bạn cần tìm cái gì" (đó là yêu cầu của bài)
   
2. 🟡 LẬP KẾ HOẠCH (Bước 2 - GỢI Ý CƠ BẢN):
   - Nếu HS không biết → hỏi "Bạn cần tìm cái gì trong bài toán này?"
   - KHÔNG được nói tên phép tính hay công thức
   
3. 🟢 THỰC HIỆN (Bước 3 - CHỈ NÊU SỐ):
   - Nếu HS không biết tính → hỏi "Bạn hãy lấy [số 1] và [số 2] để tính nhé"
   - KHÔNG được nêu phép tính (chia/nhân/cộng), chỉ nêu số liệu
   
4. 🔵 KIỂM TRA (Bước 4 - MỞ RỘNG):
   - Nếu HS nêu hợp lý (kết quả có đơn vị đúng, dấu hiệu logic) → MOVE_NEXT luôn
   - Không chỉ hỏi "có/không", phải giúp HS trả lời ngắn, giải thích
   - Đề xuất: "Nếu thay đổi thời gian thì quãng đường sẽ thế nào?", "Bạn có cách nào kiểm tra lại kết quả không?"

⚠️ LƯU Ý TUYỆT ĐỐI:
- KHÔNG ĐƯỢC xưng "em" bất kỳ ở đâu, ĐỔI THÀNH "bạn" ở mọi nơi
- KHÔNG được hỏi về phép tính hay công thức ở bước 1 (Hiểu bài)
- Gợi ý phải CỰC KỲ CƠ BẢN, tránh đề cập tới công thức hay phép tính cụ thể
- Ở bước 1, chỉ hỏi dữ kiện, KHÔNG hỏi phép tính

LUÔN TRẢ VỀ JSON:
{
  "analysis": "Phân tích ngắn gọn bế tắc của HS",
  "status": "CORRECT" hoặc "WRONG",
  "step_status": "STAY" hoặc "MOVE_NEXT",
  "feedback": "Lời khích lệ ngắn (1 câu), xưng 'bạn', không xưng 'em'.",
  "next_question": "DUY NHẤT 1 câu hỏi CƠ BẢN gợi mở để HS tự làm bước tiếp theo, xưng 'bạn', không xưng 'em', không hỏi phép tính."
}`;
  }

  async startNewProblem(problemText, isApplicationProblem = false, examContextId = '') {
    console.log('🚀 [GeminiChatServiceTimeVelocity] startNewProblem() called');
    console.log('📋 Problem text:', problemText?.substring(0, 100) + '...');
    
    this.currentProblem = problemText;
    this.currentStep = 1;
    this.isSessionComplete = false;
    if (examContextId) {
      this.currentContextId = examContextId;
    }

    const ctx = this._getContext();

    const msg = `Chào bạn! Mình là ${ctx.aiRole}. Chúng ta cùng giải bài toán này nhé!\n\nBài toán: ${problemText}\n\nTrước tiên, bạn hãy cho mình biết bài toán đã cho những thông tin gì?`;
    console.log('✅ [GeminiChatServiceTimeVelocity] Step 1 initialized');
    return { message: msg, step: 1, stepName: this._getStepName(1) };
  }

  async processStudentResponse(studentAnswer, chatHistory = []) {
    console.log('💬 [GeminiChatServiceTimeVelocity] processStudentResponse() called');
    console.log('📝 Student answered:', studentAnswer);
    console.log('🔢 Current step:', this.currentStep, '(' + this._getStepName(this.currentStep) + ')');
    
    if (this.isSessionComplete) return { message: "Bạn đã hoàn thành bài toán này rồi!" };

    // 🆕 Kiểm tra đơn vị vận tốc
    const unitCheck = this._checkVelocityUnit(studentAnswer);
    if (unitCheck.hasError) {
      return {
        message: unitCheck.message,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: 'wrong'
      };
    }

    const computationCheck = this._validateStudentComputation(studentAnswer);
    if (!computationCheck.isValid) {
      return {
        message: computationCheck.message,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: 'wrong',
        isSessionComplete: false
      };
    }

    // 🆕 Kiểm tra xem HS có nói "không biết" hay không
    const isHelpless = /không\s*(biết|hiểu|làm|có ý tưởng)|chẳng\s*(biết|hiểu)/i.test(studentAnswer);
    console.log('🆘 Is student helpless?', isHelpless, 'Current step:', this.currentStep);

    // 🆕 HARD-CODE FALLBACK CHO BƯỚC 1 KHI HS BẾ TẮC
    if (isHelpless && this.currentStep === 1) {
      console.log('⚡ [HARD-CODE] Bước 1 + HS bế tắc → Return hard-coded Step 1 gợi ý');
      return {
        message: this._fixPronouns(`Đừng lo nhé! Bài toán cho chúng mình biết có những dữ kiện gì? Bạn hãy nêu ra các con số và thông tin mà đề bài cho biết nhé!`),
        step: 1,
        stepName: this._getStepName(1),
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
2. TẠI BƯỚC 1 (Hiểu bài): KHÔNG hỏi phép tính, KHÔNG hỏi công thức, CHỈ hỏi về dữ kiện
3. KHÔNG gợi ý từ trừu tượng ("bao nhiêu phần", "tổng thể", "mối quan hệ")
4. Gợi ý phải CỰC KỲ CƠ BẢN, KHÔNG nêu công thức hay phép tính
5. ⚠️ NẾU HS nhập số có dấu chấm (0.7, 1.5), hãy nhắc nhở HS rằng ở Việt Nam ta dùng dấu phẩy (0,7, 1,5). Gợi ý format đúng cho HS.

YÊU CẦU:
1. 🚫 TUYỆT ĐỐI CẤM gợi ý về phép tính hay công thức, KHÔNG nêu tên phép tính cả
2. Nếu HS nói "không biết": Khích lệ 1 câu, sau đó hỏi 1 câu hỏi CỰC KỲ CƠ BẢN (KHÔNG gợi ý thẳng)
3. Ở BƯỚC 1: Chỉ hỏi dữ kiện, KHÔNG hỏi phép tính
4. Kiểm tra xem HS đã trả lời đủ hết các ý của đề không (nếu đề có a, b, c phải làm hết)
5. ⭐ BƯỚC 4 (Kiểm tra): 
   - Nếu HS nêu hợp lý (có phần giải thích, đơn vị đúng) → MOVE_NEXT
   - Không chỉ hỏi "có/không", phải hỏi thêm: "Nếu thay đổi ... thì ... sao?"
   - Giúp HS giải thích ngắn gọn
6. Chỉ MOVE_NEXT khi HS làm đúng và đủ hết toàn bộ yêu cầu của đề
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

      // 🆕 POST-PROCESSING: Nếu AI vẫn hỏi phép tính ở bước 1 thì ép fix
      if (this.currentStep === 1 && /phép\s*tính|tính\s*toán|chia|nhân|cộng|trừ/i.test(data.next_question)) {
        console.log('⚠️ [POST-FIX] AI vẫn hỏi phép tính ở bước 1 → Force fix');
        data.step_status = "STAY";
        data.next_question = "Vậy bạn có thể nêu ra các con số mà đề bài cho biết không?";
      }

      // 🆕 POST-FIX: Chặn AI hỏi quá rõ ràng ở Bước 3
      if (this.currentStep === 3 && /phép\s*tính|giá\s*trị\s*số|tính\s*toán|chia|nhân|cộng|trừ/i.test(data.next_question)) {
        console.log('⚠️ [POST-FIX] AI vẫn hỏi phép tính ở bước 3 → Generalize');
        data.next_question = "Kết quả là bao nhiêu?";
      }

      if (this.currentStep === 1 && data.step_status === "MOVE_NEXT" && !this._hasStep1DataAndRequirement(studentAnswer)) {
        data.step_status = "STAY";
        data.status = "WRONG";
        data.feedback = "Bạn đã nêu được dữ kiện rồi, rất tốt.";
        data.next_question = "Bây giờ bạn nói thêm yêu cầu của bài toán là cần tìm gì nhé?";
      }

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