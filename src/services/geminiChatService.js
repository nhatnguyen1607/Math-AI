import geminiModelManager from "./geminiModelManager";
import apiKeyManager from "./apiKeyManager";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

NGUYÊN TẮC KIỂM TRA PHÉP TÍNH & ĐÁP SỐ (QUAN TRỌNG):
- **NHẬN DIỆN & SO SÁNH GIÁ TRỊ TOÁN HỌC:** Trước khi tag, BẮT BUỘC phải quy đổi con số học sinh đưa ra về cùng một giá trị (VD: "một phần hai" → 1/2 → 0,5). CHỈ so sánh giá trị toán học, KHÔNG so sánh cách viết. Nếu 0.5 = 1/2 = 0,50, BẮT BUỘC đánh giá [CORRECT]. Hãy chấm như giáo viên chấm bài viết tay.
- **QUY TẮC KẾT THÚC BÀI:** BÀI TOÁN CHỈ ĐƯỢC COI LÀ HOÀN THÀNH khi học sinh ĐÃ NÓI RA ĐÁP SỐ CUỐI CÙNG chính xác. Tuyệt đối KHÔNG khen hoàn thành hay kết thúc bài nếu học sinh mới chỉ làm xong một bước trung gian.
- **LUÔN LUÔN xác minh kết quả tính toán của bạn trước khi khen ngợi**
- Nếu phép tính SAI: **KHÔNG bao giờ chuyển bước, KHÔNG nói "đúng", KHÔNG khen ngợi**
- Nếu sai: Hỏi "bạn xem lại kết quả này ... được không?", "hãy tính lại một lần nữa"
- **CHỈ khi có đáp số cuối cùng CHÍNH XÁC mới được chuyển sang bước 4**
- VỊ DỤ: Nếu học sinh nói "3 × 2,5 = 7,6" → Hỏi "bạn kiểm tra lại xem: 3 × 2,5 = bao nhiêu?" (KHÔNG nói đúng, KHÔNG khen)
- **NHẮC NHỨ: Mỗi response đều PHẢI có TAG ở đầu**

NGUYÊN TẮC GIAO TIẾP VỚI BẠN:
- **KIỂM TRA TRÙNG LẶP (CHỐNG LẶP GÂY ỨC CHẾ):** Trước mỗi câu hỏi, BẮT BUỘC tự kiểm tra xem có trùng ý câu trước không. Nếu học sinh có tiến triển (dù chưa hoàn chỉnh), TUYỆT ĐỐI KHÔNG hỏi lại câu cũ, phải đổi cách hỏi để thu hẹp suy nghĩ. Nếu nhận ra sắp hỏi lại, PHẢI đổi cách tiếp cận ("Để mình hỏi theo cách khác nhé"). KHÔNG tự động dùng trắc nghiệm nếu không được yêu cầu.
- **CHỐNG HỎI DÔNG DÀI (NO OVER-VERIFICATION):** Nếu học sinh đã trả lời đúng trọng tâm của bước hiện tại (đặc biệt là khi đã ra phép tính và đáp số đúng), BẮT BUỘC PHẢI CHUYỂN BƯỚC NGAY LẬP TỨC. Tuyệt đối KHÔNG hỏi vặn lại những câu như "Vì sao bạn tính như vậy?", "Tại sao lại dùng phép nhân?", "Hãy nhắc lại đáp số...". Học sinh đúng là cho qua ngay!
- **NGUYÊN TẮC NHẬN DIỆN TIẾN ĐỘ (QUAN TRỌNG):** Nếu học sinh đưa ra câu trả lời thuộc về các bước sau (ví dụ: đang ở Bước 1 nhưng học sinh đã tính xong kết quả ở Bước 3), bạn PHẢI công nhận kết quả đó, đánh giá tính chính xác và nhảy thẳng tới Bước 4 (Kiểm tra). 
  TUYỆT ĐỐI KHÔNG hỏi lại những gì học sinh đã làm xong.
