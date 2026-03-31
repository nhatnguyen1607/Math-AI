

import geminiServiceInstance from './geminiService';

class ExamGeneratorTiSoService {
  async initialize() {
    return;
  }

  /**
   * Tạo đề thi cho chủ đề "Tỉ số và các bài toán liên quan"
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

      const prompt = `Bạn là một AI Agent chuyên gia sư phạm Toán lớp 5, chuyên về mảng "Tỉ số và các bài toán liên quan". Bạn có khả năng suy luận logic theo phương pháp Polya và kiến thức sư phạm để soạn đề thi.

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
🎓 **HƯỚNG DẪN CHUYÊN MÔN - CHỦ ĐỀ TỈ SỐ**
═══════════════════════════════════════════════════════════════

**PHÂN LOẠI BÀI HỌC TRONG CHỦ ĐỀ:**

**Bài 36. Tỉ số. Tỉ số phần trăm:**
- Context: So sánh 2 đại lượng cùng loại (bi đỏ/xanh, sách loại A/B, táo/cam...)
- Bài 1 (Vận dụng): Tính tỉ số đơn giản, rút gọn hoặc so sánh 2 tỉ số
- Bài 2 (GQVĐ): Bài toán lời văn có thêm bước tìm tỉ số

**Bài 37. Tỉ lệ bản đồ:**
- Context: BẮT BUỘC về bản đồ tỉ lệ 1:xxx (1:500, 1:1000, 1:10000...)
- Bài 1 (Vận dụng): Cho kích thước trên bản đồ, tìm kích thước thực tế
- Bài 2 (GQVĐ): Tính diện tích thực tế hoặc bài toán phức tạp hơn

**Bài 38. Tìm hai số khi biết tổng và tỉ số:**
- Context: Cho TỔNG và TỈ SỐ (VD: "72 cuốn sách, nhóm A bằng 2/4 nhóm B")
- Bài 1 (Vận dụng): Dạng cơ bản - tìm 2 số khi biết tổng và tỉ số
- Bài 2 (GQVĐ): Có thêm yếu tố so sánh hoặc điều chỉnh

**Bài 39. Tìm hai số khi biết hiệu và tỉ số:**
- Context: Cho HIỆU và TỈ SỐ (VD: "Anh hơn em 12 tuổi, tuổi anh bằng 5/3 tuổi em")
- Bài 1 (Vận dụng): Dạng cơ bản - tìm 2 số khi biết hiệu và tỉ số
- Bài 2 (GQVĐ): Bài toán có điều kiện phụ hoặc kiểm tra kết quả

**Bài 40. Tìm tỉ số phần trăm của hai số:**
- Context: Cho 2 số, tìm số này chiếm bao nhiêu % của số kia (VD: "28kg/80kg = ?%")
- Bài 1 (Vận dụng): Tính % đơn giản
- Bài 2 (GQVĐ): Có thay đổi dữ liệu rồi so sánh % trước/sau

**Bài 41. Tìm giá trị phần trăm của một số:**
- Context: Cho một số và %, tìm giá trị tương ứng (VD: "40 HS, 25% được khen = ? HS")
- Bài 1 (Vận dụng): Tính giá trị % đơn giản
- Bài 2 (GQVĐ): Bài toán có nhiều mức % hoặc so sánh

═══════════════════════════════════════════════════════════════
🔴 **KIỂM TRA LOGIC 4 BƯỚC POLYA**
═══════════════════════════════════════════════════════════════

**BƯỚC 1 - TÌM HIỂU BÀI TOÁN (1-2 câu):**
- Mục tiêu: Học sinh xác định được dữ kiện và yêu cầu
- Ví dụ: "Nội dung nào mô tả đúng bài toán?" / "[Khái niệm X] có ý nghĩa gì?"

**BƯỚC 2 - LẬP KẾ HOẠCH (1 câu):**
- Mục tiêu: Học sinh chọn công thức/phương pháp
- Ví dụ: "Để tìm X, em cần làm gì?" / "Tổng số phần bằng nhau là?"

**BƯỚC 3 - THỰC HIỆN (2-3 câu):**
- Mục tiêu: Học sinh tính toán cụ thể
- Ví dụ: "Kết quả là bao nhiêu?" / "Giá trị X là?"

**BƯỚC 4 - KIỂM TRA & ĐÁNH GIÁ (TỐI THIỂU 2 CÂU):** ⚠️ BẮT BUỘC
- Mục tiêu: Xác minh kết quả, giải thích ý nghĩa
- Ví dụ: 
  * "Vì sao [kết quả] lớn/nhỏ hơn [kết quả khác]?"
  * "[Kết quả] cho ta biết điều gì?"
  * "Cách nào để kiểm tra lại [kết quả]?"

🚨 **TUYỆT ĐỐI PHẢI CÓ ÍT NHẤT 2 CÂU HỎI KIỂM TRA Ở CUỐI MỖI BÀI!**

═══════════════════════════════════════════════════════════════
⚠️ **LỖI THƯỜNG GẶP - TUYỆT ĐỐI TRÁNH**
═══════════════════════════════════════════════════════════════

🚫 **CẤM**: Bài "Tỉ số phần trăm" + Context "20 bi đỏ, 15 bi xanh"
   → Đây là TỈ SỐ thuần (Bài 36), không phải tỉ số phần trăm!
✅ **ĐÚNG**: "80kg giấy, 28kg phân loại đúng. Chiếm bao nhiêu %?"

🚫 **CẤM**: Bài "Tỉ lệ bản đồ" + Context "30 cây cam, 45 cây bưởi"
   → Đây là TỈ SỐ!
✅ **ĐÚNG**: "Bản đồ 1:1000, đường dài 5cm. Thực tế dài bao nhiêu?"

🚫 **CẤM**: Dùng ví dụ "Học sinh nam và nữ" quá nhiều
   → Thay bằng: bi, sách, quả, gà, vịt, ô tô, tiền, cây...

🚫 **CẤM**: Sử dụng dấu chấm (.) cho số thập phân
   → CHỈ dùng dấu phẩy (,) cho SỐ THẬP PHÂN (chuẩn tiếng Việt)
   → Ví dụ SAI: 3.5, 0.25, 12.4%
   → Ví dụ ĐÚNG: 3,5, 0,25, 12,4%
   → Áp dụng cho TẤT CẢ số thập phân trong context và explanation

🚫 **CẤM TUYỆT ĐỐI**: Số thập phân vô hạn tuần hoàn hoặc số hữu tỉ phức tạp
   → CHỈ dùng số thập phân "ĐẸP" - tức là HỮU HẠN và không lặp lại (terminating decimals)
   → Ví dụ SAI: 0,333... (1/3), 0,6666... (2/3), 0,1666... (1/6), 2,142857... (15/7)
   → Ví dụ ĐÚNG: 2,3, 3,45, 0,5, 1,25, 0,75, 12,5%, 0,125, 33,33% (có thể dùng % nếu hợp lý)
   → Cách kiểm tra: Số thập phân "đẹp" khi kết thúc sau vài chữ số (không vô hạn)
   → Nếu phải tính, chọn số chia hết: 24÷8 = 3, 15÷5 = 3, 80÷4 = 20
   → TUYỆT ĐỐI đừng dùng: 1÷3, 2÷3, 1÷6, 1÷7, 5÷6, 4÷9, bất kỳ số nào ra vô hạn tuần hoàn

═══════════════════════════════════════════════════════════════
📋 **CẤU TRÚC PHẦN 1 (VẬN DỤNG - 2 phút)**
═══════════════════════════════════════════════════════════════

**Mục tiêu**: Nhận diện, tóm tắt bài toán tỉ số cơ bản

**Số câu hỏi**: 4-5 câu
**Thời gian**: 120 giây

**Nội dung**: Context nhỏ, đơn giản, chủ yếu hỏi về:
- Khái niệm (Tỉ số là gì? Bản đồ tỉ lệ có ý nghĩa gì?)
- Nhận diện dữ kiện (Cho biết gì? Cần tìm gì?)
- Tính toán cơ bản

**Ví dụ Context Bài 1:**
"Trong vườn hoa của trường, cô giáo trồng hoa hồng đỏ và hoa hồng hồng. Cô đã trồng 24 bông hoa hồng đỏ và 36 bông hoa hồng hồng. Tỉ số giữa số hoa hồng đỏ so với số hoa hồng hồng là bao nhiêu? Rút gọn tỉ số này."

═══════════════════════════════════════════════════════════════
📋 **CẤU TRÚC PHẦN 2 (GQVĐ - 3 phút 30 giây)**
═══════════════════════════════════════════════════════════════

**Mục tiêu**: Giải quyết bài toán phức tạp (tổng/hiệu + tỉ số)

**Số câu hỏi**: 6-10 câu
**Thời gian**: 210 giây

**Nội dung**: Context phức tạp hơn, yêu cầu:
- Lập kế hoạch giải
- Tính "tổng số phần" hoặc "giá trị một phần"
- Tìm từng số
- Kiểm tra lại

**Ví dụ Context Bài 2:**
"Một trường tiểu học có 480 học sinh. Biết số học sinh nam bằng 5/7 số học sinh nữ. Hỏi trường có bao nhiêu học sinh nam và bao nhiêu học sinh nữ?"

═══════════════════════════════════════════════════════════════
🎯 **QUY TẮC TRỌNG TÂM**
═══════════════════════════════════════════════════════════════

1. **BÀI 1 và BÀI 2 phải CÙNG bài học**: Không được chuyển sang bài học khác!
2. **BÀI 2 khó hơn BÀI 1**: Thêm bước tính, so sánh, hoặc dữ liệu phức tạp
3. **Mỗi bài TỐI THIỂU 2 CÂU HỎI BƯỚC 4**: Kiểm tra lại kết quả (BẮAT BUỘC!)
4. **Số liệu hợp lý**: Chia hết hoặc ra số nguyên/phân số đẹp
5. **Context phải hoàn chỉnh**: Nêu rõ dữ kiện và yêu cầu

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
      "context": "[BỐI CẢNH ĐÚNG VỚI ${lessonName}]",
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
      "name": "Bài 2: [Tên khác VẦN VỀ ${lessonName}]",
      "duration": 210,
      "context": "[BỐI CẢNH PHỨC TẠP, VẲN ĐÚNG ${lessonName}]",
      "questions": [...]
    }
  ]
}

**YÊU CẦU:**
- JSON hợp lệ, không markdown
- correctAnswers: array chỉ số 0-based
- **explanation PHẢI là STRING (text), KHÔNG phải object hoặc array**
  - Ví dụ: "explanation": "A đúng vì... B sai vì... C sai vì... D sai vì..."
- Mỗi bài tối thiểu có 2 câu hỏi BƯỚC 4 (kiểm tra lại)
- Explanation chi tiết cho mỗi đáp án, dạng text thôi (không object)

═══════════════════════════════════════════════════════════════

**BẮT ĐẦU**: Tạo đề cho bài "${lessonName}". CẢ 2 BÀI đều phải về "${lessonName}". Mỗi bài có TỐI THIỂU 2 CÂU HỎI BƯỚC 4. Trả về JSON thuần túy, bắt đầu bằng { kết thúc bằng }.`;

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
      console.error('❌ Lỗi khi tạo đề tỉ số:', error.message);
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

const examGeneratorTiSoServiceInstance = new ExamGeneratorTiSoService();
export default examGeneratorTiSoServiceInstance;
