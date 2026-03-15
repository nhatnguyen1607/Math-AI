import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import examSessionService from '../../services/faculty/examSessionService';
import examService from '../../services/faculty/examService';
import resultService from '../../services/faculty/resultService';

/**
 * StudentExamResultPage
 * Trang quản lý tiến trình học sinh với 2 phần:
 * - Khởi động (mới hoàn thành)
 * - Luyện tập (phát triển sau)
 * - Vận dụng (phát triển sau)
 */

const StudentExamResultPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId, examId: examIdParam } = useParams();
  const fromExam = location.state?.fromExam || false;
  const examIdFromState = location.state?.examId;

  // Data states
  const [session, setSession] = useState(null);
  const [exam, setExam] = useState(null);
  const [examProgress, setExamProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLockedExam, setIsLockedExam] = useState(false);

  // UI states
  const [activeTab, setActiveTab] = useState('khoiDong');
  const [showDetails, setShowDetails] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [showCongrats, setShowCongrats] = useState(fromExam);

  // Practice states
  const [practiceData, setPracticeData] = useState(null);
  const [loadingPractice, setLoadingPractice] = useState(true);

  // Lấy dữ liệu phiên thi và tiến trình
  useEffect(() => {
    const finalExamId = examIdParam || examIdFromState;
    
    if (!sessionId && !finalExamId) {
      setError('Không tìm thấy ID phiên thi hoặc bài thi');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        let examData = null;
        let sessionData = null;

        // Nếu có examId (và exam.isLocked), lấy dữ liệu từ progress
        if (finalExamId) {
          examData = await examService.getExamById(finalExamId);
          
          if (examData?.isLocked && user?.uid) {
            // Exam đã bị khóa, lấy kết quả từ progress
            setIsLockedExam(true);
            const progress = await resultService.getExamProgress(user.uid, finalExamId);
            setExamProgress(progress);
            setExam(examData);
            setLoading(false);
            return;
          }
        }

        // Nếu không có exam.isLocked hoặc chỉ có sessionId, lấy dữ liệu từ session
        if (!sessionId) {
          setError('Không tìm thấy ID phiên thi');
          setLoading(false);
          return;
        }

        sessionData = await examSessionService.getExamSession(sessionId);
        if (!sessionData) {
          setError('Phiên thi không tồn tại');
          setLoading(false);
          return;
        }

        setSession(sessionData);

        // Lấy exam data từ session
        try {
          examData = await examService.getExamById(sessionData.examId);
          setExam(examData);

          // Lấy tiến trình học sinh
          if (user?.uid) {
            const progress = await resultService.getExamProgress(user.uid, sessionData.examId);
            setExamProgress(progress);
          }
        } catch (err) {
          // Handle error silently
        }

        setLoading(false);
      } catch (err) {
        setError('Lỗi khi tải dữ liệu');
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId, examIdParam, examIdFromState, user?.uid]);

  // Load practice data separately
  useEffect(() => {
    const loadPracticeData = async () => {
      try {
        if (!user?.uid || !exam?.id) {
          setLoadingPractice(false);
          return;
        }
        const practice = await resultService.getPracticeSession(user.uid, exam.id);
        setPracticeData(practice);
        setLoadingPractice(false);
      } catch (err) {
        setLoadingPractice(false);
      }
    };
    loadPracticeData();
  }, [user?.uid, exam?.id]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="text-6xl animate-bounce-gentle">🏆</div>
          <p className="text-2xl font-bold text-gray-700 font-quicksand">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || (!session && !isLockedExam)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">⚠️</div>
          <h2 className="text-gray-800 text-3xl font-bold font-quicksand text-center">{error || 'Không thể tải kết quả'}</h2>
          <button
            onClick={() => navigate(-1)}
            className="btn-3d px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-quicksand rounded-max hover:shadow-lg transition-all"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // For locked exams, use exam data directly
  const participantData = isLockedExam 
    ? examProgress?.parts?.khoiDong 
    : session?.participants?.[user?.uid];
  

    
  if (!participantData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">📝</div>
          <h2 className="text-gray-800 text-3xl font-bold font-quicksand">Bạn chưa làm bài học này</h2>
          <p className="text-gray-600 text-lg">Quay lại để chọn bài khác hoặc bắt đầu làm bài mới</p>
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

  // Calculate score from participantData
  const correctCount = isLockedExam
    ? participantData?.correctAnswers || 0
    : Object.values(participantData?.answers || {}).filter((a) => a.isCorrect).length;
  
  const totalQuestions = isLockedExam
    ? participantData?.totalQuestions || exam?.totalQuestions || 1
    : session?.totalQuestions || exam?.totalQuestions || 1;
    
  const percentage = isLockedExam
    ? participantData?.percentage || Math.round((correctCount / totalQuestions) * 100)
    : Math.round((correctCount / totalQuestions) * 100);
    
  const isPassed = percentage >= 50;

  // Render content based on active tab
  const renderTabContent = () => {
    if (activeTab === 'khoiDong') {
      return renderKhoiDongTab();
    } else if (activeTab === 'luyenTap') {
      return renderLuyenTapTab();
    } else if (activeTab === 'vanDung') {
      return renderVanDungTab();
    }
  };

  const renderKhoiDongTab = () => {
    return (
      <div>
        {/* Congratulations Banner (only on first visit from exam) */}
        {showCongrats && (
          <div className="bg-white rounded-max shadow-2xl overflow-hidden mb-8 animate-bounce-gentle game-card">
            <div
              className={`p-12 text-center text-white relative overflow-hidden ${
                isPassed
                  ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                  : 'bg-gradient-to-br from-orange-400 to-yellow-500'
              }`}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
              <div className="text-7xl mb-4 block animate-bounce-gentle relative z-10">{isPassed ? '🎉' : '💪'}</div>
              <h1 className="text-5xl font-bold mb-3 relative z-10 font-quicksand">
                {isPassed ? 'Chúc mừng!' : 'Cố gắng thêm lần tới!'}
              </h1>
              <p className="text-xl opacity-95 relative z-10 font-quicksand">{exam?.title || 'Bài thi'}</p>
              <button
                onClick={() => setShowCongrats(false)}
                className="mt-6 px-6 py-2 bg-white/30 text-white rounded-full font-bold hover:bg-white/50 transition-all"
              >
                Đóng ✕
              </button>
            </div>
          </div>
        )}

        {/* Khởi động Results */}
        <div className="bg-white rounded-max shadow-2xl overflow-hidden mb-8 game-card">
          {/* Result Header */}
          <div className={`p-10 text-center text-white ${isPassed ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-orange-400 to-yellow-500'}`}>
            <h2 className="text-4xl font-bold mb-2 font-quicksand">🚀 Phần Khởi động</h2>
            <p className="text-lg opacity-90">{exam?.title || 'Bài thi'}</p>
          </div>

          {/* Score Display */}
          <div className="grid grid-cols-3 gap-6 px-12 py-12 md:grid-cols-3 sm:grid-cols-1">
            <div className="flex flex-col items-center gap-3 p-6 bg-green-100 rounded-max">
              <div className="text-5xl font-bold text-green-600 font-quicksand">{correctCount}</div>
              <div className="text-gray-700 font-bold font-quicksand">Câu đúng</div>
              <div className="text-sm text-gray-600">({percentage}%)</div>
            </div>

            <div className="relative w-48 h-48 mx-auto">
              <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={isPassed ? '#10b981' : '#f97316'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: `${(percentage / 100) * 314} 314`,
                    transition: 'stroke-dasharray 0.6s ease'
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-5xl font-bold text-gray-800 font-quicksand">{percentage}%</div>
              </div>
            </div>

            {/* Score Box */}
            <div className="flex flex-col items-center gap-3 p-6 bg-blue-100 rounded-max">
              <div className="text-5xl font-bold text-blue-600 font-quicksand">
                {(() => {
                  const myEntry = exam?.finalLeaderboard?.find(entry => entry.uid === user?.uid);
                  return myEntry?.score ?? correctCount * 10;
                })()}
              </div>
              <div className="text-gray-700 font-bold font-quicksand">Điểm số</div>
              <div className="text-sm text-gray-600">
                {(() => {
                  const myRank = exam?.finalLeaderboard?.findIndex(entry => entry.uid === user?.uid) + 1;
                  return myRank > 0 ? `Hạng ${myRank}/${exam?.finalLeaderboard?.length || 0}` : '';
                })()}
              </div>
            </div>
          </div>

          {/* Competency Evaluation - HIDDEN FOR STUDENTS - Only for Faculty 
              This is now displayed through CompetencyEvaluationDisplay in FacultyStudentExamResultPage */}

          {/* Leaderboard Section */}
          <div className="border-t-4 border-gray-200">
            <button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className="btn-3d w-full p-6 bg-white border-b-3 border-yellow-400 rounded-none text-lg font-bold text-gray-800 cursor-pointer transition-all hover:bg-yellow-50 font-quicksand"
            >
              {showLeaderboard ? '▼' : '▶'} 🏆 Bảng xếp hạng
            </button>

            {showLeaderboard && (
              <div className="p-8 bg-yellow-50">
                {/* 🔧 Ưu tiên finalLeaderboard, nếu không có thì tạo từ session.participants */}
                {(() => {
                  // Tạo leaderboard từ session participants nếu chưa có finalLeaderboard
                  let leaderboardData = exam?.finalLeaderboard;
                  if ((!leaderboardData || leaderboardData.length === 0) && session?.participants) {
                    leaderboardData = Object.entries(session.participants)
                      .map(([uid, data]) => ({
                        uid,
                        name: data.studentName || data.name || 'Học sinh',
                        displayName: data.studentName || data.name,
                        score: data.score || 0
                      }))
                      .sort((a, b) => b.score - a.score);
                  }
                  return leaderboardData && leaderboardData.length > 0 ? (
                  <div className="bg-white rounded-max shadow-md overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white">
                          <th className="py-4 px-6 text-left font-quicksand">Hạng</th>
                          <th className="py-4 px-6 text-left font-quicksand">Tên</th>
                          <th className="py-4 px-6 text-center font-quicksand">Điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardData.map((entry, idx) => {
                          const isMe = entry.uid === user?.uid;
                          return (
                            <tr 
                              key={entry.uid || idx} 
                              className={`border-b border-gray-200 transition-all ${
                                isMe ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'
                              }`}
                            >
                              <td className="py-4 px-6 font-quicksand">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                              </td>
                              <td className="py-4 px-6 font-quicksand">
                                {entry.displayName || entry.name || 'Học sinh'}
                                {isMe && <span className="ml-2 text-blue-600">(Bạn)</span>}
                              </td>
                              <td className="py-4 px-6 text-center font-quicksand font-bold text-blue-600">
                                {entry.score ?? 0}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-600 font-quicksand">
                    <div className="text-4xl mb-4">📊</div>
                    <p>Chưa có dữ liệu bảng xếp hạng</p>
                  </div>
                );
                })()}
              </div>
            )}
          </div>

          {/* Show Details Section - Chia 2 phần BT */}
          <div className="border-t-4 border-gray-200">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="btn-3d w-full p-6 bg-white border-b-3 border-purple-400 rounded-none text-lg font-bold text-gray-800 cursor-pointer transition-all hover:bg-purple-50 font-quicksand"
            >
              {showDetails ? '▼' : '▶'} Xem chi tiết câu trả lời 
            </button>

            {showDetails && (
              <div className="p-8 bg-gray-50 space-y-8">
                {/* Render each exercise separately */}
                {exam?.exercises && exam.exercises.length > 0 ? (
                  exam.exercises.map((exercise, exerciseIdx) => (
                    <div key={exerciseIdx} className="bg-white rounded-max p-6 shadow-md">
                      {/* Exercise Header */}
                      <div className="mb-6 pb-4 border-b-3 border-blue-300">
                        <h4 className="text-2xl font-bold text-gray-800 font-quicksand mb-2">
                          {exerciseIdx === 0 ? '📝 Bài tập 1' : '📚 Bài tập 2'}
                        </h4>
                        {exercise.context && (
                          <div className="p-4 bg-blue-50 rounded-max border-l-4 border-blue-500 text-gray-700">
                            <p className="font-bold text-sm uppercase mb-2 font-quicksand">Bài toán:</p>
                            <p>{exercise.context}</p>
                          </div>
                        )}
                      </div>

                      {/* Questions in this exercise */}
                      <div className="space-y-4">
                        {exercise.questions && exercise.questions.length > 0 ? (
                          exercise.questions.map((question, questionIdx) => {
                            // Find the global question index
                            let globalQuestionIndex = 0;
                            for (let i = 0; i < exerciseIdx; i++) {
                              globalQuestionIndex += exam.exercises[i].questions?.length || 0;
                            }
                            globalQuestionIndex += questionIdx;

                            // Get answer data from participantData
                            let answerData = null;
                            
                            if (Array.isArray(participantData.answers)) {
                              // Array format - find by questionIndex or use index directly
                              answerData = participantData.answers.find(a => a.questionIndex === globalQuestionIndex) || participantData.answers[globalQuestionIndex];
                            } else {
                              // Object format - try both string and number keys
                              answerData = participantData.answers?.[globalQuestionIndex] || participantData.answers?.[String(globalQuestionIndex)];
                            }
                            
                            if (!answerData) {
                              return null;
                            }

                            // Auto-expand first exercise
                            const isExpanded = exerciseIdx === 0 || expandedQuestions[globalQuestionIndex];

                            return (
                              <div
                                key={globalQuestionIndex}
                                className={`rounded-max overflow-hidden border-3 transition-all ${
                                  answerData.isCorrect
                                    ? 'border-green-400 bg-green-50'
                                    : 'border-red-400 bg-red-50'
                                }`}
                              >
                                <div
                                  className={`flex justify-between items-center p-6 cursor-pointer hover:bg-gray-100 transition-colors font-quicksand ${
                                    answerData.isCorrect ? 'bg-green-100' : 'bg-red-100'
                                  }`}
                                  onClick={() =>
                                    setExpandedQuestions({
                                      ...expandedQuestions,
                                      [globalQuestionIndex]: !isExpanded
                                    })
                                  }
                                >
                                  <div className="text-lg font-bold text-gray-800">
                                    {answerData.isCorrect ? '✅' : '❌'} Câu {globalQuestionIndex + 1}
                                  </div>
                                  <div className="text-gray-600 text-2xl">{isExpanded ? '▼' : '▶'}</div>
                                </div>

                                {isExpanded && (
                                  <div className="p-8 animate-bounce-gentle font-quicksand">
                                    <div className="text-2xl font-bold text-gray-800 mb-6 pb-6 border-b-3 border-gray-300">
                                      {question.text || question.question}
                                    </div>

                                    <div className="space-y-4 mb-8">
                                      {(question.options || []).map((option, oIdx) => {
                                        // Handle both array (multiple select) and single answer formats
                                        const isMultipleSelect = Array.isArray(answerData.answer);
                                        const selectedAnswers = isMultipleSelect ? answerData.answer : [answerData.answer];
                                        const isSelected = selectedAnswers.includes(oIdx);
                                        
                                        // For multiple select, we can't have a single correctAnswerIndex
                                        // So we check if the answer is correct based on isCorrect flag
                                        const isCorrectAnswer = answerData.correctAnswerIndex === oIdx;
                                        
                                        // Hiển thị "✓ Bạn chọn" (green) khi học sinh chọn và câu đúng
                                        const showAsCorrect = isSelected && answerData.isCorrect;
                                        // Hiển thị "✓ Bạn chọn" (red) khi học sinh chọn nhưng câu sai
                                        const showAsWrong = isSelected && !answerData.isCorrect;

                                        return (
                                          <div
                                            key={oIdx}
                                            className={`flex items-center gap-4 p-5 rounded-max border-3 transition-all ${
                                              showAsCorrect
                                                ? 'border-green-500 bg-green-100'
                                                : showAsWrong
                                                ? 'border-red-500 bg-red-100'
                                                : isCorrectAnswer
                                                ? 'border-green-300 bg-green-50'
                                                : 'border-gray-300 bg-gray-50'
                                            }`}
                                          >
                                            <span
                                              className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-white text-lg flex-shrink-0 ${
                                                showAsCorrect
                                                  ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                                                  : showAsWrong
                                                  ? 'bg-gradient-to-br from-red-500 to-red-600'
                                                  : isCorrectAnswer
                                                  ? 'bg-gradient-to-br from-green-400 to-green-500'
                                                  : 'bg-gradient-to-br from-purple-600 to-purple-700'
                                              }`}
                                            >
                                              {String.fromCharCode(65 + oIdx)}
                                            </span>
                                            <span className="flex-1 text-gray-800 text-base leading-relaxed">{option}</span>
                                            {showAsCorrect && (
                                              <span className="px-4 py-2 bg-green-600 text-white rounded-max text-sm font-bold flex-shrink-0">
                                                ✓ Bạn chọn
                                              </span>
                                            )}
                                            {showAsWrong && (
                                              <span className="px-4 py-2 bg-red-600 text-white rounded-max text-sm font-bold flex-shrink-0">
                                                ✓ Bạn chọn
                                              </span>
                                            )}
                                            {isCorrectAnswer && !isSelected && !answerData.isCorrect && (
                                              <span className="px-4 py-2 bg-green-600 text-white rounded-max text-sm font-bold flex-shrink-0">
                                                ✓ Đúng
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {(() => {
                                      // Find the AI comment for this question - ONLY show AI comments, NO database fallback
                                      const aiComment = examProgress.parts.khoiDong.aiAnalysis.questionComments?.find(
                                        (c) => c.questionNum === globalQuestionIndex + 1
                                      );
                                      
                                      // Only display if AI generated a unique comment for THIS student
                                      if (!aiComment?.comment) {
                                        return null; // Don't show database explanation as fallback
                                      }

                                      return (
                                        <div className={`p-6 border-l-4 rounded-max bg-blue-100 border-blue-600`}>
                                          <h4 className="text-sm font-bold text-gray-800 uppercase mb-3">
                                            💡 Nhận xét AI:
                                          </h4>
                                          <p className="text-gray-800 leading-relaxed text-base">{aiComment.comment}</p>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-gray-600 text-center py-4">Không có câu hỏi trong phần này</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 text-center">Không có dữ liệu bài tập</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLuyenTapTab = () => {
    // Data structure is {bai1: {...}, bai2: {...}}
    const hasPracticeData = practiceData && (practiceData.bai1 || practiceData.bai2);
    const bai1Started = practiceData?.bai1?.status && practiceData.bai1.status !== 'not_started';
    const bai2Started = practiceData?.bai2?.status && practiceData.bai2.status !== 'not_started';
    const bai1Completed = practiceData?.bai1?.status === 'completed';
    const bai2Completed = practiceData?.bai2?.status === 'completed';
    const bothCompleted = bai1Completed && bai2Completed;
    const anyProgress = bai1Started || bai2Started;

    return (
      <div className="bg-white rounded-max shadow-2xl overflow-hidden mb-8 game-card">
        <div className="p-10 text-center text-white bg-gradient-to-br from-blue-400 to-blue-500">
          <h2 className="text-4xl font-bold mb-2 font-quicksand">📚 Phần Luyện tập</h2>
          <p className="text-lg opacity-90">
            {bothCompleted ? '✅ Đã hoàn thành!' : anyProgress ? '⏳ Đang làm' : '🆕 Chưa thực hiện'}
          </p>
        </div>

        {loadingPractice ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-6 animate-bounce-gentle">📚</div>
            <p className="text-gray-600 text-lg font-quicksand">Đang tải dữ liệu...</p>
          </div>
        ) : bothCompleted ? (
          // Show completed state with review button
          <div className="p-12 text-center">
            <div className="text-6xl mb-6 animate-bounce-gentle">✅</div>
            <h3 className="text-3xl font-bold text-green-600 mb-4 font-quicksand">Bạn đã hoàn thành Luyện tập!</h3>
            <p className="text-lg text-gray-600 mb-4 font-quicksand">Cả 2 bài luyện tập đều đã được hoàn thành và đánh giá.</p>
            
            {/* Progress Bar */}
            <div className="mb-8 px-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-700">Tiến độ hoàn thành</span>
                <span className="text-sm font-bold text-green-600">2/2 bài</span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
                <div className="bg-green-500 h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            
            <p className="text-lg text-gray-600 mb-8 font-quicksand">Xem lại các đoạn chat và kết quả đánh giá:</p>
            <button
              onClick={() => navigate(`/student/practice/${exam?.id}`)}
              className="btn-3d px-12 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold rounded-full hover:shadow-lg transition-all font-quicksand"
            >
              📖 Xem lại đoạn chat →
            </button>
          </div>
        ) : !hasPracticeData ? (
          // Show not started state
          <div className="p-12 text-center">
            <div className="text-6xl mb-6">📚</div>
            <h3 className="text-3xl font-bold text-gray-800 mb-4 font-quicksand">Sẵn sàng bắt đầu Luyện tập?</h3>
            <p className="text-lg text-gray-600 mb-2 font-quicksand">Dựa vào nhận xét AI ở phần Khởi động,</p>
            <p className="text-lg text-gray-600 mb-8 font-quicksand">hãy thử sức với các bài toán tương tự!</p>
            <button
              onClick={() => navigate(`/student/practice/${exam?.id}`)}
              className="btn-3d px-12 py-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xl font-bold rounded-full hover:shadow-lg transition-all font-quicksand"
            >
              🚀 Bắt đầu Luyện tập →
            </button>
          </div>
        ) : (
          // Show in-progress state
          <div className="p-12 text-center">
            <div className="text-6xl mb-6 animate-pulse">⏳</div>
            <h3 className="text-3xl font-bold text-blue-600 mb-4 font-quicksand">Bạn đang làm Luyện tập</h3>
            
            {/* Progress Bar */}
            <div className="mb-8 px-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-700">Tiến độ hoàn thành</span>
                <span className="text-sm font-bold text-blue-600">
                  {(bai1Completed ? 1 : 0) + (bai2Completed ? 1 : 0)}/2 bài
                </span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${((bai1Completed ? 1 : 0) + (bai2Completed ? 1 : 0)) * 50}%` }}
                ></div>
              </div>
            </div>

            {/* Progress Details */}
            <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
              <div className={`p-4 rounded-lg ${bai1Completed ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100 border-2 border-gray-400'}`}>
                <p className="text-sm font-bold text-gray-700">Bài 1</p>
                <p className={`text-lg font-bold ${bai1Completed ? 'text-green-600' : 'text-gray-600'}`}>
                  {bai1Completed ? '✅ Hoàn thành' : '⏳ Đang làm'}
                </p>
              </div>
              <div className={`p-4 rounded-lg ${bai2Completed ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-100 border-2 border-gray-400'}`}>
                <p className="text-sm font-bold text-gray-700">Bài 2</p>
                <p className={`text-lg font-bold ${bai2Completed ? 'text-green-600' : 'text-gray-600'}`}>
                  {bai2Completed ? '✅ Hoàn thành' : bai1Completed ? '⏳ Đang làm' : '⏸️ Chưa mở'}
                </p>
              </div>
            </div>

            <p className="text-lg text-gray-600 mb-8 font-quicksand">Tiếp tục làm bài của bạn:</p>
            <button
              onClick={() => navigate(`/student/practice/${exam?.id}`)}
              className="btn-3d px-12 py-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xl font-bold rounded-full hover:shadow-lg transition-all font-quicksand"
            >
              ⏭️ Tiếp tục Luyện tập →
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderVanDungTab = () => {
    const vanDungData = examProgress?.parts?.vanDung;
    const luyenTapCompleted = 
      examProgress?.parts?.luyenTap?.bai1?.status === 'completed' &&
      examProgress?.parts?.luyenTap?.bai2?.status === 'completed';

    return (
      <div className="bg-white rounded-max shadow-2xl overflow-hidden mb-8 game-card">
        <div className="p-10 text-center text-white bg-gradient-to-br from-yellow-400 to-orange-500">
          <h2 className="text-4xl font-bold mb-2 font-quicksand">🌟 Phần Vận dụng</h2>
          <p className="text-lg opacity-90">
            {vanDungData?.status === 'completed' ? '✅ Đã hoàn thành!' : 
             vanDungData?.status === 'in_progress' ? '⏳ Đang làm' : 
             '🆕 Sẵn sàng bắt đầu'}
          </p>
        </div>

        {!vanDungData ? (
          // Chưa bắt đầu Vận dụng
          <div className="p-12 text-center">
            <div className="text-6xl mb-6 animate-bounce-gentle">🌟</div>
            {!luyenTapCompleted ? (
              <>
                <h3 className="text-3xl font-bold text-gray-800 mb-4 font-quicksand">Hoàn thành Luyện tập trước!</h3>
                <p className="text-lg text-gray-600 mb-8 font-quicksand">Bạn cần hoàn thành cả 2 bài Luyện tập trước khi vào Vận dụng</p>
                <button
                  disabled
                  className="btn-3d px-12 py-5 bg-gray-400 text-white text-xl font-bold rounded-full cursor-not-allowed font-quicksand opacity-50"
                >
                  🔒 Mở khóa sau Luyện tập
                </button>
              </>
            ) : (
              <>
                <h3 className="text-3xl font-bold text-gray-800 mb-4 font-quicksand">Bạn đã sẵn sàng cho phần Vận dụng!</h3>
                <p className="text-lg text-gray-600 mb-2 font-quicksand">Hãy áp dụng kiến thức vào một bài toán</p>
                <p className="text-lg text-gray-600 mb-8 font-quicksand">thực tế được tạo riêng dựa trên những điểm yếu của bạn</p>
                <button
                  onClick={() => navigate(`/student/van-dung/${exam?.id}`)}
                  className="btn-3d px-12 py-5 bg-gradient-to-r from-orange-400 to-red-500 text-white text-xl font-bold rounded-full hover:shadow-lg transition-all font-quicksand"
                >
                  🚀 Bắt đầu Vận dụng →
                </button>
              </>
            )}
          </div>
        ) : vanDungData?.status === 'completed' && vanDungData?.evaluation ? (
          // Đã hoàn thành Vận dụng - hiển thị kết quả
          <div className="p-12 text-center">
            <div className="text-6xl mb-6 animate-bounce-gentle">✅</div>
            <h3 className="text-3xl font-bold text-green-600 mb-4 font-quicksand">Bạn đã hoàn thành Vận dụng!</h3>
            <p className="text-lg text-gray-600 mb-8 font-quicksand">Bài toán đã được đánh giá và lưu lại.</p>
            
            {/* Progress Bar */}
            <div className="mb-8 px-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-700">Trạng thái</span>
                <span className="text-sm font-bold text-green-600">Hoàn thành</span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
                <div className="bg-green-500 h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            
            <p className="text-lg text-gray-600 mb-8 font-quicksand">Xem lại bài làm của bạn:</p>
            <button
              onClick={() => navigate(`/student/van-dung/${exam?.id}`)}
              className="btn-3d px-12 py-5 bg-gradient-to-r from-orange-400 to-red-500 text-white text-xl font-bold rounded-full hover:shadow-lg transition-all font-quicksand"
            >
              📖 Xem lại bài làm →
            </button>
          </div>
        ) : (
          // Đang làm Vận pass
          <div className="p-12 text-center">
            <div className="text-6xl mb-6 animate-pulse">⏳</div>
            <h3 className="text-3xl font-bold text-orange-600 mb-4 font-quicksand">Bạn đang làm Vận dụng</h3>
            <p className="text-lg text-gray-600 mb-8 font-quicksand">Tiếp tục giải bài toán của bạn:</p>
            <button
              onClick={() => navigate(`/student/van-dung/${exam?.id}`)}
              className="btn-3d px-12 py-5 bg-gradient-to-r from-orange-400 to-red-500 text-white text-xl font-bold rounded-full hover:shadow-lg transition-all font-quicksand"
            >
              ⏭️ Tiếp tục Vận dụng →
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 pb-10">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="max-w-5xl mx-auto px-5 pt-10">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-max transition-all font-quicksand"
          >
            ← Quay lại
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-4 mb-10 flex-wrap">
          {[
            { id: 'khoiDong', label: '🚀 Khởi động', icon: '🚀' },
            { id: 'luyenTap', label: '📚 Luyện tập', icon: '📚' },
            { id: 'vanDung', label: '🌟 Vận dụng', icon: '🌟' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowDetails(false);
              }}
              className={`px-8 py-3 rounded-full font-bold text-lg transition-all font-quicksand ${
                activeTab === tab.id
                  ? 'bg-yellow-400 shadow-3d text-gray-900'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Action Buttons */}
        {/* <div className="grid grid-cols-2 gap-6 pb-8 md:grid-cols-2 sm:grid-cols-1 font-quicksand">
          <button
            onClick={() => navigate('/student')}
            className="btn-3d px-6 py-4 bg-white text-gray-800 border-3 border-gray-400 rounded-max font-bold text-lg transition-all hover:bg-gray-100 hover:shadow-lg"
          >
            ← Quay lại Dashboard
          </button>
          <button
            onClick={() => navigate('/student/class-selection')}
            className="btn-3d px-6 py-4 bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-max font-bold text-lg transition-all hover:shadow-lg"
          >
            Làm bài khác →
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default StudentExamResultPage;