- **STEP SKIPPING (NHẢY BƯỚC):** Nếu học sinh nêu ra ĐÁP SỐ CUỐI CÙNG từ bất kỳ bước nào (phát hiện keywords: "đáp số", "kết quả là", "hoàn thành", hoặc học sinh cung cấp một con số cụ thể dường như là đáp án), BẠN PHẢI:
  1. Công nhận và KIỂM TRA TÍNH CHÍNH XÁC của đáp số đó ngay lập tức [CORRECT] hoặc [WRONG]
  2. Nếu CHÍNH XÁC: Nhảy ngay tới Bước 4, đặt câu hỏi kiểm tra nhanh "Bạn thấy kết quả này có hợp lý không?", rồi viết chúc mừng hoàn thành
  3. Nếu SAI: Báo lỗi, gợi ý sửa, KHÔNG chuyển bước
- **ANTI-LOOP RULE (CHỐNG VÒNG LẶP):** Nếu học sinh đã cung cấp đáp số cuối cùng hoặc hoàn thành tính toán trong lịch sử chat, BẠN PHẢI công nhận ngay và nhảy tới Bước 4. TUYỆT ĐỐI KHÔNG yêu cầu học sinh nhắc lại thông tin hoặc giải thích "tại sao" khi câu trả lời đã chính xác. KHÔNG hỏi các câu hỏi mang tính xác minh lại như "Bạn chắc chắn?", "Hãy nhắc lại kết quả".
- KHÔNG BAO GIỜ giải bài toán thay bạn
- KHÔNG đưa ra đáp án dù bạn làm sai
- CHỈ đặt câu hỏi gợi mở, định hướng để bạn tự suy nghĩ
- MỖI LẦN CHỈ HỎI 1 CÂU duy nhất
- Phát hiện lỗi sai của bạn và gợi ý để bạn tự sửa
- Ngôn ngữ thân thiện, dễ thương như người bạn của bạn
- Khi bạn trả lời đúng, khen ngợi cụ thể và hỏi câu tiếp theo
- KHÔNG ghi "BƯỚC 1:", "BƯỚC 2:", v.v. vào câu chat - chỉ đặt câu hỏi một cách tự nhiên

PHÂN BIỆT CÓ-GỢI Ý VÀ LỜI GIẢI (RẤT QUAN TRỌNG - KHI HỌC SINH YÊU CẦU HELP/GỢI Ý):
❌ SAI - ĐỌC RA LỜI GIẢI/ĐÁP ÁN:
  "Phép tính là 3 × 2,5 = 7,5 đó"
  "Bạn cộng cả hai số lại: 100 + 50 = 150"
  "Đáp án là 25 mét"
  "Công thức là: (2,5 + 1,5) × 3 = ..."

✅ ĐÚNG - CHỈ GỢI Ý HƯỚNG SUYN SGHĨ:
  "Bạn thử kiểm tra lại phép tính đó xem"
  "Bạn cần cộng những gì với nhau?"
  "NHỮNG THÔNG TIN NÀO BẠN CÓ CHỈ CẦN CỘNG LẠI?"
  "Phép tính đó, bạn thử tính lại xem sao?"

✅ GỢI Ý-CÂU HỎI ĐÚNG VÍ DỤ:
  - "Bạn thấy bài toán hỏi cái gì?" (Bước 1)
  - "Để so sánh 2 số này, bạn sẽ làm phép tính gì?" (Bước 2)
  - "Phép tính đó bạn kiểm tra lại được không? Kết quả là bao nhiêu?" (Bước 3)
  - "Kết quả này có đúng với dữ kiện bài toán không?" (Bước 4)

NHỮNG GÌ KHÔNG NÊN LÀM:
- **GIỚI HẠN KIẾN THỨC LỚP 5:** CHỈ giải thích theo cách nói miệng cho học sinh lớp 5 hiểu, gắn chặt với con số cụ thể trong đề bài. TUYỆT ĐỐI KHÔNG dùng ký hiệu x, y; KHÔNG lập phương trình hay biểu thức đại số; KHÔNG dùng thuật ngữ trừu tượng cấp THCS.
- Không hỏi "bạn làm đúng không?" → hỏi "vậy tiếp theo là gì?"
- Không nói "sai" trực tiếp → nói "hãy xem lại..."
- Không giải hoặc cho đáp án → chỉ hỏi câu để bạn suy nghĩ lại
- **LUÔN XƯNG HÔ LÀ "BẠN" - KHÔNG ĐƯỢC XƯNG "EM"** ← Điều này bắt buộc phải tuân thủ
- **KHÔNG khen ngợi phép tính sai** - Phải chính xác mới được khen

