import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import examSessionService from '../../services/examSessionService';
import examService from '../../services/examService';
import scoringService from '../../services/scoringService';

/**
 * StudentExamPage
 * Trang làm bài thi với:
 * - Timer realtime 7 phút (đồng bộ từ server)
 * - Câu hỏi kiểu Quizizz (one question per screen)
 * - Cập nhật điểm realtime khi trả lời đúng
 * - Tự động hoàn thành khi hết giờ
 */

const StudentExamPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { sessionId } = useParams();

  // Session & Exam state
  const [session, setSession] = useState(null);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Exam state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionIndex: { answer: number|array, isCorrect, timeUsed } }
  const [selectedAnswer, setSelectedAnswer] = useState(null); // For single choice: number, for multiple: array
  const [isAnswered, setIsAnswered] = useState(false);

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(420); // 7 minutes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Refs
  const timerRef = useRef(null);
  const sessionStartTimeRef = useRef(null);

  // Lắng nghe session realtime
  useEffect(() => {
    if (!sessionId) {
      setError('Không tìm thấy ID phiên thi');
      setLoading(false);
      return;
    }

    let unsubscribe;

    const subscribeToSession = async () => {
      try {
        unsubscribe = examSessionService.subscribeToExamSession(
          sessionId,
          async (sessionData) => {
            if (sessionData) {
              setSession(sessionData);
              sessionStartTimeRef.current = sessionData.startTime;

              // Khôi phục answers từ session (nếu refresh page)
              if (user?.uid && sessionData.participants?.[user.uid]) {
                const participantData = sessionData.participants[user.uid];
                if (participantData.answers && participantData.answers.length > 0) {
                  // Chuyển array answers thành object { index: answerData }
                  const answersMap = {};
                  participantData.answers.forEach((answer, idx) => {
                    const qIndex = answer.questionIndex !== undefined ? answer.questionIndex : idx;
                    answersMap[qIndex] = answer;
                    console.log(`📝 Answer ${qIndex}:`, answer);
                  });
                  setAnswers(answersMap);
                  console.log('✅ Restored answers from session:', answersMap);
                  console.log('Total answers restored:', Object.keys(answersMap).length);
                }
              }

              // Lấy dữ liệu đề thi nếu chưa có
              if (!exam && sessionData.examId) {
                try {
                  const examData = await examService.getExamById(sessionData.examId);
                  setExam(examData);

                  // Lấy danh sách câu hỏi với context từ exercise
                  if (examData.exercises && examData.exercises.length > 0) {
                    const allQuestions = [];
                    examData.exercises.forEach((exercise, exerciseIndex) => {
                      if (exercise.questions && exercise.questions.length > 0) {
                        exercise.questions.forEach((question) => {
                          allQuestions.push({
                            ...question,
                            exerciseContext: exercise.context || '',
                            exerciseId: exercise.id,
                            exerciseIndex
                          });
                        });
                      }
                    });
                    setQuestions(allQuestions);
                  }
                } catch (err) {
                  console.error('Error loading exam:', err);
                  setError('Không thể tải đề thi');
                }
              }

              setLoading(false);
            } else {
              setError('Phiên thi không tồn tại');
              setLoading(false);
            }
          }
        );
      } catch (err) {
        console.error('Error subscribing to session:', err);
        setError('Lỗi khi kết nối phiên thi');
        setLoading(false);
      }
    };

    subscribeToSession();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sessionId, exam, user?.uid]);
  // Handler: Nộp bài
  const handleAutoSubmit = useCallback(async () => {
    if (isCompleted || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Tính tổng điểm từ các câu đã trả lời
      const correctAnswers = Object.values(answers).filter((a) => a.isCorrect).length;
      const totalScore = Object.values(answers).reduce((sum, answer) => {
        return sum + (answer.points || 0);
      }, 0);

      // Hoàn thành exam cho học sinh
      if (user?.uid) {
        await examSessionService.completeExamForStudent(sessionId, user.uid, {
          score: totalScore,
          correctAnswers,
          answers: answers,
          totalQuestions: questions.length
        });
      }

      setIsCompleted(true);

      // Chuyển đến trang kết quả sau 2 giây
      setTimeout(() => {
        navigate(`/student/exam-result/${sessionId}`);
      }, 2000);
    } catch (err) {
      console.error('Error submitting exam:', err);
      setError('Lỗi khi nộp bài');
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, sessionId, user?.uid, isCompleted, isSubmitting, questions.length, navigate]);

  // Handler: Câu hỏi tiếp theo
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      // Load câu trả lời cũ nếu có
      const nextAnswer = answers[nextIdx];
      if (nextAnswer) {
        setSelectedAnswer(nextAnswer.answer || null);
        setIsAnswered(true);
      } else {
        setSelectedAnswer(null);
        setIsAnswered(false);
      }
    }
  };

  // Handler: Quay lại câu trước
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevIdx = currentQuestionIndex - 1;
      setCurrentQuestionIndex(prevIdx);
      // Load câu trả lời cũ nếu có
      const prevAnswer = answers[prevIdx];
      if (prevAnswer) {
        setSelectedAnswer(prevAnswer.answer || null);
        setIsAnswered(true);
      } else {
        setSelectedAnswer(null);
        setIsAnswered(false);
      }
    }
  };

  // Effect: Khi currentQuestionIndex thay đổi, load lại câu trả lời cũ nếu có
  useEffect(() => {
    const currentAnswer = answers[currentQuestionIndex];
    if (currentAnswer && currentAnswer.answer !== undefined) {
      // Load answer từ state
      setSelectedAnswer(currentAnswer.answer);
      // Nếu có isCorrect trong state, có nghĩa câu này đã được xử lý (single choice hoặc submitted multiple choice)
      // Nếu không, chỉ là draft (multiple choice chưa submit)
      const hasBeenProcessed = currentAnswer.isCorrect !== undefined && currentAnswer.isCorrect !== false;
      const currentQuestion = questions[currentQuestionIndex];
      const isMultipleChoice = currentQuestion?.type === 'multiple';
      
      if (isMultipleChoice && !hasBeenProcessed) {
        // Multiple choice draft - không mark as answered
        setIsAnswered(false);
      } else {
        // Single choice hoặc submitted multiple choice
        setIsAnswered(true);
      }
    } else {
      setSelectedAnswer(null);
      setIsAnswered(false);
    }
  }, [currentQuestionIndex, answers, questions]);

  // Timer (đồng bộ từ server startTime)
  useEffect(() => {
    if (!session || !session.startTime || isCompleted || session.status !== 'ongoing') {
      return;
    }

    const updateTimer = () => {
      const remaining = session.getRemainingSeconds();

      if (remaining <= 0) {
        setTimeRemaining(0);
        if (!isCompleted) {
          handleAutoSubmit();
        }
      } else {
        setTimeRemaining(remaining);
      }
    };

    updateTimer();

    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, isCompleted, handleAutoSubmit]);

  // Handler: Trả lời câu hỏi
  const handleSelectAnswer = (optionIndex) => {
    if (isAnswered || isCompleted) return;

    const currentQuestion = questions[currentQuestionIndex];
    const isMultipleChoice = currentQuestion.type === 'multiple';

    let newSelectedAnswer;
    let newAnswers;

    if (isMultipleChoice) {
      // For multiple choice: toggle the option (don't check isCorrect yet)
      newSelectedAnswer = Array.isArray(selectedAnswer) ? [...selectedAnswer] : [];
      const idx = newSelectedAnswer.indexOf(optionIndex);
      if (idx > -1) {
        newSelectedAnswer.splice(idx, 1);
      } else {
        newSelectedAnswer.push(optionIndex);
      }
      setSelectedAnswer(newSelectedAnswer);

      // Only update state, don't check isCorrect yet (will check on submit)
      newAnswers = {
        ...answers,
        [currentQuestionIndex]: {
          questionIndex: currentQuestionIndex,
          answer: newSelectedAnswer,
          isCorrect: false, // Placeholder, will be determined on submit
          timeUsed: 420 - timeRemaining
        }
      };
      setAnswers(newAnswers);
      console.log(`📝 Multiple choice updated for question ${currentQuestionIndex}:`, newAnswers[currentQuestionIndex]);
    } else {
      // For single choice: only one answer
      setSelectedAnswer(optionIndex);
      setIsAnswered(true);

      // Check if correct
      const isCorrect = (currentQuestion.correctAnswers || []).includes(optionIndex);
      const exerciseIndex = currentQuestion.exerciseIndex || 0;

      // Tính điểm
      const scoreData = scoringService.calculateQuestionScore(
        exerciseIndex,
        isCorrect,
        420 - timeRemaining
      );

      newAnswers = {
        ...answers,
        [currentQuestionIndex]: {
          questionIndex: currentQuestionIndex,
          answer: optionIndex,
          isCorrect,
          timeUsed: 420 - timeRemaining,
          points: scoreData.totalPoints,
          basePoints: scoreData.basePoints,
          bonusPoints: scoreData.bonusPoints
        }
      };

      setAnswers(newAnswers);
      console.log(`✏️ Answer saved to state for question ${currentQuestionIndex}:`, newAnswers[currentQuestionIndex]);

      // Cập nhật lên Firestore
      if (user?.uid) {
        const answerDataToSubmit = {
          questionId: currentQuestion.id,
          questionIndex: currentQuestionIndex,
          answer: optionIndex,
          isCorrect,
          exerciseIndex,
          points: scoreData.totalPoints,
          basePoints: scoreData.basePoints,
          bonusPoints: scoreData.bonusPoints,
          timeUsed: 420 - timeRemaining
        };
        console.log(`📤 Submitting answer for question ${currentQuestionIndex}:`, answerDataToSubmit);
        examSessionService
          .submitAnswer(sessionId, user.uid, answerDataToSubmit)
          .catch((err) => console.error('Error submitting answer:', err));
      }

      // Auto next sau 1 giây
      setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
          handleNextQuestion();
        } else {
          handleAutoSubmit();
        }
      }, 1500);
    }
  };

  // Handler: Submit multiple choice answer
  const handleSubmitMultipleChoice = () => {
    if (isCompleted) return;

    const currentQuestion = questions[currentQuestionIndex];
    const selectedAnswers = Array.isArray(selectedAnswer) ? selectedAnswer : [];
    const exerciseIndex = currentQuestion.exerciseIndex || 0;

    // Recompute isCorrect từ dữ liệu thực tế
    const correctAnswersSet = new Set(currentQuestion.correctAnswers || []);
    const selectedSet = new Set(selectedAnswers);
    const isCorrect =
      correctAnswersSet.size > 0 &&
      correctAnswersSet.size === selectedSet.size &&
      Array.from(correctAnswersSet).every((idx) => selectedSet.has(idx));

    // Tính điểm cho multiple choice
    const scoreData = scoringService.calculateQuestionScore(
      exerciseIndex,
      isCorrect,
      420 - timeRemaining
    );

    // Cập nhật answers state với điểm
    const newAnswers = {
      ...answers,
      [currentQuestionIndex]: {
        ...answers[currentQuestionIndex],
        questionIndex: currentQuestionIndex,
        isCorrect,
        points: scoreData.totalPoints,
        basePoints: scoreData.basePoints,
        bonusPoints: scoreData.bonusPoints
      }
    };
    setAnswers(newAnswers);
    setIsAnswered(true);

    // Gửi lên Firestore
    console.log(`📤 Submitting multiple choice for question ${currentQuestionIndex}, user:`, user?.uid);
    if (user?.uid) {
      examSessionService
        .submitAnswer(sessionId, user.uid, {
          questionId: currentQuestion.id,
          questionIndex: currentQuestionIndex,
          answer: selectedAnswers,
          isCorrect,
          exerciseIndex,
          points: scoreData.totalPoints,
          basePoints: scoreData.basePoints,
          bonusPoints: scoreData.bonusPoints,
          timeUsed: 420 - timeRemaining
        })
        .catch((err) => console.error('Error submitting answer:', err));
    } else {
      console.warn('❌ User UID not available, answer not submitted to Firestore');
    }

    // Auto next sau 1 giây
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        handleNextQuestion();
      } else {
        handleAutoSubmit();
      }
    }, 1500);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-white rounded-full animate-spin"></div>
          <p className="text-white text-lg font-medium">Đang tải bài thi...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">⚠️</div>
          <h2 className="text-white text-2xl font-bold">{error}</h2>
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

  if (!session || !exam || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex items-center justify-center pt-20">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-white rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Completed state
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-8 bg-white rounded-3xl p-10 shadow-2xl">
          <div className="text-7xl">✅</div>
          <h2 className="text-2xl font-bold text-gray-800">Bài thi của bạn đã hoàn thành!</h2>
          <p className="text-gray-600">Đang chuyển đến trang kết quả...</p>
          <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;

  // Format time
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Time warning
  const isTimeWarning = timeRemaining < 60 && timeRemaining > 0;
  const isTimeRunningOut = timeRemaining === 0;

  // Question navigation
  const canGoPrev = currentQuestionIndex > 0;

  // UI Rendering
  if (loading) {
    return (
      <div className="student-exam-page loading-state">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Đang tải bài thi...</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="student-exam-page error-state">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>{error}</h2>
          <button className="btn-back" onClick={() => navigate(-1)}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!session || !exam || questions.length === 0) {
    return (
      <div className="student-exam-page">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="student-exam-page completed-state">
        <div className="completed-container">
          <div className="completed-icon">✅</div>
          <h2>Bài thi của bạn đã hoàn thành!</h2>
          <p>Đang chuyển đến trang kết quả...</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="max-w-7xl mx-auto px-5 py-8">
        {/* Header Bar with Timer */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 flex items-center justify-between gap-6 flex-wrap md:flex-nowrap">
          {/* Timer */}
          <div
            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-lg transition-all ${
              isTimeRunningOut
                ? 'bg-red-100 text-red-700 animate-pulse'
                : isTimeWarning
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-purple-100 text-purple-700'
            }`}
          >
            <span className="text-2xl">⏱️</span>
            <div>
              <div className="text-xl">{timeText}</div>
              <div className="text-xs opacity-75">Thời gian còn lại</div>
            </div>
          </div>

          {/* Progress */}
          <div className="flex-1 min-w-[200px]">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
              <div
                className="bg-gradient-to-r from-purple-600 to-purple-700 h-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div className="text-center text-sm font-semibold text-white">
              Câu {currentQuestionIndex + 1} / {questions.length}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleAutoSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isSubmitting ? '⏳ Đang nộp...' : '✓ Nộp bài'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Question List */}
          <aside className="lg:col-span-1 bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Danh sách câu hỏi</h3>

            <div className="grid grid-cols-5 gap-2 mb-8">
              {questions.map((_, idx) => {
                const isCurrentQuestion = idx === currentQuestionIndex;
                const answerData = answers[idx];
                const isAnswered = answerData !== undefined;
                const isCorrect = answerData?.isCorrect || false;

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isAnswered) {
                        setCurrentQuestionIndex(idx);
                      }
                    }}
                    disabled={isAnswered}
                    title={`Câu ${idx + 1}${isAnswered ? ' (Đã trả lời)' : ''}`}
                    className={`w-10 h-10 rounded-lg font-bold text-sm transition-all flex items-center justify-center relative ${
                      isCurrentQuestion
                        ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white scale-110 shadow-lg'
                        : isAnswered
                        ? isCorrect
                          ? 'bg-green-100 text-green-700 cursor-not-allowed'
                          : 'bg-red-100 text-red-700 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer'
                    }`}
                  >
                    {idx + 1}
                    {isAnswered && (
                      <span className={`absolute -top-1 -right-1 text-xs rounded-full w-5 h-5 flex items-center justify-center ${
                        isCorrect
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}>
                        {isCorrect ? '✓' : '✕'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="border-t-2 border-gray-200 pt-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Đã trả lời:</span>
                <span className="text-lg font-bold text-purple-600">{Object.keys(answers).length}/{questions.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Câu đúng:</span>
                <span className="text-lg font-bold text-green-600">{correctCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Điểm hiện tại:</span>
                <span className="text-lg font-bold text-blue-600">
                  {Object.values(answers).reduce((sum, answer) => {
                    return sum + (answer.points || 0);
                  }, 0)}
                </span>
              </div>
            </div>
          </aside>

          {/* Main Question Area */}
          <main className="lg:col-span-3">
            {currentQuestion && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                {/* Exercise Context (if available) */}
                {currentQuestion.exerciseContext && (
                  <div className="mb-8 p-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
                    <p className="text-blue-900 leading-relaxed whitespace-pre-wrap">
                      {currentQuestion.exerciseContext}
                    </p>
                  </div>
                )}

                {/* Question Text */}
                <div className="mb-10">
                  <h2 className="text-2xl font-bold text-gray-800 leading-relaxed">
                    {currentQuestion.text || currentQuestion.question}
                  </h2>
                </div>

                {/* Options */}
                <div className="space-y-4 mb-10">
                  {(currentQuestion.options || []).map((option, idx) => {
                    const isMultipleChoice = currentQuestion.type === 'multiple';
                    const isSelected = isMultipleChoice
                      ? (Array.isArray(selectedAnswer) ? selectedAnswer.includes(idx) : false)
                      : (selectedAnswer === idx);
                    const isCorrectAnswer = (currentQuestion.correctAnswers || []).includes(idx);
                    let buttonClass =
                      'w-full flex items-center gap-4 p-5 rounded-lg border-2 transition-all text-left font-medium ';

                    if (isAnswered) {
                      if (isSelected && isCorrectAnswer) {
                        buttonClass += 'border-green-500 bg-green-50 text-green-700 ';
                      } else if (isSelected && !isCorrectAnswer) {
                        buttonClass += 'border-red-500 bg-red-50 text-red-700 ';
                      } else if (isCorrectAnswer) {
                        // Chỉ hiển thị đáp án đúng sau khi học sinh trả lời
                        buttonClass += 'border-green-500 bg-green-50 text-green-700 ';
                      } else {
                        buttonClass += 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed ';
                      }
                    } else {
                      if (isSelected) {
                        buttonClass +=
                          'border-purple-600 bg-purple-50 text-purple-700 cursor-pointer hover:shadow-lg ';
                      } else {
                        buttonClass +=
                          'border-gray-300 bg-white text-gray-800 cursor-pointer hover:border-purple-400 hover:shadow-lg ';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => !isAnswered && handleSelectAnswer(idx)}
                        disabled={isAnswered}
                        className={buttonClass}
                      >
                        <span
                          className={`flex items-center justify-center w-10 h-10 rounded-lg font-bold text-white flex-shrink-0 ${
                            isAnswered && isCorrectAnswer
                              ? 'bg-green-600'
                              : isAnswered && isSelected && !isCorrectAnswer
                              ? 'bg-red-600'
                              : 'bg-gradient-to-br from-purple-600 to-purple-700'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1">{option}</span>
                        {isAnswered && isCorrectAnswer && (
                          <span className="text-2xl font-bold">✓</span>
                        )}
                        {isAnswered && isSelected && !isCorrectAnswer && (
                          <span className="text-2xl font-bold">✗</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Feedback */}
                {isAnswered && (() => {
                  const answerData = answers[currentQuestionIndex];
                  const answeredCorrectly = answerData?.isCorrect || false;
                  return (
                    <div
                      className={`flex items-center gap-4 p-6 rounded-lg mb-8 ${
                        answeredCorrectly
                          ? 'bg-green-50 border-2 border-green-500'
                          : 'bg-red-50 border-2 border-red-500'
                      }`}
                    >
                      <span className="text-4xl">
                        {answeredCorrectly ? '🎉' : '❌'}
                      </span>
                      <div className="text-lg font-bold text-gray-800">
                        {answeredCorrectly
                          ? 'Câu trả lời chính xác!'
                          : 'Câu trả lời không chính xác.'}
                      </div>
                    </div>
                  );
                })()}

                {/* Multiple Choice Submit Button */}
                {currentQuestion.type === 'multiple' && !isAnswered && selectedAnswer && selectedAnswer.length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={handleSubmitMultipleChoice}
                      className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:shadow-lg transition-all"
                    >
                      Xác nhận đáp án
                    </button>
                  </div>
                )}

                {/* Navigation */}
                {isAnswered && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handlePrevQuestion}
                      disabled={!canGoPrev}
                      className="px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Câu trước
                    </button>

                    {currentQuestionIndex < questions.length - 1 ? (
                      <button
                        onClick={handleNextQuestion}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                      >
                        Câu tiếp theo →
                      </button>
                    ) : (
                      <button
                        onClick={handleAutoSubmit}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                      >
                        Nộp bài ✓
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Error Message */}
        {error && (
          <div className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 max-w-xs animate-in">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-xl font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Time Warning */}
        {isTimeWarning && !isTimeRunningOut && (
          <div className="fixed bottom-6 left-6 bg-yellow-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 max-w-xs animate-in">
            <span>⏰ Thời gian sắp hết! Vui lòng hoàn thành bài thi nhanh chóng.</span>
          </div>
        )}

        {isTimeRunningOut && (
          <div className="fixed bottom-6 left-6 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 max-w-xs animate-in animate-pulse">
            <span>🚨 Hết giờ! Bài thi sẽ được nộp tự động.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentExamPage;
