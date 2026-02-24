import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import PracticeChat from '../../components/PracticeChat';
import RobotCompanion from '../../components/common/RobotCompanion';
import MobileRobotAvatar from '../../components/common/MobileRobotAvatar';
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
  const [robotStatus, setRobotStatus] = useState('idle');
  const [robotMessage, setRobotMessage] = useState('');
  const leftColRef = useRef(null);

  // Khởi tạo dữ liệu luyện tập
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
          // if we already have a session, decide which tab should be active
          if (existingSession.luyenTap.bai1.status === 'completed') {
            setActiveTab('bai2');
          } else {
            setActiveTab('bai1');
          }
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
        const topicName = examData.title || ''; // Lấy chủ đề từ title của exam

        // Lấy đánh giá năng lực của học sinh từ phần khởi động -> Lấy evaluation.competence level
        const examProgress = await resultService.getExamProgress(user.uid, examId);
        const competencyEvaluation = examProgress?.parts?.khoiDong?.evaluation;
        
        // Xác định mức năng lực dựa trên competency scores
        let competencyLevel = 'Đạt'; // Default value
        if (competencyEvaluation) {
          // Tính trung bình điểm năng lực
          const scores = [
            competencyEvaluation.TC1?.score || 0,
            competencyEvaluation.TC2?.score || 0,
            competencyEvaluation.TC3?.score || 0,
            competencyEvaluation.TC4?.score || 0
          ].filter(s => s > 0);
          
          if (scores.length > 0) {
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            
            if (avgScore <= 5) {
              competencyLevel = 'Cần cố gắng';
            } else if (avgScore >= 8) {
              competencyLevel = 'Tốt';
            } else {
              competencyLevel = 'Đạt';
            }
          }
        }

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

        // Gọi Gemini để tạo bài toán tương tự - có truyền năng lực học sinh làm tham số thứ 5
        // Throttle giữa hai lần gọi (bài 1 và bài 2) bằng delay, không cần gọi zweimal cho cùng một bài
        let similarProblem1, similarProblem2;
        const gService = new geminiService.constructor();
        
        try {
          // chỉ gọi một lần cho bài 1 với độ năng lực đã xác định
          similarProblem1 = await gService.generateSimilarProblem(
            exercise1.name,
            exercise2.name,
            context1,
            1,
            competencyLevel
          );
        } catch (err1) {
          console.warn('Failed to generate problem 1, using fallback:', err1.message);
          similarProblem1 = exercise1.name || 'Bài tập 1';
        }

        try {
          similarProblem2 = await gService.generateSimilarProblem(exercise1.name, exercise2.name, context2, 2, competencyLevel);
        } catch (err2) {
          console.warn('Failed to generate problem 2, using fallback:', err2.message);
          similarProblem2 = exercise2.name || 'Bài tập 2';
        }

        // Khởi tạo phiên luyện tập với 2 bài toán mới
        const practice = await resultService.initializePracticeSession(
          user.uid,
          examId,
          [similarProblem1, similarProblem2]
        );
        
        // Đảm bảo practice có cấu trúc đúng
        if (practice && practice.luyenTap) {
          setPracticeData(practice);
        } else {
          setError('Lỗi: Cấu trúc dữ liệu không hợp lệ');
        }
        setLoading(false);
      } catch (err) {
        setError('Lỗi khi khởi tạo phiên luyện tập. Vui lòng thử lại.');
        setLoading(false);
      }
    };

    initializePractice();
  }, [user?.uid, examId]);

  // Xử lý nộp bài luyện tập (chấm điểm)
  const handleSubmitPractice = async (baiNumber) => {
    try {
      setSubmitting(true);
      // update robot to thinking state
      setRobotStatus('thinking');
      setRobotMessage('AI đang chấm điểm...');
      // Fetch the latest practice data from Firestore to ensure we have the complete chat history
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

      // update robot status based on evaluation
      const passed = evaluation.mucDoChinh === 'Tốt' || evaluation.mucDoChinh === 'Đạt';
      if (passed) {
        setRobotStatus('correct');
        setRobotMessage('🎉 Bạn đã làm tốt!');
      } else {
        setRobotStatus('wrong');
        setRobotMessage('😓 Cố gắng hơn nhé.');
      }
      // reset to idle after 5 seconds
      setTimeout(() => {
        setRobotStatus('idle');
        setRobotMessage('');
      }, 5000);

      // Lưu kết quả đánh giá vào Firestore
      await resultService.completePracticeExercise(
        user.uid,
        examId,
        baiNumber,
        evaluation
      );

      // Cập nhật state
      const updatedData = { ...practiceData };
      updatedData.luyenTap[baiNumber].status = 'completed';
      updatedData.luyenTap[baiNumber].evaluation = evaluation;
      updatedData.luyenTap[baiNumber].chatHistory = baiData.chatHistory;

      // Mở bài tiếp theo
      if (baiNumber === 'bai1') {
        updatedData.luyenTap.bai2.status = 'in_progress';        // after a short delay switch to bài2 automatically
        setTimeout(() => setActiveTab('bai2'), 1500);      }

      setPracticeData(updatedData);
      setSubmitting(false);
    } catch (err) {
      setError('Lỗi khi nộp bài. Vui lòng thử lại.');
      setSubmitting(false);
    }
  };

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
    <div className="min-h-screen bg-gray-50">
      <StudentHeader user={user} onLogout={onSignOut} />

      {/* Compact Sticky Header with Title & Progress */}
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-800 font-quicksand">📖 Luyện tập</h1>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-all font-quicksand text-sm"
            >
              ← Quay lại
            </button>
          </div>
          {/* Progress Steps - Horizontal & Compact */}
          <div className="flex items-center justify-start space-x-3">
            {['bai1', 'bai2'].map((bai, idx) => {
              const baiData = practiceData.luyenTap?.[bai];
              const status = baiData?.status;
              const icon = status === 'completed' ? '✅' : status === 'in_progress' ? '⏳' : '🔒';
              const isBai1 = bai === 'bai1';
              const isBai2 = bai === 'bai2';
              const bai1Completed = practiceData.luyenTap.bai1?.status === 'completed';
              const isDisabled = !practiceData.luyenTap || status === 'locked' || (isBai1 && bai1Completed) || (isBai2 && !bai1Completed);
              return (
                <React.Fragment key={bai}>
                  <button
                    onClick={() => setActiveTab(bai)}
                    disabled={isDisabled}
                    className={`flex items-center px-3 py-1 rounded-full font-bold font-quicksand transition-all text-sm ${
                      isDisabled
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed line-through'
                        : activeTab === bai
                        ? 'bg-blue-500 text-white shadow-md'
                        : status === 'locked'
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-1">{icon}</span>
                    Bài {idx + 1}
                  </button>
                  {idx < 1 && <span className="text-gray-400">→</span>}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Grid with Natural Scroll */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 px-4 py-6 pb-20">
        {/* Main Content Column - Flex and grow */}
        <main className="flex flex-col gap-6">
          {currentBai ? (
            <>
              {/* STICKY PROBLEM STATEMENT */}
              <div className="sticky top-[70px] z-30 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 p-4 rounded-xl shadow-sm">
                <h3 className="text-sm font-bold text-blue-900 font-quicksand mb-2">📝 Đề Bài</h3>
                <p className="text-base text-blue-800 font-quicksand leading-relaxed">{currentBai.deBai}</p>
              </div>

              {/* SCROLLABLE CHAT */}
              <div className="flex-1">
                <PracticeChat
                  userId={user?.uid}
                  examId={examId}
                  baiNumber={activeTab}
                  deBai={currentBai.deBai}
                  chatHistory={currentBai.chatHistory}
                  scrollContainerRef={leftColRef}
                  isCompleted={currentBai.status === 'completed'}
                  evaluation={currentBai.evaluation}
                  onCompleted={() => {
                    if (activeTab === 'bai1') {
                      handleSubmitPractice('bai1');
                    } else if (activeTab === 'bai2') {
                      handleSubmitPractice('bai2');
                    }
                  }}
                  onRobotStateChange={(status, msg) => {
                    setRobotStatus(status);
                    setRobotMessage(msg);
                  }}
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => handleSubmitPractice(activeTab)}
                  disabled={submitting || currentBai?.status === 'completed'}
                  className="flex-1 min-w-[200px] px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-quicksand"
                >
                  {submitting ? '⏳ Đang chấm điểm...' : '✓ Nộp bài & Chấm điểm'}
                </button>
                
                {activeTab === 'bai2' && bai2?.status === 'completed' && (
                  <button
                    onClick={() => navigate(-1)}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg hover:shadow-lg transition-all font-quicksand"
                  >
                    ← Hoàn thành
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 flex items-center justify-center">
              <p className="text-gray-600 font-quicksand">Đang tải bài tập...</p>
            </div>
          )}
        </main>

        {/* Sticky Robot Sidebar - Fixed 350px width, no shrink */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[350px] lg:flex-none">
          <div className="sticky top-[70px] h-fit bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <RobotCompanion status={robotStatus} message={robotMessage} />
          </div>
        </aside>
      </div>

      {/* Mobile Robot Avatar */}
      <MobileRobotAvatar status={robotStatus} />

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 max-w-xs font-quicksand z-50">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-2xl font-bold">✕</button>
        </div>
      )}
    </div>
  );
};

export default StudentPracticePage;
