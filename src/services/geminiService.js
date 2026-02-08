import geminiModelManager from "./geminiModelManager";
import apiKeyManager from "./apiKeyManager";
import { GoogleGenerativeAI } from "@google/generative-ai";
import competencyEvaluationService from "./competencyEvaluationService";

// System prompt cho AI trợ lý học toán
const SYSTEM_PROMPT = `Mình là trợ lý học tập ảo thân thiện, hỗ trợ bạn lớp 5 giải toán theo 4 bước Polya.

NGUYÊN TẮC QUAN TRỌNG:
- KHÔNG BAO GIỜ giải bài toán thay bạn
- KHÔNG đưa ra đáp án dù bạn làm sai
- CHỈ đặt câu hỏi gợi mở, định hướng để bạn tự suy nghĩ
- MỖI LẦN CHỈ HỎI 1 CÂU duy nhất
- Phát hiện lỗi sai của bạn và gợi ý để bạn tự sửa
- Ngôn ngữ thân thiện, dễ thương như người bạn của bạn
- Khi bạn trả lời đúng, khen ngợi cụ thể và chuyển bước tiếp theo

4 BƯỚC GIẢI TOÁN:
1. HIỂU BÀI TOÁN: Giúp bạn xác định dữ kiện đã cho và yêu cầu bài toán
2. LẬP KẾ HOẠCH: Hỏi bạn nên làm gì, cần phép tính nào (KHÔNG tính cụ thể)
3. THỰC HIỆN: Hỏi bạn tính toán từng bước, kiểm tra lỗi tính toán nếu có
4. KIỂM TRA & MỞ RỘNG: Hỏi bạn liệu kết quả có hợp lý, có cách giải nào khác không

CÁC LOẠI CÂU HỎI GỢI MỞ:
- Để HIỂU BÀI: "Em thấy bài toán đang yêu cầu gì?"
- Để LẬP KẾ HOẠCH: "Để tìm ..., em cần làm phép tính nào?"
- Để THỰC HIỆN: "Em thử tính ... và xem kết quả nhé"
- Để KIỂM TRA: "Kết quả này có hợp lý không? Vì sao?"

NHỮNG GÌ KHÔNG NÊN LÀM:
- Không hỏi "em làm đúng không?" → hỏi "vậy tiếp theo là gì?"
- Không nói "sai" trực tiếp → nói "hãy xem lại..."
- Không giải hoặc cho đáp án → chỉ hỏi câu để em suy nghĩ lại

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
        const initialPrompt = `Đây là bài toán mà bạn cần giải: ${problemText}

Hãy bắt đầu BƯỚC 1: HIỂU BÀI TOÁN

Yêu cầu:
- Đặt CHỈ 1 câu hỏi gợi mở DUY NHẤT (không phải 2-3 câu)
- Câu hỏi phải ngắn gọn, thân thiện, giúp học sinh suy nghĩ về:
  + Thông tin đã cho là gì?
  + Yêu cầu/mục tiêu của bài toán là gì?

