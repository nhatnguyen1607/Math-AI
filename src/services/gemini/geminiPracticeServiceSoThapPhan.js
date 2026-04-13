import { GeminiPracticeService } from "./geminiPracticeService";
import { EXAM_CONTEXTS, CHARACTER_GUIDE } from '../../constants/examContexts';

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

/**
 * GeminiPracticeServiceSoThapPhan - Educational Architect 2026
 * Sinh đề toán tự luận về Số thập phân và đảm bảo nội dung phù hợp phương pháp Polya.
 */
export class GeminiPracticeServiceSoThapPhan extends GeminiPracticeService {
  constructor(...args) {
    super(...args);
    this._lastScenarioIndexByContext = new Map();
    this._recentGeneratedByContext = new Map();
  }

  _extractNumbersFromText(text = "") {
    if (!text || typeof text !== "string") return [];
    const matches = text.match(/\d+(?:[.,]\d+)?/g) || [];
    return [...new Set(matches)].slice(0, 12);
  }

  _rememberGeneratedProblem(contextId = "", text = "") {
    if (!contextId || !text) return;
    const prev = this._recentGeneratedByContext.get(contextId) || [];
    const next = [text, ...prev].slice(0, 2);
    this._recentGeneratedByContext.set(contextId, next);
  }

  _getRecentGeneratedProblems(contextId = "") {
    return this._recentGeneratedByContext.get(contextId) || [];
  }

  _buildAntiDuplicateGuidance({
    startupProblem1 = "",
    startupProblem2 = "",
    recentGenerated = [],
    problemNumber = 1
  }) {
    const sourceText = [startupProblem1, startupProblem2, ...recentGenerated]
      .filter(Boolean)
      .join(" ");
    const numberHints = this._extractNumbersFromText(sourceText);
    const numberedHintText = numberHints.length
      ? `- Tránh lặp lại các số liệu sau: ${numberHints.join(", ")}.`
      : "- Tránh lặp lại y nguyên bộ số của các bài trước.";

    return `\n[RÀNG BUỘC CHỐNG TRÙNG]\n- Bài đang sinh là Bài ${problemNumber}. Phải KHÁC rõ rệt về cấu trúc câu hỏi so với bài đã có.\n${numberedHintText}\n- Không sao chép lại mô-típ đề cũ (đổi tên nhân vật nhưng giữ nguyên số/dạng vẫn tính là trùng).`;
  }

  _getBepAnConstraint() {
    return `\n[QUY TẮC RIÊNG CHO BỐI CẢNH BỮA ĂN DINH DƯỠNG]\n- Chỉ dùng đại lượng dinh dưỡng: calo (kcal), gam (g), ki-lô-gam (kg), mililít (ml), lít (l).\n- Ưu tiên dạng: tính toán khối lượng nguyên liệu, so sánh giá trị dinh dưỡng, kiểm tra có vượt mức cho phép hay không.\n- TUYỆT ĐỐI KHÔNG dùng dạng đếm số lượng kiểu: số bánh quy, số phần cơm, số cái/chiếc.\n- Câu hỏi cuối phải xoay quanh phép tính số thập phân theo dữ liệu dinh dưỡng.`;
  }

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

  _getDifficultyGuidance(competencyLevel, topicName) {
    const level = String(competencyLevel || "Đạt").toLowerCase();
    if (level.includes("cần cố gắng")) {
      return `🔴 MỨC DỄ: 1 phép tính trực tiếp đúng chuẩn dạng "${topicName}". Cho sẵn đầy đủ các số liệu cần thiết. Lời văn cực kỳ đơn giản, không bẫy, không yêu cầu đổi đơn vị. Số liệu nguyên đẹp, ít chữ số thập phân.`;
    } else if (level.includes("đạt")) {
      return `🟡 MỨC TRUNG BÌNH: 2 phép tính. Học sinh phải thực hiện 1 bước tính toán trung gian (cộng/trừ đơn giản hoặc đổi đơn vị) để tìm ra số liệu, SAU ĐÓ mới dùng số liệu đó để giải quyết yêu cầu chính của bài "${topicName}". Có số thập phân đủ chữ số.`;
    } else if (level.includes("tốt")) {
      return `🟢 MỨC KHÁ: 3-4 phép tính mạch lạc. BẮT BUỘC có ít nhất 2 bước trung gian, sau đó chốt câu hỏi đúng dạng "${topicName}". Được phép có 1-2 điều kiện phụ nhưng không đánh đố. Số thập phân phức tạp hơn.`;
    } else {
      return `🔵 MỨC KHÓ (VẬN DỤNG CAO): 3-4 phép tính. Tình huống có thể phức tạp hơn (nhiều bước hoặc điều kiện phụ), nhưng vẫn phải rõ dữ kiện và BƯỚC CUỐI CÙNG bắt buộc áp dụng kiến thức của bài "${topicName}" để chốt đáp án.`;
    }
  }