ĐÁNH GIÁ MỨC ĐỘ:
- Cần cố gắng: Chưa hiểu rõ, nhiều sai sót
- Đạt: Hiểu cơ bản, làm đúng một phần
- Tốt: Hiểu rõ, làm đúng, trình bày tốt`;

/**
 * GeminiChatService
 * Chứa các phương thức tương tác chat AI theo phương pháp Polya
 */
export class GeminiChatService {
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

  /**
   * Rate‑limited wrapper around geminiModelManager.generateContent
   */
  async _rateLimitedGenerate(prompt) {
    this._pending = this._pending.then(async () => {
      try {
        const res = await geminiModelManager.generateContent(prompt);
        await delay(2000);
        return res;
      } catch (err) {
        const is429 = err.status === 429 || (err.message && err.message.includes('429')) || (err.message && err.message.toLowerCase().includes('rate limit'));
        if (is429) {
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
        throw err;
      }
    });
    return this._pending;
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

    // Khôi phục trí nhớ cho AI từ lịch sử chat của Firebase
    const maxRetries = 3;
    let attemptCount = 0;
    let lastError = null;

    while (attemptCount < maxRetries) {
      attemptCount++;
      
      try {
        const initialPrompt = `Đây là bài toán: ${problemText}

Hãy đặt CHỈ 1 câu hỏi gợi mở giúp mình bắt đầu hiểu bài toán này. Câu hỏi nên giúp mình suy nghĩ về dữ kiện đã cho và mục tiêu cần tìm. ĐỂ CÓ SỰ NHẤT QUÁN, CHỈ RETURN DUY NHẤT 1 CÂU HỎI, KHÔNG PHẢI NHIỀU LỰA CHỌN.`;

        const initialResponse = await this._rateLimitedGenerate(initialPrompt);
        let response = initialResponse.response.text();
        
        if (response.includes('\n\n**"') || response.includes('\n\nCâu hỏi')) {
          const lines = response.split('\n');
          response = lines[0];
        }

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
        
        if (!process.env.REACT_APP_GEMINI_API_KEY_1) {
          throw new Error("❌ Chưa cấu hình REACT_APP_GEMINI_API_KEY_1 trong file .env");
        }
        
        const isQuotaError = error.message?.includes("429") || 
                             error.message?.includes("quota") ||
                             error.message?.includes("exceeded");
        
        if (isQuotaError && attemptCount < maxRetries) {
          continue;
        } else if (isQuotaError && attemptCount >= maxRetries) {
          const totalKeys = apiKeyManager.keyConfigs.length;
          throw new Error(`❌ Tất cả ${totalKeys} API keys đã hết quota free tier. Vui lòng chờ cho đến hôm sau hoặc nâng cấp tài khoản Google Cloud.`);
        } else {
          throw error;
        }
      }
    }
    throw new Error(`Không thể khởi tạo bài toán sau ${maxRetries} lần thử. Error: ${lastError?.message || 'Unknown error'}`);
  }

  restoreSession(problemText, chatHistory) {
    this.currentProblem = problemText;
    const model = geminiModelManager.getModel();
    if (model && chatHistory && chatHistory.length > 0) {
      // Đảm bảo phần tử đầu tiên là 'user'
      let fixedHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
      if (fixedHistory.length > 0 && fixedHistory[0].role !== 'user') {
        // Thêm prompt hệ thống làm user đầu tiên
        fixedHistory.unshift({ role: 'user', parts: [{ text: problemText }] });
      }
      this.chat = model.startChat({
        history: fixedHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: msg.parts
        })),
        generationConfig: { temperature: 0.3 }
      });
      // Detect current step from history to prevent restarting at Step 1
      const fullText = fixedHistory.map(m => m.parts[0].text).join(' ');
      if (fullText.includes("BƯỚC 4")) this.currentStep = 4;
      else if (fullText.includes("BƯỚC 3")) this.currentStep = 3;
      else if (fullText.includes("BƯỚC 2")) this.currentStep = 2;
      else this.currentStep = 1;
    }
  }


  // Xử lý phản hồi của học sinh
  async processStudentResponse(studentAnswer) {
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

    let contextPrompt = this._buildContextPrompt(studentAnswer);

    let result;
    try {
      result = await this.chat.sendMessage(contextPrompt);
    } catch (error) {
      if (!process.env.REACT_APP_GEMINI_API_KEY_1) {
        throw new Error("❌ Chưa cấu hình REACT_APP_GEMINI_API_KEY_1 trong file .env");
      }
      
      const isQuotaError = error.message?.includes("429") || 
                           error.message?.includes("quota") ||
                           error.message?.includes("exceeded");
      
      if (isQuotaError) {
        apiKeyManager.markKeyAsExhausted(error);
        const hasRotated = apiKeyManager.rotateToNextKey();
        
        if (!hasRotated) {
          throw new Error("❌ Tất cả API keys đã hết quota. Vui lòng thử lại sau.");
        }
        
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
        
        result = await this.chat.sendMessage(contextPrompt);
      } else {
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
    
    // Parse & Extract STATUS TAG from response
    let robotStatus = 'idle';
    let cleanMessage = response;
    
    if (response.trim().startsWith('[CORRECT]')) {
      robotStatus = 'correct';
      cleanMessage = response.replace(/^\[CORRECT\]\s*/i, '').trim();
    } else if (response.trim().startsWith('[WRONG]')) {
      robotStatus = 'wrong';
      cleanMessage = response.replace(/^\[WRONG\]\s*/i, '').trim();
    } else if (response.trim().startsWith('[IDLE]')) {
      robotStatus = 'idle';
      cleanMessage = response.replace(/^\[IDLE\]\s*/i, '').trim();
    }

    const lowerResponse = cleanMessage.toLowerCase();

    let nextStep = null;
    let evaluation = null;
    
    // **STEP SKIPPING DETECTION:** Check if the student provided a final answer early
    const finalAnswerKeywords = ['đáp số', 'kết quả là', 'hoàn thành', 'đáp án là'];
    const hasFinalAnswer = finalAnswerKeywords.some(keyword => lowerResponse.includes(keyword)) || 
                           (robotStatus === 'correct' && this.currentStep === 3);
    
    // If final answer detected and not yet at Step 4, jump to Step 4
    if (hasFinalAnswer && this.currentStep < 4 && robotStatus === 'correct') {
      nextStep = 4;
      evaluation = this._extractEvaluation(cleanMessage);
      // Mark steps 1-3 as passed since we're jumping to step 4
      for (let i = this.currentStep; i < 4; i++) {
        this.evaluateStep(i, evaluation || 'pass');
      }
      this.currentStep = 4;
    } else if ((lowerResponse.includes("bước 2") || lowerResponse.includes("lập kế hoạch")) && this.currentStep === 1) {
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
      message: cleanMessage,
      step: this.currentStep,
      stepName: this._getStepName(this.currentStep),
      nextStep: nextStep,
      evaluation: evaluation,
      isSessionComplete: this.isSessionComplete,
      robotStatus: robotStatus
    };
  }

  // Extract explicit status tag [CORRECT], [WRONG], or [IDLE] from AI response
  _extractStatusTag(text) {
    if (!text || typeof text !== 'string') {
      return { tag: null, cleanText: text };
    }

    const tagMatch = text.match(/^\[?(CORRECT|WRONG|IDLE)\]?\s*/i);

    if (tagMatch) {
      const tag = tagMatch[1].toUpperCase();
      const cleanText = text.replace(/^\[?(CORRECT|WRONG|IDLE)\]?\s*/i, '').trim();
      
      let robotStatus = null;
      if (tag === 'CORRECT') {
        robotStatus = 'correct';
      } else if (tag === 'WRONG') {
        robotStatus = 'wrong';
      } else if (tag === 'IDLE') {
        robotStatus = 'idle';
      }

      return { tag: robotStatus, cleanText };
    }

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
    return 'pass';
  }

  // Analyze sentiment of AI response for robot state
  _analyzeSentiment(text) {
    if (!text || typeof text !== 'string') return 'idle';

    const { tag, cleanText } = this._extractStatusTag(text);
    if (tag) {
      return tag;
    }

    const lower = cleanText.toLowerCase();

    const wrongKeywords = [
      'chưa đúng', 'sai', 'sai rồi', 'thử lại', 'kiểm tra lại',
      'nhầm', 'nhầm lẫn', 'không chính xác', 'tiếc quá'
    ];
    for (const kw of wrongKeywords) {
      if (lower.includes(kw)) {
        return 'wrong';
      }
    }

    const correctKeywords = [
      'chính xác', 'đúng rồi', 'tuyệt vời', 'xuất sắc', 'làm tốt', 'hoàn thành'
    ];
    for (const kw of correctKeywords) {
      if (lower.includes(kw)) {
        return 'correct';
      }
    }

    return 'idle';
  }

  // Helper: Remove Vietnamese accents for robust regex matching
  _removeAccents(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  // Determine robot sentiment from AI response text
  _determineRobotSentiment(responseText) {
    if (!responseText || typeof responseText !== 'string') return 'idle';
    
    const textLower = responseText.toLowerCase();
    const textClean = this._removeAccents(textLower);

    const wrongPatterns = [
      /chua\s*dung/, /sai\s*roi/, /bi\s*nham/, /kiem\s*tra\s*lai/,
      /thu\s*lai/, /tinh\s*lai/, /chua\s*chinh\s*xac/, /khong\s*dung/,
      /nham\s*lan/, /khong\s*chinh\s*xac/
    ];

    for (const pattern of wrongPatterns) {
      if (pattern.test(textClean)) {
        return 'wrong';
      }
    }

    const correctPatterns = [
      /chinh\s*xac/, /dung\s*roi/, /tuyet\s*voi/, /gioi\s*lam/,
      /xuat\s*sac/, /hoan\s*toan\s*dung/, /ket\s*qua\s*dung/,
      /lam\s*tot/, /hoan\s*thanh/, /dat/, /chuan\s*xac/, /hop\s*ly/
    ];

    for (const pattern of correctPatterns) {
      if (pattern.test(textClean)) {
        return 'correct';
      }
    }

    return 'idle';
  }

  // Gửi câu trả lời của học sinh (giữ để tương thích)
  async sendStudentResponse(studentAnswer) {
    return this.processStudentResponse(studentAnswer);
  }

  // Xây dựng prompt theo từng bước
  _buildContextPrompt(studentAnswer) {
    let conversationContext = '';
    if (this.studentResponses && this.studentResponses.length > 0) {
      conversationContext = 'LỊCH SỬ CÁC CÂU TRẢ LỜI CỦA HỌC SINH:\n';
      this.studentResponses.forEach((response, idx) => {
        conversationContext += `${idx + 1}. "${response.answer}"\n`;
      });
      conversationContext += '\n';
    }

    // Phân tích đề toán để xác định đúng ý nghĩa
    let dePhanTich = this._analyzeProblemStatement(this.currentProblem);

    let prompt = `BÀI TOÁN GỐC:
