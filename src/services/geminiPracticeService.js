import geminiModelManager from "./geminiModelManager";

// simple delay helper used by rate-limited wrapper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GeminiPracticeService
 * Chứa các phương thức tạo bài luyện tập và vận dụng
 */
export class GeminiPracticeService {
  constructor() {
    // queue for rate-limited generate calls
    this._pending = Promise.resolve();
  }

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

  /**
   * Tạo bài toán luyện tập dựa trên bài khởi động tương ứng
   * @param {string} startupProblem1 - Bài 1 phần khởi động
   * @param {string} startupProblem2 - Bài 2 phần khởi động
   * @param {string} context - Bối cảnh/dạng toán
   * @param {number} problemNumber - Số thứ tự bài luyện tập (1 hoặc 2)
   * @param {string} competencyLevel - Mức năng lực của học sinh (Cần cố gắng / Đạt / Tốt)
   * @param {number} startupPercentage - Phần trăm đúng từ phần khởi động
   * @returns {Promise<string>} - Bài toán luyện tập
   */
  async generateSimilarProblem(
    startupProblem1,
    startupProblem2,
    context = '',
    problemNumber = 1,
    competencyLevel = 'Đạt',
    startupPercentage = 100
  ) {

    try {
      
      let referenceProblem = '';
      let difficultyGuidance = '';
      let topicFocus = '';
      let competencyAdjustment = '';
      
      // normalize competencyLevel
      competencyLevel = competencyLevel || 'Đạt';

      // 🔧 ĐIỀU CHỈNH ĐỘ KHÓ DỰA TRÊN NĂNG LỰC HỌC SINH (ƯU TIÊN CAO NHẤT)
      if (problemNumber === 1) {
        referenceProblem = startupProblem1;
        if (competencyLevel === 'Cần cố gắng') {
          difficultyGuidance = `
🔴 MỨC ĐỘ BÀI 1 - CỰC DỄ (Học sinh Cần cố gắng):
- Bài toán phải cực kỳ đơn giản, học sinh chỉ cần nhìn là nhẩm ra đáp án ngay, không cần trình bày nhiều bước.
- Chỉ dùng phép tính cộng, trừ, nhân, chia đơn giản với số nhỏ (dưới 20), không có bẫy, không có dữ kiện thừa.
- Không dùng ngữ cảnh phức tạp, không yêu cầu giải thích, chỉ hỏi trực tiếp phép tính hoặc thao tác đơn giản nhất.
- Đề bài ngắn gọn, rõ ràng, không cần trình bày lời giải, chỉ cần đáp số.
- Ví dụ: "Tính 7 + 5 = ?" hoặc "Có 12 quả táo, cho đi 3 quả, còn lại bao nhiêu quả?"
`;
        } else if (competencyLevel === 'Tốt') {
          difficultyGuidance = `
🟢 MỨC ĐỘ BÀI 1 - TƯƠNG ĐƯƠNG KHỞI ĐỘNG (Học sinh Tốt):
- Giữ ĐỘ KHÓ TƯƠNG ĐƯƠNG bài 1 khởi động
- Cùng số bước tính, cùng loại số liệu
- Thay đổi BỐI CẢNH và CON SỐ nhưng giữ CẤU TRÚC
- Học sinh Tốt sẽ làm bài 2 khó hơn, nên bài 1 không cần tăng độ khó`;
        } else {
          // Đạt - giữ nguyên
          difficultyGuidance = `
🟡 MỨC ĐỘ BÀI 1 - TƯƠNG ĐƯƠNG KHỞI ĐỘNG (Học sinh Đạt):
- Giữ ĐỘ KHÓ TƯƠNG ĐƯƠNG bài 1 khởi động
- Cùng số bước tính (1-2 bước)
- Thay đổi BỐI CẢNH và CON SỐ nhưng giữ CẤU TRÚC
- Số liệu dễ tính nhưng không quá đơn giản`;
        }
        
      } else if (problemNumber === 2) {
        referenceProblem = startupProblem2;
        if (competencyLevel === 'Cần cố gắng') {
          difficultyGuidance = `
🔴 MỨC ĐỘ BÀI 2 - CỰC DỄ (Học sinh Cần cố gắng):
- Bài toán phải cực kỳ đơn giản, học sinh chỉ cần nhìn là nhẩm ra đáp án ngay, không cần trình bày nhiều bước.
- Chỉ dùng phép tính cộng, trừ, nhân, chia đơn giản với số nhỏ (dưới 20), không có bẫy, không có dữ kiện thừa.
- Không dùng ngữ cảnh phức tạp, không yêu cầu giải thích, chỉ hỏi trực tiếp phép tính hoặc thao tác đơn giản nhất.
- Đề bài ngắn gọn, rõ ràng, không cần trình bày lời giải, chỉ cần đáp số.
- Ví dụ: "Tính 8 × 3 = ?" hoặc "Có 15 viên bi, chia đều cho 3 bạn, mỗi bạn được mấy viên?"
`;
        } else if (competencyLevel === 'Tốt') {
          difficultyGuidance = `
🟢 MỨC ĐỘ BÀI 2 - KHÓ HƠN KHỞI ĐỘNG (Học sinh Tốt):
- PHẢI KHÓ HƠN bài 2 khởi động để thử thách
- Thêm 1-2 BƯỚC TÍNH so với bài khởi động
- Số liệu PHỨC TẠP HƠN (số thập phân, số lớn hơn)
- CÓ THỂ THÊM: dữ kiện thừa, tư duy ngược, so sánh 2 phương án
- Yêu cầu suy luận và kết hợp nhiều kỹ năng
- Ví dụ: Nếu khởi động tìm 2 số → Luyện tập: tìm 2 số rồi so sánh với điều kiện khác`;
        } else {
          // Đạt - giữ tương đương
          difficultyGuidance = `
🟡 MỨC ĐỘ BÀI 2 - TƯƠNG ĐƯƠNG KHỞI ĐỘNG (Học sinh Đạt):
- Giữ ĐỘ KHÓ TƯƠNG ĐƯƠNG bài 2 khởi động
- Cùng số bước tính (2-3 bước)
- Thay đổi BỐI CẢNH và CON SỐ nhưng giữ CẤU TRÚC
- Học sinh đã làm tốt khởi động → tiếp tục luyện với độ khó tương đương`;
        }
      }
      
      // THÔNG TIN NĂNG LỰC ĐỂ AI HIỂU RÕ HƠN
      if (competencyLevel === 'Cần cố gắng') {
        competencyAdjustment = `
═══════════════════════════════════════════════════════════════
⚠️ HỌC SINH "CẦN CỐ GẮNG" - ƯU TIÊN CAO NHẤT: GIẢM ĐỘ KHÓ!
═══════════════════════════════════════════════════════════════
Học sinh làm CHƯA TỐT phần khởi động → Cần bài tập DỄ HƠN để:
✅ Lấy lại TỰ TIN
✅ Hiểu được CÁCH LÀM CƠ BẢN
✅ Không bị nản chí

QUY TẮC BẮT BUỘC:
- Số liệu NHỎ HƠN, DỄ TÍNH HƠN (2, 5, 10, 20 thay vì 12, 24, 72)
- Số bước tính ÍT HƠN (1 bước thay vì 2-3 bước)
- Bối cảnh NGẮN GỌN, TRỰC TIẾP
- KHÔNG có dữ kiện thừa, điều kiện phức tạp`;
      } else if (competencyLevel === 'Tốt') {
        competencyAdjustment = `
═══════════════════════════════════════════════════════════════
⭐ HỌC SINH "TỐT" - ƯU TIÊN CAO NHẤT: TĂNG ĐỘ KHÓ!
═══════════════════════════════════════════════════════════════
Học sinh làm TỐT phần khởi động → Cần bài tập KHÓ HƠN để:
✅ Thử thách và PHÁT TRIỂN năng lực
✅ Không nhàm chán với bài quá dễ
✅ Khám phá các dạng bài NÂNG CAO

QUY TẮC BẮT BUỘC:
- Số liệu PHỨC TẠP HƠN (số thập phân nhiều chữ số, số lớn)
- Số bước tính NHIỀU HƠN (thêm 1-2 bước so với khởi động)
- CÓ THỂ THÊM: dữ kiện thừa, tư duy ngược, so sánh phương án
- Yêu cầu suy luận và kết hợp kỹ năng`;
      } else {
        // Đạt - bình thường
        competencyAdjustment = `
═══════════════════════════════════════════════════════════════
✅ HỌC SINH "ĐẠT" - GIỮ ĐỘ KHÓ TƯƠNG ĐƯƠNG
═══════════════════════════════════════════════════════════════
Học sinh làm ĐẠT phần khởi động → Giữ độ khó tương đương để:
✅ Củng cố kỹ năng đã học
✅ Luyện tập thêm với bối cảnh khác
✅ Đảm bảo hiểu vững trước khi nâng cao

QUY TẮC BẮT BUỘC:
- Cùng MỨC ĐỘ KHÓ với bài khởi động
- Cùng SỐ BƯỚC TÍNH
- Chỉ thay đổi BỐI CẢNH và CON SỐ cụ thể`;
      }
      
      // Nếu có context (chủ đề), sử dụng để nhấn mạnh
      if (context) {
        topicFocus = `
**NHẤN MẠNH CHỦ ĐỀ CHÍNH "${context}":
- Bài toán PHẢI tập trung vào "${context}" là nội dung chính
- Không được để "${context}" chỉ là chi tiết phụ
- Ví dụ: Nếu chủ đề "Nhân số thập phân", bài toán PHẢI CÓ NHIỀU phép nhân số thập phân làm nội dung chính`;
      }
      
      // 🔧 LẤY HƯỚNG DẪN CỤ THỂ CHO BÀI HỌC (ưu tiên cao nhất)
      let specialTopicGuidance = this._getLessonSpecificGuidance(context);

      const prompt = this._buildSimilarProblemPrompt(
        referenceProblem, 
        context, 
        difficultyGuidance, 
        competencyAdjustment, 
        topicFocus, 
        specialTopicGuidance
      );

      // Sử dụng wrapper để rate-limit
      const result = await this._rateLimitedGenerate(prompt);
      let similarProblem = result ? result.response.text().trim() : '';

      
      // 🔧 POST-PROCESSING: Loại bỏ các header không mong muốn
      similarProblem = this._cleanGeneratedProblem(similarProblem);
      
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
   * Tạo đề thi tương đương từ sampleExam của chủ đề
   * @param {string} topicName - Tên chủ đề (vd: "Phép nhân số thập phân")
   * @param {string} lessonName - Tên bài học
   * @param {Array|Object} sampleExams - Mẫu đề (cấu trúc exercises array hoặc JSON string)
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
        topicSpecificGuide = this._getExamTopicGuideTiSo();
      } else if (topicNameLower.includes('thể tích') && topicNameLower.includes('đơn vị')) {
        topicSpecificGuide = this._getExamTopicGuideTheTich();
      } else if ((topicNameLower.includes('diện tích') && topicNameLower.includes('thể tích')) || 
                 (topicNameLower.includes('hình khối'))) {
        topicSpecificGuide = this._getExamTopicGuideDienTich();
      }

      const prompt = this._buildExamGenerationPrompt(topicName, lessonName, sampleSummary, topicSpecificGuide);

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

  // ============ PRIVATE HELPER METHODS ============

  /**
   * 🔧 Lấy hướng dẫn cụ thể cho từng bài học dựa trên tên bài/chủ đề
   * @param {string} context - Tên bài học hoặc chủ đề
   * @returns {string} - Hướng dẫn chi tiết cho bài học đó
   */
  _getLessonSpecificGuidance(context) {
    if (!context) return '';
    
    const contextLower = context.toLowerCase();
    
    // ═══════════════════════════════════════════════════════════════
    // 🔷 CHỦ ĐỀ: TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN
    // ═══════════════════════════════════════════════════════════════
    
    // Bài 36. Tỉ số. Tỉ số phần trăm (KHÔNG có ký hiệu %)
    if (contextLower.includes('bài 36') || (contextLower.includes('tỉ số') && !contextLower.includes('tổng') && !contextLower.includes('hiệu') && !contextLower.includes('bản đồ') && !contextLower.includes('phần trăm của'))) {
      return `
🎯 BÀI 36: TỈ SỐ CƠ BẢN (KHÔNG CÓ KÝ HIỆU %)
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- So sánh 2 đại lượng cùng loại: số bi đỏ/xanh, số sách loại A/B, số táo/cam...
- Tìm TỈ SỐ dưới dạng PHÂN SỐ (ví dụ: 24/18 = 4/3)
- KHÔNG có ký hiệu % trong bài

❌ TUYỆT ĐỐI KHÔNG:
- KHÔNG dùng phần trăm (%), KHÔNG hỏi "chiếm bao nhiêu %"
- KHÔNG nhầm sang bài tìm 2 số biết tổng/hiệu và tỉ số
- KHÔNG dùng ví dụ "học sinh nam/nữ" (nhàm chán)

VÍ DỤ ĐÚNG:
"Trong rổ có 24 quả táo và 18 quả cam. Hỏi tỉ số của số táo so với số cam là bao nhiêu?"
→ Tỉ số = 24/18 = 4/3`;
    }
    
    // Bài 37. Tỉ lệ bản đồ
    if (contextLower.includes('bài 37') || contextLower.includes('tỉ lệ bản đồ') || contextLower.includes('bản đồ')) {
      return `
🎯 BÀI 37: TỈ LỆ BẢN ĐỒ VÀ ỨNG DỤNG
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- BẮT BUỘC có BẢN ĐỒ với tỉ lệ cụ thể (1:500, 1:1000, 1:10000, 1:50000...)
- Tìm kích thước thực tế từ kích thước trên bản đồ hoặc ngược lại
- Ý nghĩa: 1:500 nghĩa là 1cm trên bản đồ = 500cm thực tế

❌ TUYỆT ĐỐI KHÔNG:
- KHÔNG về cây cối, học sinh, đồ vật, sách vở
- KHÔNG nhầm sang tỉ số thông thường giữa 2 đại lượng
- KHÔNG thiếu tỉ lệ bản đồ cụ thể

VÍ DỤ ĐÚNG:
"Trên bản đồ tỉ lệ 1:10000, một con đường được vẽ dài 5 cm. Hỏi chiều dài thực tế của con đường là bao nhiêu mét?"
→ Chiều dài thực tế = 5 × 10000 = 50000 cm = 500 m`;
    }
    
    // Bài 38. Tìm hai số khi biết tổng và tỉ số
    if (contextLower.includes('bài 38') || (contextLower.includes('tổng') && contextLower.includes('tỉ số'))) {
      return `
🎯 BÀI 38: TÌM HAI SỐ KHI BIẾT TỔNG VÀ TỈ SỐ
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- Cho TỔNG của 2 số (ví dụ: tổng 72 cuốn sách, 60 học sinh...)
- Cho TỈ SỐ giữa 2 số dưới dạng PHÂN SỐ (ví dụ: số A bằng 2/4 số B)
- Yêu cầu TÌM HAI SỐ riêng biệt

❌ TUYỆT ĐỐI KHÔNG:
- KHÔNG dùng phần trăm (%)
- KHÔNG chỉ tìm 1 số
- KHÔNG thiếu tổng hoặc thiếu tỉ số

VÍ DỤ ĐÚNG:
"Hai nhóm có tổng cộng 72 cuốn sách. Số sách nhóm A bằng 2/4 số sách nhóm B. Hỏi mỗi nhóm có bao nhiêu cuốn sách?"
→ Tổng phần = 2 + 4 = 6 → Mỗi phần = 72 ÷ 6 = 12 → A = 24, B = 48`;
    }
    
    // Bài 39. Tìm hai số khi biết hiệu và tỉ số
    if (contextLower.includes('bài 39') || (contextLower.includes('hiệu') && contextLower.includes('tỉ số'))) {
      return `
🎯 BÀI 39: TÌM HAI SỐ KHI BIẾT HIỆU VÀ TỈ SỐ
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- Cho HIỆU của 2 số (ví dụ: anh hơn em 12 tuổi, hơn kém 20 cuốn...)
- Cho TỈ SỐ giữa 2 số dưới dạng PHÂN SỐ (ví dụ: tuổi anh bằng 5/3 tuổi em)
- Yêu cầu TÌM HAI SỐ riêng biệt

❌ TUYỆT ĐỐI KHÔNG:
- KHÔNG nhầm với bài tổng và tỉ số
- KHÔNG dùng phần trăm (%)
- KHÔNG thiếu hiệu hoặc thiếu tỉ số

VÍ DỤ ĐÚNG:
"Anh hơn em 12 tuổi. Biết tuổi anh bằng 5/3 tuổi em. Hỏi anh và em bao nhiêu tuổi?"
→ Hiệu phần = 5 - 3 = 2 → Mỗi phần = 12 ÷ 2 = 6 → Em = 18, Anh = 30`;
    }
    
    // Bài 40. Tìm tỉ số phần trăm của hai số
    if (contextLower.includes('bài 40') || contextLower.includes('tìm tỉ số phần trăm') || (contextLower.includes('phần trăm') && contextLower.includes('của hai số'))) {
      return `
🎯 BÀI 40: TÌM TỈ SỐ PHẦN TRĂM CỦA HAI SỐ
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- Cho 2 số cụ thể
- Hỏi "số này chiếm bao nhiêu % của số kia?"
- Công thức: (Số nhỏ ÷ Số lớn) × 100 = ?%

❌ TUYỆT ĐỐI KHÔNG:
- KHÔNG nhầm với "tìm giá trị phần trăm" (bài 41)
- KHÔNG chỉ tìm tỉ số (bài 36)
- KHÔNG cho sẵn % rồi tìm số

VÍ DỤ ĐÚNG:
"Trong 80 kg giấy thu gom, có 28 kg được phân loại đúng. Hỏi số giấy phân loại đúng chiếm bao nhiêu phần trăm số giấy thu gom?"
→ 28 ÷ 80 × 100 = 35%`;
    }
    
    // Bài 41. Tìm giá trị phần trăm của một số
    if (contextLower.includes('bài 41') || contextLower.includes('tìm giá trị phần trăm') || (contextLower.includes('giá trị') && contextLower.includes('phần trăm'))) {
      return `
🎯 BÀI 41: TÌM GIÁ TRỊ PHẦN TRĂM CỦA MỘT SỐ
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- Cho một số và một tỉ lệ % cụ thể
- Hỏi "X% của số đó bằng bao nhiêu?"
- Công thức: Số × % ÷ 100 = Giá trị

❌ TUYỆT ĐỐI KHÔNG:
- KHÔNG nhầm với "tìm tỉ số phần trăm" (bài 40)
- KHÔNG hỏi "chiếm bao nhiêu %"
- KHÔNG thiếu tỉ lệ % cụ thể

VÍ DỤ ĐÚNG:
"Lớp 5A có 40 học sinh. Trong đó 25% học sinh được khen thưởng. Hỏi có bao nhiêu học sinh được khen thưởng?"
→ 40 × 25 ÷ 100 = 10 học sinh`;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🔷 CHỦ ĐỀ 8: THỂ TÍCH. ĐƠN VỊ ĐO THỂ TÍCH
    // ═══════════════════════════════════════════════════════════════
    
    // Bài 46. Xăng-ti-mét khối. Đề-xi-mét khối
    if (contextLower.includes('bài 46') || contextLower.includes('xăng-ti-mét khối') || contextLower.includes('đề-xi-mét khối') || contextLower.includes('cm³') || contextLower.includes('dm³')) {
      return `
🎯 BÀI 46: XĂNG-TI-MÉT KHỐI VÀ ĐỀ-XI-MÉT KHỐI
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- Đổi đơn vị giữa cm³ và dm³ (1 dm³ = 1000 cm³)
- So sánh 2 thể tích ở đơn vị khác nhau

VÍ DỤ ĐÚNG:
"Hộp A có thể tích 2,5 dm³. Hộp B có thể tích 2400 cm³. Hỏi hộp nào có thể tích lớn hơn?"
→ 2,5 dm³ = 2500 cm³ > 2400 cm³ → Hộp A lớn hơn`;
    }
    
    // Bài 47. Mét khối
    if (contextLower.includes('bài 47') || contextLower.includes('mét khối') || contextLower.includes('m³')) {
      return `
🎯 BÀI 47: MÉT KHỐI
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- So sánh thể tích ở các đơn vị m³, dm³ (1 m³ = 1000 dm³)
- Bối cảnh: xe bồn, bể nước, thùng chứa...

VÍ DỤ ĐÚNG:
"Bể nước có dung tích 2500 dm³. Xe bồn chở đến 2,4 m³ nước. Hỏi xe bồn có đủ nước để đổ đầy bể không?"
→ 2,4 m³ = 2400 dm³ < 2500 dm³ → Không đủ, thiếu 100 dm³`;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🔷 CHỦ ĐỀ: DIỆN TÍCH VÀ THỂ TÍCH CỦA MỘT SỐ HÌNH KHỐI
    // ═══════════════════════════════════════════════════════════════
    
    // Bài 50. Diện tích xung quanh và toàn phần hình hộp chữ nhật
    if (contextLower.includes('bài 50') || (contextLower.includes('diện tích') && contextLower.includes('hình hộp chữ nhật'))) {
      return `
🎯 BÀI 50: DIỆN TÍCH XUNG QUANH VÀ TOÀN PHẦN HÌNH HỘP CHỮ NHẬT
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- Hình hộp chữ nhật với 3 kích thước: dài, rộng, cao
- Tính diện tích xung quanh (4 mặt bên) hoặc diện tích toàn phần (6 mặt)
- Công thức: Sxq = (dài + rộng) × 2 × cao; Stp = Sxq + 2 × (dài × rộng)

VÍ DỤ ĐÚNG:
"Một thùng gỗ hình hộp chữ nhật có chiều dài 50 cm, chiều rộng 40 cm, chiều cao 30 cm. Cần bao nhiêu cm² gỗ để đóng thùng (không có nắp)?"`;
    }
    
    // Bài 51. Diện tích xung quanh và toàn phần hình lập phương
    if (contextLower.includes('bài 51') || (contextLower.includes('diện tích') && contextLower.includes('hình lập phương'))) {
      return `
🎯 BÀI 51: DIỆN TÍCH XUNG QUANH VÀ TOÀN PHẦN HÌNH LẬP PHƯƠNG
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- Hình lập phương với cạnh cụ thể
- Tính diện tích xung quanh (4 mặt) hoặc diện tích toàn phần (6 mặt)
- Công thức: Sxq = cạnh × cạnh × 4; Stp = cạnh × cạnh × 6

VÍ DỤ ĐÚNG:
"Một hộp quà hình lập phương cạnh 10 cm. Cần bọc giấy kín hộp quà. Hỏi cần bao nhiêu cm² giấy (không tính mép gấp)?"
→ Stp = 10 × 10 × 6 = 600 cm²`;
    }
    
    // Bài 52. Thể tích hình hộp chữ nhật
    if (contextLower.includes('bài 52') || (contextLower.includes('thể tích') && contextLower.includes('hình hộp chữ nhật'))) {
      return `
🎯 BÀI 52: THỂ TÍCH HÌNH HỘP CHỮ NHẬT
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- Hình hộp chữ nhật với 3 kích thước: dài, rộng, cao
- Tính thể tích (sức chứa bên trong)
- Công thức: V = dài × rộng × cao

VÍ DỤ ĐÚNG:
"Bể cá hình hộp chữ nhật có chiều dài 40 cm, chiều rộng 25 cm, mực nước cao 15 cm. Thả một viên đá vào bể, mực nước dâng lên 18 cm. Thể tích viên đá là bao nhiêu cm³?"
→ V nước dâng = 40 × 25 × (18-15) = 3000 cm³ = Thể tích viên đá`;
    }
    
    // Bài 53. Thể tích hình lập phương
    if (contextLower.includes('bài 53') || (contextLower.includes('thể tích') && contextLower.includes('hình lập phương'))) {
      return `
🎯 BÀI 53: THỂ TÍCH HÌNH LẬP PHƯƠNG
═══════════════════════════════════════════════════════
✅ PHẢI CÓ:
- Hình lập phương với cạnh cụ thể
- Tính thể tích
- Công thức: V = cạnh × cạnh × cạnh

VÍ DỤ ĐÚNG:
"Một hộp hình lập phương cạnh 5 cm. Hỏi thể tích hộp là bao nhiêu cm³?"
→ V = 5 × 5 × 5 = 125 cm³`;
    }
    
    // Bài 44, 48, 55: Luyện tập chung
    if (contextLower.includes('luyện tập chung')) {
      if (contextLower.includes('tỉ số') || contextLower.includes('bài 44')) {
        return `
🎯 BÀI 44: LUYỆN TẬP CHUNG (TỈ SỐ)
═══════════════════════════════════════════════════════
✅ KẾT HỢP CÁC DẠNG TOÁN VỀ TỈ SỐ:
- Tỉ số cơ bản, tỉ lệ bản đồ
- Tìm 2 số khi biết tổng/hiệu và tỉ số
- Tỉ số phần trăm`;
      }
      if (contextLower.includes('thể tích') || contextLower.includes('bài 48')) {
        return `
🎯 BÀI 48: LUYỆN TẬP CHUNG (THỂ TÍCH)
═══════════════════════════════════════════════════════
✅ KẾT HỢP:
- Đổi đơn vị thể tích (cm³, dm³, m³)
- Tính thể tích hình hộp, hình lập phương
- So sánh thể tích`;
      }
      if (contextLower.includes('diện tích') || contextLower.includes('bài 55')) {
        return `
🎯 BÀI 55: LUYỆN TẬP CHUNG (DIỆN TÍCH & THỂ TÍCH HÌNH KHỐI)
═══════════════════════════════════════════════════════
✅ KẾT HỢP:
- Diện tích xung quanh, toàn phần
- Thể tích hình hộp chữ nhật, hình lập phương
- So sánh và tính toán phức hợp`;
      }
    }
    
    // Fallback: Dùng hướng dẫn chung theo chủ đề
    if (contextLower.includes('tỉ số') || contextLower.includes('phần trăm')) {
      return this._getTopicGuidanceTiSo();
    } else if (contextLower.includes('thể tích')) {
      return this._getTopicGuidanceTheTich();
    } else if (contextLower.includes('diện tích') || contextLower.includes('hình khối')) {
      return this._getTopicGuidanceDienTich();
    }
    
    return '';
  }

  _getTopicGuidanceTiSo() {
    return `
🎯 CHỦ ĐỀ CỤ THỀ: TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN
═══════════════════════════════════════════════════════
**DẠNG BÀI TOÁN "TÌM HAI SỐ KHI BIẾT TỔNG VÀ TỈ SỐ"**

CẤU TRÚC LỌC BẮT BUỘC:
✅ PHẢI CÓ:
   - Một tổng cộng (ví dụ: tổng 72 cuốn, 96 học sinh, 60 kg...)
   - Một TỈ SỐ dưới dạng PHÂN SỐ (ví dụ: 2/4, 5/3, 4/2, 1/2...)
   - YÊU CẦU tìm hai chỉ tiêu riêng biệt

❌ TUYỆT ĐỐI KHÔNG:
   - KHÔNG có phần trăm (%) hoặc "X% bằng..."
   - KHÔNG chỉ là phép cộng/trừ đơn giản (ví dụ: "Bạn An có dây 12,5 mét, dùng 3,5 mét" - ĐỪNG TẠO KIỂU NÀY)
   - KHÔNG chỉ là tìm 1 số, phải tìm 2 số
   - KHÔNG để tỉ số chỉ là thông tin phụ

VÍ DỤ ĐÚNG (từ file mẫu):
   Bài mẫu: "Lớp 5C thống kê 72 cuốn sách từ hai nhóm. Nhóm Bình Minh bằng 2/4 nhóm Hoàng Hôn. Hỏi mỗi nhóm bao nhiêu cuốn?"
   → Tổng = 72, Tỉ số = 2/4 → Tìm 2 số
   → Cách giải: Tổng phần = 2 + 4 = 6 → Mỗi phần = 72 ÷ 6 = 12 → Số 1 = 12 × 2 = 24, Số 2 = 12 × 4 = 48

VÍ DỤ SAI:
   ❌ "Bạn An có dây dài 12,5 mét. Dùng 3,5 mét. Còn lại bao nhiêu?" (chỉ trừ đơn giản)
   ❌ "2 nhóm có tổng 96 học sinh. Hỏi 1 nhóm có bao nhiêu?" (thiếu tỉ số)
   ❌ "Nhóm A có 20 cái bánh, bằng 40% nhóm B. Hỏi nhóm B?" (có phần trăm - KHÔNG được)
`;
  }

  _getTopicGuidanceTheTich() {
    return `
🎯 CHỦ ĐỀ CỤ THỀ: THỂ TÍCH - ĐƠN VỊ ĐO THỂ TÍCH
═══════════════════════════════════════════════════════
**DẠNG BÀI TOÁN "ĐỔI ĐƠN VỊ VÀ SO SÁNH THỂ TÍCH"**

CẤU TRÚC LỌC BẮT BUỘC:
✅ PHẢI CÓ:
   - HAI ĐẠI LƯỢNG THỂTÍCH ở NHỮNG ĐƠN VỊ KHÁC NHAU (ví dụ: m³ vs dm³ vs cm³)
   - YÊU CẦU ĐỔI ĐƠN VỊ rồi SO SÁNH hoặc CỘNG TRỪ
   - Bối cảnh thực tế có liên quan đến chứa/chứa được/đủ không

❌ TUYỆT ĐỐI KHÔNG:
   - KHÔNG chỉ là cộng/trừ số thường (12 + 8, 96 - 15...)
   - KHÔNG đổi đơn vị độ dài, khối lượng (chỉ đổi ĐƠN VỊ THỂTÍCH)
   - KHÔNG để việc ĐỔI ĐƠN VỊ là chi tiết phụ
   - KHÔNG thiếu sự so sánh hoặc cân bằng

VÍ DỤ ĐÚNG (từ file mẫu):
   Bài mẫu: "Bể nước 2500 dm³. Xe bồn chở 2,4 m³ nước. Xe có đủ không?"
   → Phải đổi: 2,4 m³ = ? dm³ → 2,4 × 1000 = 2400 dm³
   → So sánh: 2400 dm³ < 2500 dm³ → Không đủ, thiếu 100 dm³

VÍ DỤ SAI:
   ❌ "Nhân dân mua 50kg lạc, 30kg lạc. Tổng bao nhiêu?" (chỉ cộng số tự nhiên)
   ❌ "Bể 50L, thêm 20L nước. Bây giờ bao nhiêu L?" (không có so sánh, chỉ là cộng)
   ❌ "Chiếu 3 mét dài, 2 mét rộng. Tính chu vi" (không phải đơn vị thể tích)
`;
  }

  _getTopicGuidanceDienTich() {
    return `
🎯 CHỦ ĐỀ CỤ THỀ: DIỆN TÍCH VÀ THỂ TÍCH CỦA HÌNH KHỐI
═══════════════════════════════════════════════════════
**DẠNG BÀI TOÁN "TÍNH DIỆN TÍCH TOÀN PHẦN / THỂ TÍCH HÌNH HỘP CHỮ NHẬT / HÌNH LẬP PHƯƠNG"**

CẤU TRÚC LỌC BẮT BUỘC:
✅ PHẢI CÓ:
   - MÔ TẢ KÍCH THƯỚC HÌNH KHỐI cụ thể (chiều dài, chiều rộng, chiều cao / cạnh)
   - YÊU CẦU TÍNH DIỆN TÍCH TOÀN PHẦN hoặc THỂ TÍCH hoặc SO SÁNH thể tích
   - Bối cảnh thực tế (bọc quà, bể nước, xếp hộp, bơm nước...)
   - CÓ PHÉP TÍNH CỤ THỂ với công thức hình khối

❌ TUYỆT ĐỐI KHÔNG:
   - KHÔNG chỉ là cộng trừ nhân chia số đơn giản (4 × 6, 20 + 15...)
   - KHÔNG thiếu kích thước (nếu hình hộp phải có đủ 3 kích thước)
   - KHÔNG bị nhầm giữa diện tích và thể tích:
     • Diện tích toàn phần = bọc bên ngoài = cm² (Bài 51)
     • Thể tích = sức chứa bên trong = cm³ (Bài 52)
   - KHÔNG làm mòn bài toán thành phép tính quá đơn giản

VÍ DỤ ĐÚNG (từ file mẫu):
   ✅ Bài 51: "Hộp quà hình lập phương cạnh 10 cm. Bọc giấy kín. Cần giấy bao nhiêu?"
      → Công thức: V_toàn = 10 × 10 × 6 = 600 cm² (diện tích 6 mặt)
   
   ✅ Bài 52: "Bể 40×25 cm, mực nước 15 cm. Thả vật, mực dâng 18 cm. Thể tích vật?"
      → Tính thể tích lần 1: 40 × 25 × 15 = 15000 cm³
      → Tính thể tích lần 2: 40 × 25 × 18 = 18000 cm³
      → Thể tích vật = 18000 - 15000 = 3000 cm³

VÍ DỤ SAI:
   ❌ "Bạn mua gỗ dài 4 m, rộng 2 m. Tổng bao nhiêu?" (chỉ cộng 4 + 2, không có hình khối cụ thể)
   ❌ "Hộp hình vuông cạnh 5 cm. Tính chu vi" (chu vi ≠ hình khối, không phải diện tích/thể tích)
   ❌ "Có 3 hộp, mỗi hộp 500 cm³. Tính cái gì?" (không rõ yêu cầu, không liên quan đến hình khối cụ thể)
`;
  }

  _buildSimilarProblemPrompt(referenceProblem, context, difficultyGuidance, competencyAdjustment, topicFocus, specialTopicGuidance) {
    return `Bạn là giáo viên toán lớp 5 chuyên tạo bài tập luyện tập có chất lượng cao.

BÀI KHỞI ĐỘNG (MẪU):
${referenceProblem}

${context ? `CHỦ ĐỀ BÀI TẬP:
${context}
` : ''}

NHIỆM VỤ:
Tạo BÀI LUYỆN TẬP dựa vào bài khởi động trên:
${difficultyGuidance}
${competencyAdjustment}
${topicFocus}

${specialTopicGuidance}

YÊU CẦU TỐI QUAN TRỌNG:

1. ✅ PHẢI SỬ DỤNG KỸ NĂNG TOÁN HỌC CHÍNH CỦA CHỦ ĐỀ
2. ✅ TẬP TRUNG VÀO CHỦ ĐỀ CHÍNH
3. ✅ LOẠI BỎ HOÀN TOÀN PHẦN TRĂM (%) - TRỪ CHỦĐỀ PHẦN TRĂM
4. ✅ ĐỘ KHÓ PHẢI VỪA PHẢI CHO LỚP 5
5. ✅ CHỈ MỘT CÂU HỎI CUỐI
6. ✅ THAY ĐỔI BỐI CẢNH nhưng giữ nguyên cấu trúc
7. ✅ ĐỀ SÁNG TẠO NHƯNG RÕ RÀNG

HƯỚNG DẪN TRẢ LỜI:
- CHỈ trả về nội dung bài toán (không có "Bài toán mới:", "BÀI X LUYỆN TẬP:", không có lời giải)
- Bài toán phải là một đoạn văn liền mạch, tự nhiên, kết thúc bằng CHÍNH XÁC 1 CÂU HỎI duy nhất

Bài toán luyện tập:`;
  }

  _cleanGeneratedProblem(similarProblem) {
    // Loại bỏ "BÀI X LUYỆN TẬP" header
    similarProblem = similarProblem.replace(/^BÀI\s+[12]\s+LUYỆN\s*TẬP[\s\n]*/i, '');
    
    // Loại bỏ "Chủ đề bài thi:" lines
    similarProblem = similarProblem.replace(/^Chủ\s+đề\s+bài\s+thi:\s*[^\n]*[\n]*/i, '');
    
    // 🔧 Nếu có format "1. ... 2. ..." - giữ lại từ phần text của bài toán
    const lines = similarProblem.split('\n');
    let lastContentLineIndex = -1;
    let questionCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isQuestionLine = /^[1-9]\.\s+/.test(line);
      
      if (line && !isQuestionLine) {
        lastContentLineIndex = i;
      } else if (isQuestionLine) {
        questionCount++;
        if (questionCount === 1) {
          lastContentLineIndex = i;
        }
      }
    }
    
    if (questionCount > 1 && lastContentLineIndex >= 0) {
      const cleanedLines = lines.slice(0, lastContentLineIndex + 1);
      similarProblem = cleanedLines.join('\n').trim();
    }
    
    if (questionCount === 0) {
      similarProblem = lines.join('\n').trim();
    }
    
    return similarProblem;
  }

  _getExamTopicGuideTiSo() {
    return `
**HƯỚNG DẪN ĐẶC THỨ CHO CHỦĐỀ: TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN**

✅ LOẠI BÀI TOÁN:
- Dạng 1: Tỉ số, tỉ số phần trăm cơ bản (không có % ký hiệu)
- Dạng 2: Tìm hai số khi biết Tổng và Tỉ số
- Dạng 3: Tìm hai số khi biết Hiệu và Tỉ số
- Dạng 4: Tỉ lệ bản đồ

✅ BÀI TẬP 1 - TỐI ĐA 5 CÂUHỎI, DÙNG TỈ SỐ (KHÔNG %):
- Context: Bài toán có 2 đại lượng, tỉ số giữa chúng (ví dụ: A = 2/4 B)
- **QUAN TRỌNG**: KHÔNG có ký hiệu %, không hỏi phần trăm

✅ BÀI TẬP 2 - 4-6 CÂU HỎI, TUÂN THEO 4 BƯỚC POLYA:
- **KHÔNG hiển thị "[BƯỚC X]" trong questions**
- **SỬ DỤNG DỮ LIỆU CHÍNH XÁC TỪ CONTEXT**
`;
  }

  _getExamTopicGuideTheTich() {
    return `
**HƯỚNG DẪN ĐẶC THỨ CHO CHỦĐỀ: THỂ TÍCH - ĐƠN VỊ ĐO THỂ TÍCH**

✅ NỘI DUNG:
- Tính thể tích hình hộp chữ nhật: V = dài × rộng × cao
- Tính thể tích hình lập phương: V = cạnh × cạnh × cạnh
- Chuyển đổi đơn vị: cm³, dm³, m³ (1 m³ = 1000 dm³, 1 dm³ = 1000 cm³)
- So sánh thể tích của các hộp, bể nước

✅ BÀI TẬP 1 - 5 CÂU HỎI (TỐI ĐA):
- **KHÔNG có phần trăm (%)**
- **KHÔNG nhầm lẫn giữa cm³ với cm, dm³ với dm**

✅ BÀI TẬP 2 - 4-5 CÂU HỎI, TUÂN THEO 4 BƯỚC POLYA:
- **KHÔNG hiển thị "[BƯỚC X]" trong questions**
`;
  }

  _getExamTopicGuideDienTich() {
    return `
**HƯỚNG DẪN ĐẶC THỨ CHO CHỦĐỀ: DIỆN TÍCH VÀ THỂ TÍCH CỦA HỈ HÌNH KHỐI**

✅ NỘI DUNG:
- Diện tích xung quanh hình hộp chữ nhật: (dài + rộng) × 2 × cao
- Diện tích toàn phần hình hộp: diện tích xung quanh + 2 × (dài × rộng)
- Diện tích xung quanh hình lập phương: cạnh × cạnh × 4
- Diện tích toàn phần hình lập phương: cạnh × cạnh × 6
- Thể tích hình hộp chữ nhật: dài × rộng × cao
- Thể tích hình lập phương: cạnh × cạnh × cạnh

✅ BÀI TẬP 1 - 5 CÂU HỎI:
- **PHẢI phân biệt rõ giữa diện tích (cm²) và thể tích (cm³)**
- **KHÔNG nhầm lẫn xung quanh với toàn phần**

✅ BÀI TẬP 2 - 4-6 CÂU HỎI, TUÂN THEO 4 BƯỚC POLYA:
- **KHÔNG hiển thị "[BƯỚC X]" trong questions**
`;
  }

  _buildExamGenerationPrompt(topicName, lessonName, sampleSummary, topicSpecificGuide) {
    return `Bạn là chuyên gia tạo đề thi toán lớp 5. Dựa vào TEMPLATE EXAM dưới đây, hãy TẠO MỘT ĐỀ THI TƯƠNG ĐƯƠNG cho chủ đề "${topicName}", tiêu đề "${lessonName}".

TEMPLATE EXAM (để làm mẫu):
${sampleSummary}

${topicSpecificGuide}

YÊU CẦU CHUNG CHO TẤT CẢ CHỦĐỀ:
1. ✅ GIỮ NGUYÊN CẤU TRÚC TEMPLATE:
   - Số lượng bài tập, thời gian, số câu hỏi GIỐNG HỆT template
   - Kiểu câu hỏi (single/multiple) giữ nguyên
   - Số đáp án mỗi câu GIỮ NGUYÊN

2. ✅ TẠO NỘI DUNG LIÊN QUAN ĐẾN CHỦĐỀ "${topicName}"

3. ✅ BÀI TẬP 1 - CÂU HỎI DÙNG DỮ KIỆN CỤ THỂ TỪ CONTEXT

4. ✅ BÀI TẬP 2 - TUÂN THEO 4 BƯỚC POLYA (KHÔNG hiển thị "[BƯỚC X]" trong câu hỏi)

5. ✅ RANDOM VỊ TRÍ ĐÁP ÁN ĐÚNG

6. ✅ ĐỊNH DẠNG JSON CHÍNH XÁC:
   - Mỗi exercise: name, duration, context, questions, scoring
   - Mỗi question: id, question, type, options, correctAnswers (array indices), explanation
   - Type: "single" hoặc "multiple"
   - correctAnswers: array chỉ số (ví dụ: [1], [0, 2])

CHỈ RETURN JSON ARRAY, KHÔNG CÓ TEXT KHÁC.`;
  }
}

const geminiPracticeServiceInstance = new GeminiPracticeService();
export default geminiPracticeServiceInstance;
