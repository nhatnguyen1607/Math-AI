import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import PracticeChat from '../../components/PracticeChat';
import RobotCompanion from '../../components/common/RobotCompanion';
import MobileRobotAvatar from '../../components/common/MobileRobotAvatar';
import geminiService from '../../services/gemini/geminiService';
import { practiceServiceRouter } from '../../services/serviceRouter';
import resultService from '../../services/faculty/resultService';
import examService from '../../services/faculty/examService';

/**
 * StudentVanDungPage
 * Trang vận dụng toán học - bài toán được tạo cá nhân hóa dựa trên lỗi từ Khởi động
 * và yếu điểm từ Luyện tập. Học sinh giải quyết 1 bài toán thực tế phức hợp.
 */
const StudentVanDungPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [vanDungData, setVanDungData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const initializingRef = useRef(false); // Để track xem đã khởi tạo chưa
  const [examTitle, setExamTitle] = useState(''); // 🆕 Thêm state để lưu examTitle trực tiếp
  const [examContextId, setExamContextId] = useState('');

  // UI state from practice layout
  const [activeTab, setActiveTab] = useState('vanDung');
  const leftColRef = useRef(null);

  // robot companion state
  const [robotStatus, setRobotStatus] = useState('idle');
  const [robotMessage, setRobotMessage] = useState('');

  // Khởi tạo phiên Vận dụng
  useEffect(() => {
    // Nếu đã khởi tạo hoặc đang khởi tạo, không chạy lại
    if (initializingRef.current) {
      return;
    }

    const initializeVanDung = async () => {
      try {
        if (!user?.uid || !examId) {
          setError('Thiếu thông tin học sinh hoặc đề thi');
          setLoading(false);
          return;
        }

        initializingRef.current = true; // Đánh dấu đang khởi tạo

        // Lấy dữ liệu exam
        const exam = await examService.getExamById(examId);

        if (!exam) {
          setError('Không tìm thấy đề thi');
          setLoading(false);
          return;
        }

        // 🆕 Set examTitle ở đây trước mọi return!
        const examTitle = exam.title || 'Bài toán';
        console.log('🔵 [StudentVanDungPage] Lấy examTitle từ exam:', examTitle);
        setExamTitle(examTitle);
        setExamContextId(exam.contextId || '');

        // Kiểm tra nếu đã có phiên Vận dụng cũ (với dữ liệu sẵn)
        const existingVanDung = await resultService.getVanDungSession(user.uid, examId);
        if (existingVanDung?.deBai?.length > 50) {
          console.log('🔵 [StudentVanDungPage] Using existing VanDung, không regenerate');
          // 🆕 Ensure examTitle is added to existing vanDung too
          existingVanDung.examTitle = examTitle;
          existingVanDung.examContextId = exam.contextId || '';
          setVanDungData(existingVanDung);
          setLoading(false);
          return;
        }

        // Lấy toàn bộ exam progress để tính context
        const examProgress = await resultService.getExamProgress(user.uid, examId);
        if (!examProgress) {
          setError('Không tìm thấy kết quả phần Khởi động hoặc Luyện tập');
          setLoading(false);
          return;
        }

        // Xây dựng context từ các phần trước
        const lỗiKhoiDong = [];
        const yếuĐiềmLuyenTap = {};

        // Lấy các lỗi từ khoiDong
        if (examProgress.parts?.khoiDong?.aiAnalysis?.questionComments) {
          examProgress.parts.khoiDong.aiAnalysis.questionComments.forEach(comment => {
            if (comment.comment) {
              lỗiKhoiDong.push(comment.comment);
            }
          });
        }

        // Lấy yếu điểm từ luyenTap
        if (examProgress.parts?.luyenTap) {
          const bai1Eval = examProgress.parts.luyenTap.bai1?.evaluation;
          const bai2Eval = examProgress.parts.luyenTap.bai2?.evaluation;

          // Tổng hợp đánh giá từ 2 bài
          if (bai1Eval) {
            yếuĐiềmLuyenTap.TC1 = { 
              diem: Math.min(bai1Eval.TC1?.diem || 0, bai2Eval?.TC1?.diem || 0),
              nhanXet: bai1Eval.TC1?.nhanXet
            };
            yếuĐiềmLuyenTap.TC2 = { 
              diem: Math.min(bai1Eval.TC2?.diem || 0, bai2Eval?.TC2?.diem || 0),
              nhanXet: bai1Eval.TC2?.nhanXet
            };
            yếuĐiềmLuyenTap.TC3 = { 
              diem: Math.min(bai1Eval.TC3?.diem || 0, bai2Eval?.TC3?.diem || 0),
              nhanXet: bai1Eval.TC3?.nhanXet
            };
            yếuĐiềmLuyenTap.TC4 = { 
              diem: Math.min(bai1Eval.TC4?.diem || 0, bai2Eval?.TC4?.diem || 0),
              nhanXet: bai1Eval.TC4?.nhanXet
            };
          }
        }

        // Gọi Gemini để tạo bài toán vận dụng được cá nhân hóa
        console.log('🔵 [StudentVanDungPage] Generating new VanDung');
        console.log('📌 [StudentVanDungPage] exam object:', exam);
        console.log('📌 [StudentVanDungPage] exam.title:', exam.title);
        
        // 🆕 Sử dụng router để auto-detect topic
        const topicNameForRouter = exam.title || 'Bài toán';
        console.log('📌 [StudentVanDungPage] Topic being passed to router:', topicNameForRouter);
        
        const gService = practiceServiceRouter.getService(topicNameForRouter);
        console.log('🔵 [StudentVanDungPage] Service received from router:', gService.constructor.name);
        console.log('🔵 [StudentVanDungPage] Using service for topic:', exam.title);
        
        let applicationProblem;
        
        try {
          applicationProblem = await gService.generateApplicationProblem({
            errorsInKhoiDong: lỗiKhoiDong,
            weaknessesInLuyenTap: yếuĐiềmLuyenTap,
            topicName: exam.title || 'Bài toán',
            practicePercentage: 0,
            examContextId: exam.contextId || ''
          });
        } catch (err) {
          applicationProblem = 'Bài toán vận dụng. Bạn hãy giải quyết bài toán này bằng cách thực hiện đầy đủ 4 bước Polya.';
        }

        // Khởi tạo phiên Vận dụng
        const vanDung = await resultService.initializeVanDungSession(
          user.uid,
          examId,
          applicationProblem
        );

        if (vanDung && vanDung.deBai) {
          // 🆕 Thêm examTitle vào vanDung data
          vanDung.examTitle = examTitle;
          vanDung.examContextId = exam.contextId || '';
          console.log('🔵 [StudentVanDungPage] Setting vanDungData with examTitle:', examTitle);
          setVanDungData(vanDung);
        } else {
          setError('Lỗi: Không thể khởi tạo phiên Vận dụng');
        }

        setLoading(false);
      } catch (err) {
        setError('Lỗi khi khởi tạo phiên Vận dụng. Vui lòng thử lại.');
        setLoading(false);
        initializingRef.current = false; // Reset flag nếu có lỗi
      }
    };

    initializeVanDung();
    // ESLint: initializingRef ensures we only initialize once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, examId]);

  // Xử lý nộp bài Vận dụng
  const handleSubmitVanDung = async () => {
    try {
      setSubmitting(true);

      // Lấy dữ liệu mới nhất từ Firestore
      const latestVanDung = await resultService.getVanDungSession(user.uid, examId);

      if (!latestVanDung || latestVanDung.chatHistory?.length === 0) {
        setError('Vui lòng có ít nhất một lần tương tác trước khi nộp bài');
        setSubmitting(false);
        return;
      }

      // Gọi Gemini để đánh giá theo 4 tiêu chí
      const evaluation = await geminiService.evaluatePolyaStep(
        latestVanDung.chatHistory,
        latestVanDung.deBai
      );

      // Lưu kết quả đánh giá
      await resultService.completeVanDungExercise(
        user.uid,
        examId,
        evaluation
      );

      // Cập nhật state
      const updatedData = { ...vanDungData };
      updatedData.status = 'completed';
      updatedData.evaluation = evaluation;
      updatedData.chatHistory = latestVanDung.chatHistory;

      setVanDungData(updatedData);
      setSubmitting(false);
    } catch (err) {
      // Hiển thị lỗi chi tiết hơn
      if (!process.env.REACT_APP_GEMINI_API_KEY_1) {
        setError('⚠️ Chưa cấu hình API Key. Thêm REACT_APP_GEMINI_API_KEY_1 vào file .env');
      } else if (err.message?.includes('429') || err.message?.includes('quota')) {
        setError('⏳ Đã vượt quota API. Vui lòng thử lại sau');
      } else {
        setError(`Lỗi khi nộp bài: ${err.message || 'Không rõ nguyên nhân'}`);
      }
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="text-5xl animate-bounce-gentle sm:text-6xl">🌟</div>
          <p className="text-xl font-bold text-gray-700 font-quicksand sm:text-2xl">Đang khởi tạo Vận dụng...</p>
        </div>
      </div>
    );
  }

  if (error && !vanDungData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-6xl sm:text-8xl">⚠️</div>
          <h2 className="text-center text-2xl font-bold text-gray-800 font-quicksand sm:text-3xl">{error}</h2>
          <button
            onClick={() => navigate(-1)}
            className="touch-btn btn-3d rounded-[2rem] bg-gradient-to-r from-blue-500 to-blue-600 px-6 text-white font-quicksand transition-all hover:shadow-lg"
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!vanDungData || !vanDungData.deBai) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-6xl sm:text-8xl">❓</div>
          <h2 className="text-center text-2xl font-bold text-gray-800 font-quicksand sm:text-3xl">Không tìm thấy dữ liệu Vận dụng</h2>
          <button
            onClick={() => navigate(-1)}
            className="touch-btn btn-3d rounded-[2rem] bg-gradient-to-r from-blue-500 to-blue-600 px-6 text-white font-quicksand transition-all hover:shadow-lg"
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-4">
      <StudentHeader user={user} onLogout={onSignOut} />

      {/* Compact Sticky Header with Title & Progress */}
      <div className="sticky top-16 z-40 border-b border-gray-200 bg-white shadow-sm sm:top-20">
        <div className="app-shell flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <h1 className="truncate text-xl font-bold text-gray-800 font-quicksand sm:text-2xl">🌟 Vận dụng</h1>
            <button
              onClick={() => navigate(-1)}
              className="touch-btn rounded-lg bg-gray-500 px-4 text-xs font-bold text-white font-quicksand transition-all hover:bg-gray-600 sm:text-sm"
            >
              ← Quay lại
            </button>
          </div>
          {/* Progress Steps - Horizontal & Compact */}
          <div className="flex items-center justify-start space-x-2 sm:space-x-3">
            {['vanDung'].map((step, idx) => {
              const status = vanDungData?.status;
              const icon = status === 'completed' ? '✅' : status === 'in_progress' ? '⏳' : '🔒';
              // build button class conditional on completion first
              let btnClass = 'touch-btn h-11 rounded-full px-3 text-xs font-bold font-quicksand transition-all sm:text-sm ';
              if (status === 'completed') {
                btnClass += 'bg-green-500 text-white shadow-md cursor-not-allowed';
              } else if (activeTab === step) {
                btnClass += 'bg-blue-500 text-white shadow-md';
              } else {
                btnClass += 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';
              }

              return (
                <React.Fragment key={step}>
                  <button
                    onClick={() => setActiveTab(step)}
                    disabled={status === 'completed'}
                    className={btnClass}
                  >
                    <span className="mr-1">{icon}</span>
                    Vận dụng
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Grid with Natural Scroll */}
      <div className="app-shell grid grid-cols-1 gap-6 py-6 pb-20 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_350px]">
        {/* Main Content Column - Flex and grow */}
        <main className="flex flex-col gap-6" ref={leftColRef}>
          {vanDungData?.deBai ? (
            <>
              {/* STICKY PROBLEM STATEMENT */}
              <div className="sticky top-[7.2rem] z-30 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 p-4 shadow-sm sm:top-[8.2rem]">
                <h3 className="text-sm font-bold text-blue-900 font-quicksand mb-2">📝 Đề Bài</h3>
                <p className="text-sm leading-relaxed text-blue-800 font-quicksand sm:text-base">
                  {vanDungData.deBai}
                </p>
              </div>

              {/* SCROLLABLE CHAT */}
              <div className="flex-1 pb-32">
                {console.log('📖 [StudentVanDungPage] Creating PracticeChat with topicName:', vanDungData.examTitle || examTitle)}
                <PracticeChat
                  userId={user?.uid}
                  examId={examId}
                  baiNumber="vanDung"
                  deBai={vanDungData.deBai}
                  chatHistory={vanDungData.chatHistory || []}
                  scrollContainerRef={leftColRef}
                  isCompleted={vanDungData.status === 'completed'}
                  evaluation={vanDungData.evaluation}
                  topicName={vanDungData.examTitle || examTitle}
                  examContextId={vanDungData.examContextId || examContextId}
                  // onCompleted={handleSubmitVanDung} // Bỏ tự động nộp
                  onRobotStateChange={(status, msg) => {
                    setRobotStatus(status);
                    setRobotMessage(msg);
                  }}
                />
              </div>

              {/* Submit Button */}
              {vanDungData?.status === 'in_progress' && (
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleSubmitVanDung}
                    disabled={submitting}
                    className="touch-btn h-11 min-w-[200px] flex-1 rounded-lg bg-gradient-to-r from-orange-400 to-red-500 px-6 text-sm font-bold text-white font-quicksand transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
                  >
                    {submitting ? '⏳ Đang chấm điểm...' : '✓ Nộp bài & Chấm điểm'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 flex items-center justify-center">
              <p className="text-gray-600 font-quicksand">Đang tải bài tập...</p>
            </div>
          )}
        </main>

        {/* Sticky Robot Sidebar - Fixed 350px width, no shrink */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[350px] lg:flex-none">
          <div className="sticky top-[7.2rem] h-fit rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:top-[8.2rem]">
            <RobotCompanion status={robotStatus} message={robotMessage} />
          </div>
        </aside>
      </div>

      {/* Mobile Robot Avatar */}
      <MobileRobotAvatar status={robotStatus} />

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex max-w-none items-center gap-3 rounded-lg bg-red-500 px-4 py-3 text-white shadow-lg font-quicksand sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-xs sm:px-6 sm:py-4">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-2xl font-bold">✕</button>
        </div>
      )}
    </div>
  );
};

export default StudentVanDungPage;
