import geminiModelManager from "./geminiModelManager";
import { EXAM_CONTEXTS } from '../../constants/examContexts';

export class GeminiChatServiceTimeVelocity {
  constructor() {
    this.currentProblem = "";
    this.currentStep = 1;
    this.isSessionComplete = false;
    this.currentContextId = EXAM_CONTEXTS[0]?.id || '';
    this.wrongAttemptCount = 0; // 🆕 Đếm số lần trả lời sai/không biết liên tiếp tại mỗi bước
    this.step4ChangedData = null; // Lưu dữ kiện gốc để kiểm tra ngược ở bước 4
    this.step4Phase = "reverse_check"; // reverse_check -> extension_check
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
      .replace(/\b(chia\s*cho|chia)\b/gi, "/")
      .replace(/\b(nhân\s*với|nhan\s*voi|nhân|nhan)\b/gi, "*")
      .replace(/\b(cộng\s*với|cong\s*voi|cộng|cong)\b/gi, "+")
      .replace(/\b(trừ\s*đi|tru\s*di|trừ|tru)\b/gi, "-")
      .replace(/\b(bằng|bang)\b/gi, "=")
      .replace(/[xX×]/g, "*")
      .replace(/÷/g, "/")
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
    const rawExpression = String(check?.expression || "");
    const prettyExpression = rawExpression
      .replace(/\*/g, " × ")
      .replace(/\//g, " : ")
      .replace(/\./g, ",")
      .replace(/\s+/g, " ")
      .trim();

    const actualDisplay = Number.isFinite(check?.actual)
      ? String(check.actual).replace(/\./g, ",")
      : "";

    if (check?.issueType === "decimal") {
      if (prettyExpression && actualDisplay) {
        return `Bạn đang tính ${prettyExpression} và ghi kết quả là ${actualDisplay}, nhưng kết quả này chưa đúng vì đang sai ở vị trí dấu phẩy. Bạn thử đặt lại dấu phẩy cẩn thận rồi tính lại nhé.`;
      }
      return "Kết quả tính chưa đúng do vị trí dấu phẩy chưa chính xác. Bạn thử đặt lại dấu phẩy cẩn thận rồi tính lại nhé.";
    }

    if (prettyExpression && actualDisplay) {
      return `Bạn đang tính ${prettyExpression} và ghi kết quả là ${actualDisplay}, nhưng kết quả tính chưa đúng. Bạn rà lại từng bước tính rồi ghi lại kết quả kèm đơn vị nhé.`;
    }

    return "Kết quả tính chưa đúng. Bạn rà lại từng bước tính rồi ghi lại kết quả kèm đơn vị nhé.";
  }

  _hasStep2UnitConversionMention(answer = "", chatHistory = []) {
    const recentUserText = Array.isArray(chatHistory)
      ? chatHistory
          .filter((m) => m?.role === "user")
          .slice(-6)
          .map((m) => m?.parts?.[0]?.text || "")
          .join(" ")
      : "";

    const fullText = `${recentUserText} ${String(answer || "")}`.toLowerCase();

    const hasConversionKeywords =
      /(đổi|quy\s*đổi|đưa\s*về\s*cùng\s*đơn\s*vị|cùng\s*đơn\s*vị|đổi\s*ra|chuyển)\s*(đơn\s*vị)?/i.test(
        fullText,
      );

    const hasUnitTransformHint =
      /(km|m)\s*(?:sang|ra|->|→)\s*(km|m)|(giờ|phút|giây)\s*(?:sang|ra|->|→)\s*(giờ|phút|giây)|phút\s*\/\s*60|giây\s*\/\s*60|giây\s*\/\s*3600|nhân\s*60|chia\s*60/i.test(
        fullText,
      );

    return hasConversionKeywords || hasUnitTransformHint;
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

  _needsUnitConversion(problemText = "") {
    const text = String(problemText || "").toLowerCase();
    if (!text) return false;

    const hasExplicitConversion =
      /đổi\s*đơn\s*vị|quy\s*đổi|đưa\s*về\s*cùng\s*đơn\s*vị|cùng\s*đơn\s*vị|khác\s*đơn\s*vị|không\s*cùng\s*đơn\s*vị|đổi\s*ra/i.test(
        text,
      );

    const hasMixedDistanceUnits = /\d+\s*km\b/i.test(text) && /\d+\s*m\b/i.test(text);
    const hasMixedTimeUnits =
      (/\d+\s*giờ\b/i.test(text) && /\d+\s*phút\b/i.test(text)) ||
      (/\d+\s*phút\b/i.test(text) && /\d+\s*giây\b/i.test(text));
    const hasKmPerHourWithMinute =
      /km\s*\/\s*(h|giờ)/i.test(text) && /\d+\s*phút\b/i.test(text);
    const hasMeterPerSecondWithHourOrMinute =
      /m\s*\/\s*(s|giây)/i.test(text) && /(\d+\s*giờ\b|\d+\s*phút\b)/i.test(text);

    return (
      hasExplicitConversion ||
      hasMixedDistanceUnits ||
      hasMixedTimeUnits ||
      hasKmPerHourWithMinute ||
      hasMeterPerSecondWithHourOrMinute
    );
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

  _normalizeForCompare(text = "") {
    return String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  _dedupeConsecutiveSentences(text = "") {
    const parts = String(text || "").match(/[^.!?]+[.!?]?/g) || [];
    const deduped = [];
    let prevNorm = "";

    for (const part of parts) {
      const cleaned = part.replace(/\s+/g, " ").trim();
      if (!cleaned) continue;
      const norm = this._normalizeForCompare(cleaned);
      if (!norm || norm === prevNorm) continue;
      deduped.push(cleaned);
      prevNorm = norm;
    }

    return deduped.join(" ").trim();
  }

  _mergeFeedbackAndQuestion(feedback = "", nextQuestion = "") {
    const fb = String(feedback || "").trim();
    const nq = String(nextQuestion || "").trim();

    if (!fb && !nq) return "";
    if (!nq) return this._dedupeConsecutiveSentences(fb);
    if (!fb) return this._dedupeConsecutiveSentences(nq);

    const fbNorm = this._normalizeForCompare(fb);
    const nqNorm = this._normalizeForCompare(nq);
    const merged = fbNorm.includes(nqNorm) ? fb : `${fb} ${nq}`;
    return this._dedupeConsecutiveSentences(merged);
  }

  _getRecentUserText(chatHistory = [], limit = 6) {
    return Array.isArray(chatHistory)
      ? chatHistory
          .filter((m) => m?.role === "user")
          .slice(-limit)
          .map((m) => m?.parts?.[0]?.text || "")
          .join(" ")
          .toLowerCase()
      : "";
  }

  _hasStep4ReverseCheckEvidence(answer = "", chatHistory = []) {
    const text = `${this._getRecentUserText(chatHistory)} ${String(answer || "")}`.toLowerCase();
    const hasComputation = /\d/.test(text) && (/[=:+\-*/]/.test(text) || /chia|nhân|tính/.test(text));
    const hasReverseHint =
      /(kiểm\s*tra|thử\s*lại|đối\s*chiếu|thế\s*ngược|làm\s*ngược|khớp|ra\s*đúng)/.test(text) ||
      /(vận\s*tốc\s*.*\s*thời\s*gian|thời\s*gian\s*.*\s*vận\s*tốc|quãng\s*đường)/.test(text);

    return hasComputation && hasReverseHint;
  }

  _hasStep4ExtensionEvidence(answer = "", chatHistory = []) {
    const text = `${this._getRecentUserText(chatHistory)} ${String(answer || "")}`.toLowerCase();
    const hasChangedData =
      /(nếu|giả\s*sử|thay\s*đổi|đổi\s*dữ\s*kiện|mới|tăng|giảm|thêm|bớt)/.test(text);
    const hasComputation = /\d/.test(text) && (/[=:+\-*/]/.test(text) || /chia|nhân|tính/.test(text));
    const hasRelation =
      /(mối\s*liên\s*hệ|so\s*với|cao\s*hơn|thấp\s*hơn|lớn\s*hơn|nhỏ\s*hơn|tăng|giảm|nhanh\s*hơn|chậm\s*hơn)/.test(
        text,
      );

    return hasChangedData && hasComputation && hasRelation;
  }

  _enforceStep4CompletionGate(data = {}, studentAnswer = "", chatHistory = []) {
    if (this.currentStep !== 4) return data;

    const normalized = {
      ...data,
      status: data?.status === "CORRECT" ? "CORRECT" : "WRONG",
      step_status: data?.step_status === "MOVE_NEXT" ? "MOVE_NEXT" : "STAY",
      feedback: String(data?.feedback || ""),
      next_question: String(data?.next_question || ""),
    };

    if (this.step4Phase === "reverse_check") {
      if (normalized.status !== "CORRECT") {
        const level = this.wrongAttemptCount <= 1 ? 1 : this.wrongAttemptCount === 2 ? 2 : 3;
        if (level === 1) {
          return {
            ...normalized,
            status: "WRONG",
            step_status: "STAY",
            feedback:
              normalized.feedback || "Bạn đang làm khá tốt rồi, chỉ cần kiểm tra ngược lại cho chắc chắn nữa thôi nhé.",
            next_question:
              normalized.next_question ||
              "Bạn thử nhân vận tốc với thời gian để xem có ra đúng quãng đường ban đầu không nhé?",
          };
        }

        if (level === 2) {
          return {
            ...normalized,
            status: "WRONG",
            step_status: "STAY",
            feedback:
              normalized.feedback || "Bạn còn thiếu ý kiểm tra ngược. Cần có phép tính ngược và bước đối chiếu với dữ kiện ban đầu.",
            next_question:
              normalized.next_question ||
              "Bạn viết rõ 2 ý: (1) nhân vận tốc với thời gian, (2) so sánh kết quả với quãng đường ban đầu nhé?",
          };
        }

        return {
          ...normalized,
          status: "WRONG",
          step_status: "STAY",
          feedback:
            normalized.feedback ||
            "Mình gợi ý cụ thể nhé: bạn viết phép tính ngược, tính kết quả, rồi đối chiếu với dữ kiện quãng đường ban đầu.",
          next_question:
            normalized.next_question ||
            "Bạn làm theo 3 bước: (1) nhân vận tốc với thời gian, (2) tính kết quả, (3) kết luận có khớp quãng đường ban đầu hay không nhé?",
        };
      }

      this.step4Phase = "extension_check";
      return {
        ...normalized,
        status: "CORRECT",
        step_status: "STAY",
        feedback:
          "Bạn đã làm đúng bước kiểm tra rồi. Mình chuyển sang bước mở rộng nhé.",
        next_question:
          "Bước mở rộng: mình đổi sẵn 1 dữ kiện trong đề cho bạn. Bạn hãy dùng dữ kiện mới đó để tính vận tốc mới, rồi nêu mối liên hệ với kết quả ban đầu nhé?",
      };
    }

    if (normalized.status !== "CORRECT") {
      const level = this.wrongAttemptCount <= 1 ? 1 : this.wrongAttemptCount === 2 ? 2 : 3;
      if (level === 1) {
        return {
          ...normalized,
          status: "WRONG",
          step_status: "STAY",
          feedback:
            normalized.feedback || "Bạn thử làm thêm bước mở rộng nữa là ổn nhé.",
          next_question:
            normalized.next_question ||
            "Bạn hãy dùng dữ kiện mới mình đã nêu để tính vận tốc mới và so sánh với kết quả ban đầu nhé?",
        };
      }

      if (level === 2) {
        return {
          ...normalized,
          status: "WRONG",
          step_status: "STAY",
          feedback:
            normalized.feedback || "Bạn còn thiếu ý ở bước mở rộng: cần nêu dữ kiện mới và nhận xét mối liên hệ.",
          next_question:
            normalized.next_question ||
            "Bạn viết đủ 3 ý: nêu dữ kiện mới mình đã đổi, vận tốc mới là bao nhiêu, nhanh/chậm hơn thế nào nhé?",
        };
      }

      return {
        ...normalized,
        status: "WRONG",
        step_status: "STAY",
        feedback:
          normalized.feedback ||
          "Bạn chưa hoàn thành đủ bước mở rộng. Mình gợi ý: dùng dữ kiện mới mình đã nêu, tính vận tốc mới, rồi so sánh với kết quả cũ.",
        next_question:
          normalized.next_question ||
          "Bạn làm theo 3 bước: nêu dữ kiện mới, tính vận tốc mới, nêu nhanh/chậm hơn hoặc tăng/giảm so với ban đầu nhé?",
      };
    }

    return {
      ...normalized,
      status: "CORRECT",
      step_status: "MOVE_NEXT",
    };
  }

  restoreSession(problemText, chatHistory, examContextId = '') {
    this.currentProblem = problemText;
    this.wrongAttemptCount = 0; // Reset khi restore
    this.step4ChangedData = null;
    this.step4Phase = "reverse_check";
    this.isSessionComplete = false;
    if (examContextId) {
      this.currentContextId = examContextId;
    }
    const model = geminiModelManager.getModel();
    if (model && chatHistory && chatHistory.length > 0) {
      let fixedHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
      if (fixedHistory.length > 0 && fixedHistory[0].role !== 'user') {
        fixedHistory.unshift({ role: 'user', parts: [{ text: problemText }] });
      }
      const fullText = fixedHistory.map((m) => m?.parts?.[0]?.text || '').join(' ').toLowerCase();
      const recentAssistantText = fixedHistory
        .filter((m) => m?.role === 'model' || m?.role === 'assistant')
        .slice(-4)
        .map((m) => m?.parts?.[0]?.text || '')
        .join(' ')
        .toLowerCase();

      const lastAssistantText = [...fixedHistory]
        .reverse()
        .find((m) => m?.role === 'model' || m?.role === 'assistant')
        ?.parts?.[0]?.text || '';
      const lastAssistantNormalized = String(lastAssistantText || '').toLowerCase();

      const hasCompletionSignal =
        /đã hoàn thành bài toán|bạn đã hoàn thành bài toán|hãy nộp bài luyện tập này|nhấn nút 'nộp bài'|nhấn nút "nộp bài"/i.test(
          recentAssistantText,
        );
      const hasStep4Signal =
        /phép\s*tính\s*ngược|kiểm\s*tra\s*ngược|bước\s*4|bước\s*kiểm\s*tra|bước\s*mở\s*rộng|vận\s*tốc\s*mới/i.test(
          recentAssistantText,
        );

      const hasReverseEvidenceInHistory = this._hasStep4ReverseCheckEvidence("", fixedHistory);
      const hasExtensionEvidenceInHistory = this._hasStep4ExtensionEvidence("", fixedHistory);

      if (hasCompletionSignal && hasReverseEvidenceInHistory && hasExtensionEvidenceInHistory) {
        this.currentStep = 4;
        this.step4Phase = "extension_check";
        this.isSessionComplete = true;
        return;
      }

      if (hasStep4Signal || /bước\s*4|bước\s*kiểm\s*tra|bước\s*mở\s*rộng|kiểm\s*tra\s*ngược|phép\s*tính\s*ngược/i.test(lastAssistantNormalized)) {
        this.currentStep = 4;
      } else if (/bước\s*3|thực\s*hiện|trình\s*bày\s*lời\s*giải|tính\s*toán/i.test(lastAssistantNormalized)) {
        this.currentStep = 3;
      } else if (/bước\s*2|lập\s*kế\s*hoạch|bạn\s*sẽ\s*giải\s*bài\s*này\s*như\s*thế\s*nào/i.test(lastAssistantNormalized)) {
        this.currentStep = 2;
      } else {
        this.currentStep = 1;
      }

      if (
        this.currentStep === 4 &&
        /mở rộng|thay\s*đổi\s*(số\s*liệu|dữ\s*kiện)|vận\s*tốc\s*mới/i.test(fullText)
      ) {
        this.step4Phase = "extension_check";
      } else if (this.currentStep === 4) {
        this.step4Phase = "reverse_check";
      }
    }
  }

  _buildSystemPrompt() {
    const ctx = this._getContext();

    return `Bạn là "trợ lý học tập" dẫn dắt HS lớp 5 giải toán theo 4 bước Polya. 
Xưng hô: "mình" - "bạn". TUYỆT ĐỐI CẤM xưng "em", "học sinh", "học sinh của mình" - PHẢI luôn xưng "bạn" ở MỌI chỗ.

VAI TRÒ CỦA BẠN: BẠN ĐANG ĐÓNG VAI LÀ "${ctx.aiRole}".
- Nhiệm vụ nhập vai: ${ctx.aiRoleDescription}
- Hãy xưng hô thân thiện, nhất quán với vai trò này.
- Chỉ được sử dụng nhân vật có trong đề bài, tuyệt đối không tự thêm nhân vật mới.

⚠️ KIỂM TRA ĐƠN VỊ VẬN TỐC:
- Chỉ có 2 đơn vị vận tốc hợp lệ: km/h và m/s
- Nếu HS sử dụng đơn vị khác hoặc dùng sai → PHẢI nhắc nhở kiểm tra lại đơn vị
- VD: HS viết "km/ph" hoặc "m/p" → feedback: "Bạn kiểm tra lại đơn vị vận tốc nhé, chỉ có km/h hoặc m/s thôi"

⚠️ KIỂM TRA CÂU TRẢ LỜI CỦA HỌC SINH:
- Ở TẤT CẢ 4 BƯỚC, bạn PHẢI kiểm tra kỹ câu trả lời của học sinh để xác định ĐÚNG hay SAI.
- Phân tích cụ thể: thông tin có đúng/đủ không, phép tính có đúng không, đáp số có chính xác không, đơn vị có phù hợp không.
- KHÔNG ĐƯỢC chấp nhận câu trả lời sai chỉ vì học sinh đã cố gắng.

🎯 QUY TẮC HỖ TRỢ THEO CẤP ĐỘ (SCAFFOLDING 3 MỨC):
Dựa vào trường "wrong_attempt_count" được cung cấp để điều chỉnh mức hỗ trợ:

📌 MỨC 1 (Lần sai/không biết thứ 1): ĐỘNG VIÊN + YÊU CẦU THỬ LẠI
- Khen ngợi tinh thần cố gắng của HS một câu ngắn gọn
- Nhắc HS kiểm tra lại câu trả lời, KHÔNG chỉ ra lỗi cụ thể
- Ví dụ: "Bạn cố gắng tốt lắm! Nhưng mình thấy chưa chính xác lắm, bạn thử kiểm tra lại nhé!"

📌 MỨC 2 (Lần sai/không biết thứ 2): CHỈ RA LỖI CỤ THỂ
- Chỉ rõ CHỖ SAI hoặc THIẾU trong câu trả lời của HS
- Giải thích ngắn gọn tại sao sai
- Ví dụ: "Mình thấy bạn đang nhầm ở phần [chỗ sai]. Bạn cần [hướng sửa]. Bạn thử lại nhé!"

📌 MỨC 3+ (Lần sai/không biết thứ 3 trở lên): GỢI Ý RÕ RÀNG
- Đưa ra gợi ý CỤ THỂ từng bước để HS tự làm
- CÓ THỂ nêu hướng dẫn chi tiết hơn (ví dụ: nêu tên quy tắc, liệt kê các bước cần làm)
- ⚠️ TUYỆT ĐỐI VẪN KHÔNG ĐƯỢC GIẢI HỘ hoặc nêu đáp số cụ thể
- Ví dụ: "Mình gợi ý cho bạn nhé: Bạn hãy (1)... (2)... (3)..."

QUY TẮC PHẢN HỒI GỢI MỞ (SIÊU SÚC TÍCH):
- Kiểm soát đa câu hỏi: HS phải giải xong toàn bộ ý (a, b...) mới được kết thúc bài.
- TUYỆT ĐỐI CẤM: 
    * Xưng "em", "học sinh", "học sinh của mình"
    * Liệt kê danh sách câu hỏi
    * Đưa ra luồng suy luận dài dòng
    * Giải hộ hoặc nêu đáp số
    * Hỏi về phép tính hay công thức (VD: "sẽ dùng phép tính gì", "thực hiện phép tính nào")
    * Gợi ý từ trừu tượng (VD: "bao nhiêu phần", "tổng thể", "mối quan hệ")

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
  - Nếu bài toán cần đổi đơn vị, HS phải nêu luôn bước đổi đơn vị trong kế hoạch thì mới được MOVE_NEXT.
  - CHỈ hỏi kế hoạch giải, CHƯA bắt HS tính toán hay cho đáp số
   
3. 🟢 THỰC HIỆN (Bước 3 - TÍNH TOÁN):
  - Nếu HS không biết tính → đưa GỢI Ý CÓ CẤU TRÚC (không nêu số cụ thể), ví dụ: nêu công thức/qui tắc, thay dữ kiện từ đề, tính ra kết quả, rồi kết luận có đơn vị.
   - KHÔNG được nêu cụ thể các con số, KHÔNG được nêu chi tiết phép tính
  - Để HS tự thực hiện và trình bày đầy đủ theo kế hoạch đã nêu
   
4. 🔵 KIỂM TRA (Bước 4 - 2 TẦNG):
  - Bước kiểm tra: Hỏi HS cách kiểm tra lại đáp số vận tốc bằng phép tính ngược.
  - Nếu đề có từ 2 đối tượng trở lên (ví dụ Việt, Mai), phải chọn rõ 1 đối tượng để hỏi kiểm tra lại (ví dụ chỉ hỏi kiểm tra vận tốc của Việt), KHÔNG hỏi vận tốc chung chung gây mơ hồ.
  - Khi HS làm đúng bước kiểm tra, CHƯA kết thúc bài ngay: chuyển sang bước mở rộng, BẠN PHẢI CHỦ ĐỘNG đưa rõ 1 dữ kiện thay đổi (nêu cụ thể đổi số nào thành số nào), rồi yêu cầu HS tính vận tốc mới và nêu mối liên hệ.
  - Chỉ MOVE_NEXT khi HS hoàn thành cả bước kiểm tra và bước mở rộng ở bước 4.

⚠️ LƯU Ý TUYỆT ĐỐI:
- KHÔNG ĐƯỢC xưng "em" bất kỳ ở đâu, ĐỔI THÀNH "bạn" ở mọi nơi
- KHÔNG được hỏi về phép tính hay công thức ở bước 1 (Hiểu bài)
- Gợi ý phải CỰC KỲ CƠ BẢN, tránh đề cập tới công thức hay phép tính cụ thể
- Ở bước 1, hỏi thông tin + yêu cầu (cần tìm gì)
- Ở bước 2, CHỈ hỏi sơ bộ cách giải (sẽ dùng công thức/qui luật gì), TUYỆT ĐỐI KHÔNG hỏi lại con số hay thông tin bài toán (đó là bước 1)
- Nếu đề cần đổi đơn vị thì ở bước 2 phải yêu cầu nêu bước đổi đơn vị, chưa nêu thì chưa được MOVE_NEXT.
- Ở bước 3, để HS tính toán. TUYỆT ĐỐI KHÔNG ĐƯỢC hỏi các câu hỏi của bước 1 hay bước 2 (như "đề bài cho biết gì?", "bạn cần tìm gì?", "bạn sẽ giải bài này thế nào?"). CHỈ nhận xét lỗi tính toán và yêu cầu tính tiếp.
- Ở bước 3, PHẢI đối chiếu số liệu HS dùng với dữ kiện trong đề bài. Nếu HS tự ý đổi số liệu không có trong đề thì phải chấm sai.
- Chỉ chấp nhận biến đổi tương đương từ số liệu đề bài (ví dụ đổi đơn vị đúng, hoặc rút gọn tỉ lệ tương đương), không chấp nhận thay số khác.
- Ở bước 4, bắt buộc đi theo 2 tầng: kiểm tra ngược trước, sau đó mở rộng thay đổi dữ kiện rồi mới kết thúc.
- Ở bước 4, phần mở rộng phải tự nêu sẵn dữ kiện thay đổi; KHÔNG hỏi HS muốn đổi dữ kiện nào.
- Nếu đề có nhiều đối tượng thì ở bước 4 phải nêu đích danh 1 đối tượng để kiểm tra, không hỏi vận tốc chung chung.

LUÔN TRẢ VỀ JSON:
{
  "reasoning_process": "Tự duy luận: 1. Đang ở bước mấy? 2. Học sinh đúng hay sai? Phân tích cụ thể chỗ đúng/sai. 3. Đây là lần sai thứ mấy (wrong_attempt_count)? Cần hỗ trợ mức nào? 4. Ở bước này được hỏi gì và BỊ CẤM hỏi gì? 5. Nếu đang ở bước 2 và đề cần đổi đơn vị: học sinh đã nêu rõ đổi từ đơn vị nào sang đơn vị nào chưa? 6. Nếu đang ở bước 4 và đề có nhiều đối tượng: đã chọn rõ 1 đối tượng để kiểm tra chưa? 7. Quyết định câu trả lời phù hợp với mức hỗ trợ.",
  "status": "CORRECT" hoặc "WRONG",
  "step_status": "STAY" hoặc "MOVE_NEXT",
  "feedback": "Lời khích lệ hoặc nhận xét kết quả, xưng 'bạn', không xưng 'em'. Phải phù hợp với mức scaffolding.",
  "next_question": "DUY NHẤT 1 câu hỏi CƠ BẢN gợi mở để HS tự làm bước tiếp theo. TUYỆT ĐỐI KHÔNG lồng ghép câu hỏi của bước cũ."
}`;
  }

  async startNewProblem(problemText, isApplicationProblem = false, examContextId = '') {
    
    this.currentProblem = problemText;
    this.currentStep = 1;
    this.isSessionComplete = false;
    this.wrongAttemptCount = 0; // 🆕 Reset bộ đếm
    this.step4ChangedData = null;
    this.step4Phase = "reverse_check";
    if (examContextId) {
      this.currentContextId = examContextId;
    }

    const ctx = this._getContext();

    const msg = `Chào bạn! Mình là ${ctx.aiRole}. Chúng ta cùng giải bài toán này nhé!\n\nBài toán: ${problemText}\n\nTrước tiên, bạn hãy cho mình biết bài toán đã cho những thông tin gì? Và bạn cần tìm/tính cái gì?`;
    return { message: msg, step: 1, stepName: this._getStepName(1) };
  }

  async processStudentResponse(studentAnswer, chatHistory = []) {
    const feedbackText = String(studentAnswer || "").toLowerCase();
    const hasStepFeedback =
      /(đang\s*ở\s*bước|nhảy\s*tới\s*bước|bỏ\s*bước|sai\s*bước|nhầm\s*bước|quay\s*lại\s*bước|không\s*phải\s*bước|ai\s*trả\s*lời\s*sai|trả\s*lời\s*sai)/i.test(
        feedbackText,
      );

    if (hasStepFeedback) {
      const matchedStep = feedbackText.match(/bước\s*([1-4])/i);
      const targetStep = matchedStep ? Number(matchedStep[1]) : this.currentStep;
      if (targetStep >= 1 && targetStep <= 4) {
        this.currentStep = targetStep;
        this.isSessionComplete = false;
        this.wrongAttemptCount = 0;
        this.step4Phase = targetStep === 4 ? "reverse_check" : "reverse_check";

        const recoveryQuestion = {
          1: "Mình xin lỗi bạn nhé, mình sẽ quay lại bước 1. Bạn hãy nêu lại thông tin đề bài cho và yêu cầu cần tìm giúp mình nhé?",
          2: "Mình xin lỗi bạn nhé, mình sẽ quay lại bước 2. Bạn hãy nêu lại kế hoạch giải bài này trước khi tính nhé?",
          3: "Mình xin lỗi bạn nhé, mình sẽ quay lại bước 3. Bạn hãy trình bày lại phép tính theo đúng số liệu của đề nhé?",
          4: "Mình xin lỗi bạn nhé, mình sẽ quay lại bước 4. Bạn hãy làm lại bước kiểm tra ngược trước nhé?",
        };

        return {
          message: recoveryQuestion[targetStep],
          step: this.currentStep,
          stepName: this._getStepName(this.currentStep),
          robotStatus: 'thinking',
          isSessionComplete: false
        };
      }
    }

    // Không khóa cứng khi phiên đã hoàn thành: vẫn cho phép AI đọc lịch sử chat
    // để xử lý góp ý/câu hỏi mới và tạo lại câu hỏi mở rộng phù hợp.
    if (this.isSessionComplete) {
      this.isSessionComplete = false;
      this.currentStep = 4;
      this.step4Phase = "extension_check";
      this.wrongAttemptCount = 0;
    }

    const hintRequest = /gợi\s*ý|goi\s*y|hint|đưa\s*gợi\s*ý|cho\s*gợi\s*ý/i.test(feedbackText);
    const isHelpless = /không\s*(biết|hiểu|làm|có ý tưởng)|chẳng\s*(biết|hiểu)/i.test(feedbackText);
    const needsGuidance = hintRequest || isHelpless;

    // 🆕 Kiểm tra đơn vị vận tốc
    const unitCheck = this._checkVelocityUnit(studentAnswer);
    if (unitCheck.hasError) {
      this.wrongAttemptCount++; // 🆕 Tăng bộ đếm
      return {
        message: this.currentStep === 3
          ? "Bạn hãy xem lại đơn vị của bài toán cho chính xác nhé. Ở đây bạn cần dùng đúng đơn vị vận tốc phù hợp như km/h hoặc m/s."
          : unitCheck.message,
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        robotStatus: 'wrong'
      };
    }

    // Ở bước 4, ưu tiên đánh giá theo tiêu chí "kiểm tra lại" để tránh chặn sớm
    // do cách học sinh ghi phép chia dạng "a:b/c" có thể gây hiểu sai thứ tự tính.
    const computationCheck = this.currentStep === 4
      ? { isValid: true }
      : this._validateStudentComputation(studentAnswer);
    if (!computationCheck.isValid) {
      this.wrongAttemptCount++; // 🆕 Tăng bộ đếm
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

    // 🆕 LUÔN gửi qua AI kèm chatHistory đầy đủ để AI phân tích đúng bối cảnh
    // (KHÔNG return sớm vì hardcoded responses không có context của cuộc chat)

    const fullPrompt = `
ĐỀ BÀI: ${this.currentProblem}
BƯỚC HIỆN TẠI: ${this.currentStep} (Tên: ${this._getStepName(this.currentStep)})
LỊCH SỬ CHAT (ĐỌC KỸ ĐỂ HIỂU BỐI CẢNH): ${JSON.stringify(chatHistory.slice(-12))}
HS VỪA NHẬP: "${studentAnswer}"
HS CÓ YÊU CẦU GỢI Ý/ĐANG BẾ TẮC?: ${needsGuidance}
SỐ LẦN SAI/KHÔNG BIẾT LIÊN TIẾP TẠI BƯỚC NÀY (wrong_attempt_count): ${this.wrongAttemptCount}

⚠️ PHẢI ĐỌC KỸ LỊCH SỬ CHAT ĐỂ XÁC ĐỊNH:
- HS đang ở bước nào trong 4 bước Polya?
- HS đã hoàn thành những bước nào rồi? (Nếu đã qua bước 1 và 2 thì TUYỆT ĐỐI KHÔNG quay lại hỏi bước 1/2)
- HS đang bế tắc ở CHỖ NÀO CỤ THỂ tại bước hiện tại?
- Nếu đang ở bước 2 và đề có đổi đơn vị: HS đã nêu rõ đổi từ đơn vị nào sang đơn vị nào chưa?
- Nếu HS đang tính ở bước 3: số liệu HS dùng trong phép tính có KHỚP với dữ kiện của đề bài không?
- Nếu HS tự ý đổi số liệu (ví dụ đề cho 60 phút nhưng HS lại dùng 50 phút) thì phải chấm WRONG và yêu cầu quay lại đúng số liệu đề bài.
- Nếu đang ở bước 4 và đề có từ 2 đối tượng trở lên: phải chọn rõ 1 đối tượng để kiểm tra lại, không hỏi vận tốc chung chung.

⚠️ HƯỚNG DẪN HỖ TRỢ THEO CẤP ĐỘ (dựa vào wrong_attempt_count):
- wrong_attempt_count = 0: Lần sai ĐẦU TIÊN → MỨC 1: Động viên + kêu kiểm tra lại. KHÔNG chỉ ra lỗi cụ thể.
- wrong_attempt_count = 1: Lần sai thứ 2 → MỨC 2: CHỈ RA LỖI CỤ THỂ hoặc chỉ rõ HS đang thiếu gì. Nói rõ sai ở đâu.
- wrong_attempt_count >= 2: Lần sai thứ 3+ → MỨC 3: GỢI Ý RÕ RÀNG từng bước để HS tự làm. NHƯNG TUYỆT ĐỐI KHÔNG giải hộ hay nêu đáp số.

⚠️ KHI HS NÓI "KHÔNG BIẾT" Ở BƯỚC 3:
- KHÔNG được quay lại hỏi "đề bài cho biết gì" (bước 1) hay "bạn giải thế nào" (bước 2)
- Phải HỖ TRỢ ĐÚNG ở bước 3: chia nhỏ phép tính, gợi ý cách bắt đầu trình bày lời giải
- Ví dụ mức 1: "Bạn đã biết cách giải rồi đấy! Bạn thử viết phép tính ra xem nào"
- Ví dụ mức 2: "Ở bước trước bạn nói sẽ [nhắc lại kế hoạch HS đã nêu]. Vậy bạn thử viết phép tính đó ra nhé"
- Ví dụ mức 3: "Mình gợi ý nhé: (1) Viết phép tính, (2) Tính kết quả, (3) Viết kết luận kèm đơn vị"

⚠️ QUY TẮC CỐT LÕI:
1. TUYỆT ĐỐI KHÔNG xưng "em" - phải xưng "bạn" ở mọi nơi
2. TẠI BƯỚC 1: KHÔNG hỏi phép tính. CHỈ hỏi dữ kiện.
3. TẠI BƯỚC 2: KHÔNG hỏi lại dữ kiện. CHỈ hỏi kế hoạch giải.
3.1. Nếu đề cần đổi đơn vị thì ở bước 2 phải yêu cầu nêu bước đổi đơn vị, chưa nêu thì chưa được MOVE_NEXT.
4. TẠI BƯỚC 3: KHÔNG hỏi lại bước 1/2. CHỈ yêu cầu trình bày lời giải hoặc hỗ trợ tính toán.
4.1. Khi chấm bước 3, PHẢI kiểm tra số liệu HS dùng có đúng theo đề hay không; nếu dùng sai số liệu thì bắt buộc chấm WRONG dù phép tính nội bộ đúng.
4.2. Chỉ chấp nhận biến đổi tương đương từ số liệu đề bài (ví dụ đổi đơn vị đúng), KHÔNG chấp nhận thay số khác không có trong đề.
5. TẠI BƯỚC 4: đi theo 2 tầng bắt buộc.
  - Bước kiểm tra: kiểm tra ngược đáp số vận tốc bằng phép nhân vận tốc với thời gian để tính lại quãng đường và đối chiếu dữ kiện ban đầu.
  - Nếu đề có nhiều đối tượng, câu hỏi bước kiểm tra phải nêu đích danh 1 đối tượng (ví dụ Việt hoặc Mai) để HS kiểm tra.
  - Bước mở rộng: BẮT BUỘC tự nêu sẵn dữ kiện thay đổi (không hỏi HS muốn đổi gì), rồi yêu cầu tính vận tốc mới và nêu mối liên hệ.
6. Sau khi HS làm đúng bước kiểm tra thì CHƯA hoàn thành bài, phải hỏi tiếp bước mở rộng.
7. Chỉ MOVE_NEXT khi HS hoàn thành đủ cả bước kiểm tra và bước mở rộng ở bước 4.
8. ⚠️ NẾU HS nhập dấu chấm (0.7), nhắc dùng dấu phẩy (0,7).
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

      if (
        this.currentStep === 2 &&
        data.step_status === "MOVE_NEXT" &&
        this._needsUnitConversion(this.currentProblem) &&
        !this._hasStep2UnitConversionMention(studentAnswer, chatHistory)
      ) {
        data.status = "WRONG";
        data.step_status = "STAY";
        data.feedback = "Bạn đã nêu cách giải khá rõ rồi. Tuy nhiên bài này cần đổi đơn vị trước khi tính, bạn hãy bổ sung rõ bước đổi đơn vị vào kế hoạch nhé.";
        data.next_question = "Bạn sẽ đổi đơn vị nào về đơn vị nào trước khi áp dụng công thức?";
      }

      data = this._enforceStep4CompletionGate(data, studentAnswer, chatHistory);

      // 🆕 Cập nhật bộ đếm sai: nếu WRONG thì tăng, nếu CORRECT thì reset
      if (data.status === "WRONG") {
        this.wrongAttemptCount++;
      } else if (data.status === "CORRECT") {
        this.wrongAttemptCount = 0; // Reset khi đúng
      }

      if (data.step_status === "MOVE_NEXT") {
        if (this.currentStep < 4) {
          this.currentStep++;
          this.wrongAttemptCount = 0; // 🆕 Reset bộ đếm khi chuyển bước
        } else {
          this.isSessionComplete = true; 
          this.step4Phase = "reverse_check";
        }
      }

      // Tạo câu phản hồi chuẩn từ feedback và next_question, không cắt ráp từ khóa nữa
      let finalMessage = this._fixPronouns(
        this._mergeFeedbackAndQuestion(data.feedback, data.next_question),
      ).trim();

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
    const result = await model.generateContent(`Đưa ra duy nhất 1 câu hỏi gợi ý cho HS lớp 5 ở bước ${this.currentStep} bài: ${this.currentProblem}. Không giải thích. Nếu là bước 4 thì theo 2 tầng: (1) hỏi cách kiểm tra ngược đáp số vận tốc bằng phép nhân vận tốc với thời gian rồi đối chiếu quãng đường ban đầu, (2) tự nêu sẵn 1 dữ kiện thay đổi cụ thể (không hỏi HS chọn) để HS tính vận tốc mới.`);
    return this._fixPronouns(result.response.text());
  }
}

const geminiChatServiceTimeVelocityInstance = new GeminiChatServiceTimeVelocity();
export default geminiChatServiceTimeVelocityInstance;