  _getLengthGuidance(competencyLevel) {
    const level = String(competencyLevel || "Đạt").toLowerCase();
    if (level.includes("cần cố gắng")) {
      return "Đề bài tối đa 45 từ, tối đa 2 câu ngắn.";
    }
    if (level.includes("đạt")) {
      return "Đề bài tối đa 60 từ, tối đa 3 câu.";
    }
    if (level.includes("tốt")) {
      return "Đề bài tối đa 90 từ, tối đa 5 câu ngắn. Có thể có 1-2 điều kiện phụ để tạo độ khó vừa phải, nhưng vẫn rõ dữ kiện.";
    }
    return "Đề bài tối đa 100 từ, tối đa 5 câu, ưu tiên rõ ràng hơn dài dòng.";
  }

  _getProblemTypeLimitForBai(baiNumber = 1) {
    if (baiNumber === 1) {
      return `⭐ LOẠI BÀI 1: BẮT BUỘC tập trung vào loại câu hỏi chính sau:
  - Tính toán trực tiếp với số thập phân (cộng, trừ, nhân hoặc chia tùy theo bài học).
  - Hoặc: Tính tổng/hiệu 2-3 giá trị số thập phân trong một tình huống thực tế.
  TUYỆT ĐỐI KHÔNG được hỏi so sánh giữa 2-3 trường hợp hay loại bài khác.`;
    } else {
      return `⭐ LOẠI BÀI 2: BẮT BUỘC phải KHÁC HOÀN TOÀN với Bài 1. Chọn một trong các loại:
  - Loại A: So sánh hai giá trị thập phân (ai nặng hơn, cái nào dài hơn, phương án nào rẻ hơn).
  - Loại B: Bài toán nhiều bước: tính trung gian rồi mới chốt kết quả cuối.
  - Loại C: Kiểm tra có vượt ngưỡng/mức cho phép hay không dựa trên phép tính số thập phân.
  TUYỆT ĐỐI KHÔNG phải loại bài giống Bài 1, không được hỏi lại "tính tổng/hiệu đơn giản" như Bài 1.`;
    }
  }

  /**
   * Trả về các tình huống con (sub-scenarios) cho mỗi bối cảnh
   * @private
   */
  _getScenarioVariations(contextId = 'sieu_thi') {
    const scenarios = {
      'sieu_thi': [
        { type: 'can_nang', desc: 'cân hàng hóa tại siêu thị', unit: 'kg' },
        { type: 'thanh_toan', desc: 'thanh toán hóa đơn mua sắm', unit: 'đồng' },
        { type: 'so_sanh_gia', desc: 'so sánh giá sản phẩm', unit: 'sản phẩm' },
      ],
      'tieu_vat': [
        { type: 'chi_tieu', desc: 'kế hoạch chi tiêu tiền tiêu vặt', unit: 'khoản' },
        { type: 'tiet_kiem', desc: 'tính toán tiết kiệm', unit: 'tuần' },
      ],
      'bep_an': [
        { type: 'can_nguyen_lieu', desc: 'cân nguyên liệu nấu ăn theo gam và kg', unit: 'gam' },
        { type: 'chia_khau_phan', desc: 'chia khẩu phần ăn theo khối lượng', unit: 'kg' },
        { type: 'dinh_duong', desc: 'tính toán giá trị dinh dưỡng theo kcal', unit: 'kcal' },
      ],
      'nha_truong': [
        { type: 'do_chieu_cao', desc: 'đo chiều cao, cân nặng học sinh', unit: 'cm' },
        { type: 'do_san', desc: 'đo kích thước sân trường', unit: 'm' },
        { type: 'mua_do_dung', desc: 'mua đồ dùng học tập', unit: 'đồng' },
      ],
      'kien_truc_su': [
        { type: 'do_chieu_dai', desc: 'đo chiều dài vật liệu xây dựng', unit: 'm' },
        { type: 'can_vat_lieu', desc: 'cân khối lượng vật liệu', unit: 'kg' },
        { type: 'tinh_dien_tich', desc: 'tính diện tích với số đo thập phân', unit: 'm²' },
      ],
      'cuoc_dua': [
        { type: 'quang_duong', desc: 'đo quãng đường các chặng đua', unit: 'km' },
        { type: 'thoi_gian', desc: 'ghi chép thời gian hoàn thành', unit: 'phút' },
        { type: 'diem_so', desc: 'tính điểm với số thập phân', unit: 'điểm' },
      ],
      'du_lich': [
        { type: 'khoang_cach', desc: 'tính khoảng cách giữa các điểm du lịch', unit: 'km' },
        { type: 'chi_phi', desc: 'tính chi phí chuyến đi', unit: 'đồng' },
        { type: 'khoi_luong', desc: 'cân hành lý du lịch', unit: 'kg' },
      ]
    };
    return scenarios[contextId] || scenarios['sieu_thi'];
  }

