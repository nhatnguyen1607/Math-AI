import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import PracticeChat from '../../components/PracticeChat';
import RobotCompanion from '../../components/common/RobotCompanion';
import MobileRobotAvatar from '../../components/common/MobileRobotAvatar';
import geminiService from '../../services/gemini/geminiService';
import studentEvaluationService from '../../services/gemini/studentEvaluationService';
import { practiceServiceRouter } from '../../services/serviceRouter';
import resultService from '../../services/faculty/resultService';
import examService from '../../services/faculty/examService';

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
  const [topicName, setTopicName] = useState('');
  const [examContextId, setExamContextId] = useState('');
  const [regeneratingProblem, setRegeneratingProblem] = useState(false);
  const [ttsGender, setTtsGender] = useState(() => {
    return localStorage.getItem('chat_tts_gender') || 'FEMALE';
  }); // 🔊 Giới tính giọng đọc ('MALE' | 'FEMALE')
  const [isTTSPlaying, setIsTTSPlaying] = useState(false); // Track trạng thái đang phát để khóa nút chọn giọng
  const leftColRef = useRef(null);

  const resolveCompetencyLevel = (competencyEvaluation) => {
    if (!competencyEvaluation) return 'Đạt';
    const totalScore = competencyEvaluation.totalCompetencyScore;
    if (totalScore === undefined || totalScore === null) return 'Đạt';
    if (totalScore <= 3) return 'Cần cố gắng';
    if (totalScore <= 6) return 'Đạt';
    return 'Tốt';
  };

  // Khởi tạo dữ liệu luyện tập
  useEffect(() => {
    const initializePractice = async () => {
      try {
        if (!user?.uid || !examId) {
          setError('Thiếu thông tin học sinh hoặc đề thi');
          setLoading(false);
          return;
        }

        // 🔴 ALWAYS load examData to get topicName (needed for session restore too!)
        const examData = await examService.getExamById(examId);
        if (!examData || !Array.isArray(examData.exercises) || examData.exercises.length < 1) {
          setError('Đề thi không chứa đủ bài tập');
          setLoading(false);
          return;
        }
        
        const topicNameFromExam = examData.title || '';
        setTopicName(topicNameFromExam);
        setExamContextId(examData.contextId || '');

        // Kiểm tra nếu đã có phiên luyện tập cũ
        const existingSession = await resultService.getPracticeSessionData(user.uid, examId);
        if (existingSession?.luyenTap?.bai1?.deBai?.length > 50) {
          // if we already have a session, decide which tab should be active
          if (existingSession.luyenTap.bai1.status === 'completed') {
            setActiveTab('bai2');
          } else {
            setActiveTab('bai1');
          }
          // 🆕 Add topicName to restored session data
          existingSession.topicName = topicNameFromExam;
          existingSession.examContextId = examData.contextId || '';
          setPracticeData(existingSession);
          setLoading(false);
          return;
        }

        // Tạo context từ các bài tập gốc để Gemini hiểu chủ đề
        const exercise1 = examData.exercises[0] || {};
        const exercise2 = examData.exercises[1] || exercise1;
        const startupProblem1 = exercise1?.name || '';
        const startupProblem2 = exercise2?.name || startupProblem1;

        // Lấy đánh giá năng lực của học sinh từ phần khởi động
        const examProgress = await resultService.getExamProgress(user.uid, examId);
        const competencyEvaluation = examProgress?.parts?.khoiDong?.competencyEvaluation;
        
        const competencyLevel = resolveCompetencyLevel(competencyEvaluation);

        // Gọi Gemini để tạo bài toán tương tự - có truyền năng lực học sinh làm tham số thứ 5
        // Throttle giữa hai lần gọi (bài 1 và bài 2) bằng delay, không cần gọi zweimal cho cùng một bài
        let similarProblem1, similarProblem2;
        
        // 🆕 Use router to auto-detect practice service based on topic
        const gService = practiceServiceRouter.getService(topicNameFromExam);
        
        try {
          
          similarProblem1 = await gService.generateSimilarProblem(
            startupProblem1,       // startupProblem1
            startupProblem2,       // startupProblem2
            topicNameFromExam,     // context (chủ đề) - FIX này! context1 chỉ là exercise.context, không phải topic
            1,                     // problemNumber
            competencyLevel,
            100,
            '',
            examData.contextId || ''
          );
        } catch (err1) {
          console.error('❌ [StudentPracticePage] Error generating problem 1:', err1);
          similarProblem1 = startupProblem1 || 'Bài tập 1';
        }

        try {
          
          similarProblem2 = await gService.generateSimilarProblem(
            startupProblem1,       // startupProblem1
            startupProblem2,       // startupProblem2
            topicNameFromExam,     // context (chủ đề) - FIX này!
            2,                     // problemNumber
            competencyLevel,
            100,
            '',
            examData.contextId || ''
          );
        } catch (err2) {
          console.error('❌ [StudentPracticePage] Error generating problem 2:', err2);
          similarProblem2 = startupProblem2 || startupProblem1 || 'Bài tập 2';
        }

        // Khởi tạo phiên luyện tập với 2 bài toán mới
        const practice = await resultService.initializePracticeSession(
          user.uid,
          examId,
          [similarProblem1, similarProblem2]
        );
        
        // Đảm bảo practice có cấu trúc đúng
        if (practice && practice.luyenTap) {
          // 🆕 Add topicName to practice data for sync
          practice.topicName = topicNameFromExam;
          practice.examContextId = examData.contextId || '';
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

      let studentEvaluation = '';
      try {
        studentEvaluation = await studentEvaluationService.generateLuyenTapBaiEvaluation({
          baiNumber,
          status: 'completed',
          chatHistory: baiData.chatHistory || [],
          teacherEvaluation: evaluation || null,
          problemText: baiData.deBai || ''
        });
      } catch (studentEvalError) {
        console.error('Error generating practice student evaluation:', studentEvalError);
      }

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
        evaluation,
        studentEvaluation
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

  const handleRegeneratePracticeProblem = async () => {
    try {
      if (!user?.uid || !examId || !practiceData?.luyenTap?.[activeTab]) return;

      const activeBaiData = practiceData.luyenTap[activeTab];
      const hasUserInteraction = (activeBaiData.chatHistory || []).some((m) => m?.role === 'user');
      if (hasUserInteraction) return;

      setRegeneratingProblem(true);
      setError(null);

      const examData = await examService.getExamById(examId);
      if (!examData || !Array.isArray(examData.exercises) || examData.exercises.length < 1) {
        throw new Error('Không tìm thấy dữ liệu đề gốc để tạo lại bài.');
      }

      const topicNameFromExam = examData.title || topicName || '';
      setTopicName(topicNameFromExam);
      setExamContextId(examData.contextId || '');

      const exercise1 = examData.exercises[0] || {};
      const exercise2 = examData.exercises[1] || exercise1;
      const startupProblem1 = exercise1?.name || '';
      const startupProblem2 = exercise2?.name || startupProblem1;

      const examProgress = await resultService.getExamProgress(user.uid, examId);
      const competencyEvaluation = examProgress?.parts?.khoiDong?.competencyEvaluation;
      const competencyLevel = resolveCompetencyLevel(competencyEvaluation);

      const gService = practiceServiceRouter.getService(topicNameFromExam);
      const problemNumber = activeTab === 'bai1' ? 1 : 2;

      let regeneratedProblem = activeBaiData.deBai || '';
      try {
        regeneratedProblem = await gService.generateSimilarProblem(
          startupProblem1,
          startupProblem2,
          topicNameFromExam,
          problemNumber,
          competencyLevel,
          100,
          '',
          examData.contextId || ''
        );
      } catch (genError) {
        console.error('❌ [StudentPracticePage] Error regenerating problem:', genError);
      }

      await resultService.regeneratePracticeExercise(user.uid, examId, activeTab, regeneratedProblem);

      setPracticeData((prev) => {
        if (!prev?.luyenTap?.[activeTab]) return prev;
        return {
          ...prev,
          luyenTap: {
            ...prev.luyenTap,
            [activeTab]: {
              ...prev.luyenTap[activeTab],
              deBai: regeneratedProblem,
              chatHistory: [],
              status: 'in_progress',
              student_evaluation: '',
              evaluation: {
                nhanXet: '',
                diemTC: { tc1: 0, tc2: 0, tc3: 0, tc4: 0 },
                tongDiem: 0,
                mucDo: 'Cần cố gắng'
              }
            }
          }
        };
      });
    } catch (err) {
      setError(`Lỗi khi tạo lại đề: ${err.message || 'Không rõ nguyên nhân'}`);
    } finally {
      setRegeneratingProblem(false);
    }
  };

  // 🔊 Đổi giọng đọc
  const toggleTTSGender = () => {
    const nextGender = ttsGender === 'FEMALE' ? 'MALE' : 'FEMALE';
    setTtsGender(nextGender);
    localStorage.setItem('chat_tts_gender', nextGender);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 px-4">
        <div className="flex flex-col items-center gap-6">
          <div className="text-5xl animate-bounce-gentle sm:text-6xl">📚</div>
          <p className="text-xl font-bold text-gray-700 font-quicksand sm:text-2xl">Đang tải phiên luyện tập...</p>
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
  const currentHasUserInteraction = (currentBai?.chatHistory || []).some((m) => m?.role === 'user');

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentHeader user={user} onLogout={onSignOut} />

      {/* Compact Sticky Header with Title & Progress */}
      <div className="sticky top-16 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm sm:top-20">
        <div className="app-shell flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <h1 className="truncate text-xl font-bold text-gray-800 font-quicksand sm:text-2xl">
              📚 Luyện tập
            </h1>
            <button
              onClick={() => navigate(-1)}
              className="touch-btn rounded-lg bg-gray-500 px-4 text-xs font-bold text-white font-quicksand transition-all hover:bg-gray-600 sm:text-sm"
            >
              ← Quay lại
            </button>
          </div>
          {/* Progress Steps - Horizontal & Compact */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 py-[clamp(0.6rem,2.2vw,0.9rem)]">
            {['bai1', 'bai2'].map((bai, idx) => {
              const baiData = practiceData.luyenTap?.[bai];
              const status = baiData?.status;
              const icon = status === 'completed' ? '✅' : status === 'in_progress' ? '⏳' : '🔒';
              // const isBai1 = bai === 'bai1'; // Không dùng đến
              const isBai2 = bai === 'bai2';
              const bai1Completed = practiceData.luyenTap.bai1?.status === 'completed';
              // Chỉ disable nếu status là 'locked' hoặc (bài 2 mà bài 1 chưa completed)
              const isDisabled = !practiceData.luyenTap || status === 'locked' || (isBai2 && !bai1Completed);
              return (
                <React.Fragment key={bai}>
                  <button
                    onClick={() => setActiveTab(bai)}
                    disabled={isDisabled}
                    className={`touch-btn min-h-11 rounded-full px-4 text-sm font-bold font-quicksand transition-all ${
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
      <div className="app-shell grid grid-cols-1 gap-[clamp(1rem,2.8vw,1.5rem)] py-[clamp(0.9rem,2.6vw,1.5rem)] pb-20 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_350px]">
        {/* Main Content Column - Flex and grow */}
        <main className="flex min-w-0 flex-col gap-6" ref={leftColRef}>
          {currentBai ? (
            <>
              {/* STICKY PROBLEM STATEMENT */}
              <div className="sticky top-[7.2rem] z-30 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 p-[clamp(0.8rem,2.4vw,1rem)] shadow-sm sm:top-[8.2rem]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="font-quicksand text-[clamp(0.9rem,2.7vw,1rem)] font-bold text-blue-900">📝 Đề Bài</h3>
                  <button
                    onClick={handleRegeneratePracticeProblem}
                    disabled={regeneratingProblem || currentHasUserInteraction || submitting}
                    className={`touch-btn rounded-lg px-3 py-1.5 text-xs font-bold text-white font-quicksand transition-all ${
                      regeneratingProblem || currentHasUserInteraction || submitting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-600'
                    }`}
                    title={currentHasUserInteraction ? 'Đã có tương tác, không thể tạo lại đề' : 'Tạo lại đề cho bài hiện tại'}
                  >
                    {regeneratingProblem ? '⏳ Đang tạo...' : '🔁 Tạo lại đề'}
                  </button>
                </div>
                <p className="font-quicksand text-[clamp(0.95rem,2.8vw,1.05rem)] leading-relaxed text-blue-800 [overflow-wrap:anywhere]">{currentBai.deBai}</p>
              </div>

              {/* SCROLLABLE CHAT */}
              <div className="flex-1 pb-32">
                <PracticeChat
                  userId={user?.uid}
                  examId={examId}
                  baiNumber={activeTab}
                  deBai={currentBai.deBai}
                  chatHistory={currentBai.chatHistory}
                  onChatUpdate={(nextChatHistory) => {
                    setPracticeData((prev) => {
                      if (!prev?.luyenTap?.[activeTab]) return prev;
                      return {
                        ...prev,
                        luyenTap: {
                          ...prev.luyenTap,
                          [activeTab]: {
                            ...prev.luyenTap[activeTab],
                            chatHistory: Array.isArray(nextChatHistory) ? nextChatHistory : prev.luyenTap[activeTab].chatHistory
                          }
                        }
                      };
                    });
                  }}
                  scrollContainerRef={leftColRef}
                  isCompleted={currentBai.status === 'completed'}
                  evaluation={currentBai.evaluation}
                  topicName={practiceData?.topicName || topicName}
                  examContextId={practiceData?.examContextId || examContextId}
                  ttsGender={ttsGender}
                  onTTSStateChange={(isPlaying) => setIsTTSPlaying(isPlaying)}
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
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleSubmitPractice(activeTab)}
                  disabled={submitting || currentBai?.status === 'completed'}
                  className="touch-btn min-h-11 min-w-[220px] flex-1 rounded-xl bg-gradient-to-r from-green-400 to-emerald-500 px-6 text-[clamp(0.95rem,2.7vw,1.05rem)] font-bold text-white font-quicksand transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? '⏳ Đang chấm điểm...' : '✓ Nộp bài & Chấm điểm'}
                </button>
                
                {activeTab === 'bai2' && bai2?.status === 'completed' && (
                  <button
                    onClick={() => navigate(-1)}
                    className="touch-btn min-h-11 rounded-xl bg-green-500 px-6 text-[clamp(0.95rem,2.7vw,1.05rem)] font-bold text-white font-quicksand transition-all hover:bg-green-600 hover:shadow-lg"
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
          <div className="sticky top-[7.2rem] h-fit rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:top-[8.2rem]">
            <RobotCompanion status={robotStatus} message={robotMessage} />
            
            {/* 🔊 Voice Selector - Moved below robot to avoid being obscured */}
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-sm font-bold text-gray-700 font-quicksand">Giọng đọc:</span>
              <button 
                onClick={toggleTTSGender}
                disabled={isTTSPlaying}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold font-quicksand shadow-sm transition-all active:scale-95 ${
                  isTTSPlaying
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-md'
                }`}
                title={isTTSPlaying ? "Đang đọc, không thể đổi giọng" : "Đổi giọng đọc Nam/Nữ"}
              >
                <span>{ttsGender === 'FEMALE' ? '👩 Giọng Nữ' : '👨 Giọng Nam'}</span>
              </button>
            </div>
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

export default StudentPracticePage;
