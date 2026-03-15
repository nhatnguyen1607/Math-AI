import { GeminiPracticeService } from "./geminiPracticeService";

/**
 * GeminiPracticeServiceTimeVelocity - Educational Architect 2026
 * Khắc phục lỗi sinh đề trắc nghiệm và đảm bảo nội dung tự luận phù hợp Polya.
 */
export class GeminiPracticeServiceTimeVelocity extends GeminiPracticeService {
  
  _getLessonSpecificGuidance(lessonName) {
    const guidance = {
      "Số đo thời gian": "Trọng tâm: Đổi đơn vị (giây, phút, giờ, ngày). Lỗi: Nhầm hệ số 60 thành 100[cite: 6]. Dùng dấu phẩy cho số thập phân[cite: 14].",
      "Vận tốc": "Công thức v = s : t[cite: 13]. Lỗi: Nhầm t : s[cite: 13]. Đơn vị v (km/h) phải khớp với s (km) và t (giờ)[cite: 14].",
      "Quãng đường": "Công thức s = v × t[cite: 15]. Lỗi: Nhầm thành s = v + t[cite: 16].",
      "Thời gian": "Công thức t = s : v[cite: 15]. Lỗi: Không đổi phần dư khi chia thời gian[cite: 12].",
      "Chuyển động đều": "Tổng hợp. Lưu ý bối cảnh: xe cộ, đi bộ. Lỗi: Quên ghi đơn vị kết quả[cite: 15, 20]."
    };
    return guidance[lessonName] || "Toán chuyển động đều lớp 5.";
  }

  async generateSimilarProblem(topicName, competencyLevel = "Đạt", startupPercentage = 100) {
    const lessonGuidance = this._getLessonSpecificGuidance(topicName);
    
    let difficultyGuidance = "";
    const pct = typeof startupPercentage === "number" ? startupPercentage : parseFloat(startupPercentage) || 0;
    if (pct < 50) {
      difficultyGuidance = "🔴 MỨC DỄ: 1 phép tính, số liệu nguyên đẹp.";
    } else if (pct < 75) {
      difficultyGuidance = "🟡 MỨC TRUNG BÌNH: 1-2 phép tính, có số thập phân.";
    } else {
      difficultyGuidance = "🟢 MỨC KHÓ: 2-3 phép tính, có suy luận/so sánh.";
    }

    const prompt = `Bạn là chuyên gia soạn đề toán lớp 5. 
CHỦ ĐỀ: ${topicName}
QUY TẮC: ${lessonGuidance}
ĐỘ KHÓ: ${difficultyGuidance}

NHIỆM VỤ: Sinh một ĐỀ TOÁN TỰ LUẬN thực tế.
⚠️ QUY TẮC BẮT BUỘC:
1. ĐỊNH DẠNG TỰ LUẬN: Tuyệt đối KHÔNG có trắc nghiệm A, B, C, D. 
2. CẤU TRÚC: Chỉ gồm 1 bối cảnh và 1 câu hỏi chính (hoặc tối đa 2 ý hỏi liên quan trực tiếp).
3. KHÔNG lời dẫn: Bắt đầu ngay bằng "Một người...", "Lúc...", "Xe máy...".
4. TRẢ VỀ: Duy nhất nội dung đề bài.`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const cleaned = this._cleanGeneratedProblem(result?.response.text() || "");
      if (cleaned && cleaned.length > 20 && !cleaned.includes("A.") && !cleaned.includes("B.")) {
        return cleaned;
      }
      return "Một người đi xe đạp quãng đường 18km trong 1 giờ 12 phút. Tính vận tốc của người đó với đơn vị km/giờ.";
    } catch (error) {
      return "Một ô tô đi được quãng đường 120km trong 2 giờ 30 phút. Tính vận tốc của ô tô đó.";
    }
  }

  async generateApplicationProblem(studentContext) {
    const {
      errorsInKhoiDong = [],
      weaknessesInLuyenTap = {},
      topicName = "Chuyển động đều",
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
5. Nếu HS hay sai lỗi nào, hãy tạo tình huống yêu cầu dùng kiến thức đó (ví dụ: cần đổi đơn vị).`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const rawText = result?.response.text() || "";
      const cleaned = this._cleanGeneratedProblem(rawText);
      
      // Kiểm tra xem có chứa rác trắc nghiệm không
      if (cleaned && cleaned.length > 20 && !cleaned.match(/[A-D]\.\s/)) {
        return cleaned;
      }
      // Fallback nếu AI sinh sai định dạng
      return "Lúc 7 giờ 30 phút, một người đi xe máy từ A đến B với vận tốc 40km/giờ. Biết quãng đường AB dài 90km, hỏi người đó đến B lúc mấy giờ?";
    } catch (error) {
      return "Một ô tô đi quãng đường 150km với vận tốc 50km/giờ. Tính thời gian ô tô đã đi.";
    }
  }

  _cleanGeneratedProblem(problem) {
    if (!problem) return "";
    return problem
      .replace(/^(Dưới đây là|Bài toán|Đề bài|Bài vận dụng|Bạn hãy giải quyết|Câu hỏi|Lời dẫn):/gi, "")
      .replace(/^(Chào bạn|Đây là bài toán).*?\n/gi, "")
      .replace(/```[a-z]*\n?|```/g, "")
      .replace(/\.(?=\d)/g, ",") // [cite: 14]
      .trim();
  }
}

const geminiPracticeServiceTimeVelocity = new GeminiPracticeServiceTimeVelocity();
export default geminiPracticeServiceTimeVelocity;