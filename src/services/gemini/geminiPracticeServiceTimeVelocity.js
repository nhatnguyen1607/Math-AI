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

export class GeminiPracticeServiceTimeVelocity extends GeminiPracticeService {
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

    return `\n[RÀNG BUỘC CHỐNG TRÙNG]\n- Bài đang sinh là Bài ${problemNumber}. Phải KHÁC rõ rệt về loại câu hỏi so với bài đã có.\n${numberedHintText}\n- Ưu tiên thêm một trong các kiểu: so sánh phương án, chọn phương án tối ưu, kiểm tra có vượt ngưỡng thời gian/tốc độ cho phép hay không.`;
  }

  _getBepAnConstraint() {
    return `\n[QUY TẮC RIÊNG CHO BỐI CẢNH BỮA ĂN DINH DƯỠNG]\n- Chỉ dùng đại lượng gắn với dinh dưỡng/chế biến: calo (kcal), gam (g), ki-lô-gam (kg), mililít (ml), lít (l), phút/giờ chuẩn bị.\n- Ưu tiên dạng: so sánh thời gian chế biến giữa 2 phương án thực đơn, hoặc kiểm tra phương án có vượt mức calo/khối lượng cho phép hay không.\n- TUYỆT ĐỐI KHÔNG dùng dạng đếm số lượng kiểu: số bánh quy, số phần cơm, số cái/chiếc.`;
  }
  
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
    } else if (level.includes("tốt")) {
      return `🟢 MỨC KHÁ: 3-4 phép tính mạch lạc. BẮT BUỘC có ít nhất 2 bước trung gian (ví dụ: tính thời gian từng chặng + cộng thời gian nghỉ, hoặc đổi đơn vị + tính thời gian trung bình), sau đó mới chốt câu hỏi chính đúng dạng "${topicName}". Được phép có 1-2 điều kiện phụ nhưng không lồng quá sâu.`;
    } else {
      return `🔵 MỨC KHÓ (VẬN DỤNG CAO): 3-4 phép tính. Tình huống có thể phức tạp hơn (nhiều chặng hoặc điều kiện phụ), nhưng vẫn phải rõ dữ kiện và BƯỚC CUỐI CÙNG bắt buộc áp dụng công thức của bài "${topicName}" để chốt đáp án.`;
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

  /**
   * Trả về các tình huống con (sub-scenarios) cho mỗi bối cảnh
   * Mỗi bối cảnh có thể có nhiều loại tình huống nhỏ để đa dạng không lặp
   * @private
   */
  _getScenarioVariations(contextId = 'cuoc_dua') {
    const scenarios = {
      'cuoc_dua': [
        { type: 'xe_dap', desc: 'cuộc đua xe đạp', unit: 'chặng' },
        { type: 'ngua', desc: 'cuộc đua ngựa', unit: 'chặng' },
        { type: 'chay_bo', desc: 'cuộc chạy đua', unit: 'vòng' },
        { type: 'thuyen', desc: 'cuộc đua thuyền', unit: 'chặng' },
      ],
      'du_lich': [
        { type: 'da_hoc', desc: 'chuyến đi học ngoài', unit: 'chặng' },
        { type: 'tham_quan', desc: 'chuyến tham quan di tích', unit: 'chặng' },
        { type: 've_que', desc: 'chuyến về quê thăm bà ngoại', unit: 'chặng' },
        { type: 'du_lich_noi', desc: 'chuyến du lịch trong nước', unit: 'chặng' },
      ],
      'nha_truong': [
        { type: 'von_dong', desc: 'buổi vận động trường', unit: 'vòng' },
        { type: 'dua_chi', desc: 'cuộc thi đua chi đội', unit: 'vòng' },
        { type: 'chay_lo', desc: 'đường chạy bộ trong sân trường', unit: 'vòng' },
      ],
      'kien_truc_su': [
        { type: 'xay_nha', desc: 'dự án xây rumah', unit: 'tầng' },
        { type: 'bet_nuoc', desc: 'công trình bể nước', unit: 'phần' },
        { type: 'san_choi', desc: 'sân chơi trong khuôn viên', unit: 'khu' },
      ],
      'sieu_thi': [
        { type: 'mua_sam', desc: 'chuyến mua sắm', unit: 'mặt hàng' },
        { type: 'thanh_toan', desc: 'lần thanh toán hóa đơn', unit: 'hóa đơn' },
      ],
      'tieu_vat': [
        { type: 'chi_tieu', desc: 'kế hoạch chi tiêu hàng tuần', unit: 'hạng mục' },
        { type: 'tiet_kiem', desc: 'dự định tiết kiệm', unit: 'giai đoạn' },
      ],
      'bep_an': [
        { type: 'chuan_bi_mon', desc: 'chuẩn bị bữa ăn theo dữ liệu calo và khối lượng', unit: 'gam' },
        { type: 'chi_tiet_dia', desc: 'so sánh hai thực đơn theo kcal và thời gian chuẩn bị', unit: 'kcal' },
      ]
    };
    return scenarios[contextId] || scenarios['cuoc_dua'];
  }

  /**
   * Random chọn một tình huống con từ danh sách
   * @private
   */
  _getRandomScenario(contextId = 'cuoc_dua', excludeIndex = -1) {
    const variations = this._getScenarioVariations(contextId);
    let randomIndex = Math.floor(Math.random() * variations.length);
    // Nếu muốn loại trừ một scenario cụ thể (để Bài 1 và Bài 2 khác nhau)
    if (excludeIndex !== -1 && variations.length > 1) {
      randomIndex = (excludeIndex + 1 + Math.floor(Math.random() * (variations.length - 1))) % variations.length;
    }
    return { ...variations[randomIndex], index: randomIndex };
  }

  _getProblemTypeLimitForBai(baiNumber = 1) {
    // BÀI 1: Tập trung vào loại bài "tính tổng thời gian" hoặc "tính thời gian từng chặng"
    if (baiNumber === 1) {
      return `⭐ LOẠI BÀI 1: BẮT BUỘC tập trung vào loại câu hỏi chính sau:
  - Tính tổng thời gian hoàn thành N chặng/vòng (bao gồm hoặc riêng thời gian nghỉ).
  - Hoặc: Tính thời gian trung bình cho 1 chặng/vòng dựa trên tổng thời gian cho N chặng (không bao gồm thời gian nghỉ).
  TUYỆT ĐỐI KHÔNG được hỏi so sánh giữa 2 đội/nhân vật hay loại bài khác.`;
    } else {
      // BÀI 2: Tập trung vào loại bài gọc nhau: "tính thời gian trung bình" hoặc "so sánh 2 đội"
      return `⭐ LOẠI BÀI 2: BẮT BUỘC phải KHÁC HOÀN TOÀN với Bài 1. Chọn một trong các loại:
  - Loại A: Tính thời gian tổng hợp từ nhiều điều kiện phụ khác nhau (ví dụ: 2-3 nhân vật khác nhau chạy, hoặc từng nhân vật chạy khác nhau, rồi so sánh xem cái nào nhanh hơn hoặc tính chung).
  - Loại B: Tính thời gian trung bình mỗi chặng/vòng, NHƯNG với điều kiện phụ khác (ví dụ: tính trung bình NOT bao gồm thời gian nghỉ, hoặc so sánh 2 ghi chép khác nhau).
  - Loại C: So sánh vận tốc/thời gian trung bình giữa 2 đội hoặc 2 người chạy khác nhau.
  TUYỆT ĐỐI KHÔNG phải loại bài giống Bài 1, không được hỏi lại "tính tổng thời gian N chặng" như Bài 1.`;
    }
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
    const topicName = context || "Vận tốc của một chuyển động đều";
    const lessonGuidance = this._getLessonSpecificGuidance(topicName);
    const difficultyGuidance = this._getDifficultyGuidance(competencyLevel, topicName);
    const lengthGuidance = this._getLengthGuidance(competencyLevel);
    const problemTypeGuidance = this._getProblemTypeLimitForBai(problemNumber); // BÀI 1/BÀI 2 theo tham số
    const ctx = EXAM_CONTEXTS.find((c) => c.id === examContextId) || EXAM_CONTEXTS[0];
    const recentGenerated = this._getRecentGeneratedProblems(ctx.id);
    
    // ✅ MỚI: Random scenario con từ bối cảnh
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
  - Biai toan phai dien ra trong boi canh: ${ctx.name} (${ctx.description})
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
Bài 56: Các đơn vị đo thời gian -> Bài 57: Cộng, trừ số đo thời gian -> Bài 58: Nhân, chia số đo thời gian với một số -> Bài 59: Vận tốc của một chuyển động đều -> Bài 60: Quãng đường, thời gian của một chuyển động đều.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. TUYỆT ĐỐI KHÔNG dùng khái niệm/công thức của các bài học đứng sau bài "${topicName}".
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải hỏi ĐÚNG ĐẠI LƯỢNG trọng tâm của bài "${topicName}". (Ví dụ: Đang ở bài 59 thì câu hỏi chốt phải là "tính vận tốc", tuyệt đối không hỏi ngược lại quãng đường hay thời gian).
3. CHỈ dùng dấu PHẨY (,) cho số thập phân, KHÔNG dùng dấu chấm (.). Ví dụ: 2,5 km/h, 0,75 giờ, 12,3 m/s
4. CHỈ dùng số thập phân "ĐẸP" - HỮU HẠN không lặp lại. CÁCH: 2,3, 3,45, 0,5, 1,25, 0,75, 12,5. TUYỆT ĐỐI KHÔNG: 0,333... (1/3), 0,6666... (2/3), 0,1666... (1/6), 2,142857... (15/7)
5. Nếu đề có "thời gian nghỉ" giữa các vòng/chặng thì tổng thời gian hoàn thành PHẢI tính cả thời gian nghỉ.
6. Nếu đề có "thời gian nghỉ", câu hỏi chính phải ghi rõ cụm "bao gồm thời gian nghỉ" để học sinh không hiểu nhầm.
7. Chỉ dùng cụm "được trừ X giây mỗi vòng" khi thực sự có cơ chế thưởng/trừ thời gian và phải nêu rõ đó là thời gian xếp hạng sau trừ.
8. ⭐ BẮT BUỘC: Toàn bộ đề bài phải dùng NHẤT QUÁN từ vựng - nếu bắt đầu với "chặng" thì toàn bộ phải dùng "chặng", nếu dùng "vòng" thì toàn bộ phải dùng "vòng". TUYỆT ĐỐI KHÔNG được trộn lẫn "chặng" và "vòng" trong cùng một đề.

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
  "suy_luan": "Bước 1: Phân tích yêu cầu dạng toán ${topicName}. Bước 2: Thiết kế các bước giải tương ứng với độ khó (có đổi đơn vị/tính thời gian nghỉ không). Bước 3: Chốt câu hỏi cuối cùng đảm bảo đúng dạng ${topicName}.",
  "de_bai": "Viết trực tiếp đề bài tự luận NGẮN GỌN theo đúng Độ dài bắt buộc. KHÔNG có trắc nghiệm. KHÔNG lời dẫn. PHẢI dùng dấu phẩy (,) cho số thập phân, CHỈ dùng số thập phân đẹp. Nếu có thời gian nghỉ thì câu hỏi chính phải ghi rõ 'bao gồm thời gian nghỉ'. ⭐ Toàn bộ đề phải dùng NHẤT QUÁN từ vựng (chỉ 'chặng' hoặc chỉ 'vòng', không trộn lẫn)."
}`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const parsed = extractJSON(result?.response.text() || "");
      
      if (parsed && parsed.de_bai) {
        const cleaned = this._cleanGeneratedProblem(parsed.de_bai);
        this._rememberGeneratedProblem(ctx.id, cleaned);
        return cleaned;
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
    const problemTypeGuidance = this._getProblemTypeLimitForBai(2); // BÀI 2: Loại bài khác - tính trung bình hoặc so sánh
    const ctx = EXAM_CONTEXTS.find((c) => c.id === examContextId) || EXAM_CONTEXTS[0];
    const antiDuplicateGuidance = this._buildAntiDuplicateGuidance({
      startupProblem1: Array.isArray(recentPracticeProblems) ? recentPracticeProblems[0] : '',
      startupProblem2: Array.isArray(recentPracticeProblems) ? recentPracticeProblems[1] : '',
      recentGenerated: this._getRecentGeneratedProblems(ctx.id),
      problemNumber: 3
    });
    const bepAnConstraint = ctx.id === 'bep_an' ? this._getBepAnConstraint() : '';
    
    // ✅ MỚI: Random scenario con từ bối cảnh (KHÁ NHAU với Bài 1)
    // Bài 1 vừa random xong, Bài 2 phải random khác. Vì không biết Bài 1 random được index nào,
    // ta random index -1 để system chôn tự tạo một index khác từ hàm _getRandomScenario
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
Bài 56: Các đơn vị đo thời gian -> Bài 57: Cộng, trừ số đo thời gian -> Bài 58: Nhân, chia số đo thời gian với một số -> Bài 59: Vận tốc của một chuyển động đều -> Bài 60: Quãng đường, thời gian của một chuyển động đều.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. Cấm dùng kiến thức vượt cấp.
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải là dạng toán "${topicName}". Không được nhầm lẫn sang đại lượng khác.
3. CHỈ dùng dấu PHẨY (,) cho số thập phân, KHÔNG dùng dấu chấm (.). Ví dụ: 2,5 km/h, 0,75 giờ, 12,3 m/s
4. CHỈ dùng số thập phân "ĐẸP" - HỮU HẠN không lặp lại. CÁCH: 2,3, 3,45, 0,5, 1,25, 0,75, 12,5. TUYỆT ĐỐI KHÔNG: 0,333... (1/3), 0,6666... (2/3), 0,1666... (1/6)
5. Nếu đề có "thời gian nghỉ" giữa các vòng/chặng thì tổng thời gian hoàn thành PHẢI tính cả thời gian nghỉ.
6. Nếu đề có "thời gian nghỉ", câu hỏi chính phải ghi rõ cụm "bao gồm thời gian nghỉ" để học sinh không hiểu nhầm.
7. Chỉ dùng cụm "được trừ X giây mỗi vòng" khi thực sự có cơ chế thưởng/trừ thời gian và phải nêu rõ đó là thời gian xếp hạng sau trừ.
8. ⭐ BẮT BUỘC: Toàn bộ đề bài phải dùng NHẤT QUÁN từ vựng: nếu bắt đầu với "chặng" thì toàn bộ phải dùng "chặng", nếu dùng "vòng" thì toàn bộ phải dùng "vòng". TUYỆT ĐỐI KHÔNG được trộn lẫn "chặng" và "vòng" trong cùng một đề.

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
${problemTypeGuidance}
Yêu cầu sinh đề: ${difficultyGuidance}
Độ dài bắt buộc: ${lengthGuidance}
Lỗi HS hay mắc: ${errorLog || "Không có lỗi cụ thể"}. (Tạo tình huống để rèn luyện tránh lỗi này).
${antiDuplicateGuidance}
${bepAnConstraint}
${contextInjection}

[YÊU CẦU ĐẦU RA JSON BẮT BUỘC]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Phân tích bối cảnh bài toán cho mức ${competencyLevel}. Loại bài PHẢI khác hoàn toàn với Bài 1 luyện tập. Đảm bảo học sinh phải tính toán trung gian trước khi chốt câu hỏi đúng kiến thức ${topicName}.",
  "de_bai": "Chỉ sinh 1 bài toán ngắn gọn theo đúng Độ dài bắt buộc. Cấm trắc nghiệm. Không tiêu đề. PHẢI dùng dấu phẩy (,) cho số thập phân, CHỈ dùng số thập phân đẹp. Nếu có thời gian nghỉ thì câu hỏi chính phải ghi rõ 'bao gồm thời gian nghỉ'. ⭐ Toàn bộ đề phải dùng NHẤT QUÁN từ vựng (chỉ 'chặng' hoặc chỉ 'vòng', không trộn lẫn)."
}`;

    try {
      const result = await this._rateLimitedGenerate(prompt);
      const parsed = extractJSON(result?.response.text() || "");
      
      if (parsed && parsed.de_bai) {
        const cleaned = this._cleanGeneratedProblem(parsed.de_bai);
        this._rememberGeneratedProblem(ctx.id, cleaned);
        return cleaned;
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