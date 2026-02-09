import geminiModelManager from "./geminiModelManager";
import apiKeyManager from "./apiKeyManager";
import { GoogleGenerativeAI } from "@google/generative-ai";
import competencyEvaluationService from "./competencyEvaluationService";

// System prompt cho AI trợ lý học toán
const SYSTEM_PROMPT = `Mình là trợ lý học tập ảo thân thiện, hỗ trợ bạn lớp 5 giải toán theo 4 bước Polya.

HƯỚNG TRONG NỘI BỘ (Không ghi ra cho bạn thấy):
4 BƯỚC POLYA:
1. HIỂU BÀI TOÁN: Giúp bạn xác định dữ kiện đã cho và yêu cầu bài toán
2. LẬP KẾ HOẠCH: Hỏi bạn nên làm gì, cần phép tính nào (KHÔNG tính cụ thể)
3. THỰC HIỆN: Hỏi bạn tính toán từng bước, kiểm tra lỗi tính toán nếu có
4. KIỂM TRA & MỞ RỘNG: Hỏi bạn liệu kết quả có hợp lý, có cách giải nào khác không

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
        const initialResponse = await geminiModelManager.generateContent(initialPrompt);
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
        console.error(`❌ Lỗi khi khởi tạo bài toán (lần ${attemptCount}/${maxRetries}):`, {
          message: error.message,
          status: error.status,
          code: error.code,
          fullError: error
        });
        
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
          console.error(`❌ Tất cả ${totalKeys} API keys đã hết quota`);
          throw new Error(`❌ Tất cả ${totalKeys} API keys đã hết quota free tier. Vui lòng chờ cho đến hôm sau hoặc nâng cấp tài khoản Google Cloud.`);
        } else {
          // Lỗi khác - không retry, throw ngay
          throw error;
        }
      }
    }

    // Nếu vượt quá số lần retry
    console.error(`❌ Failed after ${maxRetries} retries`);
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
        isSessionComplete: true
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
      console.error("❌ Chi tiết lỗi khi gửi message:", {
        message: error.message,
        status: error.status,
        code: error.code,
        errorCode: error.errorCode,
        fullError: error
      });
      
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
        
        console.warn("🔄 Đã rotate tới API key khác, retry...");
        
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
    
    let response = result.response.text();

    // Phân tích xem AI có muốn chuyển bước không
    let nextStep = null;
    let evaluation = null;

    // Kiểm tra các dấu hiệu chuyển bước trong response (không phân biệt hoa thường)
    const lowerResponse = response.toLowerCase();
    
    
    if ((lowerResponse.includes("bước 2") || lowerResponse.includes("lập kế hoạch")) && this.currentStep === 1) {
      nextStep = 2;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(1, evaluation || 'pass');
      this.currentStep = 2;
    } else if ((lowerResponse.includes("bước 3") || lowerResponse.includes("thực hiện kế hoạch")) && this.currentStep === 2) {
      nextStep = 3;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(2, evaluation || 'pass');
      this.currentStep = 3;
    } else if ((lowerResponse.includes("bước 4") || lowerResponse.includes("kiểm tra & mở rộng") || 
               (lowerResponse.includes("kiểm tra") && this.currentStep === 3) ||
               (lowerResponse.includes("mở rộng") && this.currentStep === 3) ||
               (lowerResponse.includes("cách khác") && this.currentStep === 3) ||
               (lowerResponse.includes("hợp lý") && this.currentStep === 3)) && this.currentStep === 3) {
      nextStep = 4;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(3, evaluation || 'pass');
      this.currentStep = 4;
    } else if ((lowerResponse.includes("hoàn thành") || lowerResponse.includes("hoàn tất") || 
               lowerResponse.includes("🎉") || lowerResponse.includes("chúc mừng") ||
               (lowerResponse.includes("giỏi") && lowerResponse.includes("đầy đủ 4 bước")) ||
               lowerResponse.includes("tuyệt vời") || lowerResponse.includes("chính xác")) && this.currentStep === 4) {
      nextStep = 5; // Đã hoàn thành bước 4, bài toán xong
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(4, evaluation || 'pass');
      this.isSessionComplete = true; // Mark session as complete
    }

    return {
      message: response,
      step: this.currentStep,
      stepName: this._getStepName(this.currentStep),
      nextStep: nextStep,
      evaluation: evaluation,
      isSessionComplete: this.isSessionComplete
    };
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
        prompt += `BƯỚC 3: THỰC HIỆN KẾ HOẠCH
