/**
 * examGeneratorChuyenDongService.js
 * 
 * Chuyên dụng cho chủ đề: SỐ ĐO THỜI GIAN. VẬN TỐC. CHUYỂN ĐỘNG ĐỀU
 * Role: AI Agent chuyên gia Toán chuyển động lớp 5
 * 
 * Hiểu sâu: Mối liên hệ giữa Quãng đường (s), Vận tốc (v), Thời gian (t)
 * Công thức: s = v × t; v = s ÷ t; t = s ÷ v
 */

import geminiServiceInstance from './geminiService';

class ExamGeneratorChuyenDongService {
  async initialize() {
    return;
  }

  /**
   * Tạo đề thi cho chủ đề "Số đo thời gian. Vận tốc. Chuyển động đều"
   * @param {Object} params
   * @param {string} params.topicName - Tên chủ đề
   * @param {string} params.lessonName - Tên bài học
   * @param {Array} params.sampleExams - Danh sách các đề mẫu
   * @returns {Promise<Object>} - Đề thi mới
   */
  async generateExamFromSamples(params) {
    try {
      const { topicName, lessonName, sampleExams } = params;

      if (!sampleExams || sampleExams.length === 0) {
        throw new Error('Chưa có đề mẫu nào để tạo đề');
      }

      const prompt = `Bạn là một AI Agent chuyên gia Toán chuyển động lớp 5. Bạn hiểu sâu sắc về mối liên hệ giữa Quãng đường, Vận tốc và Thời gian. Khả năng suy luận logic theo phương pháp Polya và kiến thức sư phạm để soạn đề thi.

═══════════════════════════════════════════════════════════════
📚 **THÔNG TIN BÀI HỌC**
═══════════════════════════════════════════════════════════════
- **CHỦ ĐỀ**: ${topicName}
- **TÊN BÀI HỌC**: ${lessonName}

📋 **CÁC ĐỀ MẪU THAM KHẢO (chỉ tham khảo cấu trúc & phong cách)**:
${sampleExams.map((sample, idx) => `
[ĐỀ MẪU ${idx + 1}]: ${sample.lessonName}
${this._formatSampleContent(sample.content)}
`).join('')}

═══════════════════════════════════════════════════════════════
🎓 **HƯỚNG DẪN CHUYÊN MÔN - CHUYỂN ĐỘNG ĐỀU**
═══════════════════════════════════════════════════════════════

**CÔNG THỨC TRỌNG TÂM:**
- Quãng đường: s = v × t
- Vận tốc: v = s ÷ t
- Thời gian: t = s ÷ v

**ĐẶC ĐIỂM BÀI TOÁN CHUYỂN ĐỘNG:**

⚠️ **QUAN TRỌNG - CẤU TRÚC CONTEXT**:
- Phần mô tả tình huống (2-3 câu)
- Kết thúc bằng 1 **CÂU HỎI CHÍNH RÒ RÀNG** (in đậm hoặc tách riêng)
- Sau đó là 4-10 câu hỏi nhỏ theo 4 bước Polya để giải câu hỏi chính

1. **Bài toán tính quãng đường**:
   - Cho: Vận tốc (m/s hoặc km/h) và thời gian
   - Tìm: Quãng đường
   - Context: Xe chạy, đi bộ, chạy...

2. **Bài toán tính vận tốc**:
   - Cho: Quãng đường và thời gian
   - Tìm: Vận tốc (chỉ dùng m/s hoặc km/h)
   - Context: So sánh ai chạy nhanh hơn
   - PHẢI CÓ: Câu hỏi về đổi đơn vị (km/h → m/s hoặc m → km)

3. **Bài toán tính thời gian**:
   - Cho: Quãng đường (m hoặc km) và vận tốc (m/s hoặc km/h)
   - Tìm: Thời gian
   - Context: Mất bao lâu để đến nơi?
   - Chú ý: Đơn vị phải tương thích trước khi tính

4. **Bài toán so sánh chuyển động**:
   - So sánh 2 hoặc 3 đối tượng chuyển động
   - Phải quy về cùng đơn vị (km/h hoặc m/s)
   - Ví dụ: "Ai chạy nhanh hơn? Tại sao?"

5. **Bài toán chuyển động ngược chiều hoặc cùng chiều**:
   - Tính khoảng cách giữa 2 vật chuyển động cùng lúc
   - Hoặc tính thời gian gặp nhau
   - Tất cả đơn vị phải thống nhất

═══════════════════════════════════════════════════════════════
🔴 **KIỂM TRA LOGIC 4 BƯỚC POLYA**
═══════════════════════════════════════════════════════════════

**BƯỚC 1 - TÌM HIỂU BÀI TOÁN (1-2 câu):**
- Mục tiêu: Nhận diện đại lượng đã cho (s, v, t)
- Ví dụ: "Nội dung nào mô tả đúng bài toán?" / "Bài toán cho biết gì?"

**BƯỚC 2 - LẬP KẾ HOẠCH (1 câu):**
- Mục tiêu: Chọn công thức phù hợp
- Ví dụ: "Để tìm vận tốc, em sử dụng công thức nào?" / "Cần thực hiện phép tính gì?"

**BƯỚC 3 - THỰC HIỆN (2-3 câu):**
- Mục tiêu: Tính toán cụ thể
- Ví dụ: "Kết quả là bao nhiêu?" / "Giá trị v là?"

**BƯỚC 4 - KIỂM TRA & ĐÁNH GIÁ (TỐI THIỂU 2 CÂU):** ⚠️ BẮT BUỘC
- Mục tiêu: Kiểm tra tính hợp lý của kết quả
- Ví dụ:
  * "Vận tốc [X] km/h có hợp lý cho người đi bộ không?"
  * "Vì sao [đối tượng A] chạy nhanh hơn [đối tượng B]?"
  * "Cách nào để kiểm tra lại kết quả [kết quả vừa tìm]?"

🚨 **TUYỆT ĐỐI PHẢI CÓ ÍT NHẤT 2 CÂU HỎI BƯỚC 4 Ở CUỐI MỖI BÀI!**

═══════════════════════════════════════════════════════════════
⚠️ **LỖI THƯỜNG GẶP - TUYỆT ĐỐI TRÁNH**
═══════════════════════════════════════════════════════════════

🚫 **CẤM**: Vận tốc người đi bộ = 100 km/h
   → Người đi bộ chỉ khoảng 5-6 km/h, con chim 10-20 km/h, ô tô 40-100 km/h

🚫 **CẤM**: Sử dụng đơn vị m/phút (KHÔNG DÙNG m/phút!)
   → Chỉ dùng: m/s hoặc km/h (thống nhất trong cả bài)

🚫 **CẤM**: Forgot to convert units (km ↔ m, giờ ↔ phút)
   → Lúc nào cũng kiểm tra xem các đơn vị có tương thích không?

🚫 **CẤM**: Bài toán "so sánh vận tốc" mà không hỏi "ai chạy nhanh hơn?"
   → Phải luôn có câu so sánh thực tế

🚫 **CẤM**: Số liệu ra số thập phân lặp lại (0.333...) 
   → Chọn số chia hết hoặc ra thập phân đẹp

🚫 **CẤM**: Sử dụng dấu chấm (.) cho số thập phân
   → CHỈ dùng dấu phẩy (,) cho SỐ THẬP PHÂN (chuẩn tiếng Việt)
   → Ví dụ SAI: 3.5 km, 0.25 l, 12.4 km/h
   → Ví dụ ĐÚNG: 3,5 km, 0,25 l, 12,4 km/h
   → Áp dụng cho TẤT CẢ số thập phân trong context và explanation

🚫 **CẤM TUYỆT ĐỐI**: Số thập phân vô hạn tuần hoàn hoặc số hữu tỉ phức tạp
   → CHỈ dùng số thập phân "ĐẸP" - tức là HỮU HẠN và không lặp lại (terminating decimals)
   → Ví dụ SAI: 0,333... (1/3), 0,6666... (2/3), 0,1666... (1/6), 2,142857... (15/7)
   → Ví dụ ĐÚNG: 2,3 km/h, 3,45 m/s, 0,5 km, 1,25 phút, 0,75 giờ, 12,5 m/s, 0,125 km
   → Cách kiểm tra: Số thập phân "đẹp" khi kết thúc sau vài chữ số (không vô hạn)
   → Nếu phải tính, chọn số chia hết: 240÷8 = 30, 150÷5 = 30, 72÷4 = 18
   → TUYỆT ĐỐI đừng dùng: 1÷3, 2÷3, 1÷6, 1÷7, 5÷6, 4÷9, bất kỳ số nào ra vô hạn tuần hoàn

═══════════════════════════════════════════════════════════════
📋 **CẤU TRÚC PHẦN 1 (VẬN DỤNG - 2 phút)**
═══════════════════════════════════════════════════════════════

**Mục tiêu**: Nhận diện đại lượng s, v, t và áp dụng công thức cơ bản + ĐỔI ĐƠN VỊ

**Số câu hỏi**: 4-6 câu
**Thời gian**: 120 giây

**Nội dung**: 
- Context kết thúc bằng 1 câu hỏi chính rõ ràng
- Sau đó là 4-6 câu nhỏ theo 4 bước Polya để giải câu hỏi chính
- Hỏi về đổi đơn vị (km/h ↔ m/s hoặc kg ↔ tạ...)
- Tính toán cơ bản một trong ba đại lượng (s, v, t)
- Chỉ dùng m/s hoặc km/h (KHÔNG m/phút)

**Ví dụ Bối cảnh Bài 1:**
Phương tiện: Người đi bộ, xe đạp, xe máy hoặc ô tô
Yêu cầu: Cho quãng đường (m hoặc km) + thời gian → Tìm vận tốc
Chú ý: PHẢI CÓ ĐỔI ĐƠN VỊ (km→m, giờ→phút hoặc ngược lại)
Kết thúc context bằng 1 CÂU HỎI CHÍNH rõ ràng (in đậm hoặc tách riêng)
Sau đó là 4-6 câu nhỏ theo 4 bước Polya để giải"

═══════════════════════════════════════════════════════════════
📋 **CẤU TRÚC PHẦN 2 (GQVĐ - 3 phút 30 giây)**
═══════════════════════════════════════════════════════════════

**Mục tiêu**: So sánh chuyển động hoặc tính bài toán phức tạp

**Số câu hỏi**: 6-10 câu
**Thời gian**: 210 giây

**Nội dung**:
- Context kết thúc bằng 1 câu hỏi chính (so sánh vận tốc hoặc tính toán)
- Sau đó là 6-10 câu nhỏ theo 4 bước Polya để giải câu hỏi chính
- So sánh 2-3 đối tượng chuyển động
- Phải quy về cùng đơn vị (km/h hoặc m/s)
- Hỏi "ai nhanh hơn?" và "vì sao?"
- Chỉ dùng m/s hoặc km/h (KHÔNG m/phút)

**Ví dụ Bối cảnh Bài 2:**
Phương tiện: 2-3 đối tượng (So sánh vận tốc hoặc tính toán bài toán phức tạp)
Yêu cầu: So sánh ai chạy/đi nhanh hơn, hoặc tính toán với điều kiện phức tạp
Chú ý: PHẢI quy về cùng đơn vị (km/h hoặc m/s), hỏi "ai nhanh hơn?" và lý do
Kết thúc context bằng 1 CÂU HỎI CHÍNH rõ ràng (in đậm hoặc tách riêng)
Sau đó là 6-10 câu nhỏ theo 4 bước Polya để giải"

═══════════════════════════════════════════════════════════════
🎯 **QUY TẮC TRỌNG TÂM**
═══════════════════════════════════════════════════════════════

1. **BÀI 1 = Tính s/v/t + đổi đơn vị**: Luôn có đổi đơn vị (km↔m, h↔phút), chỉ dùng m/s hoặc km/h (KHÔNG m/phút)
2. **BÀI 2 = So sánh chuyển động**: Phải có "ai nhanh hơn?" + tính từng giá trị trước, quy về cùng đơn vị
3. **Context cấu trúc**: Kết thúc bằng 1 câu hỏi chính rõ ràng, sau đó là các câu nhỏ theo 4 bước Polya
4. **Kiểm tra hợp lý**: Vận tốc người bộ (5-6 km/h), xe máy (30-50 km/h), ô tô (40-120 km/h)
5. **Số liệu hợp lý**: Chia hết, không ra thập phân lặp lại
6. **Bắt buộc 2 CÂU BƯỚC 4**: Kiểm tra, so sánh ý nghĩa thực tế

═══════════════════════════════════════════════════════════════
📄 **ĐỊNH DẠNG JSON OUTPUT (PHẢI CHÍNH XÁC)**
═══════════════════════════════════════════════════════════════

{
  "topicName": "${topicName}",
  "lessonName": "${lessonName}",
  "exercises": [
    {
      "name": "Bài 1: [Tên liên quan ${lessonName}]",
      "duration": 120,
      "context": "[BỐI CẢNH TÍNH s/v/t + ĐỔI ĐƠN VỊ]",
      "questions": [
        {
          "id": "q1",
          "question": "[Câu hỏi]",
          "type": "single",
          "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
          "correctAnswers": [0],
          "explanation": "[Giải thích tại sao đúng/sai cho từng đáp án]"
        }
      ]
    },
    {
      "name": "Bài 2: [Tên liên quan SO SÁNH CHUYỂN ĐỘNG]",
      "duration": 210,
      "context": "[BỐI CẢNH SO SÁNH 2+ CHUYỂN ĐỘNG]",
      "questions": [...]
    }
  ]
}

**YÊU CẦU:**
- JSON hợp lệ, không markdown
- correctAnswers: array chỉ số 0-based
- **explanation PHẢI là STRING (text), KHÔNG phải object hoặc array**
  - Ví dụ: "explanation": "A đúng vì... B sai vì... C sai vì... D sai vì..."
- Mỗi bài tối thiểu có 2 câu hỏi BƯỚC 4
- Explanation chi tiết cho mỗi đáp án, dạng text thôi (không object)

═══════════════════════════════════════════════════════════════
⚠️ **TUYỆT ĐỐI BẮT BUỘC**
═══════════════════════════════════════════════════════════════

🔴 **KHÔNG COPY NHƯ NHÂN** - Các ví dụ trên CHỈ LÀ HƯỚNG DẪN CẤU TRÚC

**TẠO BỐI CẢNH MỚI, KHÁC BIỆT:**
- Thay đổi tên nhân vật (không dùng Nam, An, Bình liên tục)
- Thay đổi phương tiện (xe buýt, xe tải, chim bay, thuyền...)
- Thay đổi quãng đường và thời gian (số liệu khác hoàn toàn)
- Thay đổi hoàn cảnh bối cảnh (từ trường, công viên, thành phố...)

**VÍ DỤ BỐI CẢNH MỚI (KHÔNG COPY):**
- Thay vì "Nam đi bộ" → "Anh Huy chạy VĐT"
- Thay vì "xe đạp +  bộ" → "thuyền 1 + thuyền 2"
- Thay vì "1200 m, 20 phút" → "2400 m, 1 giờ" (số liệu khác)

═══════════════════════════════════════════════════════════════ 
- Phần 1: Context có 1 câu hỏi chính cuối cùng (tính s/v/t + đổi đơn vị), sau đó là 4-6 câu nhỏ theo 4 bước
- Phần 2: Context có 1 câu hỏi chính cuối cùng (so sánh), sau đó là 6-10 câu nhỏ theo 4 bước
- Chỉ dùng m/s hoặc km/h (KHÔNG dùng m/phút)
- Mỗi bài có TỐI THIỂU 2 CÂU HỎI BƯỚC 4
- Trả về JSON thuần túy, bắt đầu bằng { kết thúc bằng }.`;

      const result = await geminiServiceInstance._feedbackService._rateLimitedGenerate(prompt);
      let responseText = result ? result.response.text() : '';

      // Strip markdown code blocks
      responseText = responseText.replace(/```[\w]*\n?/g, '').trim();

      // Extract JSON
      let firstBrace = responseText.indexOf('{');
      let lastBrace = responseText.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        throw new Error('Không thể phân tích đáp án từ AI');
      }

      let jsonStr = responseText.substring(firstBrace, lastBrace + 1).trim();
      const sanitizedJson = this._sanitizeJsonString(jsonStr);
      let generatedExam = JSON.parse(sanitizedJson);
      
      // Convert decimal separators from . to , (Vietnamese format)
      generatedExam = this._convertDecimalSeparators(generatedExam);

      return {
        success: true,
        data: generatedExam
      };
    } catch (error) {
      console.error('❌ Lỗi khi tạo đề chuyển động:', error.message);
      return {
        success: false,
        error: error.message || 'Không thể tạo đề từ AI'
      };
    }
  }

  /**
   * Format sample content for AI
   * @private
   */
  _formatSampleContent(content) {
    if (Array.isArray(content)) {
      return content.map((exercise, idx) => {
        const questionsText = exercise.questions?.map((q, qIdx) => {
          if (typeof q === 'string') return `${qIdx + 1}. ${q}`;
          return `${qIdx + 1}. ${q.question || q.text}`;
        }).join('\n') || '';

        return `Bài: ${exercise.name}
Thời gian: ${exercise.duration}s
Số câu: ${exercise.questions?.length || 0}
${questionsText}`;
      }).join('\n---\n');
    }

    if (typeof content === 'string') {
      return content;
    }

    return JSON.stringify(content, null, 2);
  }

  /**
   * Sanitize JSON string
   * @private
   */
  _sanitizeJsonString(jsonStr) {
    try {
      return JSON.stringify(JSON.parse(jsonStr));
    } catch (e) {
      console.log('⚠️ JSON parse failed, attempting sanitization');

      let sanitized = jsonStr
        .trim()
        .replace(/^\ufeff/, '')
        .replace(/:\s*"([^"]*?)[\r\n]+([^"]*?)"/g, (match, before, after) => {
          return ': "' + before + '\\n' + after.replace(/[\r\n]/g, '\\n') + '"';
        });

      try {
        return JSON.stringify(JSON.parse(sanitized));
      } catch (e2) {
        sanitized = sanitized
          .replace(/[\r\n]+/g, ' ')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/:\s*undefined/g, ': null');

        return JSON.stringify(JSON.parse(sanitized));
      }
    }
  }

  /**
   * Convert decimal separators from . to , (Vietnamese format)
   * Recursively processes all string values in the object
   * @private
   */
  _convertDecimalSeparators(obj) {
    if (typeof obj === 'string') {
      // Replace decimal dots with commas in numbers
      // Pattern: digit.digit (but not URLs or IP addresses)
      return obj.replace(/(\d)\.(\d)/g, '$1,$2');
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this._convertDecimalSeparators(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const converted = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          converted[key] = this._convertDecimalSeparators(obj[key]);
        }
      }
      return converted;
    }

    return obj;
  }
}

const examGeneratorChuyenDongServiceInstance = new ExamGeneratorChuyenDongService();
export default examGeneratorChuyenDongServiceInstance;