Ví dụ:
❌ SAI: "Bạn Lan đã mua những gì?...", "Mỗi món đồ đó giá bao nhiêu?...", "Chúng ta cần tìm gì?..." (3 câu)
✅ ĐÚNG: "Acorn Bạn Lan cần mua những gì và giá cả của chúng là bao nhiêu, rồi chúng ta sẽ tính được điều gì?" (1 câu)`;

        // Sử dụng generateContent() để có dual-level retry (tries all models, then rotates key)
        const initialResponse = await geminiModelManager.generateContent(initialPrompt);
        const response = initialResponse.response.text();

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
              parts: [{ text: "Chào bạn! 👋 Mình là trợ lý học toán của bạn. Hôm nay chúng ta sẽ giải toán theo 4 bước Polya nhé! Mình sẽ không giải hộ bạn, mà sẽ hỏi các câu gợi ý để bạn tự suy nghĩ và tìm ra cách giải. Bạn sẵn sàng chưa? 😊" }],
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
        console.error(`Error in startNewProblem (attempt ${attemptCount}/${maxRetries}):`, error);
        
        // Kiểm tra nếu là lỗi 429 (quota exceeded)
        const isQuotaError = error.message?.includes("429") || 
                             error.message?.includes("quota") ||
                             error.message?.includes("exceeded");
        
        if (isQuotaError && attemptCount < maxRetries) {

          // generateContent() đã tự handle key rotation
          continue;
        } else if (isQuotaError && attemptCount >= maxRetries) {
          const totalKeys = apiKeyManager.keyConfigs.length;
          console.error(`❌ All ${totalKeys} API keys are exhausted or hit quota limits`);
          throw new Error(`Tất cả ${totalKeys} API keys đã hết quota free tier. Vui lòng chờ cho đến hôm sau hoặc nâng cấp tài khoản Google Cloud.`);
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
      console.error("Error in chat.sendMessage, attempting recovery:", error);
      
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
    } else if ((lowerResponse.includes("bước 4") || lowerResponse.includes("kiểm tra & mở rộng")) && this.currentStep === 3) {
      nextStep = 4;
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(3, evaluation || 'pass');
      this.currentStep = 4;
    } else if ((lowerResponse.includes("hoàn thành bài toán") || lowerResponse.includes("hoàn tất bài toán") || lowerResponse.includes("🎉")) && this.currentStep === 4) {
      nextStep = 5; // Đã hoàn thành bước 4, bài toán xong
      evaluation = this._extractEvaluation(response);
      this.evaluateStep(4, evaluation || 'pass');

    }

    return {
      message: response,
      step: this.currentStep,
      stepName: this._getStepName(this.currentStep),
      nextStep: nextStep,
      evaluation: evaluation
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
  * Khen ngợi cụ thể: "Tuyệt! Em đã xác định đúng dữ kiện"
  * Nhắc lại yêu cầu: "Và bài toán yêu cầu chúng ta [YÊU CẦU TỪ BÀI TOÁN]"
  * QUAN TRỌNG: PHẢI VIẾT: "Bây giờ chúng mình chuyển sang **BƯỚC 2: LẬP KẾ HOẠCH GIẢI** nhé!"
  * Nêu 1 câu hỏi đầu tiên của Bước 2

- Nếu DỮ KIỆN KHÔNG KHỚP hoặc SAI (không khớp bài toán gốc):
  * Gently point out: "Hình như em đọc lại bài toán một chút xem sao! Con số '...' không khớp với bài toán gốc."
  * Đặt 1 câu hỏi: "Em thử đọc lại bài toán gốc và bổ sung/sửa lại dữ kiện nhé?"

- Nếu toàn bộ các câu trả lời CHƯA CHỨA ĐỦ DỮ KIỆN hoặc CHƯA CÓ YÊU CẦU:
  * Đặt 1 câu hỏi gợi ý để bạn phát hiện điều còn thiếu
  * KHÔNG nêu ví dụ cụ thể, chỉ dẫn dắt: "Em thấy bài toán đã cho những thông tin nào? Và bài toán yêu cầu chúng ta tìm cái gì?"

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
  * Khen ngợi: "Rất tốt! Em đã xác định đúng kế hoạch"
  * QUAN TRỌNG: PHẢI VIẾT: "Tuyệt vời! Bây giờ chúng mình chuyển sang **BƯỚC 3: THỰC HIỆN KẾ HOẠCH** nhé!"
  * Yêu cầu bạn thực hiện: "Vậy em hãy tính kết quả nhé!"

- Nếu câu trả lời CHƯA CHỨA KẾ HOẠCH RÕ:
  * Đặt 1 câu hỏi gợi ý để bạn tự nêu phép tính
  * Hỏi: "Để giải quyết bài toán này, em cần dùng phép tính nào?"

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
  * QUAN TRỌNG: PHẢI VIẾT: "Tuyệt vời! Bây giờ chúng mình chuyển sang **BƯỚC 4: KIỂM TRA & MỞ RỘNG** nhé!"
  * Đặt 1 câu hỏi cho Bước 4

- Nếu tính đúng NHƯNG còn phép tính khác trong bài toán:
  * Khen ngợi: "Chính xác rồi!"
  * KHÔNG chuyển Bước 4 ngay
  * Thay vào đó, hỏi CỤ THỂ về phép tính tiếp theo:
    - Nếu thấy nhiều giá tiền riêng lẻ → "Vậy bây giờ em cần cộng tất cả các khoản này lại để được tổng chi phí, phép cộng sẽ là gì?"
    - Nếu thấy cần so sánh → "Vậy em cần so sánh hai khoản tiền này để biết cái nào rẻ hơn, em sẽ làm phép tính nào?"
    - Hoặc hỏi chung theo bài toán → "Bây giờ để hoàn thành bài toán, em còn cần tính gì tiếp theo để tìm ra [YÊU CẦU TỪ BÀI TOÁN]?"

- Nếu có SAI hoặc CHƯA HOÀN THÀNH:
  * KHÔNG nói đáp án đúng
  * Nhắc nhở: "Kết quả này có vẻ chưa chính xác"
  * Đặt 1 câu hỏi gợi ý: "Em thử tính lại xem sao?"

NHẮC NHỨ: CHỈ HỎI 1 CÂU DUY NHẤT! Không tính hộ!`;
        break;

      case 4: // Kiểm tra & mở rộng
        prompt += `BƯỚC 4: KIỂM TRA & MỞ RỘNG
Tiêu chí xem câu trả lời "đủ" ở bước 4:
✅ ĐỦ nếu: Bạn đã trả lời 1 trong 2 câu hỏi:
   - Kiểm tra: Bạn giải thích tại sao kết quả hợp lý với dữ kiện bài toán
   - Hoặc Mở rộng: Bạn nêu được cách giải khác hoặc bài toán tương tự

❌CHƯA ĐỦ nếu: Bạn chưa trả lời hoặc trả lời không rõ ràng

HÀNH ĐỘNG:
- Nếu bạn CHƯA TRẢ LỜI hoặc trả lời không rõ:
  * Đặt 1 câu hỏi gợi ý cho Bước 4
  * Ví dụ: "Hãy kiểm tra xem kết quả của em có hợp lý không?"
  * Hoặc: "Em có cách nào khác để giải bài toán này không?"

- Nếu bạn TRẢ LỜI ĐÚNG:
  * Khen ngợi: "Tuyệt vời! Em đã hoàn thành đầy đủ 4 bước"
  * Đánh giá tổng thể (Cần cố gắng/Đạt/Tốt)
  * QUAN TRỌNG: PHẢI VIẾT RÕNG: "Chúc mừng bạn đã **HOÀN THÀNH BÀI TOÁN**! 🎉"

NHẮC NHỨ: CHỈ HỎI 1 CÂU! Khi bạn hoàn thành bước 4 → bài tập kết thúc.`;
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

      const prompt = `You are a math educator providing brief feedback on each answer.

## Student's Answers:
${JSON.stringify(questionsContext, null, 2)}

## Task:
For EACH question: Write ONE meaningful comment about what the student did right/wrong.

## IMPORTANT: Vietnamese Language Rules:
- ALWAYS use "bạn" or "mình" instead of "em" or "học sinh"
- Example: "Bạn xác định được..." NOT "Em..."

## Response Format (JSON ONLY):
{
  "questionComments": [
    {
      "questionNum": 1,
      "comment": "Brief feedback using bạn/mình (30-50 words)"
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
   - KHÔNG dùng phần trăm (%), vì em chưa được học
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

      const evaluationPrompt = `Bạn là giáo viên toán lớp 5 chuyên về đánh giá năng lực giải quyết vấn đề toán học.