Tiêu chí xem câu trả lời "đủ" ở bước 3:
✅ ĐỦ nếu: Bạn đã tính toàn bộ ĐÚNG:
   - Kết quả cuối cùng đúng (có hoặc không có đơn vị)
   - Trình bày phép tính rõ ràng (từng bước nếu có nhiều phép tính)
   - QUAN TRỌNG: Toàn bộ các phép tính của bài toán đã xong (nếu có nhiều phép tính khác nhau)

❌ CHƯA ĐỦ nếu: 
   - Bạn chỉ tính được một phần (còn phép tính khác chưa tính, hoặc chưa hoàn thành toàn bộ)
   - Kết quả tính có sai lầm

HÀNH ĐỘNG:
- Nếu tính toàn bộ ĐÚNG và ĐÃ HOÀN THÀNH tất cả phép tính của bài toán:
  * Khen ngợi: "Chính xác rồi!"
  * BẮTBUỘC: PHẢI ĐẶT NGAY 1 CÂU HỎI KIỂM TRA HOẶC MỞ RỘNG (ví dụ: "Hãy kiểm tra xem kết quả của bạn có hợp lý không?" hoặc "Bạn có thể giải bài toán này bằng cách khác không?")
  * KHÔNG được kết thúc response mà không có câu hỏi

- Nếu tính đúng NHƯNG còn phép tính khác trong bài toán:
  * Khen ngợi: "Chính xác rồi!"
  * KHÔNG chuyển Bước 4 ngay
  * Thay vào đó, hỏi CỤ THỂ về phép tính tiếp theo:
    - Nếu thấy nhiều giá tiền riêng lẻ → "Vậy bây giờ bạn cần cộng tất cả các khoản này lại để được tổng chi phí, phép cộng sẽ là gì?"
    - Nếu thấy cần so sánh → "Vậy bạn cần so sánh hai khoản tiền này để biết cái nào rẻ hơn, bạn sẽ làm phép tính nào?"
    - Hoặc hỏi chung theo bài toán → "Bây giờ để hoàn thành bài toán, bạn còn cần tính gì tiếp theo để tìm ra [YÊU CẦU TỪ BÀI TOÁN]?"

