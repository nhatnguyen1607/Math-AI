import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import PracticeChat from '../../components/PracticeChat';
import RobotCompanion from '../../components/common/RobotCompanion';
import geminiService from '../../services/geminiService';
import resultService from '../../services/resultService';
import examService from '../../services/examService';

/**
 * StudentPracticePage
 * Trang luyện tập toán với AI hỗ trợ theo 4 bước Polya
 * Cho phép học sinh giải quyết các bài toán tương tự trong một môi trường tương tác
 */
const StudentPracticePage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [practiceData, setPracticeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('bai1');

  // --- PHẦN 1: KHỞI TẠO DỮ LIỆU ---
  useEffect(() => {
    const initializePractice = async () => {
      try {
        if (!user?.uid || !examId) {
          setError('Thiếu thông tin học sinh hoặc đề thi');
          setLoading(false);
          return;
        }

        // Kiểm tra nếu đã có phiên luyện tập cũ
        const existingSession = await resultService.getPracticeSessionData(user.uid, examId);
        if (existingSession?.luyenTap?.bai1?.deBai?.length > 50) {
          setPracticeData(existingSession);
          setLoading(false);
          return;
        }

        // Lấy dữ liệu đề thi
        const examData = await examService.getExamById(examId);
        if (!examData || !examData.exercises || examData.exercises.length < 2) {
          setError('Đề thi không chứa đủ bài tập');
          setLoading(false);
          return;
        }

        // Tạo context từ các bài tập gốc để Gemini hiểu chủ đề
        const exercise1 = examData.exercises[0];
        const exercise2 = examData.exercises[1];
        const topicName = examData.title || ''; 

        // Xây dựng context từ các câu hỏi trong bài tập
        const buildExerciseContext = (exercise) => {
          let context = `Chủ đề bài thi: ${topicName}\n\n`;
          context += `Bài tập: ${exercise.name || 'Bài tập'}\n\n`;
          
          if (exercise.questions && exercise.questions.length > 0) {
            // Lấy 1-2 câu hỏi đầu tiên để cung cấp context về chủ đề
            const sampleQuestions = exercise.questions.slice(0, 2);
            context += `Các câu hỏi mẫu trong bài tập này:\n`;
            sampleQuestions.forEach((q, idx) => {
              context += `${idx + 1}. ${q.text || q.content || q.question || 'Câu hỏi'}\n`;
            });
          }
          
          return context;
        };

        const context1 = buildExerciseContext(exercise1);
        const context2 = buildExerciseContext(exercise2);

        // Gọi Gemini để tạo bài toán tương tự
        let similarProblem1, similarProblem2;
        const gService = new geminiService.constructor(); // Đảm bảo khởi tạo đúng instance nếu cần
        
        try {
          similarProblem1 = await gService.generateSimilarProblem(exercise1.name, exercise2.name, context1, 1);
        } catch (err1) {
          similarProblem1 = exercise1.name || 'Bài tập 1';
        }

        try {
          similarProblem2 = await gService.generateSimilarProblem(exercise1.name, exercise2.name, context2, 2);
        } catch (err2) {
          similarProblem2 = exercise2.name || 'Bài tập 2';
        }

        // Khởi tạo phiên luyện tập với 2 bài toán mới
        const practice = await resultService.initializePracticeSession(
          user.uid,
          examId,
          [similarProblem1, similarProblem2]
        );
        
        if (practice && practice.luyenTap) {
          setPracticeData(practice);
        } else {
          setError('Lỗi: Cấu trúc dữ liệu không hợp lệ');
        }
        setLoading(false);
      } catch (err) {
        console.error("Lỗi khởi tạo:", err);
        setError('Lỗi khi khởi tạo phiên luyện tập. Vui lòng thử lại.');
        setLoading(false);
      }
    };

    initializePractice();
  }, [user?.uid, examId]); // Đóng useEffect đúng cách

  // --- PHẦN 2: XỬ LÝ NỘP BÀI ---
  const handleSubmitPractice = async (baiNumber) => {
    try {
      setSubmitting(true);
      // Fetch data mới nhất
      const latestPracticeSession = await resultService.getPracticeSession(user.uid, examId);
      
      const baiData = latestPracticeSession?.[baiNumber];

      if (!baiData || baiData.chatHistory?.length === 0) {
        setError('Vui lòng có ít nhất một lần tương tác trước khi nộp bài');
        setSubmitting(false);
        return;
      }

      // Gọi Gemini để đánh giá
      const evaluation = await geminiService.evaluatePolyaStep(
        baiData.chatHistory,
        baiData.deBai
      );

      // Lưu kết quả đánh giá vào Firestore
      await resultService.completePracticeExercise(
        user.uid,
        examId,
        baiNumber,
        evaluation
      );

      // Cập nhật state local
      const updatedData = { ...practiceData };
      if (updatedData.luyenTap && updatedData.luyenTap[baiNumber]) {
          updatedData.luyenTap[baiNumber].status = 'completed';
          updatedData.luyenTap[baiNumber].evaluation = evaluation;
          updatedData.luyenTap[baiNumber].chatHistory = baiData.chatHistory;

          // Mở bài tiếp theo nếu là bài 1
          if (baiNumber === 'bai1' && updatedData.luyenTap.bai2) {
            updatedData.luyenTap.bai2.status = 'in_progress';
          }
      }

      setPracticeData(updatedData);
      setSubmitting(false);
    } catch (err) {
      console.error("Lỗi nộp bài:", err);
      setError('Lỗi khi nộp bài. Vui lòng thử lại.');
      setSubmitting(false);
    }
  }; // Đóng handleSubmitPractice đúng cách

  // --- PHẦN 3: RENDER GIAO DIỆN ---

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="text-6xl animate-bounce-gentle">📚</div>
          <p className="text-2xl font-bold text-gray-700 font-quicksand">Đang tải phiên luyện tập...</p>
        </div>
      </div>
    );
  }

  if (error && !practiceData) {
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

  if (!practiceData || !practiceData.luyenTap) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} />
        <div className="flex items-center justify-center pt-20">
          <div className="text-6xl animate-bounce-gentle">📚</div>
        </div>
      </div>
    );
  }

  const bai1 = practiceData.luyenTap?.bai1;
  const bai2 = practiceData.luyenTap?.bai2;
  const currentBai = activeTab === 'bai1' ? bai1 : bai2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} />

      <div className="max-w-6xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="bg-white rounded-max shadow-lg p-6 mb-8 game-card">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-800 font-quicksand">
              📖 Luyện tập 
            </h1>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-max transition-all font-quicksand"
            >
              ← Quay lại
            </button>
          </div>
          <p className="text-gray-600 font-quicksand">
            Giải quyết các bài toán cùng trợ lý AI 
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {['bai1', 'bai2'].map((bai, idx) => (
            <button
              key={bai}
              onClick={() => setActiveTab(bai)}
              disabled={!practiceData.luyenTap || practiceData.luyenTap[bai]?.status === 'locked'}
              className={`px-6 py-3 rounded-max font-bold font-quicksand transition-all ${
                activeTab === bai
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                  : !practiceData.luyenTap || practiceData.luyenTap[bai]?.status === 'locked'
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">
                {practiceData.luyenTap?.[bai]?.status === 'completed' ? '✅' : '📝'}
              </span>
              Bài {idx + 1}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Progress Sidebar */}
          <aside className="lg:col-span-1 bg-white rounded-max shadow-lg p-6 game-card">
            <h3 className="text-lg font-bold text-gray-800 mb-4 font-quicksand">📊 Tiến độ</h3>
            
            {['bai1', 'bai2'].map((bai, idx) => {
              const baiData = practiceData.luyenTap?.[bai];
              if (!baiData) return null;
              return (
                <div key={bai} className="mb-4 pb-4 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">
                      {baiData.status === 'completed' ? '✅' : 
                       baiData.status === 'locked' ? '🔒' : '⏳'}
                    </span>
                    <span className="font-bold text-sm font-quicksand">Bài {idx + 1}</span>
                  </div>
                  <p className="text-xs text-gray-600 font-quicksand mb-2">
                    {baiData.status === 'in_progress' ? 'Đang tiến hành' :
                     baiData.status === 'completed' ? 'Đã hoàn thành' :
                     'Chưa mở'}
                  </p>
                  {baiData.status === 'completed' && baiData.evaluation && (
                    <div className="bg-blue-50 p-2 rounded text-xs">
                      <p className={`font-bold ${
                        baiData.evaluation.mucDoChinh === 'Tốt' ? 'text-green-600' :
                        baiData.evaluation.mucDoChinh === 'Đạt' ? 'text-blue-600' :
                        'text-orange-600'
                      }`}>
                        {baiData.evaluation.mucDoChinh}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </aside>

          {/* Chat Area */}
          <main className="lg:col-span-3">
            {currentBai ? (
              <>
                <PracticeChat
                  userId={user?.uid}
                  examId={examId}
                  baiNumber={activeTab}
                  deBai={currentBai.deBai}
                  chatHistory={currentBai.chatHistory}
                  isCompleted={currentBai.status === 'completed'}
                  evaluation={currentBai.evaluation}
                  onCompleted={() => {
                    // Khi bài hoàn thành, tự động gọi submit
                    if (activeTab === 'bai1') {
                      handleSubmitPractice('bai1');
                    } else if (activeTab === 'bai2') {
                      handleSubmitPractice('bai2');
                    }
                  }}
                  onRobotStateChange={(status,msg)=>{
                    // demo callback, no-op in guide
                  }}
                />

                {/* Submit Button */}
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleSubmitPractice(activeTab)}
                    disabled={submitting || currentBai?.status === 'completed'}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold rounded-max hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-quicksand"
                  >
                    {submitting ? '⏳ Đang chấm điểm...' : '✓ Nộp bài & Chấm điểm'}
                  </button>
                  {activeTab === 'bai1' && bai2?.status === 'in_progress' && (
                    <button
                      onClick={() => setActiveTab('bai2')}
                      className="px-6 py-3 bg-blue-500 text-white font-bold rounded-max hover:shadow-lg transition-all font-quicksand"
                    >
                      Sang Bài 2 →
                    </button>
                  )}
                  {activeTab === 'bai1' && bai2?.status === 'completed' && (
                    <button
                      onClick={() => setActiveTab('bai2')}
                      className="px-6 py-3 bg-blue-500 text-white font-bold rounded-max hover:shadow-lg transition-all font-quicksand"
                    >
                      Sang Bài 2 →
                    </button>
                  )}
                  {activeTab === 'bai2' && bai2?.status === 'completed' && (
                    <button
                      onClick={() => navigate(-1)}
                      className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-max hover:shadow-lg transition-all font-quicksand"
                    >
                      ← Quay lại
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-max shadow-lg p-8 flex items-center justify-center">
                <p className="text-gray-600 font-quicksand">Đang tải bài tập...</p>
              </div>
            )}
          </main>

          {/* Robot Sidebar (demo) */}
          <aside className="lg:col-span-1 flex justify-center">
            <div className="sticky top-20">
              <RobotCompanion status="idle" message="Tôi ở bên phải chat" />
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

export default StudentPracticePage;