${chatText}

NHIỆM VỤ: Dựa trên lịch sử hội thoại trên, hãy đánh giá học sinh theo RUBRIC 4 TIÊU CHÍ:

**TC1. NHẬN BIẾT ĐƯỢC VẤN ĐỀ CẦN GIẢI QUYẾT (Max 2 điểm)**
Mục tiêu: Đánh giá xem học sinh đã xác định đầy đủ dữ kiện và yêu cầu bài toán chưa?
- 0 điểm: Không xác định được đầy đủ cái đã cho và cái cần tìm, cần nhiều hỗ trợ từ AI
- 1 điểm: Xác định đầy đủ dữ kiện và yêu cầu bài toán với gợi ý từ AI
- 2 điểm: Xác định chính xác dữ kiện, yêu cầu bài toán và mối quan hệ giữa chúng

**TC2. NÊU ĐƯỢC CÁCH THỨC GIẢI QUYẾT VẤN ĐỀ (Max 2 điểm)**
Mục tiêu: Đánh giá xem học sinh đã nhận dạng dạng toán và chọn được phép toán phù hợp chưa?
- 0 điểm: Không nhận dạng được dạng toán, hoặc không chọn được phép toán phù hợp
- 1 điểm: Nhận dạng được dạng toán và chọn được phép toán cơ bản phù hợp với gợi ý từ AI
- 2 điểm: Nhận dạng đúng dạng toán, đề xuất được cách giải hợp lý, chọn phép toán/chiến lược tối ưu