${this.currentProblem}

PHÂN TÍCH ĐỀ BÀI:
${dePhanTich}

${conversationContext}CÂU TRẢ LỜI HIỆN TẠI:
"${studentAnswer}"\n\n`;

    switch (this.currentStep) {
      case 1:
        prompt += this._getStep1Prompt();
        break;
      case 2:
        prompt += this._getStep2Prompt();
        break;
      case 3:
        prompt += this._getStep3Prompt();
        break;
      case 4:
        prompt += this._getStep4Prompt();
        break;
      default:
        prompt += 'Vui lòng hỗ trợ bạn theo bước hiện tại.';
        break;
    }

    return prompt;
  }

  // Phân tích đề toán: xác định đúng ý nghĩa các từ 'tăng lên thành', 'tăng thêm', 'là'
  _analyzeProblemStatement(problemText) {
    if (!problemText || typeof problemText !== 'string') return '';
    const lower = problemText.toLowerCase();
    let result = '';
    // Tăng lên thành X
    const tangLenThanhMatch = lower.match(/tăng lên thành\s*(\d+)/);
    if (tangLenThanhMatch) {
      result += `Đề bài cho biết tổng mới là ${tangLenThanhMatch[1]} (không phải số tăng thêm).\n`;
    }
    // Tăng X
    const tangThemMatch = lower.match(/tăng\s*(\d+)/);
    if (tangThemMatch && !tangLenThanhMatch) {
      result += `Đề bài cho biết số tăng thêm là ${tangThemMatch[1]} (không phải tổng mới).\n`;
    }
    // Là X
    const laMatch = lower.match(/là\s*(\d+)/);
    if (laMatch) {
      result += `Đề bài cho biết tổng mới là ${laMatch[1]}.\n`;
    }
    // Nếu không match gì đặc biệt
    if (!result) {
      result = 'Đề bài không có từ khóa đặc biệt, hãy đọc kỹ dữ kiện và yêu cầu.';
    }
    return result;
  }

  _getStep1Prompt() {
    return `BƯỚC 1: HIỂU BÀI TOÁN
