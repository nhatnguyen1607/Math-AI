import { GeminiPracticeService } from "./geminiPracticeService";

/**
 * GeminiPracticeServiceTiSo - Educational Architect 2026
 * Sinh đề toán tự luận về Tỉ số và đảm bảo nội dung phù hợp phương pháp Polya.
 */
export class GeminiPracticeServiceTiSo extends GeminiPracticeService {
  
  _getLessonSpecificGuidance(lessonName) {
    const guidance = {
      "Tỉ số đơn giản": "Trọng tâm: Biểu diễn a : b hay a/b[cite: 5]. Lỗi: Nhầm thứ tự, quên rút gọn[cite: 8]. Ví dụ: 4 : 6 = 2 : 3[cite: 9].",
      "Chia theo tỉ số": "Công thức: Chia tổng thành các phần theo tỉ số cho trước[cite: 10]. Lỗi: Quên tổng số phần, tính sai[cite: 11]. Ví dụ: tỉ 2 : 3 có 2 + 3 = 5 phần[cite: 12].",
      "Tỉ số phần trăm": "Công thức: (Phần / Tổng) × 100%[cite: 13]. Lỗi: Đảo ngược tử số và mẫu số[cite: 14]. Dùng dấu % đúng[cite: 15].",
      "So sánh tỉ số": "Quy đồng mẫu số hoặc tính giá trị thập phân để so sánh[cite: 16]. Lỗi: So sánh trực tiếp mà chưa quy đồng[cite: 17].",
      "Tỉ lệ thuận": "Hai đại lượng tỉ lệ thuận: y = k × x, k là hằng số[cite: 18]. Lỗi: Quên tìm hệ số tỉ lệ, tính sai[cite: 19]. Lưu ý ghi đơn vị[cite: 20]."
    };
    return guidance[lessonName] || "Toán về tỉ số lớp 5.";
  }

  async generateSimilarProblem(topicName, competencyLevel = "Đạt", startupPercentage = 100) {
    const lessonGuidance = this._getLessonSpecificGuidance(topicName);
    
    let difficultyGuidance = "";
    const pct = typeof startupPercentage === "number" ? startupPercentage : parseFloat(startupPercentage) || 0;
    if (pct < 50) {
      difficultyGuidance = "🔴 MỨC DỄ: Tỉ số đơn giản, số liệu nguyên đẹp, 1 phép tính.";
    } else if (pct < 75) {
      difficultyGuidance = "🟡 MỨC TRUNG BÌNH: Chia theo tỉ số hoặc rút gọn tỉ số, 1-2 phép tính.";
    } else {
      difficultyGuidance = "🟢 MỨC KHÓ: Tỉ số phần trăm hoặc tỉ lệ, 2-3 phép tính, có so sánh.";
    }

    const prompt = `Bạn là chuyên gia soạn đề toán lớp 5. 
CHỦ ĐỀ: ${topicName}
QUY TẮC: ${lessonGuidance}
ĐỘ KHÓ: ${difficultyGuidance}

NHIỆM VỤ: Sinh một ĐỀ TOÁN TỰ LUẬN thực tế.
⚠️ QUY TẮC BẮT BUỘC:
1. ĐỊNH DẠNG TỰ LUẬN: Tuyệt đối KHÔNG có trắc nghiệm A, B, C, D. 
2. CẤU TRÚC: Chỉ gồm 1 bối cảnh và 1 câu hỏi chính (hoặc tối đa 2 ý hỏi liên quan trực tiếp).
3. KHÔNG lời dẫn: Bắt đầu ngay bằng "Trong một lớp...", "Một nhà máy...", "Một cửa hàng...".
4. TRẢ VỀ: Duy nhất nội dung đề bài.`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const cleaned = this._cleanGeneratedProblem(result?.response.text() || "");
      if (cleaned && cleaned.length > 20 && !cleaned.includes("A.") && !cleaned.includes("B.")) {
        return cleaned;
      }
      return "Trong một lớp có 24 học sinh. Tỉ số giữa số học sinh nam và nữ là 1 : 3. Tính số học sinh nam và nữ của lớp.";
    } catch (error) {
      return "Một cửa hàng có bán quần áo. Tỉ số giữa số áo và quần là 5 : 3. Biết tổng số áo và quần là 80 cái. Tính số áo và số quần.";
    }
  }

  async generateApplicationProblem(studentContext) {
    const {
      errorsInKhoiDong = [],
      weaknessesInLuyenTap = {},
      topicName = "Tỉ số",
      practicePercentage = 0,
    } = studentContext;

    let competencyLevel = "Đạt";
    const pct = typeof practicePercentage === "number" ? practicePercentage : parseFloat(practicePercentage) || 0;
    if (pct < 50) competencyLevel = "Cần cố gắng";
    else if (pct < 75) competencyLevel = "Đạt";
    else competencyLevel = "Giỏi";

    const errorLog = [...errorsInKhoiDong, ...Object.values(weaknessesInLuyenTap)].filter(x => x).join("; ");

    const prompt = `TẠO ĐỀ TOÁN VẬN DỤNG TỰ LUẬN. CHỦ ĐỀ: ${topicName}.
MỨC ĐỘ: ${competencyLevel}. LỖI HS HAY MẮC: ${errorLog || "Không có lỗi cụ thể"}.

⚠️ QUY TẮC VÀNG:
1. ĐẠNG TỰ LUẬN THUẦN TÚY: Cấm tuyệt đối trắc nghiệm A, B, C, D. 
2. TÍNH TẬP TRUNG: Chỉ sinh 1 bài toán duy nhất, nội dung ngắn gọn, súc tích (dưới 100 từ).
3. KHÔNG CHIA NHỎ CÂU HỎI: Chỉ hỏi 1 hoặc 2 ý để học sinh tự thực hiện 4 bước Polya.
4. KHÔNG lời dẫn, tiêu đề. Bắt đầu ngay vào nội dung.
5. Nếu HS hay sai lỗi nào, hãy tạo tình huống yêu cầu dùng kiến thức đó (ví dụ: cần rút gọn tỉ số hoặc chia theo tỉ số).`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const rawText = result?.response.text() || "";
      const cleaned = this._cleanGeneratedProblem(rawText);
      
      // Kiểm tra xem có chứa rác trắc nghiệm không
      if (cleaned && cleaned.length > 20 && !cleaned.match(/[A-D]\.\s/)) {
        return cleaned;
      }
      // Fallback nếu AI sinh sai định dạng
      return "Một kho chứa gạo và ngô. Tỉ số giữa số kilogam gạo và ngô là 7 : 2. Biết tổng số ki-lô-gam gạo và ngô là 450kg. Tính số ki-lô-gam gạo và ngô của kho.";
    } catch (error) {
      return "Lớp 5A có 35 học sinh. Số học sinh nam bằng 3/4 số học sinh nữ. Tính số học sinh nam và nữ.";
    }
  }

  _cleanGeneratedProblem(problem) {
    if (!problem) return "";
    return problem
      .replace(/^(Dưới đây là|Bài toán|Đề bài|Bài vận dụng|Bạn hãy giải quyết|Câu hỏi|Lời dẫn):/gi, "")
      .replace(/^(Chào bạn|Đây là bài toán).*?\n/gi, "")
      .replace(/```[a-z]*\n?|```/g, "")
      .replace(/\.(?=\d)/g, ",") // Dấu phẩy thập phân
      .trim();
  }
}

const geminiPracticeServiceTiSo = new GeminiPracticeServiceTiSo();
export default geminiPracticeServiceTiSo;