  /**
   * Random chọn một tình huống con từ danh sách
   * @private
   */
  _getRandomScenario(contextId = 'sieu_thi', excludeIndex = -1) {
    const variations = this._getScenarioVariations(contextId);
    let randomIndex = Math.floor(Math.random() * variations.length);
    // Nếu muốn loại trừ một scenario cụ thể (để Bài 1 và Bài 2 khác nhau)
    if (excludeIndex !== -1 && variations.length > 1) {
      randomIndex = (excludeIndex + 1 + Math.floor(Math.random() * (variations.length - 1))) % variations.length;
    }
    return { ...variations[randomIndex], index: randomIndex };
  }

  async generateSimilarProblem(
    startupProblem1,
    startupProblem2,
    context = "",
    problemNumber = 1,
    competencyLevel = "Đạt",
    startupPercentage = 100,
    specificWeaknesses = "",
    examContextId = ""
  ) {
    // ✅ FIX: Use 'context' from params as topicName (Vietnamese lesson name)
    const topicName = context || "Cộng số thập phân";
    const lessonGuidance = this._getLessonSpecificGuidance(topicName);
    const difficultyGuidance = this._getDifficultyGuidance(competencyLevel, topicName);
    const lengthGuidance = this._getLengthGuidance(competencyLevel);
    const problemTypeGuidance = this._getProblemTypeLimitForBai(problemNumber);
    const ctx = EXAM_CONTEXTS.find((c) => c.id === examContextId) || EXAM_CONTEXTS[0];
    const recentGenerated = this._getRecentGeneratedProblems(ctx.id);

    // ✅ Random scenario con từ bối cảnh
    const excludeIndex = problemNumber > 1 ? this._lastScenarioIndexByContext.get(ctx.id) ?? -1 : -1;
    const scenario = this._getRandomScenario(ctx.id, excludeIndex);
    this._lastScenarioIndexByContext.set(ctx.id, scenario.index);
    const scenarioInjection = `
  - Tình huống cụ thể: ${scenario.desc}
  - Từ vựng sử dụng: "${scenario.unit}"`;

    const contextInjection = `
  ═══════════════════════════════════════════════════════════════
  BOI CANH VA TUYEN NHAN VAT
  ═══════════════════════════════════════════════════════════════
  - Bai toan phai dien ra trong boi canh: ${ctx.name} (${ctx.description})
  ${scenarioInjection}
  ${CHARACTER_GUIDE}
  `;

    const antiDuplicateGuidance = this._buildAntiDuplicateGuidance({
      startupProblem1,
      startupProblem2,
      recentGenerated,
      problemNumber
    });
    const bepAnConstraint = ctx.id === 'bep_an' ? this._getBepAnConstraint() : '';

    const prompt = `Bạn là chuyên gia ra đề toán tiểu học siêu việt.
CHỦ ĐỀ & TRỌNG TÂM HIỆN TẠI: ${topicName}

[TIẾN TRÌNH & RÀNG BUỘC KỸ THUẬT]
Bài 24: Cộng số thập phân -> Bài 25: Trừ số thập phân -> Bài 26: Nhân số thập phân -> Bài 27: Chia số thập phân -> Bài 28: Nhân, chia với 10, 100, 0,1.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. TUYỆT ĐỐI KHÔNG dùng khái niệm/công thức của các bài học đứng sau bài "${topicName}".
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải hỏi ĐÚNG DẠNG TOÁN của bài "${topicName}". (Ví dụ: Đang ở bài Cộng số thập phân thì phải hỏi phép cộng, cấm hỏi ngược lại phép nhân/chia).
3. CHỈ dùng dấu PHẨY (,) cho số thập phân, KHÔNG dùng dấu chấm (.). Ví dụ: 2,5 kg, 0,75 lít, 12,3 m
4. CHỈ dùng số thập phân "ĐẸP" - HỮU HẠN không lặp lại. VÍ DỤ: 2,3, 3,45, 0,5, 1,25, 0,75, 12,5. TUYỆT ĐỐI KHÔNG: 0,333... (1/3), 0,6666... (2/3), 0,1666... (1/6)
5. GHI ĐƠN VỊ: Phải ghi rõ đơn vị (kg, m, cm, lít, v.v.) trong bài toán và yêu cầu.

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
${problemTypeGuidance}
Yêu cầu sinh đề: ${difficultyGuidance}
Độ dài bắt buộc: ${lengthGuidance}
Lưu ý chuyên môn: ${lessonGuidance}
${antiDuplicateGuidance}
${bepAnConstraint}
${contextInjection}

[YÊU CẦU ĐẦU RA JSON BẮT BUỘC]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Bước 1: Phân tích yêu cầu dạng toán ${topicName}. Bước 2: Thiết kế các bước giải tương ứng với độ khó. Bước 3: Chốt câu hỏi cuối cùng đảm bảo đúng dạng ${topicName}.",
  "de_bai": "Viết trực tiếp đề bài tự luận NGẮN GỌN theo đúng Độ dài bắt buộc. KHÔNG có trắc nghiệm. KHÔNG lời dẫn. PHẢI dùng dấu phẩy (,) cho số thập phân, CHỈ dùng số thập phân đẹp. GHI ĐẦY ĐỦ ĐƠN VỊ."
}`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const parsed = extractJSON(result?.response.text() || "");

      if (parsed && parsed.de_bai) {
        const cleaned = this._cleanGeneratedProblem(parsed.de_bai);
        this._rememberGeneratedProblem(ctx.id, cleaned);
        return cleaned;
      }
      return "Một bao gạo cân nặng 25,5 kg. Sau khi sử dụng, bao gạo còn nặng 12,75 kg. Hỏi đã sử dụng bao nhiêu ki-lô-gam gạo?";
    } catch (error) {
      console.error("Lỗi sinh đề:", error);
      return "Một cửa hàng có 48,6 kg đường. Chia đều vào 6 túi. Hỏi mỗi túi có bao nhiêu ki-lô-gam đường?";
    }
  }

  async generateApplicationProblem(studentContext) {
    const {
      errorsInKhoiDong = [],
      weaknessesInLuyenTap = {},
      topicName = "Số thập phân",
      competencyLevel = "Đạt",
      examContextId = '',
      recentPracticeProblems = []
    } = studentContext;

    // ✅ FIX: Extract nhanXet (comments) from TC1-TC4 objects in weaknessesInLuyenTap
    const practiceComments = Object.values(weaknessesInLuyenTap)
      .map(tc => tc?.nhanXet)
      .filter(comment => comment && typeof comment === 'string' && comment.trim());
    
    const errorLog = [...errorsInKhoiDong, ...practiceComments].join("; ");
    const difficultyGuidance = this._getDifficultyGuidance(competencyLevel, topicName);
    const lengthGuidance = this._getLengthGuidance(competencyLevel);
    const problemTypeGuidance = this._getProblemTypeLimitForBai(2);
    const ctx = EXAM_CONTEXTS.find((c) => c.id === examContextId) || EXAM_CONTEXTS[0];
    const antiDuplicateGuidance = this._buildAntiDuplicateGuidance({
      startupProblem1: Array.isArray(recentPracticeProblems) ? recentPracticeProblems[0] : '',
      startupProblem2: Array.isArray(recentPracticeProblems) ? recentPracticeProblems[1] : '',
      recentGenerated: this._getRecentGeneratedProblems(ctx.id),
      problemNumber: 3
    });
    const bepAnConstraint = ctx.id === 'bep_an' ? this._getBepAnConstraint() : '';

    // ✅ Random scenario con từ bối cảnh (KHÁC với Bài 1)
    const scenario = this._getRandomScenario(ctx.id, -1);
    const scenarioInjection = `
  - Tình huống cụ thể: ${scenario.desc}
  - Từ vựng sử dụng: "${scenario.unit}"`;

    const contextInjection = `
  ═══════════════════════════════════════════════════════════════
  BOI CANH VA TUYEN NHAN VAT
  ═══════════════════════════════════════════════════════════════
  - Bai toan phai dien ra trong boi canh: ${ctx.name} (${ctx.description})
  ${scenarioInjection}
  ${CHARACTER_GUIDE}
  `;

    const prompt = `TẠO ĐỀ TOÁN VẬN DỤNG THỰC TẾ. 
CHỦ ĐỀ & TRỌNG TÂM HIỆN TẠI: ${topicName}

[TIẾN TRÌNH & RÀNG BUỘC KỸ THUẬT]
Bài 24: Cộng số thập phân -> Bài 25: Trừ số thập phân -> Bài 26: Nhân số thập phân -> Bài 27: Chia số thập phân -> Bài 28: Nhân, chia với 10, 100, 0,1.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. Cấm dùng kiến thức vượt cấp.
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải là dạng toán "${topicName}". Không được nhầm lẫn sang bài khác.
3. CHỈ dùng dấu PHẨY (,) cho số thập phân, KHÔNG dùng dấu chấm (.). Ví dụ: 2,5 kg, 0,75 lít, 12,3 m
4. CHỈ dùng số thập phân "ĐẸP" - HỮU HẠN không lặp lại.
5. GHI ĐƠN VỊ: Phải ghi rõ đơn vị (kg, m, cm, lít, v.v.) trong bài toán và yêu cầu.

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
${problemTypeGuidance}
Yêu cầu sinh đề: ${difficultyGuidance}
Độ dài bắt buộc: ${lengthGuidance}
Lỗi HS hay mắc: ${errorLog || "Không có lỗi cụ thể"}.
${antiDuplicateGuidance}
${bepAnConstraint}
${contextInjection}

[YÊU CẦU ĐẦU RA JSON BẮT BUỘC]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Phân tích bối cảnh bài toán cho mức ${competencyLevel}. Loại bài PHẢI khác hoàn toàn với Bài 1 luyện tập. Đảm bảo câu hỏi cuối cùng hỏi đúng kiến thức ${topicName}.",
  "de_bai": "Chỉ sinh 1 bài toán ngắn gọn theo đúng Độ dài bắt buộc. Cấm trắc nghiệm. Không tiêu đề. PHẢI dùng dấu phẩy (,) cho số thập phân, CHỈ dùng số thập phân đẹp. GHI ĐẦY ĐỦ ĐƠN VỊ."
}`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const parsed = extractJSON(result?.response.text() || "");
      
      if (parsed && parsed.de_bai) {
        const cleaned = this._cleanGeneratedProblem(parsed.de_bai);
        this._rememberGeneratedProblem(ctx.id, cleaned);
        return cleaned;
      }
      return "Một mảnh vải dài 24,5 m. Người ta cắt thành 7 đoạn bằng nhau. Hỏi mỗi đoạn vải dài bao nhiêu mét?";
    } catch (error) {
      console.error("Lỗi sinh đề vận dụng:", error);
      return "Một bé cân nặng 32,5 kg. Mẹ cân nặng gấp 1,5 lần bé. Hỏi mẹ cân nặng bao nhiêu ki-lô-gam?";
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

const geminiPracticeServiceSoThapPhan = new GeminiPracticeServiceSoThapPhan();
export default geminiPracticeServiceSoThapPhan;
