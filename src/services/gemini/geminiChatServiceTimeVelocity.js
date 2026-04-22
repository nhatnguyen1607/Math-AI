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

  _hasUnitConversionPlan(answer = "", chatHistory = []) {
    const recentUserText = Array.isArray(chatHistory)
      ? chatHistory
          .filter((m) => m?.role === "user")
          .slice(-6)
          .map((m) => m?.parts?.[0]?.text || "")
          .join(" ")
      : "";
    const fullText = `${recentUserText} ${String(answer || "")}`.toLowerCase();
    return /đổi\s*đơn\s*vị|quy\s*đổi|đưa\s*về\s*cùng\s*đơn\s*vị|cùng\s*đơn\s*vị|đổi\s*ra/i.test(
      fullText,
    );
  }

  _buildStep4RecheckQuestion() {
    const toVnNumber = (num) => {
      const rounded = Number(num).toFixed(2).replace(/\.00$/, "").replace(/(\.\d*?)0+$/, "$1");
      return rounded.replace(".", ",");
    };

    const text = String(this.currentProblem || "").toLowerCase();
    const roundInfo = this._extractRoundBasedTotalDistance(text);
    const distanceMatch = text.match(/(\d+(?:[,.]\d+)?)\s*(km|m)\b/i);
    const timeMatch = text.match(/(\d+(?:[,.]\d+)?)\s*(giờ|phút|giây|h|s)\b/i);

    const distanceValue = roundInfo?.totalDistance ?? (distanceMatch ? parseFloat(distanceMatch[1].replace(",", ".")) : null);
    const distanceUnit = roundInfo?.distanceUnit || (distanceMatch ? distanceMatch[2] : "quãng đường");
    const timeValue = timeMatch ? parseFloat(timeMatch[1].replace(",", ".")) : null;
    const timeUnit = timeMatch ? timeMatch[2] : "thời gian";

    this.step4ChangedData = {
      distanceValue: Number.isFinite(distanceValue) ? distanceValue : null,
      distanceUnit,
      timeValue: Number.isFinite(timeValue) ? timeValue : null,
      timeUnit,
      roundInfo: roundInfo || null,
    };

    if (Number.isFinite(distanceValue) && Number.isFinite(timeValue)) {
      if (roundInfo) {
        return `Kết quả vận tốc mà bạn vừa tìm được là bao nhiêu? Để kiểm tra lại, bạn dùng tổng quãng đường (${toVnNumber(roundInfo.roundCount)} vòng × ${toVnNumber(roundInfo.lapDistance)} ${roundInfo.distanceUnit} = ${toVnNumber(distanceValue)} ${distanceUnit}) cùng với ${toVnNumber(timeValue)} ${timeUnit} để thực hiện phép tính ngược nào?`;
      }
      return `Kết quả vận tốc mà bạn vừa tìm được là bao nhiêu? Để kiểm tra kết quả đó đúng, bạn sẽ thực hiện phép tính gì với ${toVnNumber(timeValue)} ${timeUnit} và quãng đường ${toVnNumber(distanceValue)} ${distanceUnit}?`;
    }

    return "Kết quả vận tốc mà bạn vừa tìm được là bao nhiêu? Để kiểm tra kết quả đó đúng, bạn sẽ thực hiện phép tính gì?";
  }

  _extractRoundBasedTotalDistance(problemText = "") {
    const text = String(problemText || "").toLowerCase();
    const roundPattern = /(\d+(?:[,.]\d+)?)\s*vòng[^.?!\n]*?(?:mỗi|mỗi\s*một)\s*vòng[^.?!\n]*?(\d+(?:[,.]\d+)?)\s*(km|m)\b/i;
    const match = text.match(roundPattern);
    if (!match) return null;

    const roundCount = parseFloat(String(match[1]).replace(",", "."));
    const lapDistance = parseFloat(String(match[2]).replace(",", "."));
    const distanceUnit = match[3];
    if (!Number.isFinite(roundCount) || !Number.isFinite(lapDistance) || !distanceUnit) return null;

    return {
      roundCount,
      lapDistance,
      distanceUnit,
      totalDistance: roundCount * lapDistance,
    };
  }

  _isRefusingStep4Check(answer = "") {
    const text = String(answer || "").toLowerCase();
    return /(không|khong)\s*(muốn|can|cần|thích|làm)?\s*(kiểm\s*tra|kiem\s*tra|xem\s*lại|xem\s*lai)|khỏi\s*(kiểm\s*tra|xem\s*lại)/i.test(
      text,
    );
  }

  _isAskingStep4Clarification(answer = "") {
    const text = String(answer || "").toLowerCase().trim();
    return /(là\s*sao|la\s*sao|nghĩa\s*là\s*gì|nghia\s*la\s*gi|mình\s*chưa\s*hiểu|toi\s*khong\s*hieu|không\s*hiểu|ko\s*hiểu)/i.test(
      text,
    ) && /(kiểm\s*tra\s*lại|kiem\s*tra\s*lai|làm\s*ngược|lam\s*nguoc|bước\s*4|buoc\s*4|phép\s*tính\s*gì)/i.test(text);
  }

  _isAskingWhereWrong(answer = "") {
    const text = String(answer || "").toLowerCase().trim();
    return /(sai\s*chỗ\s*nào|sai\s*ở\s*đâu|thiếu\s*chỗ\s*nào|cần\s*bổ\s*sung\s*gì|bo\s*sung\s*gi)/i.test(text);
  }

  _isPointingOutSingleLapConfusion(answer = "") {
    const text = String(answer || "").toLowerCase().trim();
    return /(1\s*vòng|một\s*vòng).*(0[,.]?\d*|quãng\s*đường)|0[,.]\d+\s*km.*(1\s*vòng|một\s*vòng|chỉ\s*là)/i.test(
      text,
    );
  }

  _buildStep4EvidenceText(answer = "", chatHistory = []) {
    const recentUserText = Array.isArray(chatHistory)
      ? chatHistory
          .filter((m) => m?.role === "user")
          .slice(-6)
          .map((m) => m?.parts?.[0]?.text || "")
          .join(" ")
      : "";
    return `${recentUserText} ${String(answer || "")}`.toLowerCase();
  }

  _hasStep4VerificationEvidence(answer = "", chatHistory = []) {
    return this._analyzeStep4Verification(answer, chatHistory).isValid;
  }

  _analyzeStep4Verification(answer = "", chatHistory = []) {
    const text = this._buildStep4EvidenceText(answer, chatHistory);
    const distanceVariants = Number.isFinite(this.step4ChangedData?.distanceValue)
      ? [
          String(this.step4ChangedData.distanceValue),
          String(this.step4ChangedData.distanceValue).replace(".", ","),
        ]
      : [];

    const hasReverseOperation =
      /(nhân|\*)/i.test(text) &&
      /(vận\s*tốc|kết\s*quả\s*vừa\s*tìm|đáp\s*số)/i.test(text) &&
      /(thời\s*gian|giờ|phút|giây)/i.test(text);

    const hasRecomputedDistance = /(quãng\s*đường|tính\s*lại\s*quãng\s*đường|ra\s*quãng\s*đường)/i.test(text);

    const hasComparisonWithOriginal =
      (/(bằng|khớp|trùng|đúng|chính\s*xác|không\s*trùng|không\s*khớp|sai)/i.test(text) &&
        /(quãng\s*đường\s*(ban\s*đầu|đề\s*bài)|dữ\s*kiện\s*ban\s*đầu|đề\s*bài)/i.test(text)) ||
      distanceVariants.some((value) => value && text.includes(value.toLowerCase()));

    const hasConclusionRule =
      /(nếu\s+.*(bằng|khớp|trùng).*(đúng|chính\s*xác)|ngược\s*lại|không\s*(bằng|khớp|trùng).*(xem\s*lại|kiểm\s*tra|sai\s*sót))/i.test(
        text,
      );

    const isValid =
      hasReverseOperation &&
      hasRecomputedDistance &&
      (hasComparisonWithOriginal || hasConclusionRule);

    return {
      isValid,
      hasReverseOperation,
      hasRecomputedDistance,
      hasComparisonWithOriginal,
      hasConclusionRule,
    };
  }

  _buildStep4VerificationFeedback(analysis = {}) {
    const timeValue = this.step4ChangedData?.timeValue;
    const timeUnit = this.step4ChangedData?.timeUnit || "thời gian";
    const distanceValue = this.step4ChangedData?.distanceValue;
    const distanceUnit = this.step4ChangedData?.distanceUnit || "quãng đường";

    const displayTime = Number.isFinite(timeValue)
      ? `${String(timeValue).replace(".", ",")} ${timeUnit}`
      : "thời gian của đề bài";
    const displayDistance = Number.isFinite(distanceValue)
      ? `${String(distanceValue).replace(".", ",")} ${distanceUnit}`
      : "quãng đường ban đầu của đề bài";

    const roundInfo = this.step4ChangedData?.roundInfo;
    const roundNote = roundInfo
      ? ` Lưu ý: ${String(roundInfo.roundCount).replace(".", ",")} vòng × ${String(roundInfo.lapDistance).replace(".", ",")} ${roundInfo.distanceUnit} = ${displayDistance} (tổng quãng đường).`
      : "";
    return `Từ công thức tính vận tốc là lấy quãng đường chia cho thời gian, bạn hãy làm ngược lại bằng cách lấy vận tốc vừa tìm được nhân với ${displayTime} để tính lại quãng đường. Nếu quãng đường tính lại đúng bằng ${displayDistance} thì kết quả tìm được là chính xác. Ngược lại, nếu hai kết quả không trùng nhau thì bạn cần xem lại các bước làm vì có thể đã xảy ra sai sót.${roundNote}`;
  }

  _buildStep4ExtensionQuestion() {
    const toVnNumber = (num) => {
      const rounded = Number(num).toFixed(2).replace(/\.00$/, "").replace(/(\.\d*?)0+$/, "$1");
      return rounded.replace(".", ",");
    };

    const baseDistance = this.step4ChangedData?.distanceValue;
    const baseDistanceUnit = this.step4ChangedData?.distanceUnit || "km";
    const baseTime = this.step4ChangedData?.timeValue;
    const baseTimeUnit = this.step4ChangedData?.timeUnit || "giờ";

    if (Number.isFinite(baseDistance)) {
      const delta = Math.max(baseDistance >= 10 ? 2 : 1, Math.round(Math.abs(baseDistance) * 0.2));
      const nextDistance = baseDistance + delta;
      this.step4ChangedData = {
        ...this.step4ChangedData,
        extension: {
          field: "distance",
          from: baseDistance,
          to: nextDistance,
          unit: baseDistanceUnit,
          fixedTime: Number.isFinite(baseTime) ? baseTime : null,
          fixedTimeUnit: baseTimeUnit,
        },
      };
      const timeText = Number.isFinite(baseTime) ? `, giữ nguyên thời gian ${toVnNumber(baseTime)} ${baseTimeUnit}` : "";
      return `Tuyệt vời! Vậy bây giờ hãy thử mở rộng thêm 1 chút nhé: nếu đổi quãng đường từ ${toVnNumber(baseDistance)} ${baseDistanceUnit} thành ${toVnNumber(nextDistance)} ${baseDistanceUnit}${timeText} thì vận tốc cuối sẽ thay đổi như thế nào? Bạn hãy tính vận tốc mới và nêu mối liên hệ.`;
    }

    if (Number.isFinite(baseTime) && baseTime > 0) {
      const delta = Math.max(1, Math.round(Math.abs(baseTime) * 0.2));
      const nextTime = Math.max(1, baseTime - delta);
      this.step4ChangedData = {
        ...this.step4ChangedData,
        extension: {
          field: "time",
          from: baseTime,
          to: nextTime,
          unit: baseTimeUnit,
          fixedDistance: Number.isFinite(baseDistance) ? baseDistance : null,
          fixedDistanceUnit: baseDistanceUnit,
        },
      };
      const distanceText = Number.isFinite(baseDistance) ? `, giữ nguyên quãng đường ${toVnNumber(baseDistance)} ${baseDistanceUnit}` : "";
      return `Tuyệt vời! Vậy bây giờ hãy thử mở rộng thêm 1 chút nhé: nếu đổi thời gian từ ${toVnNumber(baseTime)} ${baseTimeUnit} thành ${toVnNumber(nextTime)} ${baseTimeUnit}${distanceText} thì vận tốc cuối sẽ thay đổi như thế nào? Bạn hãy tính vận tốc mới và nêu mối liên hệ.`;
    }

    this.step4ChangedData = {
      ...this.step4ChangedData,
      extension: { field: "generic", from: 10, to: 12, unit: "" },
    };
    return "Tuyệt vời! Vậy bây giờ hãy thử mở rộng thêm 1 chút nhé: nếu thay đổi một dữ kiện trong đề bài thì vận tốc cuối sẽ thay đổi như thế nào? Bạn hãy tính kết quả mới và nêu mối liên hệ.";
  }

  _analyzeStep4Extension(answer = "", chatHistory = []) {
    const text = this._buildStep4EvidenceText(answer, chatHistory);
    const ext = this.step4ChangedData?.extension || {};

    const fromVariants = ext?.from !== undefined
      ? [String(ext.from), String(ext.from).replace(".", ",")]
      : [];
    const toVariants = ext?.to !== undefined
      ? [String(ext.to), String(ext.to).replace(".", ",")]
      : [];

    const hasChangedInputMention =
      /(thay|đổi|doi).*?(thành|thanh|sang|ra)/i.test(text) ||
      /(từ|tu)\s*\d+[.,]?\d*\s*(thành|thanh|lên|len|xuống|xuong|đến|den)\s*\d+[.,]?\d*/i.test(text) ||
      (fromVariants.some((value) => value && text.includes(value.toLowerCase())) &&
        toVariants.some((value) => value && text.includes(value.toLowerCase())));

    const hasNewComputedResult =
      /\d+[.,]?\d*\s*(km\s*\/\s*h|m\s*\/\s*s|km\s*\/\s*giờ|m\s*\/\s*giây)/i.test(text) ||
      /(=\s*\d+[.,]?\d*|kết\s*quả\s*(mới)?\s*là\s*\d+[.,]?\d*|vận\s*tốc\s+[^.]*?(là|=)\s*\d+[.,]?\d*)/i.test(text);

    const hasRelationshipReasoning =
      /(tỉ\s*lệ\s*thuận|tỉ\s*lệ\s*nghịch|khi\s+.*\s+thì\s+.*|nếu\s+.*\s+thì\s+.*|nên|do\s*đó|vì\s*vậy|mối\s*liên\s*hệ|suy\s*ra)/i.test(
        text,
      ) && /(tăng|giảm|lớn\s*hơn|nhỏ\s*hơn|nhanh\s*hơn|chậm\s*hơn|cao\s*hơn|thấp\s*hơn)/i.test(text);

    const isValid = hasChangedInputMention && hasNewComputedResult && hasRelationshipReasoning;

    return {
      isValid,
      hasChangedInputMention,
      hasNewComputedResult,
      hasRelationshipReasoning,
    };
  }

  _buildStep4ExtensionFeedback(analysis = {}) {
    const guides = [];
    if (!analysis.hasChangedInputMention) {
      guides.push("nêu rõ dữ kiện đã đổi từ ... thành ...");
    }
    if (!analysis.hasNewComputedResult) {
      guides.push("ghi phép tính và kết quả vận tốc mới");
    }
    if (!analysis.hasRelationshipReasoning) {
      guides.push("nêu mối liên hệ: dữ kiện tăng/giảm thì vận tốc thay đổi như thế nào");
    }

    if (guides.length === 0) {
      return "Bạn đã mở rộng đúng rồi, bạn rà lại một lần nữa cho chắc nhé.";
    }

    return `Bạn làm đúng được một phần rồi. Để hoàn thành phần mở rộng, bạn bổ sung giúp mình: ${guides.join("; ")}.`;
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
        2: "Mình thấy bạn đang chưa rõ cách giải. Ở bước này, bạn chỉ cần nêu: bạn sẽ dùng quy tắc/công thức nào để tìm đáp án (ví dụ: tính vận tốc, quãng đường hay thời gian), chưa cần tính ra số cụ thể. Bạn thử nêu lại xem!",
        3: "Mình thấy bạn đang bị kẹt ở phần tính toán. Bạn cần: viết rõ công thức/quy tắc → thay số từ đề vào → tính ra kết quả → viết kết luận có đơn vị. Bạn hãy thử lại từng bước một nhé!",
        4: "Mình thấy bạn đang chưa rõ cách kiểm tra. Bạn cần đối chiếu: (1) Kết quả có khớp dữ kiện đề bài không? (2) Đơn vị vận tốc đã đúng chưa (km/h hoặc m/s)? (3) Kết luận đã trả lời đủ yêu cầu bài toán chưa? Bạn thử trả lời lại nhé!"
      };
      return {
        message: this._fixPronouns(responses[step] || responses[1]),
        robotStatus: 'thinking'
      };
    }

    // === CẤP ĐỘ 3+: Gợi ý rõ ràng (nhưng KHÔNG giải hộ) ===
    const responses = {
      1: "Mình gợi ý cho bạn nhé! 🌟 Bạn hãy nhìn vào đề bài và tìm: có những con số nào được nêu ra (ví dụ: bao nhiêu km, bao nhiêu giờ...)? Và đề bài hỏi bạn tìm cái gì (vận tốc, quãng đường hay thời gian)? Bạn chỉ cần chép lại thông tin từ đề là được rồi!",
      2: "Mình gợi ý cho bạn nhé! 🌟 Khi giải bài toán về chuyển động, ta thường dùng 3 công thức liên quan đến: vận tốc, quãng đường và thời gian. Bạn hãy nghĩ xem bài này cần tìm đại lượng nào trong 3 đại lượng đó, rồi nêu quy tắc/công thức tương ứng nhé!",
      3: "Mình gợi ý cho bạn nhé! 🌟 Bạn hãy làm theo 4 ý này: (1) Viết lại quy tắc/công thức bạn đã chọn ở bước trước, (2) Thay các dữ kiện từ đề bài vào công thức, (3) Tính ra kết quả bằng số, (4) Viết kết luận kèm đơn vị (km/h hoặc m/s). Bạn thử làm theo từng ý một nhé!",
      4: "Mình gợi ý cho bạn nhé! 🌟 Để kiểm tra, bạn hãy: (1) Lấy kết quả vừa tính, thử thế ngược lại vào công thức xem có ra đúng dữ kiện đề bài không. (2) Kiểm tra đơn vị đã viết đúng chưa. (3) Đọc lại yêu cầu đề bài xem kết luận đã trả lời đúng câu hỏi chưa. Bạn thử trả lời theo 3 ý này nhé!"
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
      const fullText = fixedHistory.map(m => m.parts[0]?.text || '').join(' ');
      const normalized = String(fullText || "").toLowerCase();
      const hasCompletionSignal =
        /đã hoàn thành bài toán|bạn đã hoàn thành bài toán|hãy nộp bài luyện tập này|nhấn nút 'nộp bài'|nhấn nút "nộp bài"/i.test(
          normalized,
        );
      const hasStep4Signal =
        /kiểm tra lại|phép tính ngược|tổng quãng đường|thay đổi một dữ kiện|vận tốc mới|bước 4/i.test(normalized);

      if (hasCompletionSignal) {
        this.currentStep = 4;
        this.step4Phase = "extension_check";
        this.isSessionComplete = true;
        return;
      }

      if (hasStep4Signal || fullText.includes("Kiểm tra")) this.currentStep = 4;
      else if (fullText.includes("Thực hiện")) this.currentStep = 3;
      else if (fullText.includes("Lập kế hoạch")) this.currentStep = 2;
      else if (fullText.includes("Hiểu bài")) this.currentStep = 1;

      if (
        this.currentStep === 4 &&
        /mở rộng|thay\s*đổi\s*(số\s*liệu|dữ\s*kiện)|vận\s*tốc\s*mới/i.test(fullText)
      ) {
        this.step4Phase = "extension_check";
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
  - Tầng 1: Hỏi HS cách kiểm tra lại đáp số vận tốc bằng phép tính ngược.
  - Khi HS làm đúng tầng 1, CHƯA kết thúc bài ngay: chuyển sang Tầng 2 (mở rộng), yêu cầu thay đổi một dữ kiện rồi tính vận tốc mới và nêu mối liên hệ.
  - Chỉ MOVE_NEXT khi HS hoàn thành cả 2 tầng ở bước 4.

⚠️ LƯU Ý TUYỆT ĐỐI:
- KHÔNG ĐƯỢC xưng "em" bất kỳ ở đâu, ĐỔI THÀNH "bạn" ở mọi nơi
- KHÔNG được hỏi về phép tính hay công thức ở bước 1 (Hiểu bài)
- Gợi ý phải CỰC KỲ CƠ BẢN, tránh đề cập tới công thức hay phép tính cụ thể
- Ở bước 1, hỏi thông tin + yêu cầu (cần tìm gì)
- Ở bước 2, CHỈ hỏi sơ bộ cách giải (sẽ dùng công thức/qui luật gì), TUYỆT ĐỐI KHÔNG hỏi lại con số hay thông tin bài toán (đó là bước 1)
- Nếu đề cần đổi đơn vị thì ở bước 2 phải yêu cầu nêu bước đổi đơn vị, chưa nêu thì chưa được MOVE_NEXT.
- Ở bước 3, để HS tính toán. TUYỆT ĐỐI KHÔNG ĐƯỢC hỏi các câu hỏi của bước 1 hay bước 2 (như "đề bài cho biết gì?", "bạn cần tìm gì?", "bạn sẽ giải bài này thế nào?"). CHỈ nhận xét lỗi tính toán và yêu cầu tính tiếp.
- Ở bước 4, bắt buộc đi theo 2 tầng: kiểm tra ngược trước, sau đó mở rộng thay đổi dữ kiện rồi mới kết thúc.

LUÔN TRẢ VỀ JSON:
{
  "reasoning_process": "Tự duy luận: 1. Đang ở bước mấy? 2. Học sinh đúng hay sai? Phân tích cụ thể chỗ đúng/sai. 3. Đây là lần sai thứ mấy (wrong_attempt_count)? Cần hỗ trợ mức nào? 4. Ở bước này được hỏi gì và BỊ CẤM hỏi gì? 5. Quyết định câu trả lời phù hợp với mức hỗ trợ.",
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
    
    if (this.isSessionComplete) return { message: "Bạn đã hoàn thành bài toán này rồi!" };

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

    // Kiểm tra xem HS có nói "không biết" hay không
    const isHelpless = /không\s*(biết|hiểu|làm|có ý tưởng)|chẳng\s*(biết|hiểu)/i.test(studentAnswer);

    // 🆕 LUÔN gửi qua AI kèm chatHistory đầy đủ để AI phân tích đúng bối cảnh
    // (KHÔNG return sớm vì hardcoded responses không có context của cuộc chat)

    const fullPrompt = `
ĐỀ BÀI: ${this.currentProblem}
BƯỚC HIỆN TẠI: ${this.currentStep} (Tên: ${this._getStepName(this.currentStep)})
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
5. TẠI BƯỚC 4: đi theo 2 tầng bắt buộc.
  - Tầng 1: kiểm tra ngược đáp số vận tốc bằng phép nhân vận tốc với thời gian để tính lại quãng đường và đối chiếu dữ kiện ban đầu.
  - Tầng 2: mở rộng bằng thay đổi một dữ kiện rồi tính vận tốc mới và nêu mối liên hệ.
6. Sau khi HS làm đúng tầng 1 thì CHƯA hoàn thành bài, phải hỏi tiếp tầng 2.
7. Chỉ MOVE_NEXT khi HS hoàn thành đủ cả tầng 1 và tầng 2 ở bước 4.
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

      // 🆕 Cập nhật bộ đếm sai: nếu WRONG thì tăng, nếu CORRECT thì reset
      if (data.status === "WRONG") {
        this.wrongAttemptCount++;
      } else if (data.status === "CORRECT") {
        this.wrongAttemptCount = 0; // Reset khi đúng
      }

      // ===== BƯỚC 2: XỬ LÝ KẾ HOẠCH =====
      if (this.currentStep === 2) {
        const originalStep2Status = data.step_status;
        const requiresUnitConversion = this._needsUnitConversion(this.currentProblem);
        const hasUnitConversionPlan = this._hasUnitConversionPlan(studentAnswer, chatHistory);

        if (requiresUnitConversion && !hasUnitConversionPlan) {
          data.status = "WRONG";
          data.step_status = "STAY";
          data.feedback = "Bạn đã nêu được cách giải cơ bản rồi. Tuy nhiên bài này cần đổi đơn vị trước khi tính.";
          data.next_question =
            "Bạn hãy bổ sung vào kế hoạch: bạn sẽ đổi đơn vị nào về đơn vị nào trước khi thực hiện phép tính?";
        }

        // ✅ MOVE_NEXT: HS đã nêu kế hoạch xong → chuyển sang bước 3
        if (data.step_status === "MOVE_NEXT" && originalStep2Status === "MOVE_NEXT") {
          data.feedback = ""; // Xóa feedback để tránh trùng lặp
          data.next_question = "Tuyệt vời! Bây giờ bạn hãy bắt đầu giải bài theo kế hoạch nhé! Trình bày lời giải đầy đủ, viết rõ từng bước rồi kết luận nhé.";
        }
      }

      // ✅ Sau khi hoàn thành bước 3, chuyển sang câu hỏi kiểm tra bắt buộc có tính lại kết quả
      if (this.currentStep === 3 && data.step_status === "MOVE_NEXT") {
        this.step4Phase = "reverse_check";
        data.feedback = data.feedback || "Bạn đã thực hiện lời giải tốt lắm!";
        data.next_question = this._buildStep4RecheckQuestion();
      }



      data.feedback = this._sanitizeByCurrentStep(data.feedback || "");
      data.next_question = this._sanitizeByCurrentStep(data.next_question || "");

      // ⚠️ POST-FIX: Bước 4 (Kiểm tra) - XỬ LÝ HOÀN THÀNH PHIÊN
      if (this.currentStep === 4) {
        const refusedToCheck = this._isRefusingStep4Check(studentAnswer);
        const askedClarification = this._isAskingStep4Clarification(studentAnswer);
        const askedWhereWrong = this._isAskingWhereWrong(studentAnswer);
        const pointedSingleLap = this._isPointingOutSingleLapConfusion(studentAnswer);
        if (this.step4Phase !== "extension_check") {
          const step4Analysis = this._analyzeStep4Verification(studentAnswer, chatHistory);
          const hasVerificationEvidence = step4Analysis.isValid;

          if (refusedToCheck || !hasVerificationEvidence) {
            data.status = "WRONG";
            data.step_status = "STAY";
            data.feedback = askedClarification
              ? "'Kiểm tra lại' nghĩa là bạn làm phép tính ngược: lấy vận tốc vừa tìm được nhân với thời gian để tính lại quãng đường rồi so sánh với dữ kiện ban đầu."
              : refusedToCheck
                ? "Bước 4 bắt buộc phải kiểm tra lại, nên mình chưa thể kết thúc bài ở đây nhé."
                : askedWhereWrong
                  ? this._buildStep4VerificationFeedback(step4Analysis)
                  : pointedSingleLap
                    ? `Bạn nhận xét rất đúng: ${this.step4ChangedData?.roundInfo ? "quãng đường 0,9 km chỉ là 1 vòng, còn kiểm tra phải dùng tổng quãng đường của tất cả các vòng." : "nếu đề có nhiều vòng thì phải dùng tổng quãng đường của tất cả các vòng."} Mình cùng kiểm tra lại bằng phép tính ngược nhé.`
                  : (this._buildStep4VerificationFeedback(step4Analysis) || data.feedback);
            data.next_question = this._buildStep4RecheckQuestion();
          } else {
            this.step4Phase = "extension_check";
            data.status = "CORRECT";
            data.step_status = "STAY";
            data.feedback = "Tuyệt vời! Bạn đã kiểm tra kết quả một cách hợp lý rồi.";
            data.next_question = this._buildStep4ExtensionQuestion();
          }
        } else {
          const extensionAnalysis = this._analyzeStep4Extension(studentAnswer, chatHistory);

          if (refusedToCheck || !extensionAnalysis.isValid) {
            data.status = "WRONG";
            data.step_status = "STAY";
            data.feedback = askedClarification
              ? "Ở phần mở rộng, bạn chỉ cần đổi 1 dữ kiện theo câu hỏi, tính vận tốc mới rồi nêu mối liên hệ tăng/giảm với đáp số."
              : refusedToCheck
                ? "Phần mở rộng ở bước 4 là bắt buộc, mình cùng làm thêm một ý nữa nhé."
                : this._buildStep4ExtensionFeedback(extensionAnalysis);
            data.next_question = this._buildStep4ExtensionQuestion();
          } else {
            data.status = "CORRECT";
            data.step_status = "MOVE_NEXT";
            data.feedback = "🎉 Xuất sắc! Bạn đã hoàn thành bài toán rồi đó!";
            data.next_question = "Bạn hãy nộp bài luyện tập này bằng cách nhấn nút 'Nộp bài' ở dưới để mình chấm điểm nhé!";
          }
        }
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
    const result = await model.generateContent(`Đưa ra duy nhất 1 câu hỏi gợi ý cho HS lớp 5 ở bước ${this.currentStep} bài: ${this.currentProblem}. Không giải thích. Nếu là bước 4 thì hỏi cách kiểm tra ngược đáp số vận tốc bằng phép nhân vận tốc với thời gian rồi đối chiếu quãng đường ban đầu.`);
    return this._fixPronouns(result.response.text());
  }
}

const geminiChatServiceTimeVelocityInstance = new GeminiChatServiceTimeVelocity();
export default geminiChatServiceTimeVelocityInstance;