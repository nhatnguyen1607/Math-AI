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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-white rounded-full animate-spin"></div>
          <p className="text-white text-lg font-medium">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">⚠️</div>
          <h2 className="text-white text-2xl font-bold text-center">{error || 'Không thể tải kết quả'}</h2>
          <button
            onClick={() => navigate(-1)}
            className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all"
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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">❓</div>
          <h2 className="text-white text-2xl font-bold">Không tìm thấy dữ liệu kết quả</h2>
          <button
            onClick={() => navigate(-1)}
            className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all"
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

  // Hiển thị kết quả
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 pb-10">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="max-w-4xl mx-auto px-5 pt-10">
        {/* Result Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-8 animate-in slide-in-from-bottom duration-500">
          {/* Result Header */}
          <div
            className={`p-10 text-center text-white relative overflow-hidden ${
              isPassed
                ? 'bg-gradient-to-br from-teal-500 to-green-600'
                : 'bg-gradient-to-br from-red-400 to-red-500'
            }`}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
            <div className="text-6xl mb-4 block animate-bounce">{isPassed ? '🎉' : '💪'}</div>
            <h1 className="text-4xl font-bold mb-2 relative z-10">
              {isPassed ? 'Chúc mừng!' : 'Cố gắng thêm lần tới!'}
            </h1>
            <p className="text-lg opacity-95 relative z-10">{exam?.title || 'Bài thi'}</p>
          </div>

          {/* Score Section */}
          <div className="grid grid-cols-3 gap-5 px-10 py-10 md:grid-cols-3 sm:grid-cols-1 md:items-center">
            {/* Score Display */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-4xl font-bold text-purple-600">{correctCount}/{session.totalQuestions}</div>
              <div className="text-sm text-gray-500 font-medium uppercase">Câu đúng</div>
            </div>

            {/* Percentage Circle */}
            <div className="relative w-40 h-40 mx-auto">
              <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f0f0f0" strokeWidth="8" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={isPassed ? '#11998e' : '#ff6b6b'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: `${(percentage / 100) * 314} 314`,
                    transition: 'stroke-dasharray 0.6s ease'
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-4xl font-bold text-purple-600">{percentage}%</div>
              </div>
            </div>

            {/* Status Display */}
            <div className="flex flex-col items-center gap-2">
              <div className={`text-4xl font-bold ${isPassed ? 'text-teal-600' : 'text-red-600'}`}>
                {isPassed ? '✓ PASS' : '✗ FAIL'}
              </div>
              <div className="text-sm text-gray-500 font-medium uppercase">Kết quả</div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="border-t-2 border-gray-200 grid grid-cols-2 gap-4 md:grid-cols-4 px-10 py-8">
            <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 uppercase font-semibold">Câu đúng</div>
              <div className="text-2xl font-bold text-teal-600">{correctCount}</div>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 uppercase font-semibold">Câu sai</div>
              <div className="text-2xl font-bold text-red-600">{session.totalQuestions - correctCount}</div>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 uppercase font-semibold">Tổng câu</div>
              <div className="text-2xl font-bold text-gray-700">{session.totalQuestions}</div>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 uppercase font-semibold">Thời gian</div>
              <div className="text-2xl font-bold text-gray-700">
                {participantData.completedAt
                  ? Math.round(
                      (participantData.completedAt.getTime() - session.startTime.getTime()) / 1000 / 60
                    ) + ' phút'
                  : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* AI Analysis Card */}
        {(aiAnalysis || loadingAnalysis) && (
          <div className="bg-white rounded-3xl p-8 mb-8 border-l-4 border-purple-600 shadow-lg animate-in slide-in-from-bottom duration-500 delay-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl">🤖</div>
              <h2 className="text-2xl font-bold text-gray-800">Nhận xét từ AI</h2>
            </div>

            {loadingAnalysis ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                <p className="text-gray-600 text-center">AI đang phân tích kết quả của bạn...</p>
              </div>
            ) : aiAnalysis ? (
              <div className="p-5 bg-gray-50 rounded-lg">
                <p className="text-gray-700 leading-relaxed">{aiAnalysis}</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full p-5 bg-white border-2 border-gray-300 rounded-3xl text-lg font-semibold text-purple-600 cursor-pointer transition-all hover:bg-gray-50 hover:border-purple-600 hover:shadow-lg hover:-translate-y-1 mb-8"
        >
          {showDetails ? '▼' : '▶'} Xem chi tiết câu trả lời ({correctCount}/{session.totalQuestions} đúng)
        </button>

        {/* Details Section */}
        {showDetails && (
          <div className="bg-white rounded-3xl p-5 shadow-lg mb-8 animate-in">
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
                  className={`mb-4 rounded-lg overflow-hidden border-2 transition-all ${
                    answerData.isCorrect
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div
                    className="flex justify-between items-center p-5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() =>
                      setExpandedQuestions({
                        ...expandedQuestions,
                        [questionIndex]: !isExpanded
                      })
                    }
                  >
                    <div className="text-lg font-semibold text-gray-800">
                      {answerData.isCorrect ? '✓' : '✗'} Câu {questionIndex + 1}
                    </div>
                    <div className="text-gray-600">{isExpanded ? '▼' : '▶'}</div>
                  </div>

                  {isExpanded && (
                    <div className="p-6 animate-in">
                      <div className="text-lg font-semibold text-gray-800 mb-5 pb-5 border-b-2 border-gray-200">
                        {question.text || question.question}
                      </div>

                      <div className="space-y-3 mb-5">
                        {(question.options || []).map((option, oIdx) => {
                          const isSelected = answerData.answer === oIdx;
                          const isCorrectAnswer = oIdx === question.correctAnswerIndex;

                          return (
                            <div
                              key={oIdx}
                              className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                                isCorrectAnswer
                                  ? 'border-teal-500 bg-teal-50'
                                  : isSelected
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              <span
                                className={`flex items-center justify-center w-9 h-9 rounded-lg font-bold text-white text-sm flex-shrink-0 ${
                                  isCorrectAnswer
                                    ? 'bg-gradient-to-br from-teal-500 to-green-600'
                                    : 'bg-gradient-to-br from-purple-600 to-purple-700'
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="flex-1 text-gray-700 text-sm leading-relaxed">{option}</span>
                              {isCorrectAnswer && (
                                <span className="px-3 py-1 bg-teal-600 text-white rounded-lg text-xs font-semibold flex-shrink-0">
                                  ✓ Đúng
                                </span>
                              )}
                              {isSelected && !isCorrectAnswer && (
                                <span className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold flex-shrink-0">
                                  ✗ Bạn chọn
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {question.explanation && (
                        <div className="p-4 bg-gray-50 border-l-4 border-purple-600 rounded-lg">
                          <h4 className="text-sm font-bold text-gray-800 uppercase mb-2">Giải thích:</h4>
                          <p className="text-gray-700 leading-relaxed text-sm">{question.explanation}</p>
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
        <div className="grid grid-cols-2 gap-5 pb-5 md:grid-cols-2 sm:grid-cols-1">
          <button
            onClick={() => navigate('/student')}
            className="px-6 py-3 bg-white text-purple-600 border-2 border-purple-600 rounded-lg font-semibold transition-all hover:bg-gray-50 hover:-translate-y-1 hover:shadow-lg"
          >
            ← Quay lại Dashboard
          </button>
          <button
            onClick={() => navigate('/student/class-selection')}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            Làm bài khác →
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentExamResultPage;