**TC3. TRÌNH BÀY ĐƯỢC CÁCH THỨC GIẢI QUYẾT (Max 2 điểm)**
Mục tiêu: Đánh giá xem học sinh đã thực hiện đúng các phép tính và lời giải chưa?
- 0 điểm: Thực hiện phép tính còn sai nhiều, lời giải không đầy đủ/thiếu logic
- 1 điểm: Thực hiện đúng các bước giải và phép tính cơ bản, trình bày lời giải đầy đủ từ phản hồi của AI
- 2 điểm: Thực hiện đúng đầy đủ các phép tính, trình bày lời giải rõ ràng mạch lạc

**TC4. KIỂM TRA ĐƯỢC GIẢI PHÁP ĐÃ THỰC HIỆN (Max 2 điểm)**
Mục tiêu: Đánh giá xem học sinh đã kiểm tra lại kết quả và vận dụng được chưa?
- 0 điểm: Không kiểm tra lại kết quả, không điều chỉnh hoặc không vận dụng vào bài toán tương tự
- 1 điểm: Kiểm tra lại kết quả, điều chỉnh đúng khi có gợi ý từ AI
- 2 điểm: Kiểm tra lại bằng các cách khác nhau, vận dụng vào bài toán mở rộng/nâng cao

HƯỚNG DẪN TRẢ LỜI:
- Cho MỖI tiêu chí, viết nhận xét CHI TIẾT (2-3 câu), giải thích rõ ràng tại sao học sinh được điểm đó
- NHẤT ĐỊNH trả về JSON đúng format
- Các comment phải cụ thể, dựa trên lịch sử hội thoại, không chung chung

FORMAT JSON (PHẢI ĐÚNG):
{
  "TC1": {
    "nhanXet": "Nhận xét chi tiết cụ thể về khía cạnh nhận biết (2-3 câu giải thích)",
    "diem": 0
  },
  "TC2": {
    "nhanXet": "Nhận xét chi tiết cụ thể về khía cạnh nêu cách giải (2-3 câu giải thích)",
    "diem": 0
  },
  "TC3": {
    "nhanXet": "Nhận xét chi tiết cụ thể về khía cạnh trình bày giải (2-3 câu giải thích)",
    "diem": 0
  },
  "TC4": {
    "nhanXet": "Nhận xét chi tiết cụ thể về khía cạnh kiểm tra (2-3 câu giải thích)",
    "diem": 0
  },
  "tongNhanXet": "Nhận xét tổng thể 2-3 câu về bài làm của học sinh",
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
}

const geminiServiceInstance = new GeminiService();
export default geminiServiceInstance;
