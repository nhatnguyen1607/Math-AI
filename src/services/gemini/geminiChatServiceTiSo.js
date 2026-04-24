import geminiModelManager from "./geminiModelManager";
import { EXAM_CONTEXTS } from '../../constants/examContexts';

export class GeminiChatServiceTiSo {
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
    const expression = check?.expression ? ` ${check.expression}` : "";
    const hasActual = Number.isFinite(check?.actual);
    const mismatchDetail =
      hasActual
        ? ` Với phép tính${expression}, kết quả bạn ghi (${check.actual}) chưa đúng.`
        : "";

    if (check?.issueType === "decimal") {
      return `Bạn đang gần đúng rồi!${mismatchDetail} Có vẻ bạn đang đặt vị trí dấu phẩy chưa chính xác. Bạn thử tính lại chậm từng bước và ghi lại kết quả kèm đơn vị % nhé.`;
    }

    return `Bạn đang sai ở bước tính kết quả.${mismatchDetail} Bạn hãy rà lại phép chia rồi nhân 100 theo đúng thứ tự, sau đó kết luận với đơn vị % nhé.`;
  }

  _isLikelyStep4ExtensionContext(chatHistory = []) {
    const recentAssistantText = Array.isArray(chatHistory)
      ? chatHistory
          .filter((m) => m?.role === "model" || m?.role === "assistant")
          .slice(-4)
          .map((m) => m?.parts?.[0]?.text || "")
          .join(" ")
          .toLowerCase()
      : "";

    if (!recentAssistantText) return false;

    return /(thử\s*thách|mở\s*rộng|tỉ\s*số\s*phần\s*trăm\s*mới|thay\s*đổi\s*một\s*dữ\s*kiện|đổi\s*dữ\s*kiện|nêu\s*mối\s*liên\s*hệ)/i.test(
      recentAssistantText,
    );
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

  _needsUnitConversion(problemText = "") {
    const text = String(problemText || "").toLowerCase();
    if (!text) return false;

    const hasExplicitConversion =
      /đổi\s*đơn\s*vị|quy\s*đổi|đưa\s*về\s*cùng\s*đơn\s*vị|cùng\s*đơn\s*vị|khác\s*đơn\s*vị|không\s*cùng\s*đơn\s*vị|đổi\s*ra/i.test(
        text,
      );

    const hasMixedDistanceUnits = /\d+\s*km\b/i.test(text) && /\d+\s*m\b/i.test(text);
    const hasMixedMassUnits = /\d+\s*kg\b/i.test(text) && /\d+\s*g\b/i.test(text);
    const hasMixedVolumeUnits =
      /(\d+\s*lít\b|\d+\s*l\b)/i.test(text) && /\d+\s*ml\b/i.test(text);
    const hasMixedTimeUnits = /\d+\s*giờ\b/i.test(text) && /\d+\s*phút\b/i.test(text);

    return (
      hasExplicitConversion ||
      hasMixedDistanceUnits ||
      hasMixedMassUnits ||
      hasMixedVolumeUnits ||
      hasMixedTimeUnits
    );
  }

  _extractIntermediateComparedValues(problemText = "") {
    const text = String(problemText || "").toLowerCase();
    if (!text) return null;

    const numberRegex = /(\d+(?:[,.]\d+)?)\s*(kg|g|km|m|lít|l|ml|gam)?\b/gi;
    const values = [];
    let match;
    while ((match = numberRegex.exec(text)) !== null) {
      const value = parseFloat(String(match[1]).replace(",", "."));
      const unit = (match[2] || "").trim();
      if (!Number.isFinite(value)) continue;
      values.push({ value, unit });
    }
    if (!values.length) return null;

    const base = values[0];

    const moreMatch = text.match(/(?:nhiều\s*hơn|hơn)\s*[^\d]{0,20}(\d+(?:[,.]\d+)?)\s*(kg|g|km|m|lít|l|ml|gam)?\b/i);
    if (moreMatch) {
      const delta = parseFloat(String(moreMatch[1]).replace(",", "."));
      const deltaUnit = (moreMatch[2] || "").trim();
      if (Number.isFinite(delta) && (base.unit === deltaUnit || !deltaUnit || !base.unit)) {
        return {
          firstValue: base.value,
          secondValue: base.value + delta,
          unit: base.unit || deltaUnit || "",
          relation: "more",
          delta,
        };
      }
    }

    const lessMatch = text.match(/(?:ít\s*hơn|kém)\s*[^\d]{0,20}(\d+(?:[,.]\d+)?)\s*(kg|g|km|m|lít|l|ml|gam)?\b/i);
    if (lessMatch) {
      const delta = parseFloat(String(lessMatch[1]).replace(",", "."));
      const deltaUnit = (lessMatch[2] || "").trim();
      if (Number.isFinite(delta) && (base.unit === deltaUnit || !deltaUnit || !base.unit)) {
        const second = base.value - delta;
        if (second > 0) {
          return {
            firstValue: base.value,
            secondValue: second,
            unit: base.unit || deltaUnit || "",
            relation: "less",
            delta,
          };
        }
      }
    }

    return null;
  }

  _extractDividedValuesFromHistory(chatHistory = [], studentAnswer = "") {
    const recentText = Array.isArray(chatHistory)
      ? chatHistory.filter((m) => m?.role === "user").map((m) => m?.parts?.[0]?.text || "").join("\n")
      : "";
    const fullText = `${recentText}\n${String(studentAnswer || "")}`;
    if (!fullText.trim()) return null;

    const normalized = this._normalizeMathText(fullText);
    const divisionRegex = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g;
    let match;
    let lastMatch = null;
    while ((match = divisionRegex.exec(normalized)) !== null) {
      if (Math.abs(parseFloat(match[2]) - 100) > 1e-9) {
        lastMatch = match;
      }
    }
    
    if (lastMatch) {
       return {
         firstValue: parseFloat(lastMatch[1]),
         secondValue: parseFloat(lastMatch[2])
       };
    }
    return null;
  }

  _cleanStep4QuantityLabel(label = "") {
    let cleaned = String(label || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    cleaned = cleaned
      .replace(/^(là|chính là)\s+/i, "")
      .replace(/\s+(là|bằng)\s*bao\s*nhiêu.*$/i, "")
      .replace(/\s+(bao\s*nhiêu|là\s*bao\s*nhiêu)\s*$/i, "")
      .replace(/[,:;]+$/g, "")
      .trim();
    return cleaned;
  }

  _extractComparedQuantityLabels(problemText = "") {
    const text = String(problemText || "").replace(/\s+/g, " ").trim();
    if (!text) return null;

    const patterns = [
      /bao\s*nhiêu\s*phần\s*trăm\s+(.+?)\s+so\s+với\s+(.+?)(?:[.?!]|$)/i,
      /t[ỉiỷy]\s*s[ốo]\s*phần\s*trăm\s+(?:giữa\s+)?(.+?)\s+(?:và|so\s+với)\s+(.+?)(?:[.?!]|$)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const firstLabel = this._cleanStep4QuantityLabel(match[1]);
      const secondLabel = this._cleanStep4QuantityLabel(match[2]);
      if (firstLabel && secondLabel) {
        return { firstLabel, secondLabel };
      }
    }

    return null;
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

  _hasStep3Complete(answer = "") {
    const text = String(answer || "").toLowerCase();
    const equationCount = (text.match(/=/g) || []).length;
    const hasRatioContext = /tỉ\s*số|tỷ\s*số|phần\s*trăm/.test(text);
    const hasConclusion = /đáp\s*số|kết\s*luận|%/.test(text);
    const hasStructuredFlow = /bước\s*1|bước\s*2|bước\s*3|trước\s*hết|tiếp\s*theo|sau\s*đó|cuối\s*cùng/.test(text);

    return (equationCount >= 1 || hasStructuredFlow) && hasRatioContext && hasConclusion;
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
      /([:/]\s*100|chia\s*100|\*|x|nhân)/.test(text);

    return hasComputation && hasReverseHint;
  }

  _hasStep4ExtensionEvidence(answer = "", chatHistory = []) {
    const text = `${this._getRecentUserText(chatHistory)} ${String(answer || "")}`.toLowerCase();
    const hasChangedData =
      /(nếu|giả\s*sử|thay\s*đổi|đổi\s*dữ\s*kiện|mới|tăng|giảm|thêm|bớt)/.test(text);
    const hasComputation = /\d/.test(text) && (/[=:+\-*/]/.test(text) || /chia|nhân|tính/.test(text));
    const hasRelation =
      /(mối\s*liên\s*hệ|so\s*với|cao\s*hơn|thấp\s*hơn|lớn\s*hơn|nhỏ\s*hơn|tăng|giảm|chênh\s*lệch)/.test(
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
        return {
          ...normalized,
          status: "WRONG",
          step_status: "STAY",
          feedback: String(normalized.feedback || "Bạn thử kiểm tra ngược lại kết quả nhé."),
          next_question:
            normalized.next_question ||
            "Bạn hãy thử làm phép kiểm tra ngược để đối chiếu lại với dữ kiện ban đầu nhé?",
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
          "Bước mở rộng: mình đổi sẵn 1 dữ kiện trong đề cho bạn. Bạn hãy dùng dữ kiện mới đó để tính lại phần trăm mới, rồi nêu mối liên hệ với kết quả ban đầu nhé?",
      };
    }

    if (normalized.status !== "CORRECT") {
      return {
        ...normalized,
        status: "WRONG",
        step_status: "STAY",
        feedback: String(
          normalized.feedback ||
            "Bạn chưa hoàn thành bước mở rộng. Bạn hãy dùng dữ kiện mới mình đã nêu để tính lại nhé.",
        ),
        next_question:
          normalized.next_question ||
          "Bạn làm đủ 3 ý: nêu dữ kiện mới mình đã đổi, tính phần trăm mới, và so sánh với kết quả cũ nhé?",
      };
    }

    return {
      ...normalized,
      status: "CORRECT",
      step_status: "MOVE_NEXT",
    };
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
        2: "Bạn đang làm tốt lắm rồi! 💪 Bạn hãy suy nghĩ thêm một chút, thử nhớ lại xem mình sẽ giải bài này bằng cách nào nhé?",
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
        1: "Mình thấy bạn đang gặp khó ở phần tìm thông tin. Ở bước này, bạn cần làm 2 việc: (1) Nêu các dữ kiện đề bài cho (các con số, đơn vị), (2) Nêu yêu cầu bài toán hỏi gì (cần tìm cái gì). Bạn thử nêu lại nhé!",
        2: "Mình thấy bạn đang chưa rõ cách giải. Ở bước này, bạn chỉ cần nêu: bạn sẽ dùng quy tắc/công thức nào để tìm tỉ số hoặc phần trăm, chưa cần tính ra số cụ thể. Bạn thử nêu lại xem!",
        3: "Mình thấy bạn đang bị kẹt ở phần tính toán. Bạn cần: viết rõ công thức/quy tắc → thay số từ đề vào → tính ra kết quả → viết kết luận có đơn vị %. Bạn hãy thử lại từng bước một nhé!",
        4: "Mình thấy bạn đang chưa rõ cách kiểm tra. Bạn cần đối chiếu: (1) Kết quả có khớp dữ kiện đề bài không? (2) Kết quả đã có đơn vị % chưa? (3) Kết luận đã trả lời đúng yêu cầu bài toán chưa? Bạn thử trả lời lại nhé!"
      };
      return {
        message: this._fixPronouns(responses[step] || responses[1]),
        robotStatus: 'thinking'
      };
    }

    // === CẤP ĐỘ 3+: Gợi ý rõ ràng (nhưng KHÔNG giải hộ) ===
    const responses = {
      1: "Mình gợi ý cho bạn nhé! 🌟 Bạn hãy nhìn vào đề bài và tìm: có những con số nào được nêu ra? Đề bài hỏi bạn tìm cái gì (tỉ số, phần trăm hay giá trị)? Bạn chỉ cần chép lại thông tin từ đề là được rồi!",
      2: "Mình gợi ý cho bạn nhé! 🌟 Khi giải bài toán tỉ số, ta thường cần so sánh hai đại lượng với nhau. Bạn hãy nghĩ xem: cần so sánh cái gì với cái gì? Rồi nêu quy tắc tìm tỉ số hoặc phần trăm tương ứng nhé!",
      3: "Mình gợi ý cho bạn nhé! 🌟 Bạn hãy làm theo 4 ý này: (1) Viết lại quy tắc/công thức bạn đã chọn ở bước trước, (2) Thay các dữ kiện từ đề bài vào công thức, (3) Tính ra kết quả bằng số, (4) Viết kết luận kèm đơn vị %. Bạn thử làm theo từng ý một nhé!",
      4: "Mình gợi ý cho bạn nhé! 🌟 Để kiểm tra, bạn hãy: (1) Lấy kết quả vừa tính, thử thế ngược lại xem có ra đúng dữ kiện đề bài không. (2) Kiểm tra đơn vị % đã viết đúng chưa. (3) Đọc lại yêu cầu đề bài xem kết luận đã trả lời đúng câu hỏi chưa. Bạn thử trả lời theo 3 ý này nhé!"
    };
    return {
      message: this._fixPronouns(responses[step] || responses[1]),
      robotStatus: 'thinking'
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
        /phép\s*tính\s*ngược|kiểm\s*tra\s*ngược|bước\s*4|bước\s*kiểm\s*tra|bước\s*mở\s*rộng|kết\s*quả\s*phần\s*trăm\s*mới/i.test(
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
        /mở rộng|thay\s*đổi\s*(số\s*liệu|dữ\s*kiện)|kết\s*quả\s*mới/i.test(fullText)
      ) {
        this.step4Phase = "extension_check";
      } else if (this.currentStep === 4) {
        this.step4Phase = "reverse_check";
      }
    }
  }

  _buildSystemPrompt() {
    const ctx = this._getContext();

    return `Bạn là "trợ lý học tập" dẫn dắt HS lớp 5 giải toán tỉ số theo 4 bước Polya. 
Xưng hô: "mình" - "bạn". TUYỆT ĐỐI CẤM xưng "em", "học sinh" - PHẢI luôn xưng "bạn" ở MỌI chỗ.

VAI TRÒ CỦA BẠN: BẠN ĐANG ĐÓNG VAI LÀ "${ctx.aiRole}".
- Nhiệm vụ nhập vai: ${ctx.aiRoleDescription}
- Hãy xưng hô thân thiện, nhất quán với vai trò này.
- Chỉ được sử dụng nhân vật có trong đề bài, tuyệt đối không tự thêm nhân vật mới.

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
- NẾU HS NÓI "KHÔNG BIẾT" HOẶC YÊU CẦU GIẢI: TUYỆT ĐỐI KHÔNG quay lại hỏi câu hỏi về "thông tin bài toán" (Bước 1) nếu đang ở Bước 2, Bước 3, hoặc Bước 4.
  + Tùy vào bước hiện tại, hãy CHIA NHỎ vấn đề hiện tại thành một câu hỏi gợi mở siêu dễ liên quan MẬT THIẾT đến con số hoặc bước tính mà HS đang kẹt.
  + TUYỆT ĐỐI CẤM: Giải hộ, hỏi thẳng phép tính, gợi ý từ khóa trừu tượng.

CHI TIẾT PHẢN HỒI THEO BƯỚC:
1. 🔴 HIỂU BÀI (Bước 1 - NÊU THÔNG TIN VÀ YÊU CẦU):
   - Hỏi HS nêu thông tin đề bài + yêu cầu cần tìm: "Bạn hãy cho mình biết bài toán cho những thông tin gì? Và bạn cần tìm/tính cái gì?"
   - KHÔNG hỏi phép tính, KHÔNG hỏi công thức, CHỈ hỏi về thông tin và yêu cầu.
2. 🟡 LẬP KẾ HOẠCH (Bước 2 - NÊU SƠ BỘ CÁCH GIẢI): 
  - ⚠️ KHÔNG hỏi lại "bài toán có những con số nào" hay "bài toán cho những thông tin gì" - đó là câu hỏi bước 1 rồi!
  - Hỏi kế hoạch/chiến lược giải: "Bạn sẽ giải bài này như thế nào? Bạn dùng cách gì/quy tắc gì để tìm đáp án?"
  - Nếu bài toán cần đổi đơn vị, HS phải nêu luôn bước đổi đơn vị trong kế hoạch thì mới được MOVE_NEXT.
  - CHỈ hỏi kế hoạch, CHƯA yêu cầu tính toán hay cho đáp số.
3. 🟢 THỰC HIỆN (Bước 3):
  - Yêu cầu HS trình bày lời giải đầy đủ theo kế hoạch đã nêu.
  - TUYỆT ĐỐI KHÔNG ĐƯỢC lặp lại các câu hỏi của bước 1 hay bước 2 (như "đề bài cho biết gì?", "bạn cần tìm gì?", "bạn sẽ giải bài này thế nào?"). CHỈ nhận xét lỗi tính toán và yêu cầu tính tiếp.
  - KHÔNG đưa số cụ thể vào gợi ý.
4. 🔵 KIỂM TRA (Bước 4 - 2 TẦNG):
  - Bước kiểm tra: Hỏi HS cách kiểm tra lại tỉ số phần trăm vừa tìm được bằng phép làm ngược.
  - Khi HS làm đúng bước kiểm tra, CHƯA kết thúc bài ngay: chuyển sang bước mở rộng, BẠN PHẢI CHỦ ĐỘNG đưa rõ 1 dữ kiện thay đổi (nêu cụ thể đổi số nào thành số nào), rồi yêu cầu HS tính kết quả phần trăm mới và nêu mối liên hệ.
  - Chỉ MOVE_NEXT khi HS hoàn thành cả bước kiểm tra và bước mở rộng ở bước 4.

LUÔN TRẢ VỀ JSON:
{
  "reasoning_process": "Tự duy luận: 1. Đang ở bước mấy? 2. Học sinh đúng hay sai? Phân tích cụ thể chỗ đúng/sai. 3. Đây là lần sai thứ mấy (wrong_attempt_count)? Cần hỗ trợ mức nào? 4. Ở bước này được hỏi gì và BỊ CẤM hỏi gì? 5. Nếu đang ở bước 2 và đề cần đổi đơn vị: học sinh đã nêu rõ đổi từ đơn vị nào sang đơn vị nào chưa? 6. Quyết định câu trả lời phù hợp với mức hỗ trợ.",
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

    const msg = `Chào bạn! Mình là ${ctx.aiRole}. Chúng ta cùng giải bài toán tỉ số này nhé!\n\nBài toán: ${problemText}\n\nTrước tiên, bạn hãy cho mình biết bài toán đã cho những thông tin gì? Và bạn cần tìm/tính cái gì?`;
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

    const isLikelyStep4Extension = this._isLikelyStep4ExtensionContext(chatHistory);

    // Ở bước 4, ưu tiên đánh giá theo tiêu chí "kiểm tra lại" để tránh chặn sớm
    // do học sinh có thể ghi phép tính theo dạng dễ gây hiểu sai thứ tự tính.
    const computationCheck = this.currentStep === 4 || isLikelyStep4Extension
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

    // Với chủ đề tỉ số: khi HS đã nêu kết quả dạng số thì cần có đơn vị %
    if (this.currentStep === 3 && !isLikelyStep4Extension) {
      const percentCheck = this._checkPercentUnit(studentAnswer);
      if (percentCheck.hasError) {
        this.wrongAttemptCount++; // 🆕 Tăng bộ đếm
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

    // 🆕 LUÔN gửi qua AI kèm chatHistory đầy đủ để AI phân tích đúng bối cảnh
    // (KHÔNG return sớm vì hardcoded responses không có context của cuộc chat)

    const fullPrompt = `
ĐỀ BÀI: ${this.currentProblem}
BƯỚC HIỆN TẠI: ${this.currentStep} (${this._getStepName(this.currentStep)})
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
- Nếu HS tự ý đổi số liệu (ví dụ đề cho 50000 nhưng HS lại dùng 60000) thì phải chấm WRONG và yêu cầu quay lại đúng số liệu đề bài.

⚠️ HƯỚNG DẪN HỖ TRỢ THEO CẤP ĐỘ (dựa vào wrong_attempt_count):
- wrong_attempt_count = 0: Lần sai ĐẦU TIÊN → MỨC 1: Động viên + kêu kiểm tra lại. KHÔNG chỉ ra lỗi cụ thể.
- wrong_attempt_count = 1: Lần sai thứ 2 → MỨC 2: CHỈ RA LỖI CỤ THỂ hoặc chỉ rõ HS đang thiếu gì. Nói rõ sai ở đâu.
- wrong_attempt_count >= 2: Lần sai thứ 3+ → MỨC 3: GỢI Ý RÕ RÀNG từng bước để HS tự làm. NHƯNG TUYỆT ĐỐI KHÔNG giải hộ hay nêu đáp số.

⚠️ KHI HS NÓI "KHÔNG BIẾT" Ở BƯỚC 3:
- KHÔNG được quay lại hỏi "đề bài cho biết gì" (bước 1) hay "bạn giải thế nào" (bước 2)
- Phải HỖ TRỢ ĐÚNG ở bước 3: chia nhỏ phép tính, gợi ý cách bắt đầu trình bày lời giải
- Ví dụ mức 1: "Bạn đã biết cách giải rồi đấy! Bạn thử viết phép tính ra xem nào"
- Ví dụ mức 2: "Ở bước trước bạn nói sẽ [nhắc lại kế hoạch HS đã nêu]. Vậy bạn thử viết phép tính đó ra nhé"
- Ví dụ mức 3: "Mình gợi ý nhé: (1) Viết phép tính, (2) Tính kết quả, (3) Viết kết luận kèm đơn vị %"

⚠️ QUY TẮC CỐT LÕI:
1. TUYỆT ĐỐI KHÔNG xưng "em".
2. TẠI BƯỚC 1: KHÔNG hỏi phép tính. CHỈ hỏi dữ kiện.
3. TẠI BƯỚC 2: KHÔNG hỏi lại dữ kiện. CHỈ hỏi kế hoạch giải.
3.1. Nếu đề cần đổi đơn vị thì ở bước 2 phải yêu cầu nêu bước đổi đơn vị, chưa nêu thì chưa được MOVE_NEXT.
4. TẠI BƯỚC 3: KHÔNG hỏi lại bước 1/2. CHỈ yêu cầu trình bày lời giải hoặc hỗ trợ tính toán.
4.1. Khi chấm bước 3, PHẢI kiểm tra số liệu HS dùng có đúng theo đề hay không; nếu dùng sai số liệu thì bắt buộc chấm WRONG dù phép tính nội bộ đúng.
4.2. Chỉ chấp nhận biến đổi tương đương từ số liệu đề bài (ví dụ rút gọn tỉ lệ như 40000/50000 -> 4/5), KHÔNG chấp nhận thay số khác không có trong đề.
5. TẠI BƯỚC 4: đi theo 2 tầng bắt buộc.
  - Bước kiểm tra: kiểm tra ngược kết quả phần trăm bằng cách lấy kết quả chia 100 rồi nhân với dữ kiện thứ hai để đối chiếu dữ kiện thứ nhất ban đầu.
  - Khi chấm câu trả lời bước 4, PHẢI đọc câu HS vừa nhập + lịch sử chat + đề bài để hiểu HS đang làm phép tính nào (ví dụ "40:100x25=10" vẫn là phép kiểm tra ngược hợp lệ).
  - Nếu HS sai/thiếu ở bước 4, PHẢI chỉ rõ thiếu phần nào (thiếu chia 100, thiếu nhân dữ kiện thứ hai, hay thiếu bước đối chiếu kết quả), không trả lời chung chung.
  - Bước mở rộng: BẮT BUỘC tự nêu sẵn dữ kiện thay đổi (không hỏi HS muốn đổi gì), rồi yêu cầu tính kết quả phần trăm mới và nêu mối liên hệ.
6. Sau khi HS làm đúng bước kiểm tra thì CHƯA hoàn thành bài, phải hỏi tiếp bước mở rộng.
7. Chỉ MOVE_NEXT khi HS trả lời đúng và đủ ý.
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

      data = this._enforceStep4CompletionGate(data, studentAnswer, chatHistory);

      // 🆕 Cập nhật bộ đếm sai: nếu WRONG thì tăng, nếu CORRECT thì reset
      if (data.status === "WRONG") {
        this.wrongAttemptCount++;
      } else if (data.status === "CORRECT") {
        this.wrongAttemptCount = 0; // Reset khi đúng
      }

      // Logic chuyển bước
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
      return { message: "Mình đang kiểm tra lại một chút, bạn chờ mình nhé!", step: this.currentStep };
    }
  }

  async getHint() {
    const model = geminiModelManager.getModel();
    const result = await model.generateContent(`Đưa ra duy nhất 1 câu hỏi gợi ý cho HS lớp 5 ở bước ${this.currentStep} (${this._getStepName(this.currentStep)}) bài toán tỉ số: ${this.currentProblem}. Không giải thích, xưng bạn. Nếu là bước 4 thì theo 2 tầng: (1) kiểm tra ngược bằng chia 100 rồi nhân dữ kiện thứ hai, (2) sau đó tự nêu sẵn 1 dữ kiện thay đổi cụ thể (không hỏi HS chọn) để HS tính kết quả phần trăm mới.`);
    return this._fixPronouns(result.response.text());
  }
}

const geminiChatServiceTiSoInstance = new GeminiChatServiceTiSo();
export default geminiChatServiceTiSoInstance;