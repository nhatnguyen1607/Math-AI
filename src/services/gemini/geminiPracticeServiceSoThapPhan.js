import { GeminiPracticeService } from "./geminiPracticeService";

/**
 * GeminiPracticeServiceSoThapPhan - Educational Architect 2026
 * Sinh đề toán tự luận về Số thập phân và đảm bảo nội dung phù hợp phương pháp Polya.
 */
export class GeminiPracticeServiceSoThapPhan extends GeminiPracticeService {
  
  _getLessonSpecificGuidance(lessonName) {
    const guidance = {
      "Cộng số thập phân": "Trọng tâm: Đặt dấu phẩy thẳng hàng, cộng từ phải sang trái[cite: 10]. Lỗi: Nhầm vị trí dấu phẩy, quên thêm số 0 để đủ chữ số thập phân[cite: 11]. Dùng dấu phẩy (,) không phải dấu chấm (.)[cite: 12].",
      "Trừ số thập phân": "Trọng tâm: Đặt dấu phẩy thẳng hàng, trừ từ phải sang trái[cite: 13]. Lỗi: Quên mượn khi trừ, nhầm vị trí dấu phẩy[cite: 14]. Thêm số 0 phần thập phân khi cần[cite: 15].",
      "Nhân số thập phân": "Công thức: Nhân như số tự nhiên, rồi đếm tổng chữ số thập phân của 2 thừa số để đặt dấu phẩy[cite: 16]. Lỗi: Nhầm vị trí dấu phẩy, quên đếm chữ số thập phân[cite: 17]. Ví dụ: 2,5 × 1,2 = 3,00 = 3[cite: 18].",
      "Chia số thập phân": "Công thức: Chuyển số chia thành số tự nhiên bằng cách dịch dấu phẩy, rồi chia bình thường[cite: 19]. Lỗi: Quên dịch dấu phẩy, đặt sai vị trí dấu phẩy ở thương[cite: 20]. Ghi đơn vị đúng[cite: 21].",
      "Nhân, chia với 10, 100, 0,1": "Trọng tâm: Dịch dấu phẩy sang phải (×10, ×100) hoặc sang trái (÷10, ÷100, ×0,1)[cite: 22]. Lỗi: Nhầm hướng dịch dấu phẩy[cite: 23]. Ví dụ: 4,5 × 10 = 45[cite: 24]."
    };
    return guidance[lessonName] || "Toán về số thập phân lớp 5.";
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
    const topicName = context || "Cộng số thập phân";
    const lessonGuidance = this._getLessonSpecificGuidance(topicName);
    
    let difficultyGuidance = "";
    const pct = typeof startupPercentage === "number" ? startupPercentage : parseFloat(startupPercentage) || 0;
    if (pct < 50 || String(competencyLevel || "").toLowerCase().includes("cần cố gắng")) {
      difficultyGuidance = "🔴 MỨC DỄ: 1 phép tính cơ bản, số liệu nguyên đẹp, ít chữ số thập phân.";
    } else if (pct < 75 || String(competencyLevel || "").toLowerCase().includes("đạt")) {
      difficultyGuidance = "🟡 MỨC TRUNG BÌNH: 1-2 phép tính, có số thập phân đủ chữ số, cần kiểm tra dấu phẩy.";
    } else {
      difficultyGuidance = "🟢 MỨC KHÓ: 2-3 phép tính, có số thập phân phức tạp, cần suy luận/so sánh, ghi đơn vị.";
    }

    const prompt = `Bạn là chuyên gia soạn đề toán lớp 5. 
CHỦ ĐỀ: ${topicName}
QUY TẮC: ${lessonGuidance}
MỨC NĂNG LỰC: ${competencyLevel}
ĐỘ KHÓ: ${difficultyGuidance}

NHIỆM VỤ: Sinh một ĐỀ TOÁN TỰ LUẬN thực tế.
⚠️ QUY TẮC BẮT BUỘC:
1. ĐỊNH DẠNG TỰ LUẬN: Tuyệt đối KHÔNG có trắc nghiệm A, B, C, D. 
2. CẤU TRÚC: Chỉ gồm 1 bối cảnh và 1 câu hỏi chính (hoặc tối đa 2 ý hỏi liên quan trực tiếp).
3. SỬ DỤNG DẤU PHẨY: BẮT BUỘC dùng dấu phẩy (,) cho số thập phân, KHÔNG dấu chấm (.).
4. GHI ĐƠN VỊ: Phải ghi rõ đơn vị (kg, m, cm, lít, v.v.) trong bài toán và yêu cầu.
5. KHÔNG lời dẫn: Bắt đầu ngay bằng "Một cá hàng...", "Bao gạo...", "Người đi...".
6. TRẢ VỀ: DUY NHẤT nội dung đề bài.`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const cleaned = this._cleanGeneratedProblem(result?.response.text() || "");
      if (cleaned && cleaned.length > 20 && !cleaned.includes("A.") && !cleaned.includes("B.")) {
        return cleaned;
      }
      return "Một bao gạo cân nặng 25,5 kg. Sau khi sử dụng, bao gạo còn nặng 12,75 kg. Hỏi đã sử dụng bao nhiêu ki-lô-gam gạo?";
    } catch (error) {
      return "Một cửa hàng có 48,6 kg đường. Chia đều vào 6 túi. Hỏi mỗi túi có bao nhiêu ki-lô-gam đường?";
    }
  }

  async generateApplicationProblem(studentContext) {
    const {
      errorsInKhoiDong = [],
      weaknessesInLuyenTap = {},
      topicName = "Số thập phân",
      practicePercentage = 0,
    } = studentContext;

    let competencyLevel = "Đạt";
    const pct = typeof practicePercentage === "number" ? practicePercentage : parseFloat(practicePercentage) || 0;
    if (pct < 50) competencyLevel = "Cần cố gắng";
    else if (pct < 75) competencyLevel = "Đạt";
    else competencyLevel = "Giỏi";

    // ✅ FIX: Extract nhanXet (comments) from TC1-TC4 objects in weaknessesInLuyenTap
    const practiceComments = Object.values(weaknessesInLuyenTap)
      .map(tc => tc?.nhanXet)
      .filter(comment => comment && typeof comment === 'string' && comment.trim());
    
    const errorLog = [...errorsInKhoiDong, ...practiceComments].join("; ");

    const prompt = `TẠO ĐỀ TOÁN VẬN DỤNG TỰ LUẬN. CHỦ ĐỀ: ${topicName}.
MỨC ĐỘ: ${competencyLevel}. LỖI HS HAY MẮC: ${errorLog || "Không có lỗi cụ thể"}.

⚠️ QUY TẮC VÀNG:
1. ĐẠNG TỰ LUẬN THUẦN TÚY: Cấm tuyệt đối trắc nghiệm A, B, C, D. 
2. TÍNH TẬP TRUNG: Chỉ sinh 1 bài toán duy nhất, nội dung ngắn gọn, súc tích (dưới 100 từ).
3. KHÔNG CHIA NHỎ CÂU HỎI: Chỉ hỏi 1 hoặc 2 ý để học sinh tự thực hiện 4 bước Polya.
4. KHÔNG lời dẫn, tiêu đề. Bắt đầu ngay vào nội dung.
5. DÙNG DẤU PHẨY: BẮT BUỘC dấu phẩy (,) cho số thập phân, ghi đủ đơn vị.
6. Nếu HS hay sai lỗi nào, hãy tạo tình huống yêu cầu dùng kiến thức đó (ví dụ: cần kiểm tra vị trí dấu phẩy, ghi đơn vị).`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const rawText = result?.response.text() || "";
      const cleaned = this._cleanGeneratedProblem(rawText);
      
      // Kiểm tra xem có chứa rác trắc nghiệm không
      if (cleaned && cleaned.length > 20 && !cleaned.match(/[A-D]\.\s/)) {
        return cleaned;
      }
      // Fallback nếu AI sinh sai định dạng
      return "Một mảnh vải dài 24,5 m. Người ta cắt thành 7 đoạn bằng nhau. Hỏi mỗi đoạn vải dài bao nhiêu mét?";
    } catch (error) {
      return "Một bé cân nặng 32,5 kg. Mẹ cân nặng gấp 1,5 lần bé. Hỏi mẹ cân nặng bao nhiêu ki-lô-gam?";
    }
  }

  _cleanGeneratedProblem(problem) {
    if (!problem) return "";
    return problem
      .replace(/^(Dưới đây là|Bài toán|Đề bài|Bài vận dụng|Bạn hãy giải quyết|Câu hỏi|Lời dẫn):/gi, "")
      .replace(/^(Chào bạn|Đây là bài toán).*?\n/gi, "")
      .replace(/```[a-z]*\n?|```/g, "")
      .replace(/(\d)\.(\d)/g, "$1,$2") // Thay dấu chấm thành dấu phẩy cho số thập phân
      .trim();
  }
}

const geminiPracticeServiceSoThapPhan = new GeminiPracticeServiceSoThapPhan();
export default geminiPracticeServiceSoThapPhan;
