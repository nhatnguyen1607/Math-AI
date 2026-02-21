import geminiModelManager from "./geminiModelManager";
import apiKeyManager from "./apiKeyManager";
import { GoogleGenerativeAI } from "@google/generative-ai";
import competencyEvaluationService from "./competencyEvaluationService";

// simple delay helper used by rate-limited wrapper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// System prompt cho AI trợ lý học toán
const SYSTEM_PROMPT = `Mình là trợ lý học tập ảo thân thiện, hỗ trợ bạn lớp 5 giải toán theo 4 bước Polya.

🔴 **QUAN TRỌNG: STATUS TAG REQUIREMENT**
BẠNPHẢI bắt đầu mỗi câu trả lời của bạn bằng một trong ba tag sau:
- [CORRECT] - nếu câu trả lời của học sinh ĐÚNG hoặc chấp nhận được
- [WRONG] - nếu câu trả lời của học sinh SAI hoặc cần sửa
- [IDLE] - nếu đó là câu hỏi trung lập/gợi ý/giải thích (không phải đánh giá câu trả lời)

VÍ DỤ:
✅ [CORRECT] Tuyệt vời! Bạn đã xác định đúng dữ kiện: dữ kiện là..., yêu cầu là...
❌ [WRONG] Hình như bạn đọc lại bài toán xem sao! Con số '...' không khớp với bài toán gốc.
❓ [IDLE] Vậy bạn thấy bài toán đã cho những thông tin nào? Và bài toán yêu cầu chúng ta tìm cái gì?

**LƯU Ý:** TAG phải ở ĐẦY DỦ mỗi response. Không tag = học sinh không biết kết quả của mình đứng ở đâu.

HƯỚNG TRONG NỘI BỘ (Không ghi ra cho bạn thấy):
4 BƯỚC POLYA:
1. HIỂU BÀI TOÁN: Giúp bạn xác định dữ kiện đã cho và yêu cầu bài toán
2. LẬP KẾ HOẠCH: Hỏi bạn nên làm gì, cần phép tính nào (KHÔNG tính cụ thể)
3. THỰC HIỆN: Hỏi bạn tính toán từng bước, **KIỂM TRA CHẶT CHẼ xem phép tính có đúng không**
4. KIỂM TRA & MỞ RỘNG: Hỏi bạn liệu kết quả có hợp lý, có cách giải nào khác không

NGUYÊN TẮC KIỂM TRA PHÉP TÍNH (QUAN TRỌNG):
- **LUÔN LUÔN xác minh kết quả tính toán của bạn trước khi khen ngợi**
- Nếu phép tính SAI: **KHÔNG bao giờ chuyển bước, KHÔNG nói "đúng", KHÔNG khen ngợi**
- Nếu sai: Hỏi "bạn xem lại kết quả này ... được không?", "hãy tính lại một lần nữa"
- **CHỈ khi phép tính CHÍNH XÁC mới được chuyển sang bước 4**
- VỊ DỤ: Nếu học sinh nói "3 × 2,5 = 7,6" → Hỏi "bạn kiểm tra lại xem: 3 × 2,5 = bao nhiêu?" (KHÔNG nói đúng, KHÔNG khen)
- **NHẮC NHỨ: Mỗi response đều PHẢI có TAG ở đầu**

NGUYÊN TẮC GIAO TIẾP VỚI BẠN:
- KHÔNG BAO GIỜ giải bài toán thay bạn
- KHÔNG đưa ra đáp án dù bạn làm sai
- CHỈ đặt câu hỏi gợi mở, định hướng để bạn tự suy nghĩ
- MỖI LẦN CHỈ HỎI 1 CÂU duy nhất
- Phát hiện lỗi sai của bạn và gợi ý để bạn tự sửa
- Ngôn ngữ thân thiện, dễ thương như người bạn của bạn
- Khi bạn trả lời đúng, khen ngợi cụ thể và hỏi câu tiếp theo
- KHÔNG ghi "BƯỚC 1:", "BƯỚC 2:", v.v. vào câu chat - chỉ đặt câu hỏi một cách tự nhiên

NHỮNG GÌ KHÔNG NÊN LÀM:
- Không hỏi "bạn làm đúng không?" → hỏi "vậy tiếp theo là gì?"
- Không nói "sai" trực tiếp → nói "hãy xem lại..."
- Không giải hoặc cho đáp án → chỉ hỏi câu để bạn suy nghĩ lại
- **LUÔN XƯNG HÔ LÀ "BẠN" - KHÔNG ĐƯỢC XƯNG "EM"** ← Điều này bắt buộc phải tuân thủ
- **KHÔNG khen ngợi phép tính sai** - Phải chính xác mới được khen

ĐÁNH GIÁ MỨC ĐỘ:
- Cần cố gắng: Chưa hiểu rõ, nhiều sai sót
- Đạt: Hiểu cơ bản, làm đúng một phần
- Tốt: Hiểu rõ, làm đúng, trình bày tốt`;

export class GeminiService {
  constructor() {
    this.chat = null;
    this.currentStep = 1;
    this.currentProblem = "";
    this.studentResponses = [];
    this.isSessionComplete = false;
    this.stepEvaluations = {
      step1: null, // Hiểu bài toán
      step2: null, // Lập kế hoạch
      step3: null, // Thực hiện
      step4: null  // Kiểm tra
    };

    // queue for rate-limited generate calls
    this._pending = Promise.resolve();
  }