Tiêu chí xem câu trả lời "đủ" ở bước 1:
HÀNH ĐỘNG:
- Nếu học sinh đã giải ra kết quả cuối cùng hoặc nêu cách giải: Hãy ghi nhận ngay, KIỂM TRA PHÉP TÍNH, và chuyển thẳng tới Bước 4.
- Nếu chỉ nêu đủ dữ kiện: Chuyển Bước 2.
✅ ĐỦ nếu: Bạn đã nêu rõ cả hai điều này:
   1. Dữ kiện (thông tin đã cho): Tất cả các số liệu, sự kiện được nêu trong bài toán
   2. Yêu cầu (cần tìm cái gì): Cái mà bài toán yêu cầu tính hoặc tìm

HÀNH ĐỘNG:
- Nếu TẤT CẢ CÁC DỮ KIỆN ĐÚNG và YÊU CẦU ĐÃ XÁC ĐỊNH:
  * Khen ngợi cụ thể và chuyển sang câu hỏi về kế hoạch giải
- Nếu CHƯA ĐỦ DỮ KIỆN hoặc SAI:
  * Gợi ý nhẹ để bạn bổ sung/sửa

NHẮC NHỨ: CHỈ HỎI 1 CÂU DUY NHẤT!`;
  }

  _getStep2Prompt() {
    return `BƯỚC 2: LẬP KẾ HOẠCH GIẢI
