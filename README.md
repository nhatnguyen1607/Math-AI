🎓 Math-AI: Hệ thống Học tập Thông minh Tích hợp Trợ lý 3D & AI
📌 1. Giới thiệu tổng quan
Math-AI là một nền tảng giáo dục hiện đại chuyên biệt cho môn Toán, kết hợp sức mạnh của Generative AI (Gemini) và giao diện tương tác 3D (Spline). Hệ thống không chỉ cung cấp bài tập mà còn đóng vai trò là một gia sư ảo (AI Tutor) có khả năng hiểu, giải và hướng dẫn học sinh theo từng bước tư duy.

🚀 2. Công nghệ cốt lõi (Tech Stack)
Frontend: React 18, TailwindCSS, React Router v6/v7.

3D Interaction: @splinetool/react-spline (Robot trợ lý ảo).

Backend & API: Express.js (Local Server), Firebase (Auth & Firestore).

AI Engine: Google Gemini API (Tích hợp cơ chế xoay vòng Key để chống giới hạn 429).

Data Handling: xlsx, jspdf, html2pdf.js (Xuất báo cáo và đề thi).

🏛 3. Kiến trúc Hệ thống (System Architecture)
3.1. Cơ chế Luồng AI (AI Logic Flow)
Đây là phần quan trọng nhất để các Code Agent nắm bắt:

Service Router (src/services/serviceRouter.js): Hệ thống không dùng một Prompt chung. Thay vào đó, nó sử dụng _detectTopic để phân tích yêu cầu của người dùng và chuyển hướng đến các Service chuyên biệt:

TimeVelocity: Chuyên giải bài toán chuyển động.

TiSo: Chuyên về tỉ số và phần trăm.

SoThapPhan: Chuyên về số thập phân.

Gemini Model Manager: Quản lý việc khởi tạo model và tối ưu hóa token.

3.2. Quản lý Trợ lý ảo (Robot Companion)
Component: src/components/common/RobotCompanion.jsx

Logic: Robot có 4 trạng thái cảm xúc (idle, thinking, correct, wrong) dựa trên phản hồi của AI và kết quả làm bài của học sinh.

3.3. Phân quyền người dùng (Role-based Access Control)
Hệ thống chia làm 3 phân hệ chính được định nghĩa trong App.jsx:

Student: Dashboard, lộ trình học tập, luyện tập tự do với AI, làm Worksheet và tham gia kỳ thi trực tuyến.

Faculty (Giáo viên): Quản lý lớp học, tạo đề thi, theo dõi phiên thi trực tiếp (Live Session), chấm điểm và phân tích năng lực học sinh.

Admin: Quản trị cấp cao, cấu hình hệ thống và quản lý kho dữ liệu bài tập gốc.

📂 4. Cấu trúc thư mục (Project Structure)
Plaintext
src/
├── api/                # Các endpoint xử lý AI (VertexAI/Gemini)
├── components/
│   ├── common/         # RobotCompanion, MobileAvatar, Header dùng chung
│   ├── student/        # Component đặc thù cho giao diện học sinh
│   ├── faculty/        # Component quản lý cho giáo viên
│   └── cards/          # Các UI Card hiển thị Topic, Exam
├── constants/          # Cấu hình Context cho AI và các biến môi trường
├── models/             # Định nghĩa Schema cho Firestore (User, Exam, Topic...)
├── pages/              # Chứa logic của từng màn hình cụ thể
├── services/           # TẦNG LOGIC CHÍNH
│   ├── gemini/         # Các Service xử lý Prompt và kết nối Gemini API
│   ├── student/        # API gọi dữ liệu cho học sinh
│   ├── faculty/        # API quản lý cho giáo viên
│   └── serviceRouter.js# Bộ điều hướng AI dựa trên chủ đề bài toán
└── server/             # Express Server để hỗ trợ các tác vụ backend cục bộ
🧠 5. Hướng dẫn dành cho Code Agent (Agent Guidelines)
Khi làm việc trên dự án này, Agent cần tuân thủ các nguyên tắc sau:

Xử lý Logic Toán: Luôn kiểm tra serviceRouter.js trước khi sửa logic AI. Nếu thêm chủ đề mới, phải tạo file Service tương ứng trong src/services/gemini/.

Tương tác Robot: Khi viết các logic kiểm tra kết quả (Submit bài), hãy gọi hàm triggerState của Robot (ví dụ: correct khi làm đúng) để tăng tính tương tác.

Quản lý State: Sử dụng Firebase Firestore làm "Source of Truth". Luôn cập nhật trạng thái làm bài thực tế vào Firestore để giáo viên có thể theo dõi qua LiveSession.

UI/UX: Sử dụng TailwindCSS. Đảm bảo giao diện phản hồi tốt (Responsive) vì hệ thống được thiết kế cho cả máy tính và máy tính bảng (phục vụ học sinh trên lớp).

Bảo mật API: Không bao giờ hardcode API Key. Sử dụng apiKeyManager.js để lấy key luân phiên.