  // Bắt đầu bài toán mới
  async startNewProblem(problemText) {
    this.currentProblem = problemText;
    this.currentStep = 1;
    this.isSessionComplete = false;
    this.studentResponses = [];
    this.stepEvaluations = {
      step1: null,
      step2: null,
      step3: null,
      step4: null
    };

    const maxRetries = 3; // Tối đa 3 lần retry (tổng 4 attempts)
    let attemptCount = 0;
    let lastError = null;

    while (attemptCount < maxRetries) {
      attemptCount++;
      
      try {
        // Gửi đề bài và bắt đầu bước 1 - dùng generateContent() có dual-level retry
        const initialPrompt = `Đây là bài toán: ${problemText}

Hãy đặt CHỈ 1 câu hỏi gợi mở giúp mình bắt đầu hiểu bài toán này. Câu hỏi nên giúp mình suy nghĩ về dữ kiện đã cho và mục tiêu cần tìm. ĐỂ CÓ SỰ NHẤT QUÁN, CHỈ RETURN DUY NHẤT 1 CÂU HỎI, KHÔNG PHẢI NHIỀU LỰA CHỌN.`;

        // Sử dụng generateContent() để có dual-level retry (tries all models, then rotates key)
        const initialResponse = await this._rateLimitedGenerate(initialPrompt);
        let response = initialResponse.response.text();
        
        // Nếu có nhiều câu hỏi, chỉ lấy cái đầu tiên
        if (response.includes('\n\n**"') || response.includes('\n\nCâu hỏi')) {
          const lines = response.split('\n');
          response = lines[0]; // Lấy dòng đầu
        }

        // Khởi tạo chat mới với key/model đang work
        const model = geminiModelManager.getModel();
        this.chat = model.startChat({
          history: [
            {
              role: "user",
              parts: [{ text: SYSTEM_PROMPT }],
            },
            {
              role: "model",
              parts: [{ text: "Chào bạn! 👋 Mình là trợ lý học toán của bạn. Mình sẽ không giải hộ bạn, mà sẽ hỏi các câu gợi ý để bạn tự suy nghĩ và tìm ra cách giải. Bạn sẵn sàng chưa? 😊" }],
            },
            {
              role: "user",
              parts: [{ text: initialPrompt }],
            },
            {
              role: "model",
              parts: [{ text: response }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });

        return {
          message: response,
          step: 1,
          stepName: "Hiểu bài toán"
        };
      } catch (error) {
        lastError = error;
        
        // Kiểm tra nếu API Key bị invalid hoặc missing
        if (!process.env.REACT_APP_GEMINI_API_KEY_1) {
          throw new Error("❌ Chưa cấu hình REACT_APP_GEMINI_API_KEY_1 trong file .env");
        }
        
        // Kiểm tra nếu là lỗi 429 (quota exceeded)
        const isQuotaError = error.message?.includes("429") || 
                             error.message?.includes("quota") ||
                             error.message?.includes("exceeded");
        
        if (isQuotaError && attemptCount < maxRetries) {

          // generateContent() đã tự handle key rotation
          continue;
        } else if (isQuotaError && attemptCount >= maxRetries) {
          const totalKeys = apiKeyManager.keyConfigs.length;
          throw new Error(`❌ Tất cả ${totalKeys} API keys đã hết quota free tier. Vui lòng chờ cho đến hôm sau hoặc nâng cấp tài khoản Google Cloud.`);
        } else {
          // Lỗi khác - không retry, throw ngay
          throw error;
        }
      }
    }
    throw new Error(`Không thể khởi tạo bài toán sau ${maxRetries} lần thử. Error: ${lastError?.message || 'Unknown error'}`);
  }

  // Xử lý phản hồi của bạn
  async processStudentResponse(studentAnswer) {
    // Check if session is already complete
    if (this.isSessionComplete) {
      return {
        message: "Bài toán đã hoàn thành! Vui lòng bắt đầu một bài toán mới.",
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        nextStep: null,
        evaluation: null,
        isSessionComplete: true,
        robotStatus: 'idle'
      };
    }

    if (!this.chat) {
      throw new Error("Chưa khởi tạo bài toán. Vui lòng gọi startNewProblem() trước.");
    }

    this.studentResponses.push({
      step: this.currentStep,
      answer: studentAnswer,
      timestamp: new Date()
    });

    // Tạo context cho AI dựa vào bước hiện tại
    let contextPrompt = this._buildContextPrompt(studentAnswer);

    let result;
    try {
      result = await this.chat.sendMessage(contextPrompt);
    } catch (error) {
      // Kiểm tra nếu API Key bị invalid hoặc missing
      if (!process.env.REACT_APP_GEMINI_API_KEY_1) {
        throw new Error("❌ Chưa cấu hình REACT_APP_GEMINI_API_KEY_1 trong file .env");
      }
      
      // Kiểm tra nếu là lỗi 429 (quota exceeded)
      const isQuotaError = error.message?.includes("429") || 
                           error.message?.includes("quota") ||
                           error.message?.includes("exceeded");
      
      if (isQuotaError) {
        // Force mark key as exhausted và rotate
        apiKeyManager.markKeyAsExhausted(error);
        const hasRotated = apiKeyManager.rotateToNextKey();
        
        if (!hasRotated) {
          throw new Error("❌ Tất cả API keys đã hết quota. Vui lòng thử lại sau.");
        }
        
        // Recreate chat với key mới
        const newGeminiInstance = new GoogleGenerativeAI(apiKeyManager.getCurrentKey());
        const newModel = newGeminiInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        this.chat = newModel.startChat({
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });
        
        // Retry với chat mới
        result = await this.chat.sendMessage(contextPrompt);
      } else {
        // Với lỗi khác, thử fallback model
        const newModel = geminiModelManager.getNextAvailableModel();
        if (!newModel) {
          throw error;
        }
        
        this.chat = newModel.startChat({
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });
        
        result = await this.chat.sendMessage(contextPrompt);
      }
    }

    // ⚠️ CRITICAL: Safety check to prevent crash if API returns null/invalid response
    if (!result || !result.response) {
      console.warn('⚠️ Gemini API returned null or invalid response');
      return {
        message: "Hệ thống đang bận, em hãy thử gửi lại tin nhắn nhé!",
        step: this.currentStep,
        stepName: this._getStepName(this.currentStep),
        nextStep: null,
        evaluation: null,
        isSessionComplete: false,
        robotStatus: 'idle'
      };
    }

    let response = result.response.text();
    
    // 🔴 PARSE & EXTRACT STATUS TAG from response
    // Check if response starts with [CORRECT], [WRONG], or [IDLE]
    let robotStatus = 'idle';
    let cleanMessage = response;
    
    if (response.trim().startsWith('[CORRECT]')) {
      robotStatus = 'correct';
      cleanMessage = response.replace(/^\[CORRECT\]\s*/i, '').trim();
      console.log('✅ Extracted [CORRECT] tag → robotStatus: correct');
    } else if (response.trim().startsWith('[WRONG]')) {
      robotStatus = 'wrong';
      cleanMessage = response.replace(/^\[WRONG\]\s*/i, '').trim();
      console.log('❌ Extracted [WRONG] tag → robotStatus: wrong');
    } else if (response.trim().startsWith('[IDLE]')) {
      robotStatus = 'idle';
      cleanMessage = response.replace(/^\[IDLE\]\s*/i, '').trim();
      console.log('⚪ Extracted [IDLE] tag → robotStatus: idle');
    } else {
      // No explicit tag found, use default logic
      console.log('⚠️ No status tag found, using step-based logic');
      robotStatus = 'idle';
    }

    const lowerResponse = cleanMessage.toLowerCase();

    // Phân tích xem AI có muốn chuyển bước không (simple keyword checking)
    let nextStep = null;
    let evaluation = null;
    
    if ((lowerResponse.includes("bước 2") || lowerResponse.includes("lập kế hoạch")) && this.currentStep === 1) {
      nextStep = 2;
      evaluation = this._extractEvaluation(cleanMessage);
      this.evaluateStep(1, evaluation || 'pass');
      this.currentStep = 2;
    } else if ((lowerResponse.includes("bước 3") || lowerResponse.includes("thực hiện")) && this.currentStep === 2) {
      nextStep = 3;
      evaluation = this._extractEvaluation(cleanMessage);
      this.evaluateStep(2, evaluation || 'pass');
      this.currentStep = 3;
    } else if ((lowerResponse.includes("bước 4") || lowerResponse.includes("kiểm tra")) && this.currentStep === 3) {
      nextStep = 4;
      evaluation = this._extractEvaluation(cleanMessage);
      this.evaluateStep(3, evaluation || 'pass');
      this.currentStep = 4;
    } else if ((lowerResponse.includes("hoàn thành") || lowerResponse.includes("hoàn tất")) && this.currentStep === 4) {
      nextStep = 5;
      evaluation = this._extractEvaluation(cleanMessage);
      this.evaluateStep(4, evaluation || 'pass');
      this.isSessionComplete = true;
    }

    return {
      message: cleanMessage, // ✅ Return cleaned message WITHOUT tag
      step: this.currentStep,
      stepName: this._getStepName(this.currentStep),
      nextStep: nextStep,
      evaluation: evaluation,
      isSessionComplete: this.isSessionComplete,
      robotStatus: robotStatus // ✅ Return extracted status for robot reaction
    };
  }

  // 🔴 Extract explicit status tag [CORRECT], [WRONG], or [IDLE] from AI response
  // Returns: { tag: 'correct'|'wrong'|'idle'|null, cleanText: string }
  _extractStatusTag(text) {
    if (!text || typeof text !== 'string') {
      return { tag: null, cleanText: text };
    }

    // Regex to match [CORRECT], [WRONG], or [IDLE] at the start
    const tagMatch = text.match(/^\[?(CORRECT|WRONG|IDLE)\]?\s*/i);

    if (tagMatch) {
      const tag = tagMatch[1].toUpperCase();
      // Remove tag from display text
      const cleanText = text.replace(/^\[?(CORRECT|WRONG|IDLE)\]?\s*/i, '').trim();
      
      let robotStatus = null;
      if (tag === 'CORRECT') {
        robotStatus = 'correct';
      } else if (tag === 'WRONG') {
        robotStatus = 'wrong';
      } else if (tag === 'IDLE') {
        robotStatus = 'idle';
      }

      console.log(`🏷️ Extracted Status Tag: [${tag}] → robotStatus: '${robotStatus}'`);
      return { tag: robotStatus, cleanText };
    }

    // No tag found - return null as tag
    return { tag: null, cleanText: text };
  }

  // Trích xuất đánh giá từ response
  _extractEvaluation(response) {
    if (response.includes("tốt") || response.includes("xuất sắc") || response.includes("rất tốt")) {
      return 'good';
    } else if (response.includes("đạt") || response.includes("khá tốt")) {
      return 'pass';
    } else if (response.includes("cần cố gắng") || response.includes("chưa tốt")) {
      return 'need_effort';
    }
    return 'pass'; // Mặc định
  }

  // 🎯 Analyze sentiment of AI response for robot state
  // Priority 1: Extract explicit status tag [CORRECT], [WRONG], [IDLE]
  // Priority 2: Fall back to keyword analysis if no tag found
  _analyzeSentiment(text) {
    if (!text || typeof text !== 'string') return 'idle';

    // Priority 1: Try to extract explicit status tag
    const { tag, cleanText } = this._extractStatusTag(text);
    if (tag) {
      console.log(`✅ Using explicit tag status: '${tag}'`);
      return tag; // 'correct', 'wrong', or 'idle'
    }

    // Priority 2: Fallback to keyword analysis if no tag found
    console.log('⚠️ No status tag found, falling back to keyword analysis');
    const lower = cleanText.toLowerCase();

    const wrongKeywords = [
      'chưa đúng',
      'sai',
      'sai rồi',
      'thử lại',
      'kiểm tra lại',
      'nhầm',
      'nhầm lẫn',
      'không chính xác',
      'tiếc quá'
    ];
    for (const kw of wrongKeywords) {
      if (lower.includes(kw)) {
        console.log(`📌 Keyword match (wrong): '${kw}'`);
        return 'wrong';
      }
    }

    const correctKeywords = [
      'chính xác',
      'đúng rồi',
      'tuyệt vời',
      'xuất sắc',
      'làm tốt',
      'hoàn thành'
    ];
    for (const kw of correctKeywords) {
      if (lower.includes(kw)) {
        console.log(`📌 Keyword match (correct): '${kw}'`);
        return 'correct';
      }
    }

    console.log('📌 No keywords matched, defaulting to idle');
    return 'idle';
  }

  // Helper: Remove Vietnamese accents for robust regex matching
  _removeAccents(str) {
    if (!str) return '';
    return str
      .normalize('NFD')  // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
      .replace(/đ/g, 'd')  // Replace đ with d
      .replace(/Đ/g, 'D');  // Replace Đ with D
  }

  // Determine robot sentiment from AI response text using Advanced Regex Matching
  // Priority 1: WRONG phrases (correction needed)
  // Priority 2: CORRECT phrases (affirmative)
  // Default: IDLE (neutral/thinking)
  _determineRobotSentiment(responseText) {
    if (!responseText || typeof responseText !== 'string') return 'idle';
    
    // Preprocess: lowercase the text and remove accents for accent-insensitive matching
    const textLower = responseText.toLowerCase();
    const textClean = this._removeAccents(textLower);

    // Priority 1: Check WRONG patterns first (correction phrases need priority)
    const wrongPatterns = [
      /chua\s*dung/,           // "chưa đúng"
      /sai\s*roi/,              // "sai rồi"
      /bi\s*nham/,              // "bị nhầm"
      /kiem\s*tra\s*lai/,       // "kiểm tra lại"
      /thu\s*lai/,              // "thử lại"
      /tinh\s*lai/,             // "tính lại"
      /chua\s*chinh\s*xac/,     // "chưa chính xác"
      /khong\s*dung/,           // "không đúng"
      /nham\s*lan/,             // "nhầm lẫn"
      /khong\s*chinh\s*xac/     // "không chính xác"
    ];

    for (const pattern of wrongPatterns) {
      if (pattern.test(textClean)) {
        console.log(`🔴 Sentiment (WRONG): Pattern matched - ${pattern}`);
        return 'wrong';
      }
    }

    // Priority 2: Check CORRECT patterns (affirmative phrases)
    const correctPatterns = [
      /chinh\s*xac/,            // "chính xác"
      /dung\s*roi/,             // "đúng rồi"
      /tuyet\s*voi/,            // "tuyệt vời"
      /gioi\s*lam/,             // "giỏi lắm"
      /xuat\s*sac/,             // "xuất sắc"
      /hoan\s*toan\s*dung/,     // "hoàn toàn đúng"
      /ket\s*qua\s*dung/,       // "kết quả đúng"
      /lam\s*tot/,              // "làm tốt"
      /hoan\s*thanh/,           // "hoàn thành"
      /dat/,                    // "đạt" (careful with this one as it may match other words)
      /chuan\s*xac/,            // "chuẩn xác"
      /hop\s*ly/                // "hợp lý"
    ];

    for (const pattern of correctPatterns) {
      if (pattern.test(textClean)) {
        console.log(`🟢 Sentiment (CORRECT): Pattern matched - ${pattern}`);
        return 'correct';
      }
    }

    // Default: No strong affirmative or correction phrases detected
    console.log('⚪ Sentiment (IDLE): No matching patterns');
    return 'idle';
  }

  // Tính mức độ chung (mucDoChinh) dựa trên tổng điểm
  _calculateMucDoChinh(totalScore) {
    // 0-3 điểm: Cần cố gắng
    // 4-6 điểm: Đạt
    // 7-8 điểm: Tốt
    if (totalScore <= 3) {
      return 'Cần cố gắng';
    } else if (totalScore <= 6) {
      return 'Đạt';
    } else {
      return 'Tốt';
    }
  }

  // Gửi câu trả lời của bạn (giữ để tương thích)
  async sendStudentResponse(studentAnswer) {
    return this.processStudentResponse(studentAnswer);
  }

  // Xây dựng prompt theo từng bước
  _buildContextPrompt(studentAnswer) {
    // Build conversation history context for AI to see all previous responses
    let conversationContext = '';
    if (this.studentResponses && this.studentResponses.length > 0) {
      conversationContext = 'LỊCH SỬ CÁC CÂU TRẢ LỜI CỦA HỌC SINH:\n';
      this.studentResponses.forEach((response, idx) => {
        conversationContext += `${idx + 1}. "${response.answer}"\n`;
      });
      conversationContext += '\n';
    }

    let prompt = `BÀI TOÁN GỐC:
${this.currentProblem}

${conversationContext}CÂU TRẢ LỜI HIỆN TẠI:
"${studentAnswer}"\n\n`;

    switch (this.currentStep) {
      case 1: // Hiểu bài toán
        prompt += `BƯỚC 1: HIỂU BÀI TOÁN
Tiêu chí xem câu trả lời "đủ" ở bước 1:
✅ ĐỦ nếu: Bạn đã nêu rõ cả hai điều này (CÓ THỂ NÊUỞ CÁC CÂU TRẢ LỜI KHÁC NHAU, KHÔNG NHẤT THIẾT PHẢI TRONG MỘT CÂU):
   1. Dữ kiện (thông tin đã cho): Tất cả các số liệu, sự kiện được nêu trong bài toán - PHẢI KHỚP ĐÚNG BÀI TOÁN
   2. Yêu cầu (cần tìm cái gì): Cái mà bài toán yêu cầu tính hoặc tìm
   
   LƯU Ý: Nếu học sinh đã nêu một phần dữ kiện ở câu trả lời trước và phần còn lại ở câu này → VẪN ĐƯỢC TÍNH LÀ ĐỦ

❌ CHƯA ĐỦ nếu: 
   - Toàn bộ lịch sử các câu trả lời vẫn thiếu dữ kiện hoặc yêu cầu
   - Hoặc dữ kiện bạn nêu KHÔNG KHỚP với bài toán gốc (sai con số, sai thông tin)

HÀNH ĐỘNG:
- Nếu TẤT CẢ CÁC DỮ KIỆN ĐÚNG và KHỚP BÀI TOÁN (có thể nêu rải rác qua nhiều câu) VÀ YÊUBCẦU ĐÃ XÁC ĐỊNH:
  * Khen ngợi cụ thể: "Tuyệt! Bạn đã xác định đúng dữ kiện"
  * Nhắc lại yêu cầu: "Và bài toán yêu cầu chúng ta [YÊU CẦU TỪ BÀI TOÁN]"
  * Tự nhiên chuyển sang câu hỏi tiếp theo (KHÔNG cần nêu "BƯỚC 2"):
  * Nêu 1 câu hỏi về kế hoạch giải (ví dụ: "Vậy để giải quyết bài toán này, bạn cần dùng phép tính nào?")

- Nếu DỮ KIỆN KHÔNG KHỚP hoặc SAI (không khớp bài toán gốc):
  * Gently point out: "Hình như bạn đọc lại bài toán một chút xem sao! Con số '...' không khớp với bài toán gốc."
  * Đặt 1 câu hỏi: "Bạn thử đọc lại bài toán gốc và bổ sung/sửa lại dữ kiện nhé?"

- Nếu toàn bộ các câu trả lời CHƯA CHỨA ĐỦ DỮ KIỆN hoặc CHƯA CÓ YÊU CẦU:
  * Đặt 1 câu hỏi gợi ý để bạn phát hiện điều còn thiếu
  * KHÔNG nêu ví dụ cụ thể, chỉ dẫn dắt: "Bạn thấy bài toán đã cho những thông tin nào? Và bài toán yêu cầu chúng ta tìm cái gì?"

NHẮC NHỨ: CHỈ HỎI 1 CÂU DUY NHẤT!`;
        break;

      case 2: // Lập kế hoạch
        prompt += `BƯỚC 2: LẬP KẾ HOẠCH GIẢI
Tiêu chí xem câu trả lời "đủ" ở bước 2:
✅ ĐỦ nếu: Bạn đã nêu ĐỦ phép tính/chiến lược cần làm:
   - Bạn nêu rõ phép toán cần sử dụng (cộng, trừ, nhân, chia) và các con số liên quan
   - Bạn giải thích tại sao phải dùng phép tính đó

❌ CHƯA ĐỦ nếu: 
   - Bạn chưa nêu rõ phép tính cần làm
   - Hoặc bạn đã tính toán cụ thể rồi (đó là Bước 3, chưa phải Bước 2)

HÀNH ĐỘNG:
- Nếu câu trả lời CÓ CHỨA KẾ HOẠCH RÕ (phép tính/chiến lược rõ ràng):
  * Khen ngợi: "Rất tốt! Bạn đã xác định đúng kế hoạch"
  * Tự nhiên chuyển sang câu hỏi tiếp theo (KHÔNG cần nêu "BƯỚC 3"):
  * Yêu cầu bạn thực hiện: "Vậy bạn hãy tính kết quả nhé!"

- Nếu câu trả lời CHƯA CHỨA KẾ HOẠCH RÕ:
  * Đặt 1 câu hỏi gợi ý để bạn tự nêu phép tính
  * Hỏi: "Để giải quyết bài toán này, bạn cần dùng phép tính nào?"

NHẮC NHỨ: CHỈ HỎI 1 CÂU DUY NHẤT! Đừng tính hộ!`;
        break;

      case 3: // Thực hiện kế hoạch
        prompt += `BƯỚC 3: THỰC HIỆN KẾ HOẠCH - **KIỂM TRA TÍNH CHÍNH XÁC CẬN THẬN**
Tiêu chí xem câu trả lời "đủ" ở bước 3:
✅ ĐỦ nếu: Bạn đã tính toàn bộ ĐÚNG:
   - Kết quả cuối cùng đúng (có hoặc không có đơn vị)
   - Trình bày phép tính rõ ràng (từng bước nếu có nhiều phép tính)
   - QUAN TRỌNG: Toàn bộ các phép tính của bài toán đã xong (nếu có nhiều phép tính khác nhau)

❌ CHƯA ĐỦ nếu: 
   - Bạn chỉ tính được một phần (còn phép tính khác chưa tính, hoặc chưa hoàn thành toàn bộ)
   - **Kết quả tính CÓ SAI LẦM hoặc KHÔNG CHÍNH XÁC**

⚠️ **YÊU CẦU KIỂM TRA CHẶT CHẼ:**
- **LUÔN LUÔN xác minh lại phép tính của bạn trước**
- **Nếu phép tính SAI: KHÔNG khen ngợi, KHÔNG chuyển bước, CHỈ hỏi gợi ý để bạn sửa**
- **KHÔNG BAO GIỜ khen ngợi hoặc chuyển bước nếu phép tính sai**
- VÍ DỤ SAI: Học sinh nói "3 × 2,5 = 7,6" → **PHẢI hỏi "bạn kiểm tra lại: 3 × 2,5 = bao nhiêu?" (KHÔNG nói đúng, KHÔNG chuyển bước, chỉ gợi ý sửa)**

HÀNH ĐỘNG:
- Nếu tính toàn bộ ĐÚNG và ĐÃ HOÀN THÀNH tất cả phép tính của bài toán:
  * Khen ngợi: "Chính xác rồi!"
  * **BẮTBUỘC: PHẢI ĐẶT NGAY 1 CÂU HỎI KIỂM TRA HOẶC MỞ RỘNG** (ví dụ: "Hãy kiểm tra xem kết quả của bạn có hợp lý không?" hoặc "Bạn có thể giải bài toán này bằng cách khác không?")
  * KHÔNG được kết thúc response mà không có câu hỏi

- Nếu tính đúng NHƯNG còn phép tính khác trong bài toán:
  * Khen ngợi: "Chính xác rồi!"
  * KHÔNG chuyển Bước 4 ngay
  * Thay vào đó, hỏi CỤ THỂ về phép tính tiếp theo:
    - Nếu thấy nhiều giá tiền riêng lẻ → "Vậy bây giờ bạn cần cộng tất cả các khoản này lại để được tổng chi phí, phép cộng sẽ là gì?"
    - Nếu thấy cần so sánh → "Vậy bạn cần so sánh hai khoản tiền này để biết cái nào rẻ hơn, bạn sẽ làm phép tính nào?"
    - Hoặc hỏi chung theo bài toán → "Bây giờ để hoàn thành bài toán, bạn còn cần tính gì tiếp theo để tìm ra [YÊU CẦU TỪ BÀI TOÁN]?"

- **Nếu có SAI hoặc CHƯA HOÀN THÀNH:**
  * **KHÔNG nói đáp án đúng**
  * **KHÔNG khen ngợi**
  * Gợi ý nhẹ: "Kết quả này có vẻ cần kiểm tra lại xem sao"
  * Đặt 1 câu hỏi gợi ý: "Bạn thử tính lại xem sao?" hoặc "Bạn thử kiểm tra lại phép tính của mình?"
  * **KHÔNG chuyển bước, HÃY STẢ ở bước 3**

NHẮC NHỞ: CHỈ HỎI 1 CÂU DUY NHẤT! Không tính hộ!`;
        break;

      case 4: // Kiểm tra & mở rộng
        prompt += `BƯỚC 4: KIỂM TRA & MỞ RỘNG - **BỘC CUỐI CÙNG**
Tiêu chí xem câu trả lời "đủ" ở bước 4:
✅ ĐỦ nếu: Bạn đã trả lời 1 trong 2 câu hỏi:
   - Kiểm tra: Bạn giải thích tại sao kết quả hợp lý với dữ kiện bài toán, hoặc xác nhận kết quả là đúng
   - Hoặc Mở rộng: Bạn nêu được cách giải khác hoặc bài toán tương tự

❌CHƯA ĐỦ nếu: Bạn chưa trả lời hoặc trả lời không rõ ràng

**HÀNH ĐỘNG BẮTBUỘC:**
- Nếu bạn CHƯA TRẢ LỜI hoặc trả lời không rõ:
  * Đặt đúng 1 CÂU HỎI gợi ý cho Bước 4
  * Ví dụ: "Hãy kiểm tra xem kết quả của bạn có hợp lý không?"
  * Hoặc: "Bạn có cách nào khác để giải bài toán này không?"
  * ⚠️ KHÔNG được hỏi thêm, KHÔNG được tính toán, KHÔNG được đề cập bài khác

- Nếu bạn TRẢ LỜI ĐÚNG (nhất là có từ "đúng rồi", "hợp lý", "chính xác", "khớp", "đồng ý", v.v.):
  * BẮTBUỘC PHẢI VIẾT ĐÚNG DÒng sau:
  * "Tuyệt vời! Bạn đã hoàn thành đầy đủ 4 bước"
  * Nêu 1 đánh giá tổng thể (Cần cố gắng / Đạt / Tốt) 
  * **VIẾT CHÍNH XÁC MESSAGE NÀY: "Chúc mừng bạn đã **HOÀN THÀNH BÀI TOÁN**! 🎉"**
  * ⚠️ **TẠM BIỆT NGAY - KHÔNG HỎI NÀO THÊM - KHÔNG ĐỀ NGHỊ BÀI KHÁC - BÀI TẬP KẾT THÚC**

**CẢO BÁO QUAN TRỌNG:**
- BỰC 4 LÀ BỰC CUỐI CÙNG - Khi bạn hoàn thành, bài tập PHẢI KẾT THÚC NGAY
- KHÔNG ĐƯỢC hỏi "Bạn còn muốn...", "Làm bài khác không?", hoặc bất kỳ câu hỏi nào sau completion
- CHỈ CÓ 2 TRƯỜNG HỢP: Hoặc hỏi câu kiểm tra (nếu chưa hoàn) hoặc kết thúc bài (nếu hoàn)
- Nếu bạn viết bất kỳ điều gì sau MESSAGE HOÀN THÀNH, bạn đang vi phạm quy tắc`;
        break;

      default:
        prompt += 'Vui lòng hỗ trợ bạn theo bước hiện tại.';
        break;
    }

    return prompt;
  }

  // Lấy gợi ý khi bạn gặp khó khăn
  async getHint() {
    if (!this.chat) {
      throw new Error("Chưa khởi tạo bài toán.");
    }

    const hintPrompt = `Bạn đang gặp khó khăn ở BƯỚC ${this.currentStep}.
Hãy đưa ra 1 gợi ý NHẸ NHÀNG (KHÔNG giải hộ, KHÔNG đưa đáp án).
Chỉ gợi ý hướng suy nghĩ hoặc 1 câu hỏi dẫn dắt ngắn gọn.`;

    try {
      const result = await this.chat.sendMessage(hintPrompt);
      return result.response.text();
    } catch (error) {
      
      // Kiểm tra nếu là lỗi 429 (quota exceeded)
      const isQuotaError = error.message?.includes("429") || 
                           error.message?.includes("quota") ||
                           error.message?.includes("exceeded");
      
      if (isQuotaError) {
        // Force mark key as exhausted và rotate
        apiKeyManager.markKeyAsExhausted(error);
        const hasRotated = apiKeyManager.rotateToNextKey();
        
        if (!hasRotated) {
          throw new Error("Tất cả API keys đã hết quota");
        }
        
        // Recreate chat với key mới
        const newGeminiInstance = new GoogleGenerativeAI(apiKeyManager.getCurrentKey());
        const newModel = newGeminiInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        this.chat = newModel.startChat({
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });
        
        // Retry với chat mới
        const result = await this.chat.sendMessage(hintPrompt);
        return result.response.text();
      } else {
        // Với lỗi khác, thử fallback model
        const newModel = geminiModelManager.getNextAvailableModel();
        if (!newModel) {
          throw error;
        }
        
        this.chat = newModel.startChat({
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });
        
        const result = await this.chat.sendMessage(hintPrompt);
        return result.response.text();
      }
    }
  }

  // Chuyển sang bước tiếp theo
  moveToNextStep() {
    if (this.currentStep < 4) {
      this.currentStep++;
      return true;
    }
    return false;
  }

  // Lấy tên bước hiện tại
  _getStepName(step) {
    const stepNames = {
      1: "Hiểu bài toán",
      2: "Lập kế hoạch giải",
      3: "Thực hiện kế hoạch",
      4: "Kiểm tra & mở rộng"
    };
    return stepNames[step] || "";
  }

  // Đánh giá mức độ cho từng bước
  evaluateStep(step, level) {
    const stepKey = `step${step}`;
    this.stepEvaluations[stepKey] = level; // 'need_effort', 'pass', 'good'
  }

  // Lấy tổng kết đánh giá
  getSummary() {
    return {
      problem: this.currentProblem,
      evaluations: this.stepEvaluations,
      responses: this.studentResponses,
      currentStep: this.currentStep
    };
  }

  /**
   * Đánh giá năng lực giải quyết vấn đề toán học dựa trên Khung đánh giá
   * Input: studentAnswers, questions (với explanation), frameworkText (nội dung khung đánh giá)
   * Output: JSON với per-question comments và competence assessment (TC1, TC2, TC3)
   */
  /**
   * Evaluate question comments only (for displaying feedback to student)
   * Lightweight version - no competence assessment
   * @param {Array} studentAnswers - Array of answers
   * @param {Array} questions - Array of question objects
   * @returns {Object} - { questionComments: [...] }
   */
  async evaluateQuestionComments(studentAnswers, questions) {
    try {
      // Chuẩn bị dữ liệu câu hỏi kèm giải thích cho AI
      const questionsContext = questions.map((q, idx) => ({
        questionNum: idx + 1,
        text: q.text || q.question,
        options: q.options || [],
        studentAnswerIndex: studentAnswers[idx]?.answer,
        isCorrect: studentAnswers[idx]?.isCorrect,
        explanation: q.explanation || 'Không có giải thích'
      }));

      const prompt = `Bạn là giáo viên toán lớp 5 có kinh nghiệm trong việc cung cấp phản hồi chi tiết và khích lệ cho học sinh.

## Dữ liệu học sinh:
${JSON.stringify(questionsContext, null, 2)}

## Nhiệm vụ:
Viết TỪ NĂM ĐẾN NỬA NĂM LỜI NHẬN XÉT CHI TIẾT cho mỗi câu hỏi. Nhận xét phải:
- Chỉ rõ học sinh làm đúng/sai điểm nào cụ thể
- Giải thích TẠI SAO câu trả lời đó đúng hoặc sai
- Đưa ra gợi ý xây dựng nếu học sinh trả lời sai
- Khích lệ và chia sẻ những điểm tốt của học sinh
- Tránh để nhận xét quá chung chung

## QUY TẮC NGÔN NGỮ TIẾNG VIỆT:
- LƯU Ý: Dùng "bạn", "mình", hoặc tên gọi thân thiết - KHÔNG dùng "em", "học sinh"
- Ví dụ: "Bạn trả lời rất tốt, bạn đã xác định đúng..."
- Viết trang trọng nhưng thân thiện, gần gũi

## Định dạng JSON (PHẢI ĐÚNG):
{
  "questionComments": [
    {
      "questionNum": 1,
      "comment": "Nhận xét CHI TIẾT dài 5-8 câu (80-150 từ), giải thích rõ ràng vì sao đúng/sai, nêu gợi ý nếu cần"
    }
  ]
}`;

      const result = await this._rateLimitedGenerate(prompt);
      const responseText = result ? result.response.text() : '';

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      const assessment = JSON.parse(jsonMatch[0]);
      return assessment.questionComments || [];
    } catch (error) {
      return []; // Return empty array on error
    }
  }

  /**
   * Evaluate competency using structured rubric (4 criteria: TC1-TC4)
   * @param {Array} studentAnswers - Array of answers
   * @param {Array} questions - Array of question objects
   * @returns {Object} - Competency evaluation with TC1-TC4 scores
   */
  async evaluateCompetencyFramework(studentAnswers, questions) {
    try {
      // Import service for competency evaluation prompt generation
      
      // Build problem statement from questions and context
      let problemStatement = '';
      if (questions && questions.length > 0) {
        // Get the exercise context if available
        const firstQuestion = questions[0];
        if (firstQuestion.exerciseContext) {
          problemStatement += `BÀI TOÁN:\n${firstQuestion.exerciseContext}\n\n`;
        }
        
        // Add all questions
        problemStatement += 'CÁC CÂU HỎI:\n';
        questions.forEach((q, idx) => {
          problemStatement += `${idx + 1}. ${q.text || q.question || 'Câu hỏi không rõ'}\n`;
          if (q.options && q.options.length > 0) {
            q.options.forEach((opt, optIdx) => {
              problemStatement += `   ${String.fromCharCode(65 + optIdx)}. ${opt}\n`;
            });
          }
        });
      } else {
        problemStatement = 'Không có thông tin bài toán';
      }

      // Build student responses from answers
      const studentResponses = studentAnswers.map((answer, idx) => {
        const question = questions[idx];
        if (!question) return `Câu ${idx + 1}: Không có thông tin`;
        
        const questionText = question.text || question.question || 'Câu hỏi không rõ';
        
        if (!answer) {
          return `Câu ${idx + 1} (${questionText}): Không trả lời`;
        }
        
        let responseText = `Câu ${idx + 1} (${questionText}): `;
        
        if (Array.isArray(answer.answer)) {
          // Multiple choice answers
          const optionLetters = answer.answer.map(o => String.fromCharCode(65 + o));
          responseText += optionLetters.join(', ');
          if (question.options && answer.answer.length > 0) {
            const selectedOptions = answer.answer.map(o => question.options[o]);
            responseText += ` (${selectedOptions.join(', ')})`;
          }
        } else if (answer.answer !== null && answer.answer !== undefined) {
          // Single choice answer
          const optionLetter = String.fromCharCode(65 + answer.answer);
          const optionText = question.options?.[answer.answer] || 'Lựa chọn không xác định';
          responseText += `${optionLetter} (${optionText})`;
        } else {
          responseText += 'Không trả lời';
        }
        
        // Add correctness info if available
        if (answer.isCorrect !== undefined) {
          responseText += answer.isCorrect ? ' ✓ [Đúng]' : ' ✗ [Sai]';
        }
        
        return responseText;
      });



      // Generate the prompt for competency evaluation
      const prompt = competencyEvaluationService.generateCompetencyEvaluationPrompt(
        studentResponses,
        problemStatement
      );

      // Call Gemini API with key rotation for quota resilience
      const result = await this._rateLimitedGenerate(prompt);
      const responseText = result ? result.response.text() : '';

      // Parse the JSON response and translate to Vietnamese
      const competencyEvaluation = competencyEvaluationService.parseCompetencyEvaluation(responseText);
      
      return competencyEvaluation;
    } catch (error) {
      // Return empty evaluation on error so as not to block submission
      return competencyEvaluationService.createEmptyEvaluation();
    }
  }

  /**
   * Tạo bài toán luyện tập dựa trên bài khởi động tương ứng
   * @param {string} startupProblem1 - Bài 1 phần khởi động
   * @param {string} startupProblem2 - Bài 2 phần khởi động
   * @param {string} context - Bối cảnh/dạng toán
   * @param {number} problemNumber - Số thứ tự bài luyện tập (1 hoặc 2)
   * @returns {Promise<string>} - Bài toán luyện tập
   */

  /**
   * Rate‑limited wrapper around geminiModelManager.generateContent
   * - forces sequential processing via internal promise chain
   * - waits 2s after each call
   * - on 429 errors pauses 10s and retries once
   * - returns null on permanent failure (caller should fallback)
   */
  async _rateLimitedGenerate(prompt) {
    // enqueue
    this._pending = this._pending.then(async () => {
      try {
        const res = await geminiModelManager.generateContent(prompt);
        // always delay 2s before allowing next request
        await delay(2000);
        return res;
      } catch (err) {
        const is429 = err.status === 429 || (err.message && err.message.includes('429')) || (err.message && err.message.toLowerCase().includes('rate limit'));
        if (is429) {
          // first pause and retry once
          await delay(10000);
          try {
            const res2 = await geminiModelManager.generateContent(prompt);
            await delay(2000);
            return res2;
          } catch (err2) {
            console.warn('Second attempt failed for prompt, returning null', err2);
            await delay(2000);
            return null;
          }
        }
        // rethrow other errors so callers can catch
        throw err;
      }
    });
    return this._pending;
  }

  async generateSimilarProblem(startupProblem1, startupProblem2, context = '', problemNumber = 1, startupPercentage = 100) {
    try {
      
      let referenceProblem = '';
      let difficultyGuidance = '';
      let topicFocus = '';
      
      // normalize percentage
      const pct = typeof startupPercentage === 'number' ? startupPercentage : parseFloat(startupPercentage) || 0;

      if (problemNumber === 1) {
        referenceProblem = startupProblem1;
        // bài 1 luôn giữ hướng dẫn dễ như trước, không phụ thuộc vào điểm
        difficultyGuidance = `
MỨC ĐỘ CỦA BÀI 1 LUYỆN TẬP:
- Phải là MỨC ĐỘ DỄ, ĐƠN GIẢN, CHỈ CẦN 1-2 PHÉP TÍNH
- Ít dữ kiện, bối cảnh đơn giản không có điều kiện phức tạp
- Số lượng dữ kiện tương tự bài khởi động nhưng con số nhỏ hơn để dễ tính
- Đây là bài để học sinh luyện tập đầu tiên, phải cơ bản và dễ hiểu`;
      } else if (problemNumber === 2) {
        referenceProblem = startupProblem2;
        // điều chỉnh mức độ theo phần trăm kết quả khởi động
        if (pct < 50) {
          difficultyGuidance = `
MỨC ĐỘ DỄ: Chỉ dùng đúng 1 bước tính. Lời văn trực diện, cho sẵn mọi dữ kiện, không có dữ kiện thừa.`;
        } else if (pct >= 50 && pct < 80) {
          difficultyGuidance = `
MỨC ĐỘ VỪA: Cần 2 bước tính. Học sinh phải tính một đại lượng trung gian trước.`;
        } else {
          difficultyGuidance = `
MỨC ĐỘ KHÓ: Cần 3 bước tính trở lên hoặc dùng tư duy NGƯỢC (cho kết quả, tìm thành phần ban đầu). BẮT BUỘC chèn thêm 1 dữ kiện thừa để thử thách.`;
        }
      }
      
      // Nếu có context (chủ đề), sử dụng để nhấn mạnh
      if (context) {
        topicFocus = `
**NHẤN MẠNH CHỦ ĐỀ CHÍNH "${context}":
- Bài toán PHẢI tập trung vào "${context}" là nội dung chính
- Không được để "${context}" chỉ là chi tiết phụ
- Ví dụ: Nếu chủ đề "Nhân số thập phân", bài toán PHẢI CÓ NHIỀU phép nhân số thập phân làm nội dung chính`;
      }
      
      const prompt = `Bạn là giáo viên toán lớp 5 chuyên tạo bài tập luyện tập có chất lượng cao.

BÀI KHỞI ĐỘNG (MẪU):
${referenceProblem}

${context ? `CHỦ ĐỀ BÀI TẬP:
${context}
` : ''}

NHIỆM VỤ:
Tạo BÀI ${problemNumber} LUYỆN TẬP dựa vào bài khởi động trên:
${difficultyGuidance}
${topicFocus}

YÊU CẦU TỐI QUAN TRỌNG:

1. ✅ PHẢI SỬ DỤNG KỸ NĂNG TOÁN HỌC CỦA CHỦ ĐỀ:
   - Bài toán PHẢI chứa kỹ năng chính của chủ đề, không phải chỉ số tự nhiên đơn giản
   - Nếu chủ đề "Nhân số thập phân" → PHẢI có phép NHÂN với số thập phân (0,5 | 1,2 | 2,5 | v.v.)
   - Nếu chủ đề "Chia số thập phân" → PHẢI có phép CHIA liên quan số thập phân
   - Nếu chủ đề "Cộng/Trừ số thập phân" → PHẢI có CỘNG/TRỪ số thập phân
   - Nếu chủ đề "Phân số" → PHẢI có phép tính với phân số
   - Nếu chủ đề "Độ dài/Khối lượng" → PHẢI có phép tính so sánh, cộng trừ các đơn vị này
   
   ❌ SAI VÍ DỤ: Chủ đề "Nhân số thập phân" nhưng bài là "Bạn An có 4 hộp bút, mỗi hộp 6 cây" (chỉ 4 × 6 = số tự nhiên)
   ✅ ĐÚNG VÍ DỤ: Chủ đề "Nhân số thập phân" và bài là "Bạn An mua 2,5 m vải, giá 42 nghìn/m" (có 2,5 × 42)

2. ✅ TẬP TRUNG VÀO CHỦ ĐỀ CHÍNH:
   - Bài toán phải xoay quanh "${context || 'kỹ năng chính của bài khởi động'}" - đó phải là phần khó và quan trọng
   - KHÔNG để chủ đề chính chỉ là chi tiết phụ

3. ✅ LOẠI BỎ HOÀN TOÀN PHẦN TRĂM (%):
   - KHÔNG được dùng phần trăm (học sinh lớp 5 chưa học)
   - KHÔNG dùng "giảm 20%", "tăng 15%", "được hưởng 10%"
   - KHÔNG dùng khái niệm phức tạp: lợi nhuận, lãi suất, tỉ lệ, tỷ số

4. ✅ ĐỘ KHÓ PHẢI VỪA PHẢI CHO LỚP 5:
   - Sử dụng số tự nhiên hoặc số thập phân đơn giản (max 2 chữ số thập phân)
   - Tất cả phép tính phải là: cộng, trừ, nhân, chia cơ bản
   - KHÔNG có khái niệm nâng cao hay phức tạp
   - Con số nên hợp lý với thực tế lớp 5

5. ✅ CHỈ MỘT CÂU HỎI CUỐI:
   - Bài toán kết thúc bằng 1 câu hỏi duy nhất
   - ĐÚNG: "Tổng số mét vải cần mua là bao nhiêu?"
   - SAI: "Vậy tổng tiền là bao nhiêu? Còn lại bao nhiêu tiền?"

6. ✅ THAY ĐỔI BỐI CẢNH:
   - Tên nhân vật khác, tình huống khác
   - Nhưng cấu trúc, phép tính, SỐ THẬP PHÂN và cấp độ khó GIỮA NGUYÊN

7. ✅ ĐỀ SÁNG TẠO NHƯNG RÕ RÀNG:
   - Bài toán nên dựa trên tình huống thực tế quen thuộc của học sinh lớp 5
   - Viết dưới dạng câu chuyện bình thường, dễ tưởng tượng, dài 2-4 dòng
   - Không có cụm từ phức tạp hay khó hiểu

VÍ DỤ THAM KHẢO:

NHÂN SỐ THẬP PHÂN:
- Bài khởi động: "Mẹ mua 3 m vải, mỗi m giá 12,5 nghìn đồng. Hỏi mẹ phải trả bao nhiêu tiền?"
- BÀI LUYỆN TẬP (Bài 1 - dễ): "Bạn Hân mua 2 cuốn sách, mỗi cuốn giá 35,5 nghìn đồng. Hỏi Hân phải trả bao nhiêu tiền?"
  → ĐÚNG: 2 × 35,5 = 71 (có số thập phân + phép nhân)
- BÀI LUYỆN TẬP (Bài 2 - vừa): "Mẹ mua 2,5 kg táo giá 42 nghìn đồng/kg. Hỏi mẹ phải trả bao nhiêu tiền?"
  → ĐÚNG: 2,5 × 42 = 105 (có số thập phân + phép nhân)

CHIA SỐ THẬP PHÂN:
- Bài khởi động: "Có 10 lít nước chia đều vào 4 chai. Hỏi mỗi chai có bao nhiêu lít?"
- BÀI LUYỆN TẬP (Bài 1 - dễ): "Có 9 lít nước chia đều vào 4 chai. Hỏi mỗi chai có bao nhiêu lít?"
  → ĐÚNG: 9 ÷ 4 = 2,25 lít (kết quả là số thập phân)
- BÀI LUYỆN TẬP (Bài 2 - vừa): "Có 12,5 kg gạo chia đều cho 5 gia đình. Hỏi mỗi gia đình được bao nhiêu kg?"
  → ĐÚNG: 12,5 ÷ 5 = 2,5 kg (có số thập phân + phép chia)

PHÂN SỐ:
- Bài khởi động: "Mẹ có 3/4 lít sữa, chia đều cho 2 con. Hỏi mỗi con được bao nhiêu lít?"
- BÀI LUYỆN TẬP (Bài 1 - dễ): "Bạn Hà có 1/2 kg kẹo, chia đều cho 3 bạn. Hỏi mỗi bạn được bao nhiêu kg?"
  → ĐÚNG: 1/2 ÷ 3 hoặc so sánh phân số (có phân số)
- BÀI LUYỆN TẬP (Bài 2 - vừa): "Bạn Minh tiêu 2/5 tiền tiết kiệm, còn 3/5 để mua sách. Nếu tiêu thêm 1/5 nữa, còn bao nhiêu?"
  → ĐÚNG: 3/5 - 1/5 (có phép cộng/trừ phân số)

ĐO LƯỜNG (Độ dài, Khối lượng, Dung tích):
- Bài khởi động: "Bạn An có 2,5 m vải, bạn Bình có 1,5 m. Hỏi cả hai có tất cả bao nhiêu m vải?"
- BÀI LUYỆN TẬP (Bài 1 - dễ): "Cái túi nặng 0,5 kg, quyển sách nặng 1,2 kg. Hỏi cả hai nặng bao nhiêu kg?"
  → ĐÚNG: 0,5 + 1,2 (có đơn vị đo + phép tính)
- BÀI LUYỆN TẬP (Bài 2 - vừa): "Thùng A chứa 5,5 lít nước, thùng B chứa 3,2 lít. Hỏi thùng A chứa nhiều hơn B bao nhiêu lít?"
  → ĐÚNG: 5,5 - 3,2 (có đơn vị + phép tính so sánh)

HƯỚNG DẪN TRẢ LỜI:
- CHỈ trả về nội dung bài toán (không có "Bài toán mới:", "BÀI X LUYỆN TẬP:", không có lời giải)
- KHÔNG bao gồm header "BÀI 1 LUYỆN TẬP", "BÀI 2 LUYỆN TẬP", "Chủ đề bài thi:", v.v.
- Bài toán phải là một đoạn văn liền mạch, tự nhiên, kết thúc bằng CHÍNH XÁC 1 CÂU HỎI duy nhất
- KHÔNG có câu hỏi phụ hay bổ sung thêm

ĐỊNH DẠNG YÊU CẦU:
[Bối cảnh/Câu chuyện 2-4 dòng]
[Câu hỏi duy nhất]

VÍ DỤ:
SAI: "BÀI 2 LUYỆN TẬP Chủ đề bài thi: Nhân số thập phân Chị Lan... 1. Diện tích là bao nhiêu? 2. Để tính tiền, cần biết điều gì?"
ĐÚNG: "Chị Lan đang cắt miếng gỗ có kích thước 0,75 m × 0,4 m để làm khung tấm thảm. Hỏi diện tích miếng gỗ đó là bao nhiêu mét vuông?"

⚠️ KIỂM TRA CUỐI CÙNG:
- Bài toán có sử dụng KỸ NĂNG của chủ đề không?
- Bài toán chỉ có ĐÚNG 1 CÂU HỎI cuối cùng không?
- Ví dụ:
  • Chủ đề "Nhân số thập phân" mà bài chỉ có 4 × 6 → SAI (không có số thập phân)
  • Chủ đề "Phân số" mà bài chỉ có 4 + 3 → SAI (không có phân số)
  • Chủ đề "Đo lường" mà bài chỉ có 2 + 3 → SAI (không có đơn vị đo)
  • Bài có 2 câu hỏi → SAI (phải chỉ 1 câu)
- Nếu bài toán không đạt yêu cầu → BÀI SAI, phải viết lại

Bài toán luyện tập:`;

      // Sử dụng wrapper để rate-limit
      const result = await this._rateLimitedGenerate(prompt);
      let similarProblem = result ? result.response.text().trim() : '';

      
      // 🔧 POST-PROCESSING: Loại bỏ các header không mong muốn
      // Loại bỏ "BÀI X LUYỆN TẬP" header
      similarProblem = similarProblem.replace(/^BÀI\s+[12]\s+LUYỆN\s*TẬP[\s\n]*/i, '');
      
      // Loại bỏ "Chủ đề bài thi:" lines
      similarProblem = similarProblem.replace(/^Chủ\s+đề\s+bài\s+thi:\s*[^\n]*[\n]*/i, '');
      
      // 🔧 Nếu có format "1. ... 2. ..." - giữ lại từ phần text của bài toán
      // Tìm dòng bắt đầu bằng "1. " hoặc "2. " (những câu hỏi)
      const lines = similarProblem.split('\n');
      let lastContentLineIndex = -1;
      let questionCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Kiểm tra nếu dòng này là một câu hỏi (bắt đầu bằng con số là câu hỏi)
        const isQuestionLine = /^[1-9]\.\s+/.test(line);
        
        if (line && !isQuestionLine) {
          // Đây là dòng nội dung
          lastContentLineIndex = i;
        } else if (isQuestionLine) {
          // Đây là dòng câu hỏi
          questionCount++;
          if (questionCount === 1) {
            // Giữ lại câu hỏi đầu tiên
            lastContentLineIndex = i;
          }
        }
      }
      
      // Nếu có nhiều hơn 1 câu hỏi, chỉ giữ phần đến câu hỏi đầu tiên
      if (questionCount > 1 && lastContentLineIndex >= 0) {
        const cleanedLines = lines.slice(0, lastContentLineIndex + 1);
        similarProblem = cleanedLines.join('\n').trim();
      }
      
      // Nếu không có bất kỳ câu hỏi nào (không có số thứ tự), giữ nguyên
      if (questionCount === 0) {
        similarProblem = lines.join('\n').trim();
      }
      
      return similarProblem;
    } catch (error) {
      // Safety fallback: If API fails (429, timeout, etc.), return the original problem text
      console.warn('⚠️ generateSimilarProblem failed, returning original problem:', error.message);
      return startupProblem1 || startupProblem2 || 'Hãy giải bài toán này một cách từng bước theo 4 bước Polya.';
    }
  }

  /**
   * Tạo bài toán Vận dụng được cá nhân hóa dựa trên các lỗi từ Khởi động và yếu điểm từ Luyện tập
   * @param {Object} studentContext - Dữ liệu ngữ cảnh của học sinh:
   *   - errorsInKhoiDong: Array<string> - Các lỗi từ phần Khởi động
   *   - weaknessesInLuyenTap: Object - Đánh giá từ 2 bài Luyện tập (TC1-TC4 điểm thấp)
   *   - topicName: string - Tên chủ đề bài thi
   * @returns {Promise<string>} - Đề bài vận dụng
   */
  async generateApplicationProblem(studentContext) {
    try {
      const { errorsInKhoiDong = [], weaknessesInLuyenTap = {}, topicName = 'Bài toán', practicePercentage = 100 } = studentContext;
      
      // Xây dựng danh sách yếu điểm từ các tiêu chí
      let weaknessText = '';
      if (weaknessesInLuyenTap.TC1?.diem !== undefined) {
        if (weaknessesInLuyenTap.TC1.diem < 2) weaknessText += `- Yếu ở khía cạnh nhận biết vấn đề\n`;
      }
      if (weaknessesInLuyenTap.TC2?.diem !== undefined) {
        if (weaknessesInLuyenTap.TC2.diem < 2) weaknessText += `- Yếu ở khía cạnh nêu cách giải quyết\n`;
      }
      if (weaknessesInLuyenTap.TC3?.diem !== undefined) {
        if (weaknessesInLuyenTap.TC3.diem < 2) weaknessText += `- Yếu ở khía cạnh thực hiện các bước giải\n`;
      }
      if (weaknessesInLuyenTap.TC4?.diem !== undefined) {
        if (weaknessesInLuyenTap.TC4.diem < 2) weaknessText += `- Yếu ở khía cạnh kiểm tra lại kết quả\n`;
      }

      // xác định hướng dẫn mức độ theo phần trăm luyện tập
      let difficultyGuidance = '';
      const pct = typeof practicePercentage === 'number' ? practicePercentage : parseFloat(practicePercentage) || 0;
      if (pct < 50) {
        difficultyGuidance = `MỨC ĐỘ DỄ: Chỉ dùng đúng 1 bước tính. Lời văn trực diện, cho sẵn mọi dữ kiện, không có dữ kiện thừa.`;
      } else if (pct >= 50 && pct < 80) {
        difficultyGuidance = `MỨC ĐỘ VỪA: Cần 2 bước tính. Học sinh phải tính một đại lượng trung gian trước.`;
      } else {
        difficultyGuidance = `MỨC ĐỘ KHÓ: Cần 3 bước tính trở lên hoặc dùng tư duy NGƯỢC (cho kết quả, tìm thành phần ban đầu). BẮT BUỘC chèn thêm 1 dữ kiện thừa để thử thách.`;
      }

      const prompt = `Bạn là giáo viên toán lớp 5 tâm huyết, chuyên tạo bài tập vận dụng vừa đủ khó để giúp học sinh nhận biết được các lỗi sai nhưng vẫn trong tầm cơ bản.

HỒSƠ NĂNG LỰC HỌC SINH:
Chủ đề: ${topicName}

${errorsInKhoiDong.length > 0 ? `Những lỗi mắc phải ở phần Khởi động (trắc nghiệm):
${errorsInKhoiDong.map((e, i) => `${i + 1}. ${e}`).join('\n')}

` : ''}${weaknessText ? `Những điểm yếu khi giải toán Polya ở phần Luyện tập:
${weaknessText}\n` : ''}

NHIỆM VỤ:
${difficultyGuidance}
Tạo 1 BÀI TOÁN VẬN DỤNG (Real-world Application Problem) phù hợp với học sinh lớp 5 để giúp khắc phục những yếu điểm trên.
**QUAN TRỌNG NHẤT: Bài toán PHẢI TẬP TRUNG VÀO CHỦĐỀ CHÍNH "${topicName}" - đó phải là phần chính và khó nhất của bài toán, không phải chỉ là phần phụ.**

YÊU CẦU TỐI QUAN TRỌNG:
1. ✅ MỨC ĐỘ PHẢI DỄ VÀ PHÁT TRIỂN CHỦ ĐỀ:
   - Bài toán nên dựa trên một tình huống thực tế quen thuộc của học sinh lớp 5 (gia đình, nhà trường, chợ, cửa hàng, dã ngoại...)
   - KHÔNG dùng phần trăm (%), vì bạn chưa được học
   - KHÔNG dùng khái niệm phức tạp (lợi nhuận, lãi suất, tỉ lệ, tỷ số...)
   - Bài toán nên CÓ 2-3 dữ kiện để cần phân tích, nhưng không quá nhiều
   - Phép tính cơ bản như: cộng, trừ, nhân, chia, số thập phân đơn giản
   
2. ✅ CHỦ ĐỀ PHẢI LÀ TRUNG TÂM CỦA BÀI TOÁN:
   - Nếu chủ đề là "Nhân số thập phân": Bài toán PHẢI CÓ NHIỀU phép nhân số thập phân làm nội dung chính. Ví dụ: "Mẹ mua 2,5 kg táo giá 35.500 đồng/kg. Bố mua 1,5 lít nước cam giá 18.000 đồng/lít. Hỏi tổng tiền mua là bao nhiêu?"
   - Nếu chủ đề là "Chia số thập phân": Bài toán PHẢI làm nổi bật phép chia. Ví dụ: "Có 7,5 lít sữa chia đều vào các chai 1,5 lít. Hỏi cần bao nhiêu chai?"
   - Nếu chủ đề liên quan "Cộng/Trừ số thập phân": Bài toán PHẢI có nhiều phép cộng/trừ với số thập phân
   
3. ✅ CHỈ MỘT CÂU HỎI CUỐI (không phải 2-3 câu)

4. ✅ ĐỂ ĐỌC DỄ HIỂU: Viết dưới dạng câu chuyện bình thường, dễ tưởng tượng

VÍ DỤ CHO CHỦ ĐỀ "NHÂN SỐ THẬP PHÂN":
"Gia đình bạn An đi siêu thị chuẩn bị cho buổi dã ngoại. Bố mua 3 kg táo, mỗi kilogam giá 35.500 đồng. Mẹ mua 2,5 lít nước cam ép, mỗi lít giá 18.000 đồng. An còn xin mua thêm 4 gói bánh quy, mỗi gói giá 12.750 đồng. Hỏi nếu bố An mang theo 220.000 đồng, thì gia đình còn lại bao nhiêu tiền sau khi mua sắm?"

VÍ DỤ CHO CHỦĐỀ "CHIA SỐ THẬP PHÂN":
"Cô giáo có 12,5 lít nước khoáng để chia đều cho các bạn học sinh trong lớp. Mỗi bạn được 0,5 lít. Hỏi lớp đó có bao nhiêu bạn học sinh?"

HƯỚNG DẪN TRẢ LỜI:
- CHỈ trả về nội dung bài toán (không có "Bài toán mới:", không có lời giải, không có gợi ý)
- Bài toán phải là một đoạn văn liền mạch, tự nhiên, dài 3-5 dòng
- CHẮC CHẮN bài toán tập trung vào chủ đề "${topicName}"

Bài toán vận dụng:`;

      // Sử dụng rate-limited wrapper
      const result = await this._rateLimitedGenerate(prompt);
      const applicationProblem = result ? result.response.text().trim() : '';
      return applicationProblem;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Đánh giá bài làm của học sinh theo khung năng lực 4 tiêu chí (TC1-TC4)
   * Mỗi TC tối đa 2 điểm, tổng tối đa 8 điểm
   * @param {Array} chatHistory - Lịch sử hội thoại giữa AI và học sinh
   * @param {string} problem - Nội dung bài toán
   * @returns {Promise<Object>} - Đánh giá chi tiết theo rubric
   */
  async evaluatePolyaStep(chatHistory, problem) {
    try {
      
      // Định dạng chatHistory để gửi cho Gemini
      let chatText = `BÀI TOÁN: ${problem}\n\n`;
      chatText += `LỊCH SỬ HỘI THOẠI:\n`;
      
      if (!chatHistory || chatHistory.length === 0) {
        chatText += '(Không có lịch sử hội thoại)';
      } else {
        chatHistory.forEach((msg, idx) => {
          const sender = msg.role === 'user' ? 'HỌC SINH' : 'AI';
          const text = msg.parts?.[0]?.text || msg.text || '';
          chatText += `${sender}: ${text}\n`;
        });
      }

      const evaluationPrompt = `Bạn là giáo viên toán lớp 5 có kinh nghiệm đánh giá năng lực giải quyết vấn đề toán học theo khung quy chuẩn.

${chatText}

NHIỆM VỤ: Dựa trên lịch sử hội thoại trên, đánh giá chi tiết năng lực học sinh theo 4 TIÊU CHÍ.

**TC1. NHẬN BIẾT ĐƯỢC VẤN ĐỀ CẦN GIẢI QUYẾT (Max 2 điểm)**
Mục tiêu: Xác định xem học sinh đã xác định đầy đủ dữ kiện, yêu cầu bài toán và mối liên hệ chưa?
- 0 điểm: Không xác định được đầy đủ thông tin, cần nhiều gợi ý từ trợ lí AI
- 1 điểm: Xác định được phần lớn dữ kiện và yêu cầu, nhưng có thể bỏ sót 1-2 chi tiết, cần gợi ý
- 2 điểm: Xác định chính xác toàn bộ dữ kiện, yêu cầu, và hiểu rõ mối quan hệ giữa chúng

**TC2. NÊU ĐƯỢC CÁCH THỨC GIẢI QUYẾT VẤN ĐỀ (Max 2 điểm)**
Mục tiêu: Đánh giá việc nhận dạng dạng toán, đề xuất phương pháp và chọn phép toán phù hợp
- 0 điểm: Không nhận dạng được dạng toán hoặc đề xuất phương pháp sai, không chọn được phép toán phù hợp
- 1 điểm: Nhận dạng được dạng toán cơ bản, chọn được phép toán phù hợp nhưng cần gợi ý
- 2 điểm: Nhận dạng đúng dạng toán, đề xuất được cách giải hợp lý, lựa chọn phép toán tối ưu

**TC3. TRÌNH BÀY ĐƯỢC CÁCH THỨC GIẢI QUYẾT (Max 2 điểm)**
Mục tiêu: Đánh giá tính chính xác của các phép tính, bước giải, và sự rõ ràng của trình bày
- 0 điểm: Các phép tính hay bước giải còn sai, lời giải không đầy đủ hoặc không logic
- 1 điểm: Thực hiện đúng các bước giải cơ bản, phép tính chủ yếu đúng, trình bày khá đầy đủ
- 2 điểm: Thực hiện đúng toàn bộ phép tính, trình bày lời giải logic, rõ ràng, dễ hiểu

**TC4. KIỂM TRA ĐƯỢC GIẢI PHÁP ĐÃ THỰC HIỆN (Max 2 điểm)**
Mục tiêu: Đánh giá việc kiểm tra lại kết quả và vận dụng vào các tình huống khác
- 0 điểm: Không kiểm tra lại kết quả, không điều chỉnh hoặc không vận dụng được
- 1 điểm: Kiểm tra lại kết quả, có điều chỉnh khi cần nhưng còn cần gợi ý; vận dụng có hạn
- 2 điểm: Kiểm tra lại kết quả bằng nhiều cách, vận dụng được vào bài toán tương tự hoặc nâng cao

HƯỚNG DẪN VIẾT NHẬN XÉT:
- Cho MỖI tiêu chí (TC1-4): Viết 10-12 câu nhận xét RẤT CHI TIẾT, CỤ THỂ, DÀI(cần phải chi tiết để giúp học sinh hiểu)
  * **ĐIỂM MẠNH**: Nêu rõ và CHỈ TỊ CỤ THỂ những gì học sinh làm ĐÚNG (ghi cụ thể hành động, hiểu biết, ví dụ cụ thể từ lịch sử chat)
  * **ĐIỂM YẾU/CÒNG HẠN**: Nêu rõ những điểm CHƯA TỐT hay SAI LẦM (nếu có) - ghi cụ thể những gì còn thiếu, chưa đầy đủ, hoặc sai lầm
  * **GIẢI THÍCH**: Giải thích TẠI SAO điều đó đúng/sai dựa vào khung lý thuyết và lịch sử hội thoại
  * **GỢI Ý CẢI THIỆN**: Nêu gợi ý cụ thể để cải thiện (nên làm thế nào khác, học sinh nên tập trung vào cái gì)
  * **ĐỘNG VIÊN**: Thêm lời khích lệ phù hợp với thành quả học sinh
  * Tránh nhận xét chung chung, phải dựa vào lịch sử hội thoại và dữ kiện cụ thể

- NHẬN XÉT TỔNG THỂ (tongNhanXet): Viết 10-12 câu TỔNG HỢP (DÀI, CHI TIẾT)
  * Nêu rõ 2-3 ĐIỂM MẠNH chính (những gì làm rất tốt, nên tiếp tục giữ)
  * Nêu rõ 2-3 ĐIỂM YẾU CẦN CẢI THIỆN chính (những gì còn hạn chế, cần phát triển)
  * Nêu 2-3 GỢI Ý HƯỚNG PHÁT TRIỂN cụ thể (học sinh nên tập trung vào cái gì trước, làm thế nào)
  * Lời khích lệ, động viên, và tạo động lực cho học sinh

ĐỊNH DẠNG JSON (PHẢI ĐÚNG):
{
  "TC1": {
    "nhanXet": "Nhận xét RẤT CHI TIẾT 10-12 câu (150-200 từ) về nhận biết vấn đề. GỒM: (1) Điểm mạnh cụ thể - học sinh xác định được cái gì (2) Điểm yếu/còn hạn - chưa xác định cái gì, thiếu cái gì (3) Tại sao điều đó quan trọng (4) Gợi ý cải thiện cụ thể (5) Lời động viên",
    "diem": 0
  },
  "TC2": {
    "nhanXet": "Nhận xét RẤT CHI TIẾT 10-12 câu (150-200 từ) về cách thức giải quyết. GỒM: (1) Điểm mạnh cụ thể - chọn phép toán đúng/đề xuất cách giải tối ưu (2) Điểm yếu - không nhận dạng dạng toán/chọn sai phép toán (3) Tại sao lựa chọn đó đúng/sai (4) Gợi ý cải thiện cụ thể (5) Động viên",
    "diem": 0
  },
  "TC3": {
    "nhanXet": "Nhận xét RẤT CHI TIẾT 10-12 câu (150-200 từ) về trình bày giải quyết. GỒM: (1) Điểm mạnh cụ thể - bước tính đúng, trình bày rõ (2) Điểm yếu - bước tính sai, trình bày không rõ, bỏ sót bước (3) Tại sao phép tính đó đúng/sai (4) Gợi ý cải thiện cách trình bày (5) Động viên",
    "diem": 0
  },
  "TC4": {
    "nhanXet": "Nhận xét RẤT CHI TIẾT 10-12 câu (150-200 từ) về kiểm tra và vận dụng. GỒM: (1) Điểm mạnh cụ thể - kiểm tra được gì, vận dụng được gì (2) Điểm yếu - chưa kiểm tra/vận dụng (3) Tại sao kiểm tra/vận dụng quan trọng (4) Gợi ý cải thiện cụ thể - cách kiểm tra, vận dụng thế nào (5) Động viên",
    "diem": 0
  },
  "tongNhanXet": "Nhận xét TỔNG THỂ 10-12 câu (200-250 từ) gồm: (1) 2-3 ĐIỂM MẠNH cụ thể (2) 2-3 ĐIỂM YẾU/CẦN CẢI THIỆN cụ thể (3) 2-3 GỢI Ý HƯỚNG PHÁT TRIỂN cụ thể cho từng khía cạnh (4) Lời khích lệ, động viên học sinh",
  "tongDiem": 0,
  "mucDoChinh": "Cần cố gắng"
}`;

      // Sử dụng generateContent từ geminiModelManager
      const result = await this._rateLimitedGenerate(evaluationPrompt);
      const responseText = result.response.text().trim();
      
      // Parse JSON từ response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse evaluation response');
      }
      
      const evaluation = JSON.parse(jsonMatch[0]);
      
      // Validate structure và fill missing fields
      const validatedEval = {
        TC1: evaluation.TC1 || { nhanXet: 'Chưa đánh giá', diem: 0 },
        TC2: evaluation.TC2 || { nhanXet: 'Chưa đánh giá', diem: 0 },
        TC3: evaluation.TC3 || { nhanXet: 'Chưa đánh giá', diem: 0 },
        TC4: evaluation.TC4 || { nhanXet: 'Chưa đánh giá', diem: 0 },
        tongNhanXet: evaluation.tongNhanXet || 'Lỗi khi đánh giá',
        tongDiem: evaluation.tongDiem || 0,
        // Tính mucDoChinh từ tongDiem thay vì lấy từ Gemini response
        mucDoChinh: this._calculateMucDoChinh(evaluation.tongDiem || 0)
      };
      
      return validatedEval;
    } catch (error) {
      // Return default evaluation on error
      return {
        TC1: { nhanXet: 'Không thể đánh giá - Vui lòng thử lại', diem: 0 },
        TC2: { nhanXet: 'Không thể đánh giá - Vui lòng thử lại', diem: 0 },
        TC3: { nhanXet: 'Không thể đánh giá - Vui lòng thử lại', diem: 0 },
        TC4: { nhanXet: 'Không thể đánh giá - Vui lòng thử lại', diem: 0 },
        tongNhanXet: `Lỗi: ${error.message}. Vui lòng tải lại trang hoặc liên hệ hỗ trợ.`,
        tongDiem: 0,
        mucDoChinh: 'Cần cố gắng'
      };
    }
  }

  /**
   * Tạo overallAssessment từ TC1-4 nhận xét
   * @param {Object} evaluation - Evaluation object with TC1-4
   * @returns {Object} - Overall assessment with strengths, weaknesses, areas to improve, recommendations
   */
  async generateOverallAssessment(evaluation) {
    try {
      const tc1Comment = evaluation.TC1?.nhanXet || '';
      const tc2Comment = evaluation.TC2?.nhanXet || '';
      const tc3Comment = evaluation.TC3?.nhanXet || '';
      const tc4Comment = evaluation.TC4?.nhanXet || '';
      const totalComment = evaluation.tongNhanXet || '';

      const prompt = `Dựa vào nhận xét chi tiết từ 4 tiêu chí đánh giá năng lực sau:

TC1 (Nhận biết vấn đề): ${tc1Comment}

TC2 (Nêu cách giải): ${tc2Comment}

TC3 (Trình bày giải): ${tc3Comment}

TC4 (Kiểm tra và vận dụng): ${tc4Comment}

NHẬN XÉT TỔNG THỂ: ${totalComment}

}`;

      const result = await this._rateLimitedGenerate(prompt);
      const responseText = result ? result.response.text().trim() : '';

      // Parse JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          strengths: ['Không thể tạo đánh giá chi tiết'],
          weaknesses: ['Vui lòng tải lại trang'],
          recommendations: ['Liên hệ hỗ trợ'],
          encouragement: 'Hãy cố gắng thêm, bạn sẽ thành công!'
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        recommendations: parsed.recommendations || [],
        encouragement: parsed.encouragement || 'Bạn đang trên đúng con đường!'
      };
    } catch (error) {
      return {
        strengths: ['Không thể tạo đánh giá chi tiết'],
        weaknesses: ['Vui lòng tải lại trang'],
        recommendations: ['Liên hệ hỗ trợ'],
        encouragement: 'Hãy cố gắng thêm, bạn sẽ thành công!'
      };
    }
  }

  /**
   * Tạo đề thi tương đương từ sampleExam của chủ đề
   * @param {string} topicName - Tên chủ đề (vd: "Phép nhân số thập phân")
   * @param {Array|Object} sampleExam - Mẫu đề (cấu trúc exercises array hoặc JSON string)
   * @returns {Promise<Array>} - Mảng exercises tương tự với sampleExam
   */
  async generateExamFromSampleExam(topicName, lessonName, sampleExams) {
    try {
      // Handle sampleExams - could be array of objects or a single object
      let sampleStructure = sampleExams;
      
      // If it's a single SampleExam object with content, use the content
      if (sampleExams && !Array.isArray(sampleExams) && sampleExams.content) {
        sampleStructure = sampleExams.content;
      }
      
      // Parse sampleExam nếu là string
      if (typeof sampleStructure === 'string') {
        try {
          sampleStructure = JSON.parse(sampleStructure);
        } catch (e) {
          throw new Error('Định dạng sampleExam không hợp lệ');
        }
      }

      if (!Array.isArray(sampleStructure)) {
        throw new Error('sampleExam phải là array trong cấu trúc exercises');
      }

      // Xây dựng prompt để AI tạo đề tương đương
      const sampleSummary = sampleStructure.map((ex, idx) => `
Bài tập ${idx + 1}: "${ex.name}"
- Thời gian: ${ex.duration}s
- Số câu hỏi: ${ex.questions?.length || 0}
- Độ khó: ${ex.questions?.length > 5 ? 'Khó' : ex.questions?.length > 2 ? 'Vừa' : 'Dễ'}
`).join('\n');

      // Xác định loại chủ đề để áp dụng prompt cụ thể
      const topicNameLower = topicName.toLowerCase();
      let topicSpecificGuide = '';

      if (topicNameLower.includes('tỉ số') && topicNameLower.includes('bài toán')) {
        // Chủ đề: Tỉ số và các bài toán liên quan
        topicSpecificGuide = `
**HƯỚNG DẪN ĐẶC THỨ CHO CHỦĐỀ: TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN**

✅ LOẠI BÀI TOÁN:
- Dạng 1: Tỉ số, tỉ số phần trăm cơ bản (không có % ký hiệu)
- Dạng 2: Tìm hai số khi biết Tổng và Tỉ số
- Dạng 3: Tìm hai số khi biết Hiệu và Tỉ số
- Dạng 4: Tỉ lệ bản đồ

✅ BÀI TẬP 1 - TỐI ĐA 5 CÂUHỎI, DÙNG TỈ SỐ (KHÔNG %):
- Context: Bài toán có 2 đại lượng, tỉ số giữa chúng (ví dụ: A = 2/4 B)
- VÍ DỤ: "Lớp 5C có 72 cuốn sách từ hai nhóm. Số sách nhóm A bằng 2/4 số sách nhóm B."
- Câu hỏi:
  * Xác định dạng bài toán (là dạng "Tổng và Tỉ")
  * Xác định tổng số phần bằng nhau
  * Tìm số lượng mỗi phần
  * Tìm mỗi số
  * Kiểm tra lại (tổng/hiệu có hợp lý)
- **QUAN TRỌNG**: KHÔNG có ký hiệu %, không hỏi phần trăm

✅ BÀI TẬP 2 - 4-6 CÂU HỎI, TUÂN THEO 4 BƯỚC POLYA:
Context: Bài toán phức tạp với tình huống thực tế
- BƯỚC 1 (Hiểu): Hỏi xác định dữ kiện, tỉ số, yêu cầu
- BƯỚC 2 (Kế hoạch): Hỏi cách giải, số phần bằng nhau, phép tính
- BƯỚC 3 (Thực hiện): Hỏi các bước tính toán chi tiết
- BƯỚC 4 (Kiểm tra): Hỏi kiểm tra, so sánh, kết luận
- **KHÔNG hiển thị "[BƯỚC X]" trong questions**
- **SỬ DỤNG DỮ LIỆU CHÍNH XÁC TỪ CONTEXT**

✅ VÍ DỤ CONTEXT BÀI TẬP 2:
"Khối 5 có 96 học sinh. Số HS đội trang trí bằng 5/3 số HS đội dọn dẹp. Sau khi chuyển 6 bạn từ đội trang trí sang dọn dẹp, hỏi phương án nào có sự chênh lệch ít hơn?"

✅ VÍ DỤ CÂU HỎI BÀI TẬP 2 (KHÔNG "[BƯỚC X]"):
Q1: "Tổng số phần bằng nhau là bao nhiêu?" → 5 + 3 = 8
Q2: "Số HS đội trang trí là bao nhiêu?" → 96 : 8 × 5 = 60
Q3: "Số HS đội dọn dẹp là bao nhiêu?" → 96 : 8 × 3 = 36
Q4: "Sau khi chuyển 6 bạn, đội trang trí còn bao nhiêu?" → 60 - 6 = 54
Q5: "Sau chuyển, đội dọn dẹp có bao nhiêu?" → 36 + 6 = 42
Q6: "Chênh lệch hiện tại là bao nhiêu?" → 54 - 42 = 12
`;
      } else if (topicNameLower.includes('thể tích') && topicNameLower.includes('đơn vị')) {
        // Chủ đề: Thể tích. Đơn vị đo thể tích
        topicSpecificGuide = `
**HƯỚNG DẪN ĐẶC THỨ CHO CHỦĐỀ: THỂ TÍCH - ĐƠN VỊ ĐO THỂ TÍCH**

✅ NỘI DUNG:
- Tính thể tích hình hộp chữ nhật: V = dài × rộng × cao
- Tính thể tích hình lập phương: V = cạnh × cạnh × cạnh
- Chuyển đổi đơn vị: cm³, dm³, m³ (1 m³ = 1000 dm³, 1 dm³ = 1000 cm³)
- So sánh thể tích của các hộp, bể nước

✅ BÀI TẬP 1 - 5 CÂU HỎI (TỐI ĐA):
Context: Bài toán yêu cầu tính thể tích hoặc so sánh
- VÍ DỤ: "Bể nước dài 40 cm, rộng 25 cm, cao 15 cm. Xe bồn chở 2,4 m³ nước. Bể có dung tích 2500 dm³. Hỏi xe có đủ nước?"
- Câu hỏi:
  * Xác định dạng bài (tính thể tích, so sánh hay chuyển đơn vị)
  * Chuyển đổi đơn vị nếu cần
  * Áp dụng công thức thích hợp
  * Tính toán
  * Kết luận hợp lý
- **KHÔNG có phần trăm (%)**
- **KHÔNG nhầm lẫn giữa cm³ với cm, dm³ với dm**

✅ BÀI TẬP 2 - 4-5 CÂU HỎI, TUÂN THEO 4 BƯỚC POLYA:
Context: Bài toán thực tế phức tạp (ví dụ: 3 hộp xếp chồng, bể nước dâng, v.v.)
- BƯỚC 1: Xác định kích thước, công thức cần dùng
- BƯỚC 2: Lập kế hoạch (chọn công thức, tính toán gì trước)
- BƯỚC 3: Thực hiện tính (bước tính chi tiết)
- BƯỚC 4: Kiểm tra kết quả (hợp lý không, có cách nào khác)
- **KHÔNG hiển thị "[BƯỚC X]" trong questions**

✅ VÍ DỤ BÀI TẬP 2:
Context: "3 hộp lập phương cạnh 10 cm được xếp chồng thành hình hộp chữ nhật. Hỏi tiết kiệm bao nhiêu cm² giấy gói?"
Q1: "Diện tích toàn phần 1 hộp là bao nhiêu cm²?" → 10 × 10 × 6 = 600
Q2: "Gói riêng 3 hộp cần bao nhiêu cm² giấy?" → 600 × 3 = 1800
Q3: "Khi xếp chồng, khối mới có kích thước nào?" → 10 × 10 × 30 cm
Q4: "Diện tích toàn phần khối mới?" → (10×10)×2 + (10×30)×4 = 1400
Q5: "Tiết kiệm được bao nhiêu cm²?" → 1800 - 1400 = 400
`;
      } else if ((topicNameLower.includes('diện tích') && topicNameLower.includes('thể tích')) || 
                 (topicNameLower.includes('hình khối'))) {
        // Chủ đề: Diện tích và Thể tích của một số hình khối
        topicSpecificGuide = `
**HƯỚNG DẪN ĐẶC THỨ CHO CHỦĐỀ: DIỆN TÍCH VÀ THỂ TÍCH CỦA HỈ HÌNH KHỐI**

✅ NỘI DUNG:
- Diện tích xung quanh hình hộp chữ nhật: (dài + rộng) × 2 × cao
- Diện tích toàn phần hình hộp: diện tích xung quanh + 2 × (dài × rộng)
- Diện tích xung quanh hình lập phương: cạnh × cạnh × 4
- Diện tích toàn phần hình lập phương: cạnh × cạnh × 6
- Thể tích hình hộp chữ nhật: dài × rộng × cao
- Thể tích hình lập phương: cạnh × cạnh × cạnh

✅ BÀI TẬP 1 - 5 CÂU HỎI:
Context: Bài toán yêu cầu tính diện tích xung quanh hoặc toàn phần
- VÍ DỤ: "Hộp quà hình lập phương cạnh 10 cm. Cần bao nhiêu cm² giấy để bọc kín?"
- Câu hỏi:
  * Xác định loại diện tích (xung quanh hay toàn phần)
  * Chọn công thức đúng
  * Tính diện tích 1 mặt hoặc xung quanh
  * Tính diện tích toàn phần
  * Kiểm tra: 1 hộp = 6 mặt, hình lập phương mặt vuông bằng nhau
- **PHẢI phân biệt rõ giữa diện tích (cm²) và thể tích (cm³)**
- **KHÔNG nhầm lẫn xung quanh với toàn phần**

✅ BÀI TẬP 2 - 4-6 CÂU HỎI, TUÂN THEO 4 BƯỚC POLYA:
Context: Bài toán kết hợp cả diện tích và thể tích hoặc so sánh
- BƯỚC 1: Xác định hình dạng, kích thước, cái cần tìm
- BƯỚC 2: Lập kế hoạch (diện tích hay thể tích, công thức nào)
- BƯỚC 3: Thực hiện tính từng bước
- BƯỚC 4: Kiểm tra kết quả, ý nghĩa thực tiễn
- **KHÔNG hiển thị "[BƯỚC X]" trong questions**

✅ VÍ DỤ BÀI TẬP 2:
Context: "Minh làm 3 hộp lập phương cạnh 10 cm. Để gói riêng, cần 1800 cm² giấy. Nếu gói chung (xếp chồng), cần 1400 cm² giấy. Hỏi tiết kiệm bao nhiêu?"
Q1: "Hình gói riêng: mỗi hộp là hình gì?" → Lập phương
Q2: "Diện tích toàn phần 1 hộp = 10×10×6 = bao nhiêu?" → 600 cm²
Q3: "Gói riêng 3 hộp = 600 × 3 = bao nhiêu?" → 1800 cm²
Q4: "Hình gói chung: 3 hộp xếp chồng tạo thành hình gì?" → Hộp chữ nhật (10×10×30 cm)
Q5: "Diện tích toàn phần khối mới?" → 1400 cm²
Q6: "Tiết kiệm được bao nhiêu cm²?" → 1800 - 1400 = 400 cm²
`;
      }

      const prompt = `Bạn là chuyên gia tạo đề thi toán lớp 5. Dựa vào TEMPLATE EXAM dưới đây, hãy TẠO MỘT ĐỀ THI TƯƠNG ĐƯƠNG cho chủ đề "${topicName}", tiêu đề "${lessonName}".

TEMPLATE EXAM (để làm mẫu):
${sampleSummary}

${topicSpecificGuide}

YÊU CẦU CHUNG CHO TẤT CẢ CHỦĐỀ:
1. ✅ GIỮ NGUYÊN CẤU TRÚC TEMPLATE:
   - Số lượng bài tập, thời gian, số câu hỏi GIỐNG HỆT template
   - Kiểu câu hỏi (single/multiple) giữ nguyên
   - Số đáp án mỗi câu GIỮ NGUYÊN

2. ✅ TẠO NỘI DUNG LIÊN QUAN ĐẾN CHỦĐỀ "${topicName}":
   - Toàn bộ câu hỏi PHẢI liên quan trực tiếp đến chủ đề này
   - Sử dụng tình huống thực tế phù hợp với bối cảnh tiểu học

3. ✅ BÀI TẬP 1 - CÂU HỎI DÙNG DỮ KIỆN CỤ THỂ TỪ CONTEXT:
   - Context phải là bài toán thực tế cụ thể (không chung chung)
   - TẤT CẢ câu hỏi phải sử dụng dữ liệu CHÍNH XÁC từ context
   - Không thêm dữ liệu mới, không làm thay đổi dữ kiện

4. ✅ BÀI TẬP 2 - TUÂN THEO 4 BƯỚC POLYA:
   - BƯỚC 1: Hỏi hiểu dữ kiện, yêu cầu
   - BƯỚC 2: Hỏi cách giải, phép tính cần dùng
   - BƯỚC 3: Hỏi các bước tính toán, kết quả
   - BƯỚC 4: Hỏi kiểm tra kết quả, tính hợp lý
   - **KHÔNG hiển thị "[BƯỚC X]" trong câu hỏi JSON**

5. ✅ RANDOM VỊ TRÍ ĐÁP ÁN ĐÚNG:
   - Đáp án đúng KHÔNG phải lúc nào cũng ở vị trí A
   - Phân bố đáp án đúng ở các vị trí khác nhau

6. ✅ ĐỊNH DẠNG JSON CHÍNH XÁC:
   - Mỗi exercise: name, duration, context, questions, scoring
   - Mỗi question: id, question, type, options, correctAnswers (array indices), explanation
   - Type: "single" hoặc "multiple"
   - correctAnswers: array chỉ số (ví dụ: [1], [0, 2])
   - **KHÔNG CÓ "[BƯỚC X - ...]" TRONG QUESTIONs**

CHỈ RETURN JSON ARRAY, KHÔNG CÓ TEXT KHÁC.`;

      const result = await this._rateLimitedGenerate(prompt);
      const responseText = result ? result.response.text().trim() : '';


      // Parse JSON
      let jsonStr = responseText;
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json[\r\n]?/gi, '').replace(/```[\r\n]?/g, '');
      }
      // Xóa ký tự điều khiển
      // eslint-disable-next-line no-control-regex
      jsonStr = jsonStr.replace(/[\u0000-\u0019]+/g, ' ');

      const exercises = JSON.parse(jsonStr);
      
      if (!Array.isArray(exercises)) {
        throw new Error('Response must be an array of exercises');
      }

      return exercises;
    } catch (error) {
      throw new Error(`Không thể tạo đề từ AI: ${error.message}`);
    }
  }
}

const geminiServiceInstance = new GeminiService();
export default geminiServiceInstance;