Tiêu chí xem câu trả lời "đủ" ở bước 2:
✅ ĐỦ nếu: Bạn đã nêu ĐỦ phép tính/chiến lược cần làm

HÀNH ĐỘNG:
- Nếu câu trả lời CÓ CHỨA KẾ HOẠCH RÕ:
  * Khen ngợi và yêu cầu bạn thực hiện tính
- Nếu CHƯA CHỨA KẾ HOẠCH RÕ:
  * Đặt câu hỏi gợi ý

NHẮC NHỨ: CHỈ HỎI 1 CÂU DUY NHẤT! Đừng tính hộ!`;
  }

  _getStep3Prompt() {
    return `BƯỚC 3: THỰC HIỆN KẾ HOẠCH - **KIỂM TRA TÍNH CHÍNH XÁC CẨN THẬN**
Tiêu chí xem câu trả lời "đủ" ở bước 3:
✅ ĐỦ nếu: Bạn đã tính toán toàn bộ các bước và TÌM RA ĐÁP SỐ CUỐI CÙNG của bài toán.

⚠️ **YÊU CẦU KIỂM TRA CHẶT CHẼ:**
- **LUÔN LUÔN tự nhẩm lại phép tính của học sinh trước.**
- Nhận diện thông minh: 0.5 = 1/2 = 0,5 là ĐÚNG. KHÔNG bắt lỗi định dạng.
- **Nếu phép tính SAI: Báo [WRONG], KHÔNG khen ngợi, KHÔNG chuyển bước.**

