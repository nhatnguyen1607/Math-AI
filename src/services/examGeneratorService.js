import geminiServiceInstance from './geminiService';
// apiKeyManager no longer needed here (handled inside geminiModelManager)


class ExamGeneratorService {
  // constructor removed as it served no purpose

  // initialize remains for backward compatibility but now does nothing
  async initialize() {
    // geminiModelManager internally handles API key selection/rotation
    return;
  }

  /**
   * Tạo đề thi mới dựa trên các đề mẫu
   * @param {Object} params
   * @param {string} params.topicName - Tên chủ đề (e.g., "CHỦ ĐỀ: TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN")
   * @param {string} params.lessonName - Tên bài học (e.g., "Bài 36. Tỉ số. Tỉ số phần trăm")
   * @param {Array} params.sampleExams - Danh sách các đề mẫu (có content)
   * @returns {Promise<Object>} - Đề thi mới sinh ra
   */
  async generateExamFromSamples(params) {
    try {
      const { topicName, lessonName, sampleExams } = params;

      if (!sampleExams || sampleExams.length === 0) {
        throw new Error('Chưa có đề mẫu nào để tạo đề');
      }

      // Chuẩn bị nội dung từ các đề mẫu để gửi cho AI
      const prompt = `Bạn là chuyên gia soạn đề thi toán lớp 5 theo phương pháp Polya.

═══════════════════════════════════════════════════════════════
📚 **THÔNG TIN BÀI HỌC**
═══════════════════════════════════════════════════════════════
- **CHỦ ĐỀ**: ${topicName}
- **TÊN BÀI HỌC**: ${lessonName}

📋 **CÁC ĐỀ MẪU THAM KHẢO (chỉ tham khảo cấu trúc)**:
${sampleExams.map((sample, idx) => `
[ĐỀ MẪU ${idx + 1}]: ${sample.lessonName}
${this._formatSampleContent(sample.content)}
`).join('')}

═══════════════════════════════════════════════════════════════
📖 **HƯỚNG DẪN CỤ THỂ CHO TỪNG BÀI HỌC**
═══════════════════════════════════════════════════════════════

🔷 **CHƯƠNG 1. SỐ TỰ NHIÊN**
(Ôn tập và mở rộng các phép tính với số tự nhiên)

**Ôn tập về số tự nhiên & Phép tính (Cộng, Trừ, Nhân, Chia):**
- Context: Các tình huống thực tế về số lượng lớn, dân số, diện tích, tiền tệ.
- Bài 1: Thực hiện phép tính hoặc tính giá trị biểu thức số tự nhiên.
- Bài 2: Bài toán lời văn giải quyết vấn đề thực tế cần 2-3 bước tính.

**Làm tròn số tự nhiên:**
- Context: Ước lượng số liệu trong thực tế.
- Bài 1: Làm tròn đến hàng chục, trăm, nghìn...
- Bài 2: Vận dụng làm tròn để giải quyết tình huống ước lượng mua sắm hoặc thống kê.

🔷 **CHƯƠNG 2. PHÂN SỐ**
(Phân số và các phép tính với phân số)

**Ôn tập phân số & So sánh phân số:**
- Context: Chia phần, tỉ lệ các bộ phận trong một tổng thể.
- Bài 1: Rút gọn, quy đồng hoặc so sánh các phân số.
- Bài 2: Bài toán thực tế về chia quà, chia đất hoặc so sánh phần công việc.

**Cộng, Trừ phân số (Cùng & Khác mẫu số):**
- Context: Thêm hoặc bớt các phần đại lượng.
- Bài 1: Tính tổng hoặc hiệu phân số.
- Bài 2: Bài toán lời văn (VD: vòi nước chảy vào bể, quãng đường đi trong nhiều ngày).

**Nhân, Chia phân số & Hỗn số:**
- Context: Tìm phân số của một số hoặc chia đều đại lượng cho nhiều phần.
- Bài 1: Phép tính nhân, chia phân số hoặc hỗn số.
- Bài 2: Tính diện tích hình học hoặc chia đều số lượng hàng hóa.

🔷 **CHƯƠNG 3. SỐ THẬP PHÂN**

**Khái niệm & So sánh số thập phân (Bài 10, 11, 14):**
- Context: Các đơn vị đo lường có số lẻ (mét, kg, lít).
- Bài 1: Đọc, viết, xác định hàng của STP hoặc so sánh các STP.
- Bài 2: Sắp xếp thứ tự các số liệu đo lường thực tế từ bé đến lớn hoặc ngược lại.

**Làm tròn số thập phân:**
- Context: Các tình huống cần kết quả gọn (cân nặng, đo đạc, thi đấu).
- Bài 1: Làm tròn đến số tự nhiên gần nhất, hàng phần mười hoặc hàng phần trăm.
- Bài 2: Bài toán thực tiễn. VD: Quả bí đỏ 4,68 kg làm tròn đến STN; lượng nước 0,46 lít làm tròn đến hàng phần mười; thành tích chạy 12,478 giây làm tròn đến hàng phần trăm.

**Phép cộng & Phép trừ số thập phân (Bài 19, 20):**
- Context: Thu chi tiền tệ, tổng độ dài quãng đường hoặc chênh lệch chiều cao.
- Bài 1: Tính tổng/hiệu các số thập phân.
- Bài 2: Bài toán lời văn nhiều bước tính STP.

**Phép nhân số thập phân (Bài 21, 23):**
- Context: Gấp nhiều lần đại lượng lẻ, tính diện tích hoặc nhân nhẩm.
- Bài 1: Nhân STP với STN, STP với STP hoặc nhân nhẩm với 10, 100, 0.1, 0.01...
- Bài 2: Bài toán vận dụng. VD: 3 bạn uống nước cam (mỗi bạn 0,25 l); ô tô đi 1,2 giờ (mỗi giờ 84,5 km); 10 chú gấu ăn cá (mỗi chú 4,5 kg); lấy ra 0,1 số gạo trong kho 45,8 tấn.

**Phép chia số thập phân (Bài 22, 23):**
- Context: Chia đều đại lượng, tìm kích thước hoặc chia nhẩm.
- Bài 1: Chia STP cho STN, STN cho STP, STP cho STP hoặc chia nhẩm cho 10, 100, 0.1, 0.01...
- Bài 2: Bài toán vận dụng. VD: Chia đều 9,68 yến cá vào 8 khay; nhổ 4 răng sâu hết 15,4 kg kẹo; tính chiều dài mặt sàn kính (S=292,8, R=9,6); trung bình mỗi lần máy xúc (10 lần được 937,8 tấn); tìm số tờ giấy màu (mỗi tờ 0,1 mm, cả chồng 23,5 mm).

🔷 **CHỦ ĐỀ: TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN**

**Bài 36. Tỉ số. Tỉ số phần trăm:**
- Context: So sánh 2 đại lượng cùng loại (số sách loại A/loại B, số bi đỏ/xanh, số táo/cam...). KHÔNG có ký hiệu %.
- Bài 1: Tính tỉ số đơn giản giữa 2 số (VD: 24 bi đỏ, 18 bi xanh → tỉ số bi đỏ so với bi xanh = 24/18 = 4/3).
- Bài 2: Bài toán có thêm bước tìm tỉ số rồi rút gọn hoặc so sánh 2 tỉ số.

**Bài 37. Tỉ lệ bản đồ và ứng dụng:**
- Context: BẮT BUỘC về bản đồ với tỉ lệ cụ thể (1:500, 1:1000, 1:10000...). KHÔNG về cây cối, học sinh, đồ vật.
- Bài 1: Cho kích thước trên bản đồ và tỉ lệ, tìm kích thước thực tế (VD: "bản đồ 1:500, đường dài 8cm trên bản đồ...").
- Bài 2: Bài toán ngược hoặc tính diện tích thực tế từ kích thước trên bản đồ.

**Bài 38. Tìm hai số khi biết tổng và tỉ số:**
- Context: Cho TỔNG của 2 số và TỈ SỐ giữa chúng (VD: "72 cuốn sách, số sách nhóm A bằng 2/4 nhóm B").
- Bài 1: Dạng cơ bản - tìm 2 số khi biết tổng và tỉ số đơn giản.
- Bài 2: Có thêm yếu tố so sánh 2 phương án khác nhau hoặc điều chỉnh sau khi tính.

**Bài 39. Tìm hai số khi biết hiệu và tỉ số:**
- Context: Cho HIỆU của 2 số và TỈ SỐ giữa chúng (VD: "Anh hơn em 12 tuổi, tuổi anh bằng 5/3 tuổi em").
- Bài 1: Dạng cơ bản - tìm 2 số khi biết hiệu và tỉ số.
- Bài 2: Bài toán có điều kiện phụ hoặc yêu cầu kiểm tra kết quả.

**Bài 40. Tìm tỉ số phần trăm của hai số:**
- Context: Cho 2 số, tìm số này chiếm bao nhiêu % của số kia (VD: "80kg giấy, 28kg phân loại đúng = ?%").
- Bài 1: Tính % đơn giản bằng phép chia rồi nhân 100.
- Bài 2: Có thay đổi dữ liệu (điều chỉnh số liệu) rồi so sánh % trước và sau.

**Bài 41. Tìm giá trị phần trăm của một số:**
- Context: Cho một số và tỉ lệ %, tìm giá trị tương ứng (VD: "Lớp 40 HS, 25% được khen thưởng = ? HS").
- Bài 1: Tính giá trị % đơn giản (số × %/100).
- Bài 2: Bài toán có nhiều mức % hoặc so sánh các giá trị %.

═══════════════════════════════════════════════════════════════
🎓 **HƯỚNG DẪN: CÂU HỎI BƯỚC 4 CHO MỖI LOẠI BÀI HỌC**
═══════════════════════════════════════════════════════════════

⚠️ **VỈ DỤ CÂU HỎI BƯỚC 4 (KIỂM TRA/GIẢI THÍCH) CHO TỪNG BÀI:**

📌 **Bài 36 - Tỉ số (Bước 4 mẫu):**
- "Tỉ số A/B có ý nghĩa gì? Nó cho biết điều gì?"
- "Vì sao ta cần rút gọn tỉ số? Rút gọn có lợi ích gì?"
- "Tỉ số [A/B] so với [C/D], tỉ số nào lớn hơn? Điều này có ý nghĩa gì?"
- "Cách nào để kiểm tra lại rằng tỉ số A:B = a:b là đúng?"

📌 **Bài 37 - Tỉ lệ bản đồ (Bước 4 mẫu):**
- "Vì sao chiều dài thực tế lớn hơn chiều dài trên bản đồ?"
- "Tỉ lệ bản đồ 1:X có ý nghĩa gì? Nó cho biết cái gì?"
- "Nếu bản đồ có tỉ lệ lớn hơn (VD 1:100.000 thay vì 1:50.000), bản đồ sẽ to hay nhỏ hơn? Vì sao?"
- "Cách nào để kiểm tra lại kết quả kích thước thực tế?"

📌 **Bài 38 - Tổng & Tỉ số (Bước 4 mẫu):**
- "Nếu ta cộng [số A] + [số B] từ kết quả, có được tổng [X] không? Kiểm tra lại."
- "Vì sao [số A] nhỏ/lớn hơn [số B]? Từ tỉ số nào ta biết được?"
- "Nếu tỉ số thay đổi (VD từ 2/5 thành 3/5), [số A] sẽ thay đổi như thế nào?"
- "Kết quả có hợp lý với tình huống không? Tại sao?"

📌 **Bài 39 - Hiệu & Tỉ số (Bước 4 mẫu):**
- "Nếu lấy [số lớn] - [số bé], có được hiệu [X] không? Kiểm tra lại."
- "Vì sao [số lớn] lớn hơn [số bé]? Từ tỉ số nào ta biết được?"
- "Nếu hiệu thay đổi, [số lớn] và [số bé] sẽ thay đổi như thế nào?"
- "Phương án [A] hay phương án [B] cho kết quả hợp lý hơn? Vì sao?"

📌 **Bài 40 - Tìm tỉ số phần trăm (Bước 4 mẫu):**
- "Tỉ lệ % này có hợp lý không? Nó có lớn/bé quá không?"
- "Nếu ta tính ngược lại (lấy [B]/[A]×100), ta được bao nhiêu? Tại sao khác [X]%?"
- "Kết quả [X]% cho biết cái gì chiếm bao nhiêu phần trăm của cái khác?"
- "Cách nào để kiểm tra lại rằng [X]% là đúng?"

📌 **Bài 41 - Tìm giá trị phần trăm (Bước 4 mẫu):**
- "Cách nào để kiểm tra lại kết quả [X] từ [%] của [Y]?"
- "Nếu % thay đổi, kết quả sẽ thay đổi như thế nào?"
- "Kết quả [X] này có hợp lý với tình huống không? Vì sao?"
- "Nếu ta lấy [kết quả] ÷ [số ban đầu] × 100, ta được bao nhiêu %?"

📌 **Bài 46, 47 - Đổi đơn vị đo (Bước 4 mẫu):**
- "Vì sao [số lần] cm³/dm³ lại bằng [số lần] dm³/m³? Có quy luật nào không?"
- "Nếu đổi đơn vị từ cm³ sang dm³, số đo sẽ nhỏ đi hay lớn lên? Vì sao?"
- "Kết quả so sánh [X] với [Y] ở đơn vị khác nhau, kết luận nào đúng? Tại sao?"
- "Cách nào để kiểm tra lại kết quả đổi đơn vị?"

📌 **Bài 50, 51 - Diện tích (Bước 4 mẫu):**
- "Vì sao tính diện tích toàn phần chứ không phải xung quanh? Sự khác nhau là gì?"
- "Nếu tăng chiều dài hình hộp, diện tích xung quanh sẽ tăng bao nhiêu lần?"
- "Kết quả [X] m² có hợp lý cho bài toán không? Vì sao?"
- "Cách nào để kiểm tra lại diện tích vừa tính?"

📌 **Bài 52, 53 - Thể tích (Bước 4 mẫu):**
- "Vì sao thể tích nước dâng cao lên đúng bằng thể tích vật thả vào?"
- "Nếu tăng cạnh hình lập phương gấp 2 lần, thể tích sẽ tăng gấp bao nhiêu lần? Vì sao?"
- "Kết quả [X] cm³ có hợp lý không? Nó có quá lớn/nhỏ không?"
- "Cách nào để kiểm tra lại thể tích vừa tính?"

🔴 **QUY TẮC CHI TIẾT:**
- Mỗi bài PHẢI chọn TỐI THIỂU 2 ví dụ trên để tạo 2 câu hỏi Bước 4
- Có thể kết hợp hoặc chỉnh sửa theo nội dung cụ thể của bài
- Các câu hỏi Bước 4 phải dựa vào kết quả tìm được ở Bước 3
- 🚨 NẾU BÀI THIẾU 2 CÂU HỎI BƯỚC 4 → PHẢI THÊM NGAY!

**Bài 44. Luyện tập chung (Tỉ số):**
- Context: Kết hợp các dạng toán về tỉ số đã học.
- Bài 1: Bài toán tổng hợp đơn giản.
- Bài 2: Bài toán phức tạp kết hợp nhiều kỹ năng.

🔷 **CHỦ ĐỀ 8: THỂ TÍCH. ĐƠN VỊ ĐO THỂ TÍCH**

**Bài 46. Xăng-ti-mét khối. Đề-xi-mét khối:**
- Context: Đổi đơn vị giữa cm³ và dm³ (1 dm³ = 1000 cm³).
- Bài 1: Đổi đơn vị đơn giản, so sánh 2 thể tích ở đơn vị khác nhau.
- Bài 2: Bài toán thực tế cần đổi đơn vị rồi tính toán.

**Bài 47. Mét khối:**
- Context: So sánh thể tích ở các đơn vị m³, dm³ (VD: "xe bồn 2,4 m³, bể 2500 dm³ - có đủ không?").
- Bài 1: Đổi đơn vị và so sánh 2 thể tích.
- Bài 2: Tính thể tích 2 bể hình hộp chữ nhật rồi so sánh.

**Bài 48. Luyện tập chung (Thể tích):**
- Context: Kết hợp đổi đơn vị và tính thể tích.
- Bài 1: Bài toán cơ bản về thể tích.
- Bài 2: Bài toán phức tạp với nhiều bước tính.

🔷 **CHỦ ĐỀ: DIỆN TÍCH VÀ THỂ TÍCH CỦA MỘT SỐ HÌNH KHỐI**

**Bài 50. Diện tích xung quanh và diện tích toàn phần của hình hộp chữ nhật:**
- Context: Hình hộp chữ nhật cần sơn/bọc/dán (VD: "thùng gỗ cần sơn mặt ngoài").
- Bài 1: Tính diện tích xung quanh hoặc toàn phần đơn giản.
- Bài 2: So sánh diện tích 2 hộp hoặc tính lượng vật liệu cần dùng.

**Bài 51. Diện tích xung quanh và diện tích toàn phần của hình lập phương:**
- Context: Hình lập phương cần bọc giấy/sơn kín (VD: "hộp quà cạnh 10cm, bọc giấy kín").
- Bài 1: Tính diện tích toàn phần hình lập phương (cạnh × cạnh × 6).
- Bài 2: So sánh gói riêng vs gói chung nhiều hộp để tiết kiệm giấy.

**Bài 52. Thể tích của hình hộp chữ nhật:**
- Context: Tính sức chứa/thể tích hình hộp chữ nhật (VD: "thùng gỗ dài 50cm, rộng 40cm, cao 30cm").
- Bài 1: Tính thể tích đơn giản (V = dài × rộng × cao).
- Bài 2: Bài toán thả vật vào nước - thể tích vật = thể tích nước dâng lên.

**Bài 53. Thể tích của hình lập phương:**
- Context: Tính thể tích hình lập phương (VD: "hộp lập phương cạnh 5cm").
- Bài 1: Tính thể tích đơn giản (V = cạnh × cạnh × cạnh).
- Bài 2: So sánh thể tích nhiều hình lập phương hoặc ghép hình.

**Bài 55. Luyện tập chung (Diện tích & Thể tích):**
- Context: Kết hợp tính diện tích và thể tích các hình khối.
- Bài 1: Bài toán tổng hợp cơ bản.
- Bài 2: Bài toán phức tạp so sánh hoặc tối ưu hóa.

═══════════════════════════════════════════════════════════════
🎯 **QUY TẮC BẮT BUỘC: CẢ 2 BÀI ĐỀU PHẢI ĐÚNG VỚI TÊN BÀI HỌC**
═══════════════════════════════════════════════════════════════

🔴🔴🔴 **CẢNH BÁO: CÁC BÀI HỌC VỀ TỈ SỐ RẤT DỄ NHẦM LẪN!** 🔴🔴🔴

**PHÂN BIỆT RÕ RÀNG:**
| Bài học | Dấu hiệu nhận biết | Context phải có |
|---------|-------------------|-----------------|
| Bài 36. Tỉ số | KHÔNG có % | "Tỉ số của A và B là..." |
| Bài 37. Tỉ lệ bản đồ | Có "bản đồ", "1:xxx" | "Bản đồ tỉ lệ 1:500..." |
| Bài 38. Tổng và tỉ số | Cho TỔNG + TỈ SỐ | "Tổng là X, tỉ số là a/b" |
| Bài 39. Hiệu và tỉ số | Cho HIỆU + TỈ SỐ | "Hơn kém X, tỉ số là a/b" |
| Bài 40. Tìm tỉ số % | Tìm "chiếm bao nhiêu %" | "X chiếm bao nhiêu % của Y?" |
| Bài 41. Giá trị % | Cho % → tìm số | "X% của Y bằng bao nhiêu?" |

🚨 **LỖI THƯỜNG GẶP - TUYỆT ĐỐI TRÁNH:**

🚫 **CẤM DÙNG VÍ DỤ "HỌC SINH NAM VÀ NỮ"** - Quá nhàm chán, lặp lại!
→ Thay bằng: bi đỏ/xanh, sách toán/văn, táo/cam, gà/vịt, xe máy/ô tô, bánh mì/bánh ngọt...

❌ **SAI**: Bài "Tìm tỉ số phần trăm" + Context "Có 20 bi đỏ, 15 bi xanh. Tỉ số?" 
   → Đây là BÀI 36 (tỉ số thuần), KHÔNG phải tỉ số phần trăm!
✅ **ĐÚNG**: Bài "Tìm tỉ số phần trăm" + Context "80kg giấy, 28kg phân loại đúng. Chiếm bao nhiêu %?"

❌ **SAI**: Bài "Tỉ lệ bản đồ" + Context "30 cây cam, 45 cây bưởi" 
   → Đây là TỈ SỐ thông thường!
✅ **ĐÚNG**: Bài "Tỉ lệ bản đồ" + Context "Bản đồ tỉ lệ 1:1000, đường dài 5cm..."

❌ **SAI**: Bài "Tìm giá trị phần trăm" + Context "Tìm 20 chiếm bao nhiêu % của 80"
   → Đây là BÀI 40 (tìm tỉ số %), KHÔNG phải tìm giá trị %!
✅ **ĐÚNG**: Bài "Tìm giá trị phần trăm" + Context "Lớp 40 HS, 25% được khen = ? HS"

═══════════════════════════════════════════════════════════════
🔴🔴🔴 **QUAN TRỌNG NHẤT: BÀI 1 VÀ BÀI 2 PHẢI CÙNG BÀI HỌC!** 🔴🔴🔴
═══════════════════════════════════════════════════════════════

⚠️ **LỖI NGHIÊM TRỌNG THƯỜNG GẶP:**
Bài học: "Tìm tỉ số phần trăm của hai số"
❌ Bài 1: Tỉ số phần trăm (ĐÚNG)
❌ Bài 2: Tìm hai số khi biết tổng và tỉ số (SAI - ĐÂY LÀ BÀI HỌC KHÁC!)

**QUY TẮC BẮT BUỘC:**
- Bài học "${lessonName}" → Bài 1 phải về "${lessonName}"
- Bài học "${lessonName}" → Bài 2 CŨNG phải về "${lessonName}" (chỉ khó hơn)
- TUYỆT ĐỐI KHÔNG được tạo Bài 2 thuộc bài học khác!

**VÍ DỤ ĐÚNG cho bài "Tìm tỉ số phần trăm của hai số":**
- Bài 1: Context về tìm % (đơn giản)
- Bài 2: Context về tìm % (phức tạp hơn, có so sánh 2 tỉ lệ %)

**VÍ DỤ SAI:**
- Bài 1: Tìm tỉ số phần trăm
- Bài 2: Tìm hai số khi biết tổng và tỉ số ← SAI! Đây là BÀI 38, không phải BÀI 40!

═══════════════════════════════════════════════════════════════
📐 **CẤU TRÚC BÀI TẬP VÀ CÂU HỎI THEO 4 BƯỚC POLYA**
═══════════════════════════════════════════════════════════════

⚠️ **QUAN TRỌNG: CONTEXT PHẢI LÀ BÀI TOÁN HOÀN CHỈNH!**

**CONTEXT (Đoạn văn/Bối cảnh) phải:**
- Chứa ĐẦY ĐỦ dữ kiện cần thiết để giải bài toán
- Có câu hỏi cuối cùng nêu rõ yêu cầu cần tìm
- Viết như một bài toán có lời văn hoàn chỉnh (3-5 câu)

**VÍ DỤ CONTEXT ĐÚNG:**
✅ "Trường Tiểu học Hòa Bình chuẩn bị bơm đầy một bể nước phía sau sân trường. Trên thành bể có ghi dung tích: 2500 dm³. Một xe bồn chở đến 2,4 m³ nước để đổ vào bể. Hỏi xe bồn có chở đủ nước để đổ đầy bể không?"

✅ "Trong buổi tổng kết phong trào Đọc sách mỗi ngày, lớp 5C thống kê được 72 cuốn sách do hai nhóm học sinh mang đến. Biết số sách của nhóm Bình Minh bằng 2/4 số sách của nhóm Hoàng Hôn. Hỏi mỗi nhóm đã mang đến bao nhiêu cuốn sách?"

❌ CONTEXT SAI (quá ngắn, thiếu yêu cầu):
"Một bản đồ địa hình có tỉ lệ 1:50000." → Thiếu dữ kiện và câu hỏi!

═══════════════════════════════════════════════════════════════
📝 **CÂU HỎI PHẢI TUÂN THEO THỨ TỰ 4 BƯỚC POLYA:**
═══════════════════════════════════════════════════════════════

**BƯỚC 1 - TÌM HIỂU BÀI TOÁN (1-2 câu đầu tiên) - KHÔNG TÍNH TOÁN:**
Câu hỏi mẫu:
- "Nội dung nào dưới đây mô tả đúng bài toán?"
- "[Khái niệm X] có ý nghĩa gì?" (VD: "Tỉ lệ bản đồ 1:500 có ý nghĩa gì?")
Đáp án: Các phát biểu về dữ kiện và yêu cầu (đúng/sai về cái đã cho, cái cần tìm)

**BƯỚC 2 - LẬP KẾ HOẠCH (1-2 câu tiếp) - SUY LUẬN, CHƯA TÍNH:**
Câu hỏi mẫu:
- "Muốn biết X, cần làm gì?" / "Cần làm gì trước?"
- "Để tính X, em cần thực hiện phép tính nào?"
- "Cần áp dụng dạng toán/công thức nào?"
- "Tổng số phần bằng nhau là bao nhiêu?" (cho bài tỉ số)
Đáp án: Các cách tiếp cận/phép tính khác nhau

**BƯỚC 3 - THỰC HIỆN (1-3 câu) - TÍNH TOÁN CỤ THỂ:**
Câu hỏi mẫu:
- "Kết quả của phép tính trên/vừa tìm được là bao nhiêu?"
- "Giá trị X là bao nhiêu?" (VD: "Số sách của nhóm Bình Minh là?")
- Có thể hỏi kết quả trung gian trước khi hỏi kết quả cuối
Đáp án: Các con số (đúng và các lỗi tính phổ biến)

**BƯỚC 4 - KIỂM TRA & ĐÁNH GIÁ (1-2 câu cuối) - BẮT BUỘC CÓ:**
🔴 **LUÔN PHẢI CÓ ÍT NHẤT 1 CÂU HỎI KIỂM TRA Ở CUỐI MỖI BÀI!**

Câu hỏi mẫu (CHỌN 1-2 trong các dạng sau):
- "Kết quả [đáp án câu trước] cho ta biết điều gì?" → Ý nghĩa thực tiễn
- "Vì sao bạn chọn đáp án như vậy ở câu trước?" → Giải thích lý do chọn
- "Vì sao [kết quả X] lớn hơn/nhỏ hơn [kết quả Y]?" → Hiểu bản chất
- "Theo em, phương án nào tốt hơn? Vì sao?" → So sánh (cho bài có 2 phương án)
- "Cách nào để kiểm tra lại kết quả vừa tìm được?" → Kiểm chứng

Đáp án mẫu cho câu "Vì sao bạn chọn đáp án...":
→ A. Vì [lý do đúng - giải thích bản chất] ✓
→ B. Vì [lý do sai - hiểu nhầm]
→ C. Vì [lý do sai - chỉ nêu hiện tượng, không giải thích]
→ D. Mình chưa giải thích được

═══════════════════════════════════════════════════════════════
🔴 **VÍ DỤ CỤ THỂ CHO BÀI "TỈ LỆ BẢN ĐỒ":**
═══════════════════════════════════════════════════════════════

**CONTEXT:**
"Trên bản đồ tỉ lệ 1:50000, một con đường được vẽ dài 4 cm. Bạn An muốn biết con đường đó thực tế dài bao nhiêu km để lên kế hoạch đi bộ."

**CÂU HỎI THEO 4 BƯỚC:**
1. [Bước 1] "Tỉ lệ 1:50000 trên bản đồ có ý nghĩa gì?"
   → A. 1cm trên bản đồ = 50000cm thực tế ✓
   → B. 1cm thực tế = 50000cm trên bản đồ
   → C. Bản đồ nhỏ hơn thực tế 50000 lần
   → D. Mình chưa chắc

2. [Bước 2] "Để tìm chiều dài thực tế, em cần thực hiện phép tính nào?"
   → A. 4 : 50000
   → B. 4 × 50000 ✓
   → C. 50000 : 4
   → D. 4 + 50000

3. [Bước 3] "Chiều dài thực tế của con đường là bao nhiêu km?"
   → A. 0,2 km
   → B. 2 km ✓
   → C. 20 km
   → D. 200 km

4. [Bước 4] "Vì sao chiều dài thực tế lớn hơn chiều dài trên bản đồ?"
   → A. Vì bản đồ được phóng to
   → B. Vì bản đồ được thu nhỏ theo tỉ lệ ✓
   → C. Vì đơn vị đo khác nhau
   → D. Mình chưa giải thích được

📝 **LƯU Ý QUAN TRỌNG:**
- KHÔNG hiển thị "[Bước X]" trong câu hỏi thực tế
- Số câu hỏi linh hoạt (4-10 câu/bài tùy độ phức tạp)
- Random vị trí đáp án đúng
- Đáp án sai phải có lý do phổ biến (nhầm công thức, tính sai, hiểu sai đề...)

🔴 **BẮT BUỘC - KIỂM TRA LẠI KỆT QUẢ (BƯỚC 4 POLYA):**
- 👉 **Mỗi bài TỐI THIỂU PHẢI CÓ 2 CÂU HỎI BƯỚC 4 ở cuối** (không phải chỉ 1 câu)
- Câu hỏi Bước 4 phải hỏi về cách kiểm tra/xác minh kết quả, ý nghĩa, hoặc lý do
- Dạng câu hỏi Bước 4 bao gồm:
  * "Vì sao [kết quả] lớn hơn/nhỏ hơn [kết quả khác]?" → Giải thích so sánh
  * "[Kết quả] cho ta biết điều gì?" → Ý nghĩa thực tiễn
  * "Cách nào để kiểm tra lại kết quả [kết quả vừa tìm]?" → Xác minh
  * "Theo em, [phát biểu/phương án] nào đúng? Vì sao?" → Loại bỏ sai lầm
  * "Em có chắc chắn về kết quả không? Tại sao?" → Tự tin giải thích
- 🚨 **NẾU BÀI THIẾU 2 CÂU HỎI BƯỚC 4 → KHÔNG ĐƯỢC DỪNG, PHẢI THÊM ĐỦ VÀO!**
- Nếu bài chỉ có Bước 1, 2, 3 mà thiếu Bước 4, bài tập coi như chưa hoàn chỉnh!

═══════════════════════════════════════════════════════════════
⚡ **BÀI 2 PHẢI KHÓ HƠN BÀI 1**
═══════════════════════════════════════════════════════════════

**BÀI 1 - CƠ BẢN (4-5 câu, 300s):**
- Context đơn giản, 2-3 dữ kiện
- Chỉ cần 1-2 bước tính
- Số liệu đơn giản, dễ tính

**BÀI 2 - NÂNG CAO (6-10 câu, 480s) - VẪN CÙNG BÀI HỌC:**
- Context phức tạp hơn, 3-5 dữ kiện, NHƯNG VẪN VỀ "${lessonName}"
- Cần 2-4 bước tính
- Có thể có: so sánh 2 phương án, dữ kiện thừa, tư duy ngược, điều chỉnh sau tính toán
- 🚫 KHÔNG ĐƯỢC chuyển sang dạng toán khác (VD: từ "tỉ số %" sang "tổng và tỉ số")

═══════════════════════════════════════════════════════════════
📄 **ĐỊNH DẠNG JSON OUTPUT**
═══════════════════════════════════════════════════════════════

{
  "topicName": "${topicName}",
  "lessonName": "${lessonName}",
  "exercises": [
    {
      "name": "Bài 1: [Tên liên quan ${lessonName}]",
      "duration": 300,
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
      "name": "Bài 2: [Tên khác VẪN VỀ ${lessonName}]",
      "duration": 480,
      "context": "[BỐI CẢNH PHỨC TẠP HƠN, VẪN ĐÚNG ${lessonName}]",
      "questions": [...]
    }
  ]
}

**YÊU CẦU:**
- correctAnswers: array chỉ số 0-based ([0]=A, [1]=B, [2]=C, [3]=D)
- explanation: Giải thích chi tiết cho MỖI đáp án (Chọn A → ..., Chọn B → ...)
- Đề mới phải độc lập, KHÔNG COPY từ đề mẫu

🔴🔴🔴 **KIỂM TRA BẮT BUỘC TRƯỚC KHI OUTPUT:** 🔴🔴🔴
1. ⚠️ Bài 1 và Bài 2 có CÙNG thuộc bài học "${lessonName}" không? (QUAN TRỌNG NHẤT!)
2. Context Bài 1 có đúng với "${lessonName}" không? (Nếu sai → sửa lại!)
3. Context Bài 2 có đúng với "${lessonName}" không? (Nếu sai → sửa lại!)
4. Nếu bài học có "phần trăm" → context PHẢI có ký hiệu % hoặc hỏi "chiếm bao nhiêu %"
5. Nếu bài học có "bản đồ" → context PHẢI có "bản đồ tỉ lệ 1:xxx"
6. Nếu bài học có "tổng và tỉ số" → context PHẢI cho TỔNG và TỈ SỐ
7. Nếu bài học có "hiệu và tỉ số" → context PHẢI cho HIỆU và TỈ SỐ

❌ **NẾU BÀI 2 THUỘC BÀI HỌC KHÁC → TẠO LẠI BÀI 2!**

═══════════════════════════════════════════════════════════════
🔴 **KIỂM TRA BƯỚC 4 - KIỂM TRA LẠI KỌT QUẢ (TRƯỚC KHI SUBMIT):**
═══════════════════════════════════════════════════════════════

🚨 **BẮT BUỘC - QUY TẮC CHẤT LƯỢNG CUỐI CÙNG:**

Trước khi trả về JSON, kiểm tra từng bài:

✅ **BÀI 1:**
   1. Đếm tất cả các câu hỏi = ? câu
   2. Có bao nhiêu câu hỏi HỎI VỀ KIỂM TRA/GIẢI THÍCH? (Bước 4)
      - Câu hỏi "Vì sao..." hoặc "Cách nào để kiểm tra..." → ✓ Là Bước 4
      - Câu hỏi "Tính... kết quả là...?" → ✗ Là Bước 3, không phải Bước 4
   3. 🔴 **TỐI THIỂU PHẢI CÓ 2 CÂU HỎI BƯỚC 4**
   4. Nếu < 2 câu → PHẢI THÊM câu hỏi kiểm tra/ giải thích cho đến đủ 2 câu!

✅ **BÀI 2:**
   1. Đếm tất cả các câu hỏi = ? câu
   2. Có bao nhiêu câu hỏi HỎI VỀ KIỂM TRA/GIẢI THÍCH? (Bước 4)
   3. 🔴 **TỐI THIỂU PHẢI CÓ 2 CÂU HỎI BƯỚC 4**
   4. Nếu < 2 câu → PHẢI THÊM câu hỏi kiểm tra/giải thích cho đến đủ 2 câu!

🔴 **NHỮNG GÌ KHÔNG TÍNH LÀ "KIỂM TRA LẠI":**
❌ "Kết quả tìm được là bao nhiêu?" → Đây là Bước 3 (thực hiện)
❌ "Để tính X, em cần làm gì?" → Đây là Bước 2 (lập kế hoạch)
❌ "X có ý nghĩa gì?" + chỉ hỏi về khái niệm → Có thể là Bước 1 hoặc Bước 4 (tùy nội dung)

🟢 **NHỮNG GÌ TÍNH LÀ "KIỂM TRA LẠI" (BƯỚC 4):**
✅ "Vì sao [kết quả] lớn hơn [kết quả khác]?" → Giải thích so sánh
✅ "[Kết quả] cho biết điều gì?" + giải thích ý nghĩa thực tiễn → Đánh giá ý nghĩa
✅ "Cách nào để kiểm tra lại [kết quả]?" → Xác minh kết quả
✅ "Em có thể giải thích tại sao [phát biểu] là đúng/sai?" → Phân tích sai lầm
✅ "Theo em, phương án [A/B/C/D] tốt hơn vì sao?" → So sánh mục tiêu
✅ "[Phát biểu A] so với [Phát biểu B], phát biểu nào phản ánh tốt hơn?" → Đánh giá lựa chọn

💡 **HƯỚNG DẪN THÊM CÂU HỎI BƯỚC 4:**

Nếu bài chỉ có Bước 1, 2, 3 mà thiếu Bước 4:
1. Xem kết quả tìm được ở Bước 3
2. Thêm câu hỏi hỏi "Vì sao kết quả này lớn/nhỏ/hợp lý?"
3. Hoặc hỏi "Kết quả này cho ta biết điều gì về tình huống?"
4. Hoặc hỏi "Làm thế nào để kiểm tra lại kết quả này?"

📋 **VÍ DỤ:**
- Nếu bài về "tỉ lệ bản đồ" → Thêm câu hỏi "Vì sao chiều dài thực tế lớn hơn chiều dài trên bản đồ?"
- Nếu bài về "tổng và tỉ số" → Thêm câu hỏi "Nếu ta cộng 2 kết quả lại, ta được bao nhiêu?"
- Nếu bài về "tỉ số %" → Thêm câu hỏi "Tỉ lệ % này có hợp lý với tình huống không? Vì sao?"

═══════════════════════════════════════════════════════════════

**BẮT ĐẦU**: Tạo đề cho bài "${lessonName}". CẢ 2 BÀI đều phải về "${lessonName}". Mỗi bài phải có TỐI THIỂU 2 CÂU HỎI BƯỚC 4 (kiểm tra lại kết quả). Trả về JSON bắt đầu bằng { kết thúc bằng }`;

      // call through geminiService wrapper which itself queues the requests and handles retries
      const result = await geminiServiceInstance._practiceService._rateLimitedGenerate(prompt);
      const responseText = result ? result.response.text() : '';

      // Parse JSON từ response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Không thể phân tích đáp án từ AI');
      }

      // Sanitize JSON string to remove control characters
      const sanitizedJson = this._sanitizeJsonString(jsonMatch[0]);
      const generatedExam = JSON.parse(sanitizedJson);
      return {
        success: true,
        data: generatedExam
      };
    } catch (error) {
      console.error('Lỗi khi tạo đề:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Phân tích format của nội dung đề mẫu
   * @private
   */
  _analyzeFormat(content) {
    if (Array.isArray(content)) {
      return {
        type: 'structured',
        exerciseCount: content.length,
        avg_questions_per_exercise: content.reduce((sum, ex) => sum + (ex.questions?.length || 0), 0) / content.length
      };
    }
    return { type: 'text', format: typeof content };
  }

  /**
   * Định dạng nội dung đề mẫu để gửi tới AI
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
   * Sanitize JSON string to remove control characters that cause JSON parse errors
   * @private
   */
  _sanitizeJsonString(jsonStr) {
    try {
      // First attempt: try regular JSON parse
      return JSON.stringify(JSON.parse(jsonStr));
    } catch (e) {
      // If that fails, sanitize the string
      // Replace actual newlines with \n, tabs with \t, etc.
      let sanitized = jsonStr
        .replace(/[\r]/g, '\\r')  // Replace return with escaped \r
        .replace(/[\n]/g, '\\n')  // Replace newline with escaped \n
        .replace(/[\t]/g, '\\t')  // Replace tab with escaped \t
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f]/g, (match) => {
          // Replace other control characters
          return '\\u' + ('000' + match.charCodeAt(0).toString(16)).slice(-4);
        });
      
      // Try json5 parsing for better error recovery if needed
      try {
        return JSON.stringify(JSON.parse(sanitized));
      } catch (e2) {
        // Last resort: try to fix common JSON formatting issues
        sanitized = sanitized
          .replace(/,\s*}/g, '}')  // Remove trailing commas before }
          .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
          .replace(/:\s*undefined/g, ': null');  // Replace undefined with null
        
        return JSON.stringify(JSON.parse(sanitized));
      }
    }
  }

  /**
   * Tạo prompt để sinh đề với các tùy chọn cụ thể
   * @param {Object} options
   */
  setupCustomPrompt(options = {}) {
    return {
      difficulty: options.difficulty || 'medium', // 'easy', 'medium', 'hard'
      focusArea: options.focusArea || 'general',
      questionCount: options.questionCount || 10
    };
  }
}

const examGeneratorServiceInstance = new ExamGeneratorService();
export default examGeneratorServiceInstance;
