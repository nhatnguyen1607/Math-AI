import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import examSessionService from '../../services/examSessionService';
import examService from '../../services/examService';
import geminiService from '../../services/geminiService';

/**
 * StudentExamResultPage
 * Hiển thị kết quả cuối cùng của phiên thi:
 * - Điểm số
 * - Số câu đúng/sai
 * - Nhận xét AI từ Gemini
 * - Chi tiết câu trả lời
 */

const StudentExamResultPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { sessionId } = useParams();

  // Data states
  const [session, setSession] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  // UI states
  const [showDetails, setShowDetails] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState({});

  // Lấy dữ liệu phiên thi
  useEffect(() => {
    if (!sessionId) {
      setError('Không tìm thấy ID phiên thi');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        // Lấy session data
        const sessionData = await examSessionService.getExamSession(sessionId);
        if (!sessionData) {
          setError('Phiên thi không tồn tại');
          setLoading(false);
          return;
        }

        setSession(sessionData);

        // Lấy exam data
        try {
          const examData = await examService.getExamById(sessionData.examId);
          setExam(examData);
        } catch (err) {
          console.error('Error loading exam:', err);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading session:', err);
        setError('Lỗi khi tải dữ liệu phiên thi');
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId]);

  // Lấy nhận xét AI
  useEffect(() => {
    if (!session || !exam || !user?.uid || aiAnalysis) return;

    const generateAnalysis = async () => {
      try {
        setLoadingAnalysis(true);

        const participantData = session.participants[user.uid];
        if (!participantData) {
          setLoadingAnalysis(false);
          return;
        }

        // Chuẩn bị dữ liệu để gửi tới Gemini
        const analysisPrompt = `
Phân tích kết quả bài thi của học sinh:
- Điểm số: ${participantData.score}/${session.totalQuestions}
- Câu trả lời đúng: ${Object.values(participantData.answers || {}).filter(a => a.isCorrect).length}/${session.totalQuestions}
- Tỉ lệ: ${Math.round((participantData.score / session.totalQuestions) * 100)}%

Hãy đưa ra:
1. Nhận xét ngắn gọn về kết quả (1-2 câu)
2. Những điểm mạnh
3. Những điểm cần cải thiện
4. Lời khuyên để cải thiện

Trả lời bằng tiếng Việt.
        `;

        const response = await geminiService.analyzeExamResult(analysisPrompt);
        if (response) {
          setAiAnalysis(response);
        }
      } catch (err) {
        console.error('Error generating AI analysis:', err);
      } finally {
        setLoadingAnalysis(false);
      }
    };

    generateAnalysis();
  }, [session, exam, user?.uid, aiAnalysis]);

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
  if (error || !session) {
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

  const participantData = session.participants[user?.uid];
  if (!participantData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">❓</div>
          <h2 className="text-gray-800 text-3xl font-bold font-quicksand">Không tìm thấy dữ liệu kết quả</h2>
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

  const correctCount = Object.values(participantData.answers || {}).filter(
    (a) => a.isCorrect
  ).length;
  const percentage = Math.round((correctCount / session.totalQuestions) * 100);
  const isPassed = percentage >= 50; // 50% là pass

  // Determine trophy level
  const getTrophyIcon = () => {
    if (percentage === 100) return { icon: '🏆', label: 'Hạng vàng', className: 'trophy-gold' };
    if (percentage >= 80) return { icon: '🥈', label: 'Hạng bạc', className: 'trophy-silver' };
    if (percentage >= 50) return { icon: '🥉', label: 'Hạng đồng', className: 'trophy-bronze' };
    return { icon: '🎯', label: 'Cố gắng thêm', className: 'trophy-bronze' };
  };

  const trophy = getTrophyIcon();

  // Hiển thị kết quả
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 pb-10">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="max-w-5xl mx-auto px-5 pt-10">
        {/* Main Result Card with Trophy */}
        <div className="bg-white rounded-max shadow-2xl overflow-hidden mb-8 animate-bounce-gentle game-card">
          {/* Result Header */}
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
          </div>

          {/* Trophy & Score Section */}
          <div className={`trophy-container ${trophy.className}`}>
            <div className="trophy-icon">{trophy.icon}</div>
            <div className="text-center font-quicksand">
              <h2 className="text-2xl font-bold text-gray-800">{trophy.label}</h2>
              <p className="text-gray-600 mt-2">Bạn đạt được {percentage}% điểm số</p>
            </div>
          </div>

          {/* Score Display */}
          <div className="grid grid-cols-3 gap-6 px-12 py-12 md:grid-cols-3 sm:grid-cols-1 md:items-center">
            {/* Correct Count */}
            <div className="flex flex-col items-center gap-3 p-6 bg-green-100 rounded-max">
              <div className="text-5xl font-bold text-green-600 font-quicksand">{correctCount}</div>
              <div className="text-gray-700 font-bold font-quicksand">Câu đúng</div>
              <div className="text-sm text-gray-600">({percentage}%)</div>
            </div>

            {/* Percentage Circle */}
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

            {/* Status Display */}
            <div className="flex flex-col items-center gap-3 p-6 bg-yellow-100 rounded-max">
              <div className={`text-5xl font-bold font-quicksand ${isPassed ? 'text-green-600' : 'text-orange-600'}`}>
                {isPassed ? '✓' : '✗'}
              </div>
              <div className={`text-2xl font-bold font-quicksand ${isPassed ? 'text-green-600' : 'text-orange-600'}`}>
                {isPassed ? 'PASS' : 'FAIL'}
              </div>
              <div className="text-sm text-gray-600">Kết quả</div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="border-t-4 border-gray-200 grid grid-cols-2 gap-6 md:grid-cols-4 px-12 py-10">
            <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-green-100 to-green-50 rounded-max">
              <div className="text-sm text-gray-700 uppercase font-bold font-quicksand">Câu đúng</div>
              <div className="text-4xl font-bold text-green-600 font-quicksand">{correctCount}</div>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-red-100 to-red-50 rounded-max">
              <div className="text-sm text-gray-700 uppercase font-bold font-quicksand">Câu sai</div>
              <div className="text-4xl font-bold text-red-600 font-quicksand">{session.totalQuestions - correctCount}</div>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-blue-100 to-blue-50 rounded-max">
              <div className="text-sm text-gray-700 uppercase font-bold font-quicksand">Tổng câu</div>
              <div className="text-4xl font-bold text-blue-600 font-quicksand">{session.totalQuestions}</div>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-purple-100 to-purple-50 rounded-max">
              <div className="text-sm text-gray-700 uppercase font-bold font-quicksand">Thời gian</div>
              <div className="text-4xl font-bold text-purple-600 font-quicksand">
                {participantData.completedAt
                  ? Math.round(
                      (participantData.completedAt.getTime() - session.startTime.getTime()) / 1000 / 60
                    ) + ' min'
                  : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* AI Teacher Speech Bubble */}
        {(aiAnalysis || loadingAnalysis) && (
          <div className="mb-10 game-card">
            <div className="speech-bubble-with-avatar">
              <div className="teacher-avatar">👨‍🏫</div>
              <div className="speech-bubble">
                {loadingAnalysis ? (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <p className="font-quicksand">Thầy đang phân tích kết quả của em...</p>
                  </div>
                ) : aiAnalysis ? (
                  <p className="font-quicksand text-lg">{aiAnalysis}</p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="btn-3d w-full p-6 bg-white border-3 border-purple-400 rounded-max text-lg font-bold text-gray-800 cursor-pointer transition-all hover:bg-purple-50 hover:shadow-lg font-quicksand mb-8"
        >
          {showDetails ? '▼' : '▶'} Xem chi tiết câu trả lời ({correctCount}/{session.totalQuestions} đúng)
        </button>

        {/* Details Section */}
        {showDetails && (
          <div className="bg-white rounded-max p-8 shadow-lg mb-8 animate-bounce-gentle game-card">
            {Object.entries(participantData.answers || {}).map(([qIdx, answerData], idx) => {
              const questionIndex = parseInt(qIdx);
              const question = exam?.exercises
                ? exam.exercises.flatMap((e) => e.questions || {})[questionIndex]
                : null;

              if (!question) return null;

              const isExpanded = expandedQuestions[questionIndex];

              return (
                <div
                  key={questionIndex}
                  className={`mb-4 rounded-max overflow-hidden border-3 transition-all ${
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
                        [questionIndex]: !isExpanded
                      })
                    }
                  >
                    <div className="text-lg font-bold text-gray-800">
                      {answerData.isCorrect ? '✅' : '❌'} Câu {questionIndex + 1}
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
                          const isSelected = answerData.answer === oIdx;
                          const isCorrectAnswer = oIdx === question.correctAnswerIndex;

                          return (
                            <div
                              key={oIdx}
                              className={`flex items-center gap-4 p-5 rounded-max border-3 transition-all ${
                                isCorrectAnswer
                                  ? 'border-green-500 bg-green-100'
                                  : isSelected
                                  ? 'border-red-500 bg-red-100'
                                  : 'border-gray-300 bg-gray-50'
                              }`}
                            >
                              <span
                                className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-white text-lg flex-shrink-0 ${
                                  isCorrectAnswer
                                    ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                                    : 'bg-gradient-to-br from-purple-600 to-purple-700'
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="flex-1 text-gray-800 text-base leading-relaxed">{option}</span>
                              {isCorrectAnswer && (
                                <span className="px-4 py-2 bg-green-600 text-white rounded-max text-sm font-bold flex-shrink-0">
                                  ✓ Đúng
                                </span>
                              )}
                              {isSelected && !isCorrectAnswer && (
                                <span className="px-4 py-2 bg-red-600 text-white rounded-max text-sm font-bold flex-shrink-0">
                                  ✗ Bạn chọn
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {question.explanation && (
                        <div className="p-6 bg-purple-100 border-l-4 border-purple-600 rounded-max">
                          <h4 className="text-sm font-bold text-gray-800 uppercase mb-3">📚 Giải thích:</h4>
                          <p className="text-gray-800 leading-relaxed text-base">{question.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-6 pb-8 md:grid-cols-2 sm:grid-cols-1 font-quicksand">
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
        </div>
      </div>
    </div>
  );
};

export default StudentExamResultPage;
