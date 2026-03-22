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

export class GeminiPracticeServiceTimeVelocity extends GeminiPracticeService {
  
  _getLessonSpecificGuidance(lessonName) {
    const guidance = {
      "Các đơn vị đo thời gian": "Trọng tâm: Đổi đơn vị (giây, phút, giờ, ngày). Lỗi: Nhầm hệ số 60 thành 100.",
      "Cộng, trừ số đo thời gian": "Trọng tâm: Tính toán và nhớ chuyển đổi đơn vị nếu phần dư quá 60.",
      "Nhân, chia số đo thời gian với một số": "Trọng tâm: Đặt tính nhân chia, xử lý phần dư thời gian.",
      "Vận tốc của một chuyển động đều": "Công thức v = s : t. Yêu cầu BẮT BUỘC: Câu hỏi cuối cùng phải là tính vận tốc. Chú ý đơn vị km/giờ, m/phút.",
      "Quãng đường, thời gian của một chuyển động đều": "Công thức s = v × t hoặc t = s : v. Yêu cầu BẮT BUỘC: Hỏi đúng đại lượng Quãng đường hoặc Thời gian theo nội dung bài học."
    };
    return guidance[lessonName] || "Toán chuyển động đều lớp 5.";
  }

  // CẬP NHẬT MỚI: Định nghĩa lại độ khó sắc bén hơn, khóa chặt dạng toán
  _getDifficultyGuidance(competencyLevel, topicName) {
    const level = String(competencyLevel || "Đạt").toLowerCase();
    if (level.includes("cần cố gắng")) {
      return `🔴 MỨC DỄ: 1 phép tính trực tiếp đúng chuẩn dạng "${topicName}". Cho sẵn đầy đủ các đại lượng cần thiết (Ví dụ bài Vận tốc thì cho sẵn s và t chuẩn đơn vị). Lời văn cực kỳ đơn giản, không bẫy, không yêu cầu đổi đơn vị.`;
    } else if (level.includes("đạt")) {
      return `🟡 MỨC TRUNG BÌNH: 2 phép tính. Học sinh phải thực hiện 1 bước tính toán trung gian (Ví dụ: Đổi đơn vị từ phút sang giờ, hoặc làm 1 phép trừ để tìm thời gian thực đi), SAU ĐÓ mới dùng số liệu đó để giải quyết yêu cầu chính của bài "${topicName}".`;
    } else {
      return `🟢 MỨC KHÓ (VẬN DỤNG CAO): 3 phép tính trở lên. Tình huống phức tạp: có thời gian nghỉ dọc đường, xuất phát không cùng lúc, hoặc phải tính quãng đường của từng đoạn. Học sinh phải lập luận, tính qua nhiều bước trung gian, BƯỚC CUỐI CÙNG bắt buộc phải áp dụng công thức của bài "${topicName}" để chốt câu trả lời.`;
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
    const topicName = context || "Vận tốc của một chuyển động đều";
    const lessonGuidance = this._getLessonSpecificGuidance(topicName);
    const difficultyGuidance = this._getDifficultyGuidance(competencyLevel, topicName);

    const prompt = `Bạn là chuyên gia ra đề toán tiểu học siêu việt.
CHỦ ĐỀ & TRỌNG TÂM HIỆN TẠI: ${topicName}

[TIẾN TRÌNH & RÀNG BUỘC KỸ THUẬT]
Bài 56: Các đơn vị đo thời gian -> Bài 57: Cộng, trừ số đo thời gian -> Bài 58: Nhân, chia số đo thời gian với một số -> Bài 59: Vận tốc của một chuyển động đều -> Bài 60: Quãng đường, thời gian của một chuyển động đều.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. TUYỆT ĐỐI KHÔNG dùng khái niệm/công thức của các bài học đứng sau bài "${topicName}".
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải hỏi ĐÚNG ĐẠI LƯỢNG trọng tâm của bài "${topicName}". (Ví dụ: Đang ở bài 59 thì câu hỏi chốt phải là "tính vận tốc", tuyệt đối không hỏi ngược lại quãng đường hay thời gian).

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
Mức năng lực: ${competencyLevel}
Yêu cầu sinh đề: ${difficultyGuidance}
Lưu ý chuyên môn: ${lessonGuidance}

[YÊU CẦU ĐẦU RA JSON BẮT BUỘC]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Bước 1: Phân tích yêu cầu dạng toán ${topicName}. Bước 2: Thiết kế các bước giải tương ứng với độ khó (có đổi đơn vị/tính thời gian nghỉ không). Bước 3: Chốt câu hỏi cuối cùng đảm bảo đúng dạng ${topicName}.",
  "de_bai": "Viết trực tiếp đề bài tự luận. KHÔNG có trắc nghiệm. KHÔNG lời dẫn."
}`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const parsed = extractJSON(result?.response.text() || "");
      
      if (parsed && parsed.de_bai) {
        return this._cleanGeneratedProblem(parsed.de_bai);
      }
      return "Một người đi xe máy trong 2 giờ được quãng đường dài 70km. Tính vận tốc của người đi xe máy đó.";
    } catch (error) {
      console.error("Lỗi sinh đề:", error);
      return "Một con đà điểu khi chạy có thể đạt vận tốc 42 km/giờ. Tính quãng đường con đà điểu đó chạy được trong 2 giờ.";
    }
  }

  async generateApplicationProblem(studentContext) {
    const {
      errorsInKhoiDong = [],
      weaknessesInLuyenTap = {},
      topicName = "Vận tốc của một chuyển động đều",
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
Bài 56: Các đơn vị đo thời gian -> Bài 57: Cộng, trừ số đo thời gian -> Bài 58: Nhân, chia số đo thời gian với một số -> Bài 59: Vận tốc của một chuyển động đều -> Bài 60: Quãng đường, thời gian của một chuyển động đều.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. Cấm dùng kiến thức vượt cấp.
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải là dạng toán "${topicName}". Không được nhầm lẫn sang đại lượng khác.

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
Mức năng lực: ${competencyLevel}
Yêu cầu sinh đề: ${difficultyGuidance}
Lỗi HS hay mắc: ${errorLog || "Không có lỗi cụ thể"}. (Tạo tình huống để rèn luyện tránh lỗi này).

[YÊU CẦU ĐẦU RA JSON BẮT BUỘC]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Phân tích bối cảnh bài toán cho mức ${competencyLevel}. Đảm bảo học sinh phải tính toán trung gian trước khi chốt câu hỏi đúng kiến thức ${topicName}.",
  "de_bai": "Chỉ sinh 1 bài toán ngắn gọn (dưới 100 từ). Cấm trắc nghiệm. Không tiêu đề."
}`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const parsed = extractJSON(result?.response.text() || "");
      
      if (parsed && parsed.de_bai) {
        return this._cleanGeneratedProblem(parsed.de_bai);
      }
      return "Lúc 7 giờ 15 phút, một ô tô xuất phát từ A đi về B. Dọc đường ô tô nghỉ 15 phút và đến B lúc 10 giờ. Biết quãng đường AB dài 125km. Tính vận tốc của ô tô.";
    } catch (error) {
      console.error("Lỗi sinh đề vận dụng:", error);
      return "Một xe đạp đi với vận tốc 12 km/giờ. Hỏi xe đạp đó đi quãng đường 30 km hết bao nhiêu thời gian?";
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

const geminiPracticeServiceTimeVelocity = new GeminiPracticeServiceTimeVelocity();
export default geminiPracticeServiceTimeVelocity;