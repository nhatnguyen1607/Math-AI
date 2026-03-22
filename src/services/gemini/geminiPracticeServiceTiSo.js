import { GeminiPracticeService } from "./geminiPracticeService";

const extractJSON = (text) => {
  try {
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonString = text.substring(startIndex, endIndex + 1);
      return JSON.parse(jsonString);
    }
    return null;
  } catch (error) {
    console.warn('Lỗi khi parse JSON:', error);
    return null;
  }
};

export class GeminiPracticeServiceTiSo extends GeminiPracticeService {
  
  _getLessonSpecificGuidance(lessonName) {
    const guidance = {
      "Tỉ số đơn giản": "Trọng tâm: Biểu diễn a : b hay a/b. Lỗi: Nhầm thứ tự, quên rút gọn.",
      "Chia theo tỉ số": "Công thức: Chia tổng thành các phần theo tỉ số cho trước. Lỗi: Quên tổng số phần, tính sai.",
      "Tỉ số phần trăm": "Trọng tâm: Hiểu ý nghĩa tỉ số %. Lỗi: Quên ký hiệu %.",
      "Tìm tỉ số phần trăm của hai số": "Công thức: (a : b) x 100. Yêu cầu BẮT BUỘC: Câu hỏi phải là tìm tỉ số phần trăm của A và B. Lỗi: Lấy b chia a.",
      "Tìm giá trị phần trăm của một số": "Công thức: a x (p/100). Yêu cầu: Cho biết tổng và %, tìm giá trị cụ thể.",
      "So sánh tỉ số": "Quy đồng mẫu số hoặc tính giá trị thập phân để so sánh.",
      "Tỉ lệ thuận": "Hai đại lượng tỉ lệ thuận: y = k × x."
    };
    return guidance[lessonName] || "Toán về tỉ số lớp 5.";
  }

  // CẬP NHẬT MỚI: Định nghĩa lại độ khó sắc bén hơn, khóa chặt dạng toán
  _getDifficultyGuidance(competencyLevel, topicName) {
    const level = String(competencyLevel || "Đạt").toLowerCase();
    if (level.includes("cần cố gắng")) {
      return `🔴 MỨC DỄ: 1 phép tính trực tiếp đúng chuẩn dạng "${topicName}". Cho sẵn các số liệu cần thiết. (Ví dụ nếu bài là 'Tìm tỉ số % của hai số', hãy cho luôn 2 số và bắt tính tỉ số %). Lời văn cực kỳ đơn giản, không bẫy.`;
    } else if (level.includes("đạt")) {
      return `🟡 MỨC TRUNG BÌNH: 2 phép tính. Học sinh phải thực hiện 1 bước tính toán trung gian (cộng/trừ đơn giản hoặc đổi đơn vị) để tìm ra số liệu, SAU ĐÓ mới dùng số liệu đó để giải quyết yêu cầu của bài "${topicName}".`;
    } else {
      return `🟢 MỨC KHÓ (VẬN DỤNG CAO): 3 phép tính trở lên. Số liệu bị ẩn giấu kỹ trong một tình huống thực tế. Học sinh phải lập luận, tính tổng/hiệu/tích/thương qua nhiều bước để tìm ra các đại lượng ẩn, BƯỚC CUỐI CÙNG mới áp dụng công thức của bài "${topicName}" để trả lời câu hỏi.`;
    }
  }

