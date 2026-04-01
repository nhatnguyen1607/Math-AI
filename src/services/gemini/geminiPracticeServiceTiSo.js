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
    } else if (level.includes("tốt")) {
      return `🟢 MỨC KHÁ: 3-4 phép tính mạch lạc. BẮT BUỘC có ít nhất 2 bước trung gian (ví dụ: tìm phần còn lại rồi mới tính tỉ số %, hoặc tính tổng từ các phần rồi mới suy ra tỉ lệ), sau đó chốt câu hỏi đúng dạng "${topicName}". Được phép có 1-2 điều kiện phụ nhưng không đánh đố.`;
    } else {
      return `🟢 MỨC KHÓ (VẬN DỤNG CAO): 3 phép tính trở lên. Số liệu bị ẩn giấu kỹ trong một tình huống thực tế. Học sinh phải lập luận, tính tổng/hiệu/tích/thương qua nhiều bước để tìm ra các đại lượng ẩn, BƯỚC CUỐI CÙNG mới áp dụng công thức của bài "${topicName}" để trả lời câu hỏi.`;
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
    // BÀI 1: Tập trung vào loại bài tính trực tiếp một dạng tỉ số/tỉ số phần trăm
    if (baiNumber === 1) {
      return `⭐ LOẠI BÀI 1: BẮT BUỘC tập trung vào loại câu hỏi chính sau:
  - Tính tỉ số của hai đại lượng (ví dụ: a : b hoặc a/b).
  - Hoặc: Tính tỉ số phần trăm của hai số cho sẵn.
  - Hoặc: Chia một đại lượng theo tỉ số cho trước.
  TUYỆT ĐỐI KHÔNG được hỏi so sánh giữa 2-3 trường hợp khác nhau hay multiple-choice tỉ số.`;
    } else {
      // BÀI 2: Tập trung vào loại bài khác nhau: so sánh hoặc tính giá trị phần trăm từ tỉ số
      return `⭐ LOẠI BÀI 2: BẮT BUỘC phải KHÁC HOÀN TOÀN với Bài 1. Chọn một trong các loại:
  - Loại A: Cho tỉ số phần trăm, tính giá trị cụ thể (ngược lại bài 1 chỉ tính tỉ số %).
  - Loại B: So sánh tỉ số giữa 2-3 nhân vật/đối tượng khác nhau.
  - Loại C: Bài toán với 2 bước tính tỉ số phụ, rồi mới suy ra kết quả cuối cùng (ví dụ: tìm tỉ số từ tổng và hiệu).
  TUYỆT ĐỐI KHÔNG phải loại bài giống Bài 1, không được hỏi lại "tính tỉ số % của hai số" như Bài 1.`;
    }
  }

  /**
   * Trả về các tình huống con (sub-scenarios) cho mỗi bối cảnh
   * Mỗi bối cảnh có thể có nhiều loại tình huống nhỏ để đa dạng không lặp
   * @private
   */
  _getScenarioVariations(contextId = 'sieu_thi') {
    const scenarios = {
      'sieu_thi': [
        { type: 'gia_hang', desc: 'giá các mặt hàng trong siêu thị', unit: 'sản phẩm' },
        { type: 'so_luong', desc: 'số lượng sản phẩm bán được', unit: 'lần bán' },
        { type: 'giam_gia', desc: 'khách hàng so sánh giá sau giảm', unit: 'mức giảm' },
      ],
      'tieu_vat': [
        { type: 'chi_toan_bo', desc: 'kế hoạch chi tiêu toàn bộ tiền', unit: 'hạng mục' },
        { type: 'so_sanh_hai_chi_tieu', desc: 'so sánh hai loại chi tiêu khác nhau', unit: 'mục chi' },
        { type: 'tiet_kiem_vs_chi', desc: 'so sánh tiền tiết kiệm với tiền chi tiêu', unit: 'phần' },
      ],
      'bep_an': [
        { type: 'dinh_duong', desc: 'so sánh tỉ lệ dinh dưỡng trong thực phẩm', unit: 'chất' },
        { type: 'so_luong_thuc_pham', desc: 'tỉ lệ các loại thực phẩm trong một bữa ăn', unit: 'loại' },
        { type: 'khau_phan', desc: 'chia khẩu phần ăn', unit: 'phần' },
      ],
      'nha_truong': [
        { type: 'ti_so_thanh_tich', desc: 'tỉ lệ thành tích giữa các lớp', unit: 'lớp' },
        { type: 'so_luong_sach', desc: 'tỉ số sách giữa các thư viện lớp', unit: 'thư viện' },
        { type: 'so_sang_choi', desc: 'so sánh thiết bị chơi giữa các khu sân', unit: 'khu' },
        { type: 'dnh_tieu_dung', desc: 'chi tiêu trường học', unit: 'khoản' },
      ],
      'kien_truc_su': [
        { type: 'ti_le_ban_do', desc: 'tỉ lệ bản đồ công trình', unit: 'bộ phận' },
        { type: 'ti_so_dien_tich', desc: 'so sánh diện tích các phòng', unit: 'phòng' },
        { type: 'ti_so_khoi_luong', desc: 'tỉ số khối lượng vật liệu xây dựng', unit: 'vật liệu' },
      ],
      'cuoc_dua': [
        { type: 'so_sanh_van_toc', desc: 'so sánh tỉ số vận tốc giữa các thí sinh', unit: 'thí sinh' },
        { type: 'ti_so_diem', desc: 'tỉ lệ điểm thưởng/trừ giữa các chặng', unit: 'chặng' },
        { type: 'ti_so_tham_du', desc: 'tỉ số số người tham dự đua', unit: 'đội' },
      ],
      'du_lich': [
        { type: 'ti_so_khoang_cach', desc: 'so sánh khoảng cách giữa các quãng đường', unit: 'quãng' },
        { type: 'so_sanh_ngay', desc: 'tỉ lệ ngày đi vs ngày ở tại mỗi nơi', unit: 'địa điểm' },
        { type: 'chi_phi_du_lich', desc: 'so sánh chi phí giữa các hoạt động', unit: 'hoạt động' },
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
    const topicName = context || "Tỉ số đơn giản";
    const lessonGuidance = this._getLessonSpecificGuidance(topicName);
    const difficultyGuidance = this._getDifficultyGuidance(competencyLevel, topicName);
    const lengthGuidance = this._getLengthGuidance(competencyLevel);
    const problemTypeGuidance = this._getProblemTypeLimitForBai(1); // BÀI 1
    const ctx = EXAM_CONTEXTS.find((c) => c.id === examContextId) || EXAM_CONTEXTS[0];
    
    // ✅ MỚI: Random scenario con từ bối cảnh
    const scenario = this._getRandomScenario(ctx.id);
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

    const prompt = `Bạn là chuyên gia ra đề toán tiểu học siêu việt.
CHỦ ĐỀ & TRỌNG TÂM HIỆN TẠI: ${topicName}

[TIẾN TRÌNH & RÀNG BUỘC KỸ THUẬT]
Bài 36: Tỉ số, Tỉ số phần trăm -> Bài 37: Tỉ lệ bản đồ -> Bài 38: Tìm hai số khi biết Tổng và Tỉ -> Bài 39: Tìm hai số khi biết Hiệu và Tỉ -> Bài 40: Tìm tỉ số phần trăm của hai số -> Bài 41: Tìm giá trị phần trăm của một số.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. TUYỆT ĐỐI KHÔNG dùng khái niệm của các bài học đứng sau bài "${topicName}".
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải hỏi ĐÚNG DẠNG của bài "${topicName}". (Ví dụ: Đang ở bài 40 thì phải hỏi "tỉ số phần trăm là bao nhiêu?", cấm hỏi ngược lại giá trị cụ thể của bài 41).
3. CHỈ dùng dấu PHẨY (,) cho số thập phân, KHÔNG dùng dấu chấm (.). Ví dụ: 2,5, 0,75, 12,4%, 33,33%
4. CHỈ dùng số thập phân "ĐẸP" - HỮU HẠN không lặp lại. CÁCH: 2,3, 3,45, 0,5, 1,25, 0,75, 12,5. TUYỆT ĐỐI KHÔNG: 0,333... (1/3), 0,6666... (2/3), 0,1666... (1/6)

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
${problemTypeGuidance}
Yêu cầu sinh đề: ${difficultyGuidance}
Độ dài bắt buộc: ${lengthGuidance}
Lưu ý chuyên môn: ${lessonGuidance}
${contextInjection}

[YÊU CẦU ĐẦU RA JSON BẮT BUỘC]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Bước 1: Phân tích yêu cầu dạng toán ${topicName}. Bước 2: Thiết kế các bước giải tương ứng với độ khó. Bước 3: Chốt câu hỏi cuối cùng đảm bảo đúng dạng ${topicName}.",
  "de_bai": "Viết trực tiếp đề bài tự luận NGẮN GỌN theo đúng Độ dài bắt buộc. KHÔNG có trắc nghiệm. KHÔNG lời dẫn. PHẢI dùng dấu phẩy (,) cho số thập phân, CHỈ dùng số thập phân đẹp."
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
      competencyLevel = "Đạt",
      examContextId = ''
    } = studentContext;

    // ✅ FIX: Extract nhanXet (comments) from TC1-TC4 objects in weaknessesInLuyenTap
    const practiceComments = Object.values(weaknessesInLuyenTap)
      .map(tc => tc?.nhanXet)
      .filter(comment => comment && typeof comment === 'string' && comment.trim());
    
    const errorLog = [...errorsInKhoiDong, ...practiceComments].join("; ");
    const difficultyGuidance = this._getDifficultyGuidance(competencyLevel, topicName);
    const lengthGuidance = this._getLengthGuidance(competencyLevel);
    const problemTypeGuidance = this._getProblemTypeLimitForBai(2); // BÀI 2
    const ctx = EXAM_CONTEXTS.find((c) => c.id === examContextId) || EXAM_CONTEXTS[0];
    
    // ✅ MỚI: Random scenario con từ bối cảnh (KHÁC với Bài 1)
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
Bài 36: Tỉ số, Tỉ số phần trăm -> Bài 37: Tỉ lệ bản đồ -> Bài 38: Tìm hai số khi biết Tổng và Tỉ -> Bài 39: Tìm hai số khi biết Hiệu và Tỉ -> Bài 40: Tìm tỉ số phần trăm của hai số -> Bài 41: Tìm giá trị phần trăm của một số.
⚠️ QUY TẮC TỐI THƯỢNG: 
1. Cấm dùng kiến thức vượt cấp.
2. CÂU HỎI CUỐI CÙNG của đề bài BẮT BUỘC phải là dạng toán "${topicName}". Không được nhầm lẫn sang bài khác.
3. CHỈ dùng dấu PHẨY (,) cho số thập phân, KHÔNG dùng dấu chấm (.). Ví dụ: 2,5, 0,75, 12,4%, 33,33%
4. CHỈ dùng số thập phân "ĐẸP" - HỮU HẠN không lặp lại. CÁCH: 2,3, 3,45, 0,5, 1,25, 0,75, 12,5. TUYỆT ĐỐI KHÔNG: 0,333... (1/3), 0,6666... (2/3), 0,1666... (1/6)

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
${problemTypeGuidance}
Yêu cầu sinh đề: ${difficultyGuidance}
Độ dài bắt buộc: ${lengthGuidance}
Lỗi HS hay mắc: ${errorLog || "Không có lỗi cụ thể"}.
${contextInjection}

[ĐÁNH GIÁ NĂNG LỰC & ĐỘ KHÓ]
${problemTypeGuidance}
Yêu cầu sinh đề: ${difficultyGuidance}
Độ dài bắt buộc: ${lengthGuidance}
Lỗi HS hay mắc: ${errorLog || "Không có lỗi cụ thể"}.
${contextInjection}

[YÊU CẦU ĐẦU RA JSON BẮT BUỘC]
Trả về DUY NHẤT 1 OBJECT JSON định dạng như sau:
{
  "suy_luan": "Phân tích số liệu bị ẩn cho mức ${competencyLevel}. Loại bài PHẢI khác hoàn toàn với Bài 1 luyện tập. Đảm bảo câu hỏi cuối cùng hỏi đúng kiến thức ${topicName}.",
  "de_bai": "Chỉ sinh 1 bài toán ngắn gọn theo đúng Độ dài bắt buộc. Cấm trắc nghiệm. Không tiêu đề. PHẢI dùng dấu phẩy (,) cho số thập phân, CHỈ dùng số thập phân đẹp."
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