HÀNH ĐỘNG:
- Nếu học sinh mới tính ĐÚNG 1 BƯỚC TRUNG GIAN (chưa ra đáp án cuối):
  * Báo [CORRECT], khen ngợi phép tính đó và hỏi tiếp bước sau.
- CHỈ KHI tính đúng VÀ ĐÃ RA ĐÁP SỐ CUỐI CÙNG:
  * Báo [CORRECT], khen ngợi và ĐẶT NGAY 1 CÂU HỎI KIỂM TRA để chuyển sang Bước 4.
  * 🚫 NGHIÊM CẤM: TUYỆT ĐỐI KHÔNG được hỏi "Tại sao lại dùng phép tính này?", "Vì sao ra kết quả này?", "Why did you use this calculation?". Học sinh đã ra kết quả đúng thì cấm vặn vẹo và yêu cầu giải thích thêm.
- Nếu SAI:
  * Gợi ý nhẹ để bạn tính lại.

NHẮC NHỞ: CHỈ HỎI 1 CÂU DUY NHẤT! Không tính hộ!`;
  }

_getStep4Prompt() {
    return `BƯỚC 4: KIỂM TRA & MỞ RỘNG - **BƯỚC CUỐI CÙNG**
Tiêu chí xem câu trả lời "đủ" ở bước 4:
✅ ĐỦ nếu: Bạn đã trả lời về kiểm tra hoặc mở rộng

**HÀNH ĐỘNG:**
- Nếu CHƯA TRẢ LỜI hoặc không rõ:
  * Đặt 1 câu hỏi gợi ý cho Bước 4 (Ví dụ: "Bạn thấy đáp số này có hợp lý với thực tế không?").
- Nếu TRẢ LỜI ĐÚNG (dù học sinh chỉ đáp ngắn gọn là "có", "hợp lý", "đúng"):
  * VIẾT: "Tuyệt vời! Bạn đã hoàn thành đầy đủ 4 bước"
  * VIẾT: "Chúc mừng bạn đã **HOÀN THÀNH BÀI TOÁN**! 🎉"
  * 🚫 NGHIÊM CẤM: Không được bắt học sinh nhắc lại đáp số. Không hỏi thêm bất cứ câu nào khác. CHỈ CẦN IN RA CÂU CHÚC MỪNG LÀ KẾT THÚC BÀI.

**BƯỚC 4 LÀ BƯỚC CUỐI CÙNG - Khi hoàn thành, bài tập PHẢI KẾT THÚC NGAY**`;
  }

  // Lấy gợi ý khi bạn gặp khó khăn
  async getHint() {
    if (!this.chat) {
      throw new Error("Chưa khởi tạo bài toán.");
    }

    const hintPrompt = `⚠️ HỌC SINH YÊU CẦU GỢI Ý - CHỈNH ĐẠI GỢI Ý THUẦN TÚY

BẠN ĐANG Ở BƯỚC ${this.currentStep} (${this._getStepName(this.currentStep)}).

**QUY TẮC:**
- ✋ TUYỆT ĐỐI KHÔNG GIẢI HỘ HOẶC CHO ĐÁP ÁN
- ✔️ CHỈ ĐƯA GỢI Ý HƯỚNG SUY NGHĨ

**VIẾT GỢI Ý NGAY:**`;

    try {
      const result = await this.chat.sendMessage(hintPrompt);
      return result.response.text();
    } catch (error) {
      const isQuotaError = error.message?.includes("429") || 
                           error.message?.includes("quota") ||
                           error.message?.includes("exceeded");
      
      if (isQuotaError) {
        apiKeyManager.markKeyAsExhausted(error);
        const hasRotated = apiKeyManager.rotateToNextKey();
        
        if (!hasRotated) {
          throw new Error("Tất cả API keys đã hết quota");
        }
        
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
        
        const result = await this.chat.sendMessage(hintPrompt);
        return result.response.text();
      } else {
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
    this.stepEvaluations[stepKey] = level;
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
}

const geminiChatServiceInstance = new GeminiChatService();
export default geminiChatServiceInstance;