  async generateSimilarProblem(
    startupProblem1,
    startupProblem2,
    context = "",
    problemNumber = 1,
    competencyLevel = "Đạt",
    startupPercentage = 100,
    specificWeaknesses = ""
  ) {
    // ✅ FIX: Use 'context' from params as topicName (Vietnamese lesson name)
    const topicName = context || "Tỉ số đơn giản";
    const lessonGuidance = this._getLessonSpecificGuidance(topicName);
    const difficultyGuidance = this._getDifficultyGuidance(competencyLevel, topicName);

    const prompt = `Bạn là chuyên gia ra đề toán tiểu học siêu việt.
CHỦ ĐỀ & TRỌNG TÂM HIỆN TẠI: ${topicName}

[TIẾN TRÌNH & RÀNG BUỘC KỸ THUẬT]
Bài 36: Tỉ số, Tỉ số phần trăm -> Bài 37: Tỉ lệ bản đồ -> Bài 38: Tìm hai số khi biết Tổng và Tỉ -> Bài 39: Tìm hai số khi biết Hiệu và Tỉ -> Bài 40: Tìm tỉ số phần trăm của hai số -> Bài 41: Tìm giá trị phần trăm của một số.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. TUYỆT ĐỐI KHÔNG dùng khái niệm của các bài học đứng sau bài "${topicName}".
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải hỏi ĐÚNG DẠNG của bài "${topicName}". (Ví dụ: Đang ở bài 40 thì phải hỏi "tỉ số phần trăm là bao nhiêu?", cấm hỏi ngược lại giá trị cụ thể của bài 41).

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
Mức năng lực: ${competencyLevel}
Yêu cầu sinh đề: ${difficultyGuidance}
Lưu ý chuyên môn: ${lessonGuidance}

[YÊU CẦU ĐẦU RA JSON BẮT BUỘC]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Bước 1: Phân tích yêu cầu dạng toán ${topicName}. Bước 2: Thiết kế các bước giải tương ứng với độ khó. Bước 3: Chốt câu hỏi cuối cùng đảm bảo đúng dạng ${topicName}.",
  "de_bai": "Viết trực tiếp đề bài tự luận. KHÔNG có trắc nghiệm. KHÔNG lời dẫn."
}`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const parsed = extractJSON(result?.response.text() || "");
      
      if (parsed && parsed.de_bai) {
        return this._cleanGeneratedProblem(parsed.de_bai);
      }
      return "Một lớp học có 18 học sinh nữ và 12 học sinh nam. Tìm tỉ số phần trăm của số học sinh nữ và tổng số học sinh của lớp đó.";
    } catch (error) {
      console.error("Lỗi sinh đề:", error);
      return "Trong vườn có 25 cây cam và 75 cây bưởi. Tỉ số phần trăm của số cây cam so với tổng số cây trong vườn là bao nhiêu?";
    }
  }

  async generateApplicationProblem(studentContext) {
    const {
      errorsInKhoiDong = [],
      weaknessesInLuyenTap = {},
      topicName = "Tỉ số",
      competencyLevel = "Đạt"
    } = studentContext;

    // ✅ FIX: Extract nhanXet (comments) from TC1-TC4 objects in weaknessesInLuyenTap
    const practiceComments = Object.values(weaknessesInLuyenTap)
      .map(tc => tc?.nhanXet)
      .filter(comment => comment && typeof comment === 'string' && comment.trim());
    
    const errorLog = [...errorsInKhoiDong, ...practiceComments].join("; ");
    const difficultyGuidance = this._getDifficultyGuidance(competencyLevel, topicName);

    const prompt = `TẠO ĐỀ TOÁN VẬN DỤNG THỰC TẾ. 
CHỦ ĐỀ & TRỌNG TÂM HIỆN TẠI: ${topicName}

[TIẾN TRÌNH & RÀNG BUỘC KỸ THUẬT]
Bài 36: Tỉ số, Tỉ số phần trăm -> Bài 37: Tỉ lệ bản đồ -> Bài 38: Tìm hai số khi biết Tổng và Tỉ -> Bài 39: Tìm hai số khi biết Hiệu và Tỉ -> Bài 40: Tìm tỉ số phần trăm của hai số -> Bài 41: Tìm giá trị phần trăm của một số.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. Cấm dùng kiến thức vượt cấp.
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải là dạng toán "${topicName}". Không được nhầm lẫn sang bài khác.

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
Mức năng lực: ${competencyLevel}
Yêu cầu sinh đề: ${difficultyGuidance}
Lỗi HS hay mắc: ${errorLog || "Không có lỗi cụ thể"}.

[YÊU CẦU ĐẦU RA JSON BẮT BUỘC]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Phân tích số liệu bị ẩn cho mức ${competencyLevel}. Đảm bảo câu hỏi cuối cùng hỏi đúng kiến thức ${topicName}.",
  "de_bai": "Chỉ sinh 1 bài toán ngắn gọn (dưới 100 từ). Cấm trắc nghiệm. Không tiêu đề."
}`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const parsed = extractJSON(result?.response.text() || "");
      
      if (parsed && parsed.de_bai) {
        return this._cleanGeneratedProblem(parsed.de_bai);
      }
      return "Một cửa hàng nhập về 400kg gạo. Buổi sáng bán được 120kg, buổi chiều bán được 160kg. Hỏi số gạo đã bán chiếm bao nhiêu phần trăm tổng số gạo nhập về?";
    } catch (error) {
      console.error("Lỗi sinh đề vận dụng:", error);
      return "Một thư viện có 500 quyển sách. Sau khi cho mượn, thư viện còn lại 350 quyển. Hỏi số sách đã cho mượn chiếm bao nhiêu phần trăm tổng số sách?";
    }
  }

  _cleanGeneratedProblem(problem) {
    if (!problem) return "";
    return problem
      .replace(/^(Dưới đây là|Bài toán|Đề bài|Bài vận dụng|Bạn hãy giải quyết|Câu hỏi|Lời dẫn):/gi, "")
      .replace(/^(Chào bạn|Đây là bài toán).*?\n/gi, "")
      .replace(/```[a-z]*\n?|```/g, "")
      .replace(/\.(?=\d)/g, ",") 
      .trim();
  }
}

const geminiPracticeServiceTiSo = new GeminiPracticeServiceTiSo();
export default geminiPracticeServiceTiSo;