import geminiModelManager from "./geminiModelManager";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        const is429 =
          err.status === 429 ||
          (err.message && err.message.includes("429")) ||
          (err.message && err.message.toLowerCase().includes("rate limit"));
        if (is429) {
          // first pause and retry once
          await delay(10000);
          try {
            const res2 = await geminiModelManager.generateContent(prompt);
            await delay(2000);
            return res2;
          } catch (err2) {
            console.warn(
              "Second attempt failed for prompt, returning null",
              err2
            );
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
    context = "",
    problemNumber = 1,
    competencyLevel = "Đạt",
    startupPercentage = 100,
    specificWeaknesses = ""
  ) {
    try {
      let referenceProblem = "";
      let difficultyGuidance = "";
      let topicFocus = "";
      let competencyAdjustment = "";

      // normalize competencyLevel
      competencyLevel = competencyLevel || "Đạt";

      // 🔧 ĐIỀU CHỈNH ĐỘ KHÓ DỰA TRÊN NĂNG LỰC HỌC SINH (ƯU TIÊN CAO NHẤT)
      if (problemNumber === 1) {
        referenceProblem = startupProblem1;
        if (competencyLevel === "Cần cố gắng") {
          difficultyGuidance = `
🔴 MỨC ĐỘ BÀI 1 - CỰC DỄ (Học sinh Cần cố gắng):
- Bài toán PHẢI CỰC KỲ ĐƠN GIẢN - Chỉ 1 phép tính duy nhất, không có phép tính kế tiếp
- Số liệu NHỎ VÀ DỄ TÍNH: Nhân/chia với số nhỏ (dưới 10), không có số thập phân phức tạp
- Nếu dùng số thập phân → CHỈ 1 chữ số thập phân + nhân với số tự nhiên NHỎ (2, 3, 4, 5)
- TUYỆT ĐỐI KHÔNG dữ kiện thừa, không suy luận nhiều bước
- Bối cảnh TRỰC TIẾP, ngắn gọn, rõ ràng

📌 VÍ DỤ CHO NHÂN SỐ THẬP PHÂN:
✅ "Mỗi hộp milk 0,5 lít. 3 hộp bao nhiêu lít?" (CHỈ nhân 0,5 × 3, 1 chữ số thập phân × nhỏ)
❌ "Một cô thợ may dùng 1,2 mét vải để may một chiếc áo. Hỏi nếu cô ấy may 3,5 chiếc áo thì cần bao nhiêu mét vải?" (Quá khó: 2 chữ số thập phân, 1,2 × 3,5)
❌ "Hùng vận tốc 15,6 km/giờ, 1,5 giờ được bao nhiêu km?" (Quá khó: 2 chữ số thập phân)`;
        } else if (competencyLevel === "Tốt") {
          difficultyGuidance = `
🟢 MỨC ĐỘ BÀI 1 - PHỨC TẠP HƠN KHỞI ĐỘNG (Học sinh Tốt):
- BÀI 1 PHẢI KHÓ HƠN khởi động (cả 2 bài phải khó, bài 2 khó hơn bài 1)
- **CÓ 2 PHÉP TÍNH hoặc 1 phép tính phức tạp** với số thập phân đa chữ số
- Số liệu PHỨC TẠP: Nhiều chữ số thập phân, yêu cầu tính toán cẩn thận
- CÓ THỂ: yêu cầu so sánh nhẹ, suy luận đơn giản

📌 VÍ DỤ CHO NHÂN SỐ THẬP PHÂN:
✅ "Tính 32,5 × 2,4" (2 chữ số thập phân, khó hơn 2,5 × 4)
✅ "Vận tốc 25,5 km/giờ, 2,5 giờ được bao nhiêu km, rồi chia 6 được bao nhiêu?" (2 phép tính)`;
        } else {
          // Đạt - giữ nguyên
          difficultyGuidance = `
🟡 MỨC ĐỘ BÀI 1 - TƯƠNG ĐƯƠNG KHỞI ĐỘNG (Học sinh Đạt):
- Giữ ĐỘ KHÓ TƯƠNG ĐƯƠNG bài 1 khởi động
- Cùng số bước tính (1-2 bước)
- Thay đổi BỐI CẢNH và CON SỐ nhưng giữ CẤU TRÚC
- Số liệu dễ tính nhưng không quá đơn giản

📌 VÍ DỤ:
✅ ĐÚNG: "Mẹ có 24 quả cam, chia đều cho 4 con. Mỗi con được bao nhiêu quả?" (1 bước chia, số vừa phải, rõ ràng)
❌ SAI: "An có 5 cái kẹo, thêm 3 cái. Bây giờ có bao nhiêu?" (quá dễ, chỉ thích hợp mức Cần cố gắng)`;
        }

      } else if (problemNumber === 2) {
        referenceProblem = startupProblem2;
        if (competencyLevel === "Cần cố gắng") {
          difficultyGuidance = `
🔴 MỨC ĐỘ BÀI 2 - DỄ NHƯNG KHÓ HƠN BÀI 1 (Học sinh Cần cố gắng):
- Bài 2 CŨNG CHỈ 1 phép tính duy nhất (2 bài dễ cho mức này)
- Nhưng BÀI 2 PHẢI KHÓ HƠN BÀI 1: **Nhân với số lớn hơn** (nhân với 4, 5, 6, 8 thay vì 2, 3)
- PHẢI CÓ 1 CHỮ SỐ THẬP PHÂN: Nếu bài 1 là 0,5, bài 2 có thể là 1,2, 1,5, 2,5 nhân với số tự nhiên lớn hơn
- ⚠️ KHÔNG ĐƯỢC nhân 2 số thập phân (ví dụ: KHÔNG nhân 1,2 × 3,5, KHÔNG nhân 15,6 × 1,5)
- VẪN CỰC KỲ ĐƠN GIẢN: 1 phép tính, không so sánh, không suy luận

📌 VÍ DỤ CHO NHÂN SỐ THẬP PHÂN:
✅ Bài 1: "Mỗi hộp milk 0,5 lít. 3 hộp bao nhiêu lít?" (Dễ - 0,5 × 3, nhân nhỏ)
✅ Bài 2: "Mỗi mét vải 1,5 m, mua 6 mét, tổng dài bao nhiêu?" (Khó hơn - 1,5 × 6, nhân lớn hơn)
❌ SAI: "Một cô thợ may dùng 1,2 mét vải để may một chiếc áo. Nếu may 3,5 chiếc áo thì cần bao nhiêu mét vải?" (LỖI: 1,2 × 3,5 = nhân 2 số thập phân, quá khó)`;
        } else if (competencyLevel === "Tốt") {
          difficultyGuidance = `
🟢 MỨC ĐỘ BÀI 2 - KHÓ HƠN KHỞI ĐỘNG (Học sinh Tốt):
- **PHẢI KHÓ HƠN** bài 2 khởi động để thử thách
- **PHẢI CÓ 2-3 phép tính** hoặc 1 phép + so sánh/suy luận
- Số liệu PHỨC TẠP: Nhiều chữ số thập phân, phép tính chuỗi (nhân rồi cộng, cộng rồi nhân...)
- CÓ THỂ: So sánh 2 phương án, tính tổng của nhiều items, kiểm tra đủ/thiếu

📌 VÍ DỤ CHO NHÂN SỐ THẬP PHÂN:
✅ "Vận động viên A: 32,5 km/giờ × 2,4 giờ. VĐV B: 28 km/giờ × 3 giờ. Ai dài hơn? Dài hơn bao nhiêu?" (Nhân × 2, so sánh)
✅ "Hùng: 15,6 km/giờ × 1,5 giờ, rồi đi tiếp 10,2 km/giờ × 2 giờ. Tổng quãng đường?" (Nhân × 2, cộng)`;
        } else {
          // Đạt - giữ tương đương
          difficultyGuidance = `
🟡 MỨC ĐỘ BÀI 2 - TƯƠNG ĐƯƠNG KHỞI ĐỘNG (Học sinh Đạt):
- Giữ ĐỘ KHÓ TƯƠNG ĐƯƠNG bài 2 khởi động
- Cùng SỐ BƯỚC TÍNH (2 phép tính hoặc 1 phép + yêu cầu)
- Thay đổi BỐI CẢNH và CON SỐ nhưng giữ CẤU TRÚC
- Học sinh Đạt không cần quá khó, chỉ cần thêm luyện tập

📌 VÍ DỤ CHO NHÂN SỐ THẬP PHÂN:
✅ ĐÚNG: "Kim chạy 18,5 km/giờ trong 2,5 giờ được bao nhiêu km?" (1 phép nhân, số liệu vừa phải)
✅ ĐÚNG: "Mua 3,5 kg táo giá bao nhiêu nếu 1 kg = 2 đơn vị tiền?" (2 bước, tương đương độ khó)
❌ SAI: "Tính với 2 vận động viên, so sánh chi tiết, tính sai biệt" (Quá khó, thích hợp mức Tốt)`;
        }
      }

      // THÔNG TIN NĂNG LỰC ĐỂ AI HIỂU RÕ HƠN
      if (competencyLevel === "Cần cố gắng") {
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
- KHÔNG có dữ kiện thừa, điều kiện phức tạp

📌 VÍ DỤ CHO MỨC "CẦN CỐ GẮNG":
✅ BÀI ĐÚNG: "Có 5 cái kẹo, thêm 3 cái nữa. Bây giờ có mấy cái kẹo?" (cộng số nhỏ, 1 bước, không bẫy)
❌ BÀI SAI: "Mẹ mua 3.5 kg táo, bố mua 2,5 kg, anh mua 1.5 kg. Tổng cộng là bao nhiêu?" (số thập phân + 3 dữ kiện, quá khó)`;
      } else if (competencyLevel === "Tốt") {
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
- Yêu cầu suy luận và kết hợp kỹ năng

📌 VÍ DỤ CHO MỨC "TỐT":
✅ BÀI ĐÚNG: "Bố có 2,5 kg gạo, mẹ mua thêm 1,75 kg. Một tuần nhà ăn hết 2,8 kg. Hỏi còn lại bao nhiêu kg gạo?" (cộng + trừ thập phân, 2 bước, logic rõ)
❌ BÀI SAI: "Có 5 cái kẹo, thêm 3 cái. Bây giờ có mấy cái?" (quá easy cho mức Tốt)`;
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
- Chỉ thay đổi BỐI CẢNH và CON SỐ cụ thể

📌 VÍ DỤ CHO MỨC "ĐẠT":
✅ BÀI ĐÚNG: "Mẹ mua 3 kg táo giá 25,000 đồng/kg. Bố mua 2 kg cam giá 30,000 đồng/kg. Hỏi tổng tiền mua là bao nhiêu?" (2 bước nhân, cộng, độ khó vừa phải)
❌ BÀI SAI: "Mẹ mua 3.5 kg táo, bố mua 2.5 kg cam, anh mua 1.5 kg ổi. Mỗi kg táo 20,000đ, cam 25,000đ, ổi 18,000đ. Tính tổng?" (quá nhiều dữ kiện, 3 bước)`;
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
      const specialTopicGuidance = this._getLessonSpecificGuidance(context);

      const prompt = this._buildSimilarProblemPrompt(
        referenceProblem,
        context,
        difficultyGuidance,
        competencyAdjustment,
        topicFocus,
        specialTopicGuidance,
        specificWeaknesses
      );

      // Sử dụng wrapper để rate-limit
      const result = await this._rateLimitedGenerate(prompt);
      const similarProblem = result ? result.response.text().trim() : "";

      // 🔧 POST-PROCESSING: Loại bỏ các header không mong muốn
      return this._cleanGeneratedProblem(similarProblem);
    } catch (error) {
      // Safety fallback: If API fails (429, timeout, etc.), return the original problem text
      console.warn(
        "⚠️ generateSimilarProblem failed, returning original problem:",
        error.message
      );
      return (
        startupProblem1 ||
        startupProblem2 ||
        "Hãy giải bài toán này một cách từng bước theo 4 bước Polya."
      );
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
      const {
        errorsInKhoiDong = [],
        weaknessesInLuyenTap = {},
        topicName = "Bài toán",
        practicePercentage = 100,
      } = studentContext;

      // Xây dựng danh sách yếu điểm từ các tiêu chí
      let weaknessText = "";
      if (
        weaknessesInLuyenTap.TC1?.diem !== undefined &&
        weaknessesInLuyenTap.TC1.diem < 2
      ) {
        weaknessText += `- Yếu ở khía cạnh nhận biết vấn đề\n`;
      }
      if (
        weaknessesInLuyenTap.TC2?.diem !== undefined &&
        weaknessesInLuyenTap.TC2.diem < 2
      ) {
        weaknessText += `- Yếu ở khía cạnh nêu cách giải quyết\n`;
      }
      if (
        weaknessesInLuyenTap.TC3?.diem !== undefined &&
        weaknessesInLuyenTap.TC3.diem < 2
      ) {
        weaknessText += `- Yếu ở khía cạnh thực hiện các bước giải\n`;
      }
      if (
        weaknessesInLuyenTap.TC4?.diem !== undefined &&
        weaknessesInLuyenTap.TC4.diem < 2
      ) {
        weaknessText += `- Yếu ở khía cạnh kiểm tra lại kết quả\n`;
      }

      // xác định hướng dẫn mức độ theo phần trăm luyện tập
      let difficultyGuidance = "";
      const pct =
        typeof practicePercentage === "number"
          ? practicePercentage
          : parseFloat(practicePercentage) || 0;
      if (pct < 50) {
        difficultyGuidance =
          `🔴 MỨC ĐỘ CỰC DỄ (Học sinh Cần cố gắng):
- BÀI PHẢI CỰC KỲ ĐƠN GIẢN: Chỉ 1 phép tính duy nhất
- TUYỆT ĐỐI KHÔNG dữ kiện thừa - mỗi thông tin đều cần thiết để giải
- Lời văn TRỰC TIẾP, rõ ràng, dễ tưởng tượng
- Ví dụ: "Mỗi bạn được 0,75 lít nước. Lớp có 32 bạn. Hỏi cần bao nhiêu lít nước?"
- ❌ SAI: Thêm dữ kiện như "có 2 bạn không tham gia" - điều này làm bài phức tạp thêm`;
      } else if (pct >= 50 && pct < 80) {
        difficultyGuidance =
          `🟠 MỨC ĐỘ VỪA (Học sinh Đạt):
- Cần 2 bước tính: Học sinh phải tính 1 đại lượng trung gian trước
- Tối đa 1-2 dữ kiện hỗ trợ, nhưng mỗi dữ kiện đều cân thiết
- Không quá 4 dữ kiện chính
- Ví dụ: "Giá 1kg là 25k, mua 2,5kg. Hỏi giá tiền?" (2 dữ kiện chính)`;
      } else {
        difficultyGuidance =
          `🟢 MỨC ĐỘ KHÓ (Học sinh Tốt):
- Cần 3+ bước tính hoặc tư duy NGƯỢC (cho kết quả, tìm thành phần ban đầu)
- Có thể chèn 1 dữ kiện thừa để thử thách (nhưng rõ ràng là thừa)
- Tình huống phức tạp hơn, yêu cầu phân tích sâu
- Ví dụ: "1 chiếc bánh nặng 0,05kg, sản xuất 1250 chiếc, mua thêm 50kg hạt điều (không dùng tới). Hỏi tổng khối lượng bánh?" (dữ kiện thừa: 50kg hạt điều)`;
      }

      // Hướng dẫn chi tiết theo từng bài học/chủ đề (giống logic phần luyện tập)
      const lessonGuide = this._getLessonSpecificGuidance(topicName);

      const prompt = `[HỆ THỐNG HƯỚNG DẪN AI - CHỈ DÀNH CHO AI, KHÔNG HIỂN THỊ CHO NGƯỜI DÙNG]

Bạn là giáo viên toán lớp 5 tâm huyết, chuyên tạo bài tập vận dụng dựa trên chủ đề cụ thể, phù hợp mức độ học sinh.

═══════════════════════════════════════════════════════════════
CHỦĐỀ: "${topicName}"
═══════════════════════════════════════════════════════════════

HỒSƠ HỌC SINH:
${errorsInKhoiDong.length > 0 ? `Lỗi ở Khởi động: ${errorsInKhoiDong.join(", ")}` : "Không có lỗi cụ thể"}
${weaknessText ? `Yếu điểm: ${weaknessText.replace(/\n/g, " ")}` : ""}

MỨC ĐỘ TIÊU CHUẨN:
${difficultyGuidance}
${lessonGuide ? `
HƯỚNG DẪN CHI TIẾT CHỦĐỀ:
${lessonGuide}` : ""}

═══════════════════════════════════════════════════════════════
NHIỆM VỤ: TẠO BÀI TOÁN VẬN DỤNG (CHỈ IN ĐỀ BÀI, KHÔNG IN PHÂN TÍCH)
═══════════════════════════════════════════════════════════════

YÊU CẦU BẮBUỘC:
1️⃣ CHỦĐỀ PHẢI LÀ TRỌNG TÂM CHÍNH - không thêm kỹ năng khác
2️⃣ MỨC ĐỘ ĐÚNG VỚI HƯỚNG DẪN
${pct < 50 ? `
3️⃣ CHỈ 1 PHÉP TÍNH DUY NHẤT - Không được có phép tính thứ 2!
   - ❌ SAI: "Tính chiều dài dây (phép 1), rồi tính giá tiền (phép 2)" → 2 phép
   - ✅ ĐÚNG: "Tính chiều dài dây gấp mấy lần" → Chỉ 1 phép nhân

4️⃣ TUYỆT ĐỐI KHÔNG THỪA DỮ KIỆN:
   - Tất cả thông tin cho PHẢI được dùng để giải
   - ❌ SAI: "Chiều cao 1,5m, chiều rộng 2,4m... tính chiều rộng × 1,5" → chiều cao thừa
   - ✅ ĐÚNG: "Chiều rộng 2,4m, tính dây dài gấp 1,5 lần"

5️⃣ KHÔNG thêm dữ kiện phụ để "làm phức tạp": Không hỏi giá tiền, số lượng, v.v
   - ❌ SAI: "Giá 125.000 đồng/mét, hỏi tổng chi phí" → thêm phép cộng & phép nhân tiền tệ
   - ✅ ĐÚNG: "Hỏi bao nhiêu mét dây" → Chỉ 1 phép nhân SO THẬP PHÂN
   
6️⃣ VÍ DỤ ĐÚNG CHO "CẦN CỐ GẮNG":
   ✅ Bà Lan cần mua dây để viền rèm. Chiều rộng rèm là 2,4 mét. Dây cần dài gấp 1,5 lần chiều rộng. Hỏi bà cần mua bao nhiêu mét dây?
   (Chỉ tính: 2,4 × 1,5)
   
   ✅ Mỗi chiếc bánh cần 0,075 kg bột. Để làm 1500 chiếc bánh, cần bao nhiêu kg bột?
   (Chỉ tính: 0,075 × 1500)

7️⃣ VÍ DỤ SAI CHO "CẦN CỐ GẮNG":
   ❌ Bà Lan dự định làm rèm 2,4m × 1,5m. Dây trang trí gấp 1,5 lần rộng. Có 3,5m kim tuyến sẵn. Giá vải 125k/m, giá dây 35,5k/m. Tổng chi phí?
   (Quá nhiều dữ kiện, quá nhiều phép tính!)
   
   ❌ Xưởng bánh: mỗi bánh 0,075kg bột, 0,02kg đường, sản xuất 1500 chiếc, mua 50kg hạt điều. Cần bao nhiêu kg bột?
   (Dữ kiện thừa: đường 0,02kg, hạt điều 50kg → không dùng)

Tùy theo mức độ, điều chỉnh số lượng dữ kiện:
- CẦN CỐ GẮNG: 2-3 dữ kiện CHÍNH, KHÔNG có thừa
- ĐẠT: 3-4 dữ kiện CHÍNH, có thể 1 thừa rõ ràng
- TỐT: 4-5 dữ kiện, có 1 thừa không quá rõ`
      : (pct >= 50 && pct < 80) ? `
3️⃣ TỐI ĐA 2 HOẶC 3 PHÉP TÍNH liên tiếp
   - ✅ ĐÚNG: "Tính lượng bột (phép 1), tính tiền (phép 2)"
   - ❌ SAI: Thêm phép 3, 4, 5...

4️⃣ CÓ THỂ CÓ 1 DỮKIỆN THỪA rõ ràng (nhưng chỉ 1 cái)
   - ✅ ĐÚNG: "Bánh nặng 0,05kg, kẹo nặng 0,02kg, làm 1250 bánh, mua 50kg hạt (không dùng). Tính khối lượng bánh?"
   - ❌ SAI: Nhiều dữ kiện thừa > 1
   `
      : `
3️⃣ TỐI ĐA 3-4 PHÉP TÍNH liên tiếp
   - ✅ ĐÚNG: "Tính A (phép 1), tính B (phép 2), tính C (phép 3)"
   - ❌ SAI: Quá 4 phép tính

4️⃣ CÓ ĐÚNG 1 DỮKIỆN THỪA rõ ràng để test lựa chọn
   - ✅ ĐÚNG: Học sinh phải nhận ra dữ kiện nào cần, loại bỏ cái thừa
   - ❌ SAI: Không có hoặc quá 1 dữ kiện thừa
   `}

5️⃣ HÌNH THỨC: Câu chuyện tự nhiên, dễ hiểu, chỉ 1 câu hỏi cuối

CHỈ IN DÒNG NÀY (KHÔNG IN PHÂN TÍCH, HƯỚNG DẪN, V.V):

Bài toán vận dụng:`;

      const result = await this._rateLimitedGenerate(prompt);
      const applicationProblem = result ? result.response.text().trim() : "";
      return applicationProblem;
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
    if (!context) return "";
    const contextLower = context.toLowerCase();

    // Bài 41. Tìm giá trị phần trăm của một số
    if (
      contextLower.includes("bài 41") ||
      contextLower.includes("tìm giá trị phần trăm") ||
      (contextLower.includes("giá trị") && contextLower.includes("phần trăm"))
    ) {
      return `
    BÀI 41: TÌM GIÁ TRỊ PHẦN TRĂM CỦA MỘT SỐ
    PHẢI CÓ:
    - Cho một số và một tỉ lệ % cụ thể
    - Hỏi "X% của số đó bằng bao nhiêu?"
    - Công thức: Số × % ÷ 100 = Giá trị

    TUYỆT ĐỐI KHÔNG:
    - KHÔNG nhầm với "tìm tỉ số phần trăm" (bài 40)
    - KHÔNG hỏi "chiếm bao nhiêu %"
    - KHÔNG thiếu tỉ lệ % cụ thể

    VÍ DỤ ĐÚNG:
    "Lớp 5A có 40 học sinh. Trong đó 25% học sinh được khen thưởng. Hỏi có bao nhiêu học sinh được khen thưởng?"
    40 × 25 ÷ 100 = 10 học sinh`;
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔷 CHỦ ĐỀ 8: THỂ TÍCH. ĐƠN VỊ ĐO THỂ TÍCH
    // ═══════════════════════════════════════════════════════════════

    // Bài 46. Xăng-ti-mét khối. Đề-xi-mét khối
    if (
      contextLower.includes("bài 46") ||
      contextLower.includes("xăng-ti-mét khối") ||
      contextLower.includes("đề-xi-mét khối") ||
      contextLower.includes("cm³") ||
      contextLower.includes("dm³")
    ) {
      return `
    BÀI 46: XĂNG-TI-MÉT KHỐI VÀ ĐỀ-XI-MÉT KHỐI
    PHẢI CÓ:
    - Đổi đơn vị giữa cm³ và dm³ (1 dm³ = 1000 cm³)
    - So sánh 2 thể tích ở đơn vị khác nhau

    VÍ DỤ ĐÚNG:
    "Hộp A có thể tích 2,5 dm³. Hộp B có thể tích 2400 cm³. Hỏi hộp nào có thể tích lớn hơn?"
    2,5 dm³ = 2500 cm³ > 2400 cm³ → Hộp A lớn hơn`;
    }

    // Bài 47. Mét khối
    if (
      contextLower.includes("bài 47") ||
      contextLower.includes("mét khối") ||
      contextLower.includes("m³")
    ) {
      return `
    BÀI 47: MÉT KHỐI
    PHẢI CÓ:
    - So sánh thể tích ở các đơn vị m³, dm³ (1 m³ = 1000 dm³)
    - Bối cảnh: xe bồn, bể nước, thùng chứa...

    VÍ DỤ ĐÚNG:
    "Bể nước có dung tích 2500 dm³. Xe bồn chở đến 2,4 m³ nước. Hỏi xe bồn có đủ nước để đổ đầy bể không?"
    2,4 m³ = 2400 dm³ < 2500 dm³ → Không đủ, thiếu 100 dm³`;
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔷 CHỦ ĐỀ: DIỆN TÍCH VÀ THỂ TÍCH CỦA MỘT SỐ HÌNH KHỐI
    // ═══════════════════════════════════════════════════════════════

    // Bài 50. Diện tích xung quanh và toàn phần hình hộp chữ nhật
    if (
      contextLower.includes("bài 50") ||
      (contextLower.includes("diện tích") &&
        contextLower.includes("hình hộp chữ nhật"))
    ) {
      return `
    BÀI 50: DIỆN TÍCH XUNG QUANH VÀ TOÀN PHẦN HÌNH HỘP CHỮ NHẬT
    PHẢI CÓ:
    - Hình hộp chữ nhật với 3 kích thước: dài, rộng, cao
    - Tính diện tích xung quanh (4 mặt bên) hoặc diện tích toàn phần (6 mặt)
    - Công thức: Sxq = (dài + rộng) × 2 × cao; Stp = Sxq + 2 × (dài × rộng)

    VÍ DỤ ĐÚNG:
    "Một thùng gỗ hình hộp chữ nhật có chiều dài 50 cm, chiều rộng 40 cm, chiều cao 30 cm. Cần bao nhiêu cm² gỗ để đóng thùng (không có nắp)?"`;
    }

    // Bài 51. Diện tích xung quanh và toàn phần hình lập phương
    if (
      contextLower.includes("bài 51") ||
      (contextLower.includes("diện tích") &&
        contextLower.includes("hình lập phương"))
    ) {
      return `
    BÀI 51: DIỆN TÍCH XUNG QUANH VÀ TOÀN PHẦN HÌNH LẬP PHƯƠNG
    PHẢI CÓ:
    - Hình lập phương với cạnh cụ thể
    - Tính diện tích xung quanh (4 mặt) hoặc diện tích toàn phần (6 mặt)
    - Công thức: Sxq = cạnh × cạnh × 4; Stp = cạnh × cạnh × 6

    VÍ DỤ ĐÚNG:
    "Một hộp quà hình lập phương cạnh 10 cm. Cần bọc giấy kín hộp quà. Hỏi cần bao nhiêu cm² giấy (không tính mép gấp)?"
    Stp = 10 × 10 × 6 = 600 cm²`;
    }

    // Bài 52. Thể tích hình hộp chữ nhật
    if (
      contextLower.includes("bài 52") ||
      (contextLower.includes("thể tích") &&
        contextLower.includes("hình hộp chữ nhật"))
    ) {
      return `
    BÀI 52: THỂ TÍCH HÌNH HỘP CHỮ NHẬT
    PHẢI CÓ:
    - Hình hộp chữ nhật với 3 kích thước: dài, rộng, cao
    - Tính thể tích (sức chứa bên trong)
    - Công thức: V = dài × rộng × cao

    VÍ DỤ ĐÚNG:
    "Bể cá hình hộp chữ nhật có chiều dài 40 cm, chiều rộng 25 cm, mực nước cao 15 cm. Thả một viên đá vào bể, mực nước dâng lên 18 cm. Thể tích viên đá là bao nhiêu cm³?"
    V nước dâng = 40 × 25 × (18-15) = 3000 cm³ = Thể tích viên đá`;
    }

    // Bài 53. Thể tích hình lập phương
    if (
      contextLower.includes("bài 53") ||
      (contextLower.includes("thể tích") &&
        contextLower.includes("hình lập phương"))
    ) {
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
    if (contextLower.includes("luyện tập chung")) {
      if (contextLower.includes("tỉ số") || contextLower.includes("bài 44")) {
        return `
🎯 BÀI 44: LUYỆN TẬP CHUNG (TỈ SỐ)
═══════════════════════════════════════════════════════
✅ KẾT HỢP CÁC DẠNG TOÁN VỀ TỈ SỐ:
- Tỉ số cơ bản, tỉ lệ bản đồ
- Tìm 2 số khi biết tổng/hiệu và tỉ số
- Tỉ số phần trăm`;
      }
      if (contextLower.includes("thể tích") || contextLower.includes("bài 48")) {
        return `
🎯 BÀI 48: LUYỆN TẬP CHUNG (THỂ TÍCH)
═══════════════════════════════════════════════════════
✅ KẾT HỢP:
- Đổi đơn vị thể tích (cm³, dm³, m³)
- Tính thể tích hình hộp, hình lập phương
- So sánh thể tích`;
      }
      if (contextLower.includes("diện tích") || contextLower.includes("bài 55")) {
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
    if (
      contextLower.includes("tỉ số") &&
      !contextLower.includes("phần trăm")
    ) {
      // Thuần tỉ số → dùng hướng dẫn Tỉ số
      return this._getTopicGuidanceTiSo();
    }
    if (contextLower.includes("phần trăm")) {
      // Bất kỳ chủ đề nào có "phần trăm" → dùng hướng dẫn Phần trăm, KHÔNG dùng tỉ số
      return this._getTopicGuidancePhanTram();
    }
    if (contextLower.includes("thể tích")) {
      return this._getTopicGuidanceTheTich();
    }
    if (
      contextLower.includes("diện tích") ||
      contextLower.includes("hình khối")
    ) {
      return this._getTopicGuidanceDienTich();
    }

    if (contextLower.includes("số tự nhiên") || 
    contextLower.includes("chương 1")) {
      return this._getTopicGuidanceSoTuNhien();
    }
    if (contextLower.includes("phân số") || 
    contextLower.includes("chương 2")) {
      return this._getTopicGuidancePhanSo();
    }
    if (contextLower.includes("số thập phân") || 
    contextLower.includes("chương 3")) {
      return this._getTopicGuidanceSoThapPhan();
    }

    return "";
  }

  _getTopicGuidanceSoTuNhien() {
    return `
🎯 CHỦ ĐỀ CỤ THỂ: SỐ TỰ NHIÊN VÀ CÁC PHÉP TÍNH
═══════════════════════════════════════════════════════
**DẠNG BÀI TOÁN "CỘNG, TRỪ, NHÂN, CHIA VÀ LÀM TRÒN SỐ TỰ NHIÊN"**

CẤU TRÚC LỌC BẮT BUỘC:
✅ PHẢI CÓ:
   - Các đại lượng là SỐ TỰ NHIÊN hoàn toàn.
   - Trọng tâm vào các kĩ năng: Cộng, Trừ, Nhân, Chia hoặc Làm tròn số tự nhiên.
   - Bối cảnh: Đời sống học sinh lớp 5, mua sắm, trường học, thiên nhiên.

❌ TUYỆT ĐỐI KHÔNG:
   - KHÔNG dùng số thập phân (có dấu phẩy) hoặc phân số.
   - KHÔNG dùng tỷ số phần trăm (%).
   - KHÔNG dùng biến số x, y (tư duy đại số THCS).

VÍ DỤ ĐÚNG:
   "Một thư viện có 3456 quyển sách. Người ta quyên góp thêm 1250 quyển nữa. Hỏi thư viện có tất cả bao nhiêu quyển sách?"
   "Trường tiểu học có 1245 học sinh. Để chuẩn bị cho hội thao, trường xếp mỗi hàng 15 học sinh. Hỏi xếp được bao nhiêu hàng và còn dư mấy bạn?"
`;
  }

_getTopicGuidancePhanSo() {
    return `
🎯 CHỦ ĐỀ CỤ THỂ: PHÂN SỐ VÀ CÁC PHÉP TÍNH
═══════════════════════════════════════════════════════
**DẠNG BÀI TOÁN "CỘNG, TRỪ, NHÂN, CHIA PHÂN SỐ, HỖN SỐ VÀ PHÂN SỐ THẬP PHÂN"**

CẤU TRÚC LỌC BẮT BUỘC:
✅ PHẢI CÓ:
   - Dữ kiện phải có PHÂN SỐ (cùng mẫu hoặc khác mẫu) hoặc HỖN SỐ.
   - Các dạng toán: Tính toán trực tiếp, so sánh phân số, hoặc ứng dụng tìm phân số của một số.
   - Bối cảnh: Chia bánh, đo độ dài dải ruy băng, chia diện tích đất trồng trọt, chia thời gian.

❌ TUYỆT ĐỐI KHÔNG:
   - KHÔNG dùng số thập phân (ví dụ: 0,5; 1,2).
   - KHÔNG dùng tỷ số phần trăm (%).

VÍ DỤ ĐÚNG:
   "Một mảnh vườn hình chữ nhật, người ta dùng 2/5 diện tích để trồng rau và 1/3 diện tích để trồng hoa. Hỏi diện tích trồng rau và hoa chiếm bao nhiêu phần diện tích mảnh vườn?"
   "Có 3/4 cái bánh pizza, chia đều cho 2 anh em. Hỏi mỗi người được bao nhiêu phần của cái bánh?"
`;
  }

 _getTopicGuidanceSoThapPhan() {
    return `
🎯 CHỦ ĐỀ CỤ THỂ: SỐ THẬP PHÂN VÀ CÁC PHÉP TÍNH
═══════════════════════════════════════════════════════
**DẠNG BÀI TOÁN SỐ THẬP PHÂN ĐƯỢC PHÂN LỌC THEO TỪNG KỸ NĂNG**

CẤU TRÚC LỌC BẮT BUỘC:
✅ PHẢI CÓ dữ kiện là SỐ THẬP PHÂN (có dấu phẩy, ví dụ: 4,68; 12,478; 0,25).
✅ NẾU BÀI TOÁN LÀ "LÀM TRÒN SỐ THẬP PHÂN":
   - Phải mô phỏng các tình huống đo lường thực tế.
   - VÍ DỤ MẪU: 
     + Làm tròn đến số tự nhiên: "Trong hội thi 'Nông sản sạch', quả bí đỏ nặng 4,68 kg. Ban tổ chức yêu cầu làm tròn đến số tự nhiên gần nhất. Hỏi quả bí đỏ nặng khoảng bao nhiêu ki-lô-gam?"
     + Làm tròn phần mười/phần trăm: "Bạn Nam chạy 10 m trong 12,478 giây. Làm tròn kết quả đến hàng phần trăm. Thành tích của Nam là khoảng bao nhiêu giây?"

✅ NẾU BÀI TOÁN LÀ "NHÂN SỐ THẬP PHÂN":
   - Nhân STP với STN: "Mỗi cốc có 0,25 lít nước cam, mỗi bạn uống một cốc. Hỏi 3 bạn uống bao nhiêu lít?" (SGK tr.72)
   - Nhân STP với STP: "Mỗi giờ ô tô đi được 84,5 km. Hỏi trong 1,2 giờ ô tô đi được bao nhiêu km?" (SGK tr.67)
   - Nhân với 10, 100, 0.1...: "10 chú gấu con, mỗi chú ăn 4,5 kg cá. 10 chú ăn hết bao nhiêu kg?" (SGK tr.85) HOẶC "Kho có 45,8 tấn gạo, lấy ra 0,1 số gạo. Đã lấy ra bao nhiêu tấn?"

✅ NẾU BÀI TOÁN LÀ "CHIA SỐ THẬP PHÂN":
   - Chia STP cho STN: "Rô-bốt chia đều 9,68 yến cá vào 8 khay. Mỗi khay đựng bao nhiêu yến?" (SGK tr.77)
   - Chia STP cho STP: "Mặt sàn hình chữ nhật có diện tích 292,8 m² và chiều rộng 9,6 m. Tính chiều dài." (SGK tr.82) HOẶC "Chú rồng trả 15,4 kg kẹo cho 4 chiếc răng sâu. Nhổ 1 chiếc trả bao nhiêu kg?"
   - Chia cho 10, 100, 0.1...: "Giấy màu dày 0,1 mm. Chồng giấy dày 23,5 mm có bao nhiêu tờ?"

❌ TUYỆT ĐỐI KHÔNG:
   - KHÔNG sử dụng phân số (a/b).
   - KHÔNG dùng biến số x, y.
   - TRÁNH nhầm lẫn sang tỉ số phần trăm (%) nếu bài không yêu cầu.
`;
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

  _getTopicGuidancePhanTram() {
    return `
🎯 CHỦ ĐỀ CỤ THỂ: CÁC BÀI TOÁN VỀ PHẦN TRĂM (%)
═══════════════════════════════════════════════════════
**DẠNG BÀI TOÁN "TÍNH GIÁ TRỊ PHẦN TRĂM CỦA MỘT SỐ" HOẶC CÁC DẠNG CƠ BẢN LIÊN QUAN %**

✅ PHẢI CÓ:
   - Xuất hiện RÕ RÀNG một tỉ lệ phần trăm (ví dụ: 25%, 40%, 15%...)
   - Có MỘT đại lượng gốc (tổng số học sinh, số cây, số tiền, số sản phẩm...)
   - YÊU CẦU TÍNH GIÁ TRỊ: "X% của ... là bao nhiêu?"
   - Dùng đúng bản chất: Giá trị = Số ban đầu × % ÷ 100

❌ TUYỆT ĐỐI KHÔNG:
   - KHÔNG biến bài toán % thành bài "tìm hai số khi biết tổng và tỉ số"
   - KHÔNG yêu cầu lập tỉ số dạng phân số (2/3, 5/7...) nếu MỤC TIÊU là phần trăm
   - KHÔNG bỏ quên ký hiệu % hoặc câu hỏi về %
   - KHÔNG dùng khái niệm Toán THCS (tăng/giảm %, lãi suất, thuế suất phức tạp...)

VÍ DỤ ĐÚNG:
   "Lớp 5A có 40 học sinh. Trong đó 25% học sinh được khen thưởng. Hỏi có bao nhiêu học sinh được khen thưởng?"
   → 40 × 25 ÷ 100 = 10 học sinh

   "Một cửa hàng có 120 kg gạo. Người ta bán 35% số gạo đó. Hỏi cửa hàng còn lại bao nhiêu ki-lô-gam gạo?"

VÍ DỤ SAI (KHÔNG ĐƯỢC TẠO):
   ❌ Bài toán chỉ nói về "tỉ số giữa hai số" mà KHÔNG có %
   ❌ Bài toán chỉ đổi đơn vị hoặc so sánh số liệu, không hề có tính %
   ❌ Bài toán dùng tỉ số phân số (2/5, 3/4) mà không liên quan đến ký hiệu %
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

  _buildSimilarProblemPrompt(
    referenceProblem,
    context,
    difficultyGuidance,
    competencyAdjustment,
    topicFocus,
    specialTopicGuidance,
    specificWeaknesses = ""
  ) {
    return `Bạn là giáo viên toán lớp 5 chuyên tạo bài tập luyện tập có chất lượng cao.

═══════════════════════════════════════════════════════════════
🔴 [BẮT BUỘC] CHỈ TẠO BÀI TOÁN VỀ CHỦĐỀ: "${context || "Bài học"}"
═══════════════════════════════════════════════════════════════
⚠️ NGHIÊM CẢNH: Toàn bộ bài toán PHẢI xoay quanh CHỦ ĐỀ NÀY
- Nếu chủ đề là "Nhân số thập phân": BÀI PHẢI CÓ PHÉP NHÂN SỐ THẬP PHÂN LÀM TRỌNG TÂM
- Nếu chủ đề là "Tỉ số": BÀI PHẢI CÓ PHẦN TỬ TỈ SỐ/SO SÁNH
- Nếu chủ đề là "Thể tích": BÀI PHẢI TÍNH HOẶC SO SÁNH THỂ TÍCH
- KHÔNG được tạo bài toán chung chung hoặc khác chủ đề

BÀI KHỞI ĐỘNG (MẪU):
${referenceProblem}

${context ? `CHỦ ĐỀ BÀI TẬP (PHẢI TUÂN THỦ):
${context}
` : ""}

NHIỆM VỤ:
Tạo BÀI LUYỆN TẬP dựa vào bài khởi động trên:
${difficultyGuidance}
${competencyAdjustment}
${topicFocus}
${specificWeaknesses ? `
⚠️ NHỮNG ĐIỂM YẾU CẦN KHẮC PHỤC:
${specificWeaknesses}
` : ""}
${specialTopicGuidance}

YÊU CẦU TỐI QUAN TRỌNG:

1. ✅ PHẢI SỬ DỤNG KỸ NĂNG TOÁN HỌC CHÍNH CỦA CHỦ ĐỀ "${context || "Bài học"}"
   → Kỹ năng chính PHẢI xuất hiện RÕRŒNG và LÀ TRỌNG TÂM bài toán
   → KHÔNG được để kỹ năng chính chỉ là chi tiết phụ

2. ✅ TẬP TRUNG 100% VÀO CHỦ ĐỀ CHÍNH
   → ĐỀ SÁNG TẠO NHƯNG RÕ RÀNG

3. ✅ LOẠI BỎ HOÀN TOÀN PHẦN TRĂM (%) - TRỪ CHỦ ĐỀ "PHẦN TRĂM"

4. ✅ ĐỘ KHÓ PHẢI VỪA PHẢI CHO LỚP 5 + TUÂN THEO HƯỚNG DẪN TRÊN

5. ✅ CHỈ MỘT CÂU HỎI CUỐI

6. ✅ THAY ĐỔI BỐI CẢNH nhưng giữ nguyên CẤU TRÚC TOÁN HỌC

7. ✅ **SỐ THẬP PHÂN PHẢI DÙNG DẤU PHẨY (,) CHỨ KHÔNG DÙNG DẤU CHẤM (.)**
   → VÍ DỤ ĐÚNG: 15,25 km; 1,5 giờ; 1,2 mét; 3,5 chiếc
   → VÍ DỤ SAI: 15.25 km; 1.5 giờ; 1.2 mét; 3.5 chiếc

8. ✅ TUYỆT ĐỐI KHÔNG tạo bài toán chứa:
   - Biến số x, y hoặc ẩn chưa biết (đại số THCS)
   - Các khái niệm THCS (phương trình, bất phương trình, lợi nhuận %, lãi suất...)

KIỂM TRA TỰ NHANH (PHẢI TRỰC TRẢ LỜI):
- ❓ Bài toán này có TẬP TRUNG vào chủ đề "${context || "Bài học"}" không?
- ❓ Kỹ năng chính của chủ đề có xuất hiện RÕRŒNG không?
- ❓ Độ khó có phù hợp với hướng dẫn trên không?
→ Nếu câu trả lời "KHÔNG" cho bất kỳ câu nào → HÃY TẠO LẠI BÀI KHÁC

HƯỚNG DẪN TRẢ LỜI:
- CHỈ trả về nội dung bài toán (không có "Bài toán mới:", "BÀI X LUYỆN TẬP:", không có lời giải)
- Bài toán phải là một đoạn văn liền mạch, tự nhiên, kết thúc bằng CHÍNH XÁC 1 CÂU HỎI duy nhất
- Nếu không tự tin bài toán tập trung vào chủ đề → KHÔNG TRÍCH từ bất kỳ đâu, HÃY TẠO LẠI

Bài toán luyện tập:`;
  }

  _cleanGeneratedProblem(similarProblem) {
    // Loại bỏ "BÀI X LUYỆN TẬP" header
    similarProblem = similarProblem.replace(
      /^BÀI\s+[12]\s+LUYỆN\s*TẬP[\s\n]*/i,
      ""
    );

    // Loại bỏ "Chủ đề bài thi:" lines
    similarProblem = similarProblem.replace(
      /^Chủ\s+đề\s+bài\s+thi:\s*[^\n]*[\n]*/i,
      ""
    );

    // 🔧 Nếu có format "1. ... 2. ..." - giữ lại từ phần text của bài toán
    const lines = similarProblem.split("\n");
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
      similarProblem = cleanedLines.join("\n").trim();
    }

    if (questionCount === 0) {
      similarProblem = lines.join("\n").trim();
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
**HƯỚNG DẪN ĐẶC THỨ CHO CHỦ ĐỀ: THỂ TÍCH - ĐƠN VỊ ĐO THỂ TÍCH**

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
**HƯỚNG DẪN ĐẶC THỨ CHO CHỦ ĐỀ: DIỆN TÍCH VÀ THỂ TÍCH CỦA HÌNH KHỐI**

✅ GỢI Ý:
- Tập trung vào công thức diện tích xung quanh, toàn phần và thể tích.
- Bài toán gắn với bọc quà, bể nước, thùng chứa, xếp hộp...
- Không dùng khái niệm Toán cấp 2, không dùng ẩn x, y.
`;
  }

  _buildExamGenerationPrompt(
    topicName,
    lessonName,
    sampleSummary,
    topicSpecificGuide
  ) {
    return `Bạn là chuyên gia tạo đề thi toán lớp 5. Dựa vào TEMPLATE EXAM dưới đây, hãy TẠO MỘT ĐỀ THI TƯƠNG ĐƯƠNG cho chủ đề "${topicName}", tiêu đề "${lessonName}".

YÊU CẦU CHUNG CHO TẤT CẢ CHỦ ĐỀ:
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

7. ✅ BÁM SÁT KIẾN THỨC TIỂU HỌC: Các câu hỏi và bài toán tuyệt đối không dùng ẩn x, y hoặc các khái niệm Toán cấp 2.

8. ✅ KẾT HỢP VỚI HƯỚNG DẪN CHỦ ĐỀ CỤ THỂ:
${topicSpecificGuide || ""}

CHỈ RETURN JSON ARRAY, KHÔNG CÓ TEXT KHÁC.`;
  }
}

const geminiPracticeService = new GeminiPracticeService();

export default geminiPracticeService;

