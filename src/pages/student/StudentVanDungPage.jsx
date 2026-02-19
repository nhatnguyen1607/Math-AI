import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import PracticeChat from '../../components/PracticeChat';
import RobotCompanion from '../../components/common/RobotCompanion';
import geminiService from '../../services/geminiService';
import resultService from '../../services/resultService';
import examService from '../../services/examService';

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

        // Kiểm tra nếu đã có phiên Vận dụng cũ (với dữ liệu sẵn)
        const existingVanDung = await resultService.getVanDungSession(user.uid, examId);
        if (existingVanDung?.deBai?.length > 50) {
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
        const gService = new geminiService.constructor();
        let applicationProblem;
        
        try {
          applicationProblem = await gService.generateApplicationProblem({
            errorsInKhoiDong: lỗiKhoiDong,
            weaknessesInLuyenTap: yếuĐiềmLuyenTap,
            topicName: exam.title || 'Bài toán'
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
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="text-6xl animate-bounce-gentle">🌟</div>
          <p className="text-2xl font-bold text-gray-700 font-quicksand">Đang khởi tạo Vận dụng...</p>
        </div>
      </div>
    );
  }

  if (error && !vanDungData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">⚠️</div>
          <h2 className="text-gray-800 text-3xl font-bold font-quicksand text-center">{error}</h2>
          <button
            onClick={() => navigate(-1)}
            className="btn-3d px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-quicksand rounded-max hover:shadow-lg transition-all"
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
          <div className="text-8xl">❓</div>
          <h2 className="text-gray-800 text-3xl font-bold font-quicksand">Không tìm thấy dữ liệu Vận dụng</h2>
          <button
            onClick={() => navigate(-1)}
            className="btn-3d px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-quicksand rounded-max hover:shadow-lg transition-all"
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} />

      <div className="max-w-6xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="bg-white rounded-max shadow-lg p-6 mb-8 game-card">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-800 font-quicksand">
              🌟 Vận dụng
            </h1>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-max transition-all font-quicksand"
            >
              ← Quay lại
            </button>
          </div>
          <p className="text-gray-600 font-quicksand">
            Áp dụng kiến thức vào bài toán thực tế được tạo riêng cho bạn
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Progress Sidebar */}
          <aside className="lg:col-span-1 bg-white rounded-max shadow-lg p-6 game-card">
            <h3 className="text-lg font-bold text-gray-800 mb-4 font-quicksand">📊 Tiến độ</h3>
            
            <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">
                  {vanDungData?.status === 'completed' ? '✅' : '⏳'}
                </span>
                <span className="font-bold text-sm font-quicksand">Vận dụng</span>
              </div>
              <p className="text-xs text-gray-600 font-quicksand mb-2">
                {vanDungData?.status === 'in_progress' ? 'Đang tiến hành' :
                 vanDungData?.status === 'completed' ? 'Đã hoàn thành' :
                 'Chưa mở'}
              </p>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 p-3 rounded-max border-l-4 border-blue-500">
              <p className="text-xs font-bold text-blue-700 mb-2 font-quicksand">💡 Mẹo:</p>
              <p className="text-xs text-blue-600 font-quicksand leading-relaxed">
                Hãy thực hiện đầy đủ 4 bước khi giải bài toán này!
              </p>
            </div>
          </aside>

          {/* Chat Area */}
          <main className="lg:col-span-3">
            {vanDungData?.deBai ? (
              <>
                <PracticeChat
                  userId={user?.uid}
                  examId={examId}
                  baiNumber="vanDung"
                  deBai={vanDungData.deBai}
                  chatHistory={vanDungData.chatHistory || []}
                  isCompleted={vanDungData.status === 'completed'}
                  evaluation={vanDungData.evaluation}
                  onCompleted={() => {
                    // Khi bài hoàn thành, tự động gọi submit
                    handleSubmitVanDung();
                  }}
                  onRobotStateChange={(status, msg) => {
                    setRobotStatus(status);
                    setRobotMessage(msg);
                  }}
                />

                {/* Submit Button - Luôn hiển thị khi đang tiến hành */}
                {vanDungData?.status === 'in_progress' && (
                  <div className="mt-4 space-y-3">
                    <button
                      onClick={handleSubmitVanDung}
                      disabled={submitting}
                      className="w-full px-6 py-4 bg-gradient-to-r from-orange-400 to-red-500 text-white font-bold rounded-max hover:shadow-lg transition-all disabled:opacity-50 font-quicksand text-lg"
                    >
                      {submitting ? '⏳ Đang chấm điểm...' : '✓ Nộp bài & Chấm điểm'}
                    </button>
                    {vanDungData?.chatHistory?.length === 0 && (
                      <p className="text-center text-sm text-gray-500 font-quicksand">
                        💡 Hãy tương tác với AI trước khi nộp bài
                      </p>
                    )}
                  </div>
                )}

                {/* Navigation Button */}
                {/* {vanDungData?.status === 'completed' && (
                  <div className="mt-4">
                    <button
                      onClick={() => navigate(`/student/exam-result/${examId}`)}
                      className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-max hover:shadow-lg transition-all font-quicksand text-lg"
                    >
                      ✅ Xem kết quả toàn diện →
                    </button>
                  </div>
                )} */}
              </>
            ) : (
              <div className="bg-white rounded-max shadow-lg p-8 flex items-center justify-center">
                <p className="text-gray-600 font-quicksand">Đang tải bài tập...</p>
              </div>
            )}
          </main>

          {/* Robot Sidebar */}
          <aside className="lg:col-span-1 flex justify-center">
            <div className="sticky top-20 w-full max-w-[400px]">
              <RobotCompanion status={robotStatus} message={robotMessage} />
            </div>
          </aside>
        </div>

        {/* Error Message */}
        {error && (
          <div className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-max shadow-lg flex items-center gap-3 max-w-xs font-quicksand">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-2xl font-bold">✕</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentVanDungPage;