- Nếu có SAI hoặc CHƯA HOÀN THÀNH:
  * KHÔNG nói đáp án đúng
  * Nhắc nhở: "Kết quả này có vẻ chưa chính xác"
  * Đặt 1 câu hỏi gợi ý: "Bạn thử tính lại xem sao?"

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
      console.error("Error getting hint, attempting recovery:", error);
      
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

      const result = await geminiModelManager.generateContent(prompt);
      const responseText = result.response.text();

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from Gemini');
      }

      const assessment = JSON.parse(jsonMatch[0]);
      return assessment.questionComments || [];
    } catch (error) {
      console.error('Error evaluating question comments:', error);
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
      const result = await geminiModelManager.generateContent(prompt);
      const responseText = result.response.text();

      // Parse the JSON response and translate to Vietnamese
      const competencyEvaluation = competencyEvaluationService.parseCompetencyEvaluation(responseText);
      
      return competencyEvaluation;
    } catch (error) {
      console.error('❌ Error evaluating competency framework:', error);
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
  async generateSimilarProblem(startupProblem1, startupProblem2, context = '', problemNumber = 1) {
    try {
      
      let referenceProblem = '';
      let difficultyGuidance = '';
      let topicFocus = '';
      
      if (problemNumber === 1) {
        referenceProblem = startupProblem1;
        difficultyGuidance = `
MỨC ĐỘ CỦA BÀI 1 LUYỆN TẬP:
- Phải là MỨC ĐỘ DỄ, ĐƠN GIẢN, CHỈ CẦN 1-2 PHÉP TÍNH
- Ít dữ kiện, bối cảnh đơn giản không có điều kiện phức tạp
- Số lượng dữ kiện tương tự bài khởi động nhưng con số nhỏ hơn để dễ tính
- Đây là bài để học sinh luyện tập đầu tiên, phải cơ bản và dễ hiểu`;
      } else if (problemNumber === 2) {
        referenceProblem = startupProblem2;
        difficultyGuidance = `
MỨC ĐỘ CỦA BÀI 2 LUYỆN TẬP:
- Phải có độ khó TƯƠNG ĐƯƠNG với bài 2 khởi động
- Có cùng số lượng dữ kiện và điều kiện giống bài khởi động
- Cùng số lượng phép tính và cấp độ suy luận với bài 2 khởi động
- Bài này giúp học sinh luyện tập sau khi đã hoàn thành bài 1 dễ`;
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
- CHỈ trả về nội dung bài toán (không có "Bài toán mới:", không có lời giải)
- Bài toán phải là một đoạn văn liền mạch, tự nhiên

⚠️ KIỂM TRA CUỐI CÙNG:
- Bài toán có sử dụng KỸ NĂNG của chủ đề không?
- Ví dụ:
  • Chủ đề "Nhân số thập phân" mà bài chỉ có 4 × 6 → SAI (không có số thập phân)
  • Chủ đề "Phân số" mà bài chỉ có 4 + 3 → SAI (không có phân số)
  • Chủ đề "Đo lường" mà bài chỉ có 2 + 3 → SAI (không có đơn vị đo)
- Nếu bài toán không sử dụng kỹ năng chủ đề → BÀI SAI, phải viết lại

Bài toán luyện tập:`;

      // Sử dụng generateContent từ geminiModelManager (hỗ trợ auto-rotate key)
      const result = await geminiModelManager.generateContent(prompt);
      const similarProblem = result.response.text().trim();
      return similarProblem;
    } catch (error) {
      console.error('❌ Error generating similar problem:', error);
      throw error;
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
      const { errorsInKhoiDong = [], weaknessesInLuyenTap = {}, topicName = 'Bài toán' } = studentContext;
      
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

      const prompt = `Bạn là giáo viên toán lớp 5 tâm huyết, chuyên tạo bài tập vận dụng vừa đủ khó để giúp học sinh nhận biết được các lỗi sai nhưng vẫn trong tầm cơ bản.

HỒSƠ NĂNG LỰC HỌC SINH:
Chủ đề: ${topicName}

${errorsInKhoiDong.length > 0 ? `Những lỗi mắc phải ở phần Khởi động (trắc nghiệm):
${errorsInKhoiDong.map((e, i) => `${i + 1}. ${e}`).join('\n')}

` : ''}${weaknessText ? `Những điểm yếu khi giải toán Polya ở phần Luyện tập:
${weaknessText}\n` : ''}

NHIỆM VỤ:
Tạo 1 BÀI TOÁN VẬN DỤNG (Real-world Application Problem) phù hợp với học sinh lớp 5 để giúp khắc phục những yếu điểm trên.
**QUAN TRỌNG NHẤT: Bài toán PHẢI TẬP TRUNG VÀO CHỦĐỀ CHÍNH "${topicName}" - đó phải là phần chính và khó nhất của bài toán, không phải chỉ là phần phụ.**

YÊU CẦU TỐI QUAN TRỌNG:
1. ✅ MỨC ĐỘ PHẢI DỄ VÀ PHÁT TRIỂN CHỦ ĐỀ:
   - Bài toán nên dựa trên một tình huống thực tế quen thuộc của học sinh lớp 5 (gia đình, nhà trường, chợ, cửa hàng, dã ngoại...)
   - KHÔNG dùng phần trăm (%), vì bạn chưa được học
   - KHÔNG dùng khái niệm phức tạp (lợi nhuận, lãi suất, tỉ lệ, tỷ số...)
   - Bài toán nên CÓ 2-3 dữ kiện để cần phân tích, nhưng không quá nhiều
   - Phép tính cơ bản như: cộng, trừ, nhân, chia, số thập phân đơn giản
   
2. ✅ CHỦĐỀ PHẢI LÀ TRUNG TÂM CỦA BÀI TOÁN:
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

      // Sử dụng generateContent từ geminiModelManager
      const result = await geminiModelManager.generateContent(prompt);
      const applicationProblem = result.response.text().trim();
      return applicationProblem;
    } catch (error) {
      console.error('❌ Error generating application problem:', error);
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
      const result = await geminiModelManager.generateContent(evaluationPrompt);
      const responseText = result.response.text().trim();
      
      // Parse JSON từ response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ No JSON found in response. Response:', responseText.substring(0, 200));
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
      console.error('❌ Error evaluating competencies:', error.message);
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

      const result = await geminiModelManager.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Parse JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️ Could not parse overallAssessment JSON:', responseText.substring(0, 200));
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
      console.error('Error generating overall assessment:', error);
      return {
        strengths: ['Không thể tạo đánh giá chi tiết'],
        weaknesses: ['Vui lòng tải lại trang'],
        recommendations: ['Liên hệ hỗ trợ'],
        encouragement: 'Hãy cố gắng thêm, bạn sẽ thành công!'
      };
    }
  }
}

const geminiServiceInstance = new GeminiService();
export default geminiServiceInstance;
