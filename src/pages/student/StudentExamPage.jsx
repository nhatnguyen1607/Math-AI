import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import examSessionService from '../../services/examSessionService';
import examService from '../../services/examService';
import scoringService from '../../services/scoringService';
import geminiService from '../../services/geminiService';
import resultService from '../../services/resultService';

/**
 * StudentExamPage
 * Trang làm bài thi với:
 * - Timer realtime 7 phút (đồng bộ từ server)
 * - Câu hỏi kiểu Quizizz (one question per screen)
 * - Cập nhật điểm realtime khi trả lời đúng
 * - Tự động hoàn thành khi hết giờ
 */

// Helper function: Remove undefined fields từ object trước khi gửi lên Firestore
const cleanFirebaseData = (obj) => {
  const cleaned = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

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
  const draftSaveTimerRef = useRef(null);

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
                  });
                  setAnswers(answersMap);
                }

                // 🔧 Khôi phục currentQuestionIndex từ session
                if (participantData.currentQuestion !== undefined) {
                  setCurrentQuestionIndex(participantData.currentQuestion);
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
                        exercise.questions.forEach((question, qIdx) => {
                          allQuestions.push({
                            ...question,
                            exerciseContext: exercise.context || exercise.name || '',
                            exerciseId: exercise.id,
                            exerciseIndex
                          });
                        });
                      } else {
                      }
                    });
                    setQuestions(allQuestions);
                  } else {
                  }
                } catch (err) {
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
      // Step 1: Use local answers state (all answers have been submitted via submitAnswer())
      // Do NOT use session data - it has update delay
      const answersToValidate = answers;
      
      
      // Step 1b: Re-validate all answers to ensure correctness is evaluated
      // This is important for multiple choice questions which were marked as isCorrect: false
      const validatedAnswers = {};
      
      // Step 1.5: Normalize answers to string keys for consistency
      const normalizedAnswers = {};
      Object.keys(answersToValidate).forEach(key => {
        const numKey = String(parseInt(key));
        normalizedAnswers[numKey] = answersToValidate[key];
      });
            
      // 🔧 IMPORTANT: Iterate through ALL questions (0 to questions.length-1)
      // NOT just answers.keys(), because some answers might be missing
      for (let idx = 0; idx < questions.length; idx++) {
        const idxStr = String(idx);
        const answer = normalizedAnswers[idxStr];
        const question = questions[idx];
        
        if (!question) {
          continue; // Skip to next iteration
        }
        
        if (!answer) {
          // Still create entry with unanswered marker
          validatedAnswers[idxStr] = {
            questionIndex: idx,
            answer: null,
            isCorrect: false,
            points: 0,
            timeUsed: 0
          };
          continue;
        }

        // Get correct answers - check both singular and plural fields
        let correctAnswersArray = question.correctAnswers || [];
        if (!correctAnswersArray.length && question.correctAnswer !== undefined) {
          // If correctAnswers is empty but correctAnswer exists, use the singular form
          correctAnswersArray = Array.isArray(question.correctAnswer) 
            ? question.correctAnswer 
            : [question.correctAnswer];
        }
        
        const correctAnswersSet = new Set(correctAnswersArray);
        let isCorrect = false;

        if (Array.isArray(answer.answer)) {
          // Multiple choice question
          const selectedSet = new Set(answer.answer);
          isCorrect = correctAnswersSet.size > 0 &&
            correctAnswersSet.size === selectedSet.size &&
            Array.from(correctAnswersSet).every((idx) => selectedSet.has(idx));
          
          if (idx === questions.length - 1) {
          }
        } else {
          // Single choice question
          isCorrect = correctAnswersSet.has(answer.answer);
          
          if (idx === questions.length - 1) {
          }
        }

        // Calculate points if not already done (for multiple choice)
        let points = answer.points || 0;
        if (!answer.points && isCorrect) {
          const exerciseIndex = question.exerciseIndex || 0;
          const scoreData = scoringService.calculateQuestionScore(
            exerciseIndex,
            isCorrect,
            answer.timeUsed || 0
          );
          points = scoreData.totalPoints;
        }

        validatedAnswers[idxStr] = {
          ...answer,
          isCorrect,
          points
        };
      }

      // Step 2: Calculate total score and correct answers from validated data
      const correctAnswers = Object.values(validatedAnswers).filter((a) => a.isCorrect).length;
      const totalScore = Object.values(validatedAnswers).reduce((sum, answer) => {
        return sum + (answer.points || 0);
      }, 0);
      


      // Normalize answers to an ordered array before saving to Firestore
      const answersArray = Object.keys(validatedAnswers)
        .map(k => ({ index: parseInt(k, 10), ...validatedAnswers[k] }))
        .sort((a, b) => a.index - b.index)
        .map(({ index, ...rest }) => rest);

      // Hoàn thành exam cho học sinh
      if (user?.uid) {
        try {
          await examSessionService.completeExamForStudent(sessionId, user.uid, {
            score: totalScore,
            correctAnswers,
            answers: answersArray,
            totalQuestions: questions.length
          });
        } catch (writeErr) {
          console.error('completeExamForStudent error:', writeErr);
          throw writeErr;
        }
      }

      // 1. Gọi AI Đánh giá năng lực (Dùng evaluateCompetencyFramework - 4 TC mới)
      let competencyEvaluation = null;
      let aiAnalysis = null;
      try {
        // Call Gemini to evaluate competency using the 4-criterion framework
        const [questionComments, competencyEval] = await Promise.all([
          geminiService.evaluateQuestionComments(validatedAnswers, questions),
          geminiService.evaluateCompetencyFramework(Object.values(validatedAnswers), questions)
        ]);

        // 🤖 Generate overall assessment from competency evaluation
        const overallAssessment = await geminiService.generateOverallAssessment(competencyEval);
        
        // Structure aiAnalysis with questionComments and overallAssessment
        aiAnalysis = {
          questionComments: questionComments || [],
          overallAssessment: overallAssessment
        };

        // Add overallAssessment to competencyEvaluation
        competencyEvaluation = competencyEval || {
          overallAssessment: {
            level: 'Cần cố gắng',
            score: 0
          },
          competenceAssessment: {}
        };
        
        if (!competencyEvaluation.overallAssessment) {
          competencyEvaluation.overallAssessment = {};
        }
        competencyEvaluation.overallAssessment.strengths = overallAssessment.strengths || [];
        competencyEvaluation.overallAssessment.weaknesses = overallAssessment.weaknesses || [];
        competencyEvaluation.overallAssessment.recommendations = overallAssessment.recommendations || [];
        competencyEvaluation.overallAssessment.encouragement = overallAssessment.encouragement || '';
      } catch (compError) {
        competencyEvaluation = {
          overallAssessment: {
            level: 'Cần cố gắng',
            score: 0
          },
          competenceAssessment: {}
        };
        aiAnalysis = { questionComments: [] };
      }

      // 2. Validate competency evaluation with percentage from actual answers
      // Ensure consistency between overall score and competency levels
      const percentage = questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0;
      
      // Map percentage to level
      let expectedLevel = 'Cần cố gắng';
      if (percentage >= 80) {
        expectedLevel = 'Tốt';
      } else if (percentage >= 50) {
        expectedLevel = 'Đạt';
      }
      
      // Validate and correct competency evaluation if needed
      if (competencyEvaluation?.overallAssessment) {
        const evalLevel = typeof competencyEvaluation.overallAssessment === 'string' 
          ? competencyEvaluation.overallAssessment 
          : competencyEvaluation.overallAssessment?.level;
        
        // If evaluation doesn't match percentage, log warning but use it
        if (evalLevel !== expectedLevel) {
          // Force correct level based on percentage
          if (competencyEvaluation.overallAssessment?.level !== undefined) {
            competencyEvaluation.overallAssessment.level = expectedLevel;
          }
          if (competencyEvaluation.competenceAssessment) {
            Object.keys(competencyEvaluation.competenceAssessment).forEach(key => {
              if (competencyEvaluation.competenceAssessment[key].level) {
                competencyEvaluation.competenceAssessment[key].level = expectedLevel;
              }
            });
          }
        }
      }

      // 3. Lưu vào tiến trình (Lưu vào parts.khoiDong)
      if (user?.uid && exam?.id) {
        try {
          await resultService.upsertExamProgress(user.uid, exam.id, {
            part: 'khoiDong',
            data: {
              score: totalScore,
              correctAnswers,
              totalQuestions: questions.length,
              percentage: questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0,
              answers: answersArray,
              aiAnalysis: aiAnalysis,
              competencyEvaluation: competencyEvaluation,
              completedAt: new Date().toISOString()
            },
            sessionId // include sessionId for traceability
          });
        } catch (writeErr) {
          console.error('upsertExamProgress error:', writeErr);
          throw writeErr;
        }
      }

      setIsCompleted(true);

      // 3. Chuyển sang trang kết quả (với flag fromExam để hiển thị lời chúc mừng)
      setTimeout(() => {
        navigate(`/student/exam-result/${sessionId}`, {
          state: { fromExam: true, examId: exam?.id }
        });
      }, 2000);
    } catch (err) {
      setError('Lỗi khi nộp bài');
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, sessionId, user?.uid, exam?.id, isCompleted, isSubmitting, questions, navigate]);

  // Handler: Câu hỏi tiếp theo
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      // 🔧 Save currentQuestion to session
      examSessionService.updateCurrentQuestion(sessionId, user?.uid, nextIdx).catch(err => {
      });
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
      // 🔧 Save currentQuestion to session
      examSessionService.updateCurrentQuestion(sessionId, user?.uid, prevIdx).catch(err => {
      });
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
    if (!session || isCompleted) {
      return;
    }

    // Check if session is ready for timer
    if (session.status !== 'ongoing') {
      return;
    }

    if (!session.startTime) {
      // Wait for startTime to be set - don't give up
      // Start a retry timer to check again in 1 second
      const retryTimer = setTimeout(() => {
      }, 1000);
      return () => clearTimeout(retryTimer);
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

    // Initial update
    updateTimer();

    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, isCompleted, handleAutoSubmit]);

  // Auto-save draft answers cho multiple choice questions
  // Mỗi 3 giây, lưu các lựa chọn draft vào Firestore để tránh mất dữ liệu nếu reload
  useEffect(() => {
    if (!user?.uid || isCompleted || !session || !isAnswered) return;

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion || currentQuestion.type !== 'multiple') return;

    const saveDraftAnswer = async () => {
      try {
        const answerData = answers[currentQuestionIndex];
        // Chỉ save draft nếu chưa được submit (isCorrect === false)
        if (answerData && answerData.isCorrect === false) {
          // Lưu draft vào Firestore - không ghi đè score
          const draftData = cleanFirebaseData({
            questionId: currentQuestion?.id,
            questionIndex: currentQuestionIndex,
            answer: answerData.answer || [],
            isDraft: true, // Đánh dấu đây là draft
            exerciseIndex: currentQuestion?.exerciseIndex || 0,
            points: 0,
            basePoints: 0,
            bonusPoints: 0,
            timeUsed: 420 - timeRemaining
          });
          
          await examSessionService.submitAnswer(session.id, user.uid, draftData)
        }
      } catch (error) {
      }
    };

    // Tự động save mỗi 3 giây
    draftSaveTimerRef.current = setInterval(saveDraftAnswer, 3000);

    return () => {
      if (draftSaveTimerRef.current) clearInterval(draftSaveTimerRef.current);
    };
  }, [user?.uid, currentQuestionIndex, answers, questions, isAnswered, isCompleted, timeRemaining, session]);

  // Fallback: if no questions loaded but exam has exercises, try to extract
  useEffect(() => {
    if (questions.length === 0 && exam?.exercises?.length > 0) {
      const fallbackQuestions = [];
      exam.exercises.forEach((exercise, exerciseIndex) => {
        if (exercise.questions && exercise.questions.length > 0) {
          exercise.questions.forEach((q) => {
            fallbackQuestions.push({
              ...q,
              exerciseContext: exercise.context || exercise.name || '',
              exerciseId: exercise.id,
              exerciseIndex
            });
          });
        }
      });
      if (fallbackQuestions.length > 0) {
        setQuestions(fallbackQuestions);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, exam]);

  // Auto-submit when session is finished by teacher or timeout (if not already submitted)
  useEffect(() => {
    if (session?.status === 'finished' && !isCompleted && !isSubmitting) {
      handleAutoSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, isCompleted, isSubmitting]);

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
    } else {
      // For single choice: only one answer
      setSelectedAnswer(optionIndex);
      setIsAnswered(true);

      // Check if correct - handle both correctAnswers (plural) and correctAnswer (singular)
      let correctAnswersArray = currentQuestion.correctAnswers || [];
      if (!correctAnswersArray.length && currentQuestion.correctAnswer !== undefined) {
        correctAnswersArray = Array.isArray(currentQuestion.correctAnswer)
          ? currentQuestion.correctAnswer
          : [currentQuestion.correctAnswer];
      }
      const isCorrect = correctAnswersArray.includes(optionIndex);
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

      // Cập nhật lên Firestore
      if (user?.uid) {
        const answerDataToSubmit = cleanFirebaseData({
          questionId: currentQuestion.id,
          questionIndex: currentQuestionIndex,
          answer: optionIndex,
          isCorrect,
          exerciseIndex,
          points: scoreData.totalPoints,
          basePoints: scoreData.basePoints,
          bonusPoints: scoreData.bonusPoints,
          timeUsed: 420 - timeRemaining
        });
        
        examSessionService
          .submitAnswer(sessionId, user.uid, answerDataToSubmit)
          .then(() => {
          })
          .catch((err) => {
          });
      }
    }
  };

  // Handler: Submit multiple choice answer
  const handleSubmitMultipleChoice = () => {
    if (isCompleted) return;

    const currentQuestion = questions[currentQuestionIndex];
    const selectedAnswers = Array.isArray(selectedAnswer) ? selectedAnswer : [];
    const exerciseIndex = currentQuestion.exerciseIndex || 0;

    // Get correct answers - handle both correctAnswers (plural) and correctAnswer (singular)
    let correctAnswersArray = currentQuestion.correctAnswers || [];
    if (!correctAnswersArray.length && currentQuestion.correctAnswer !== undefined) {
      correctAnswersArray = Array.isArray(currentQuestion.correctAnswer)
        ? currentQuestion.correctAnswer
        : [currentQuestion.correctAnswer];
    }

    // Recompute isCorrect từ dữ liệu thực tế
    const correctAnswersSet = new Set(correctAnswersArray);
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
    if (user?.uid) {
      examSessionService
        .submitAnswer(sessionId, user.uid, cleanFirebaseData({
          questionId: currentQuestion.id,
          questionIndex: currentQuestionIndex,
          answer: selectedAnswers,
          isCorrect,
          isDraft: false, // Đây là câu trả lời chính thức, không phải draft
          exerciseIndex,
          points: scoreData.totalPoints,
          basePoints: scoreData.basePoints,
          bonusPoints: scoreData.bonusPoints,
          timeUsed: 420 - timeRemaining
        }))
    } else {
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="text-6xl animate-bounce-gentle">🚀</div>
          <p className="text-2xl font-bold text-gray-700 font-quicksand">Đang tải bài thi...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">⚠️</div>
          <h2 className="text-gray-800 text-3xl font-bold font-quicksand">{error}</h2>
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


  // --- UI rendering logic ---
  if (!session || !exam || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex items-center justify-center pt-20">
          <div className="text-6xl animate-bounce-gentle">🚀</div>
        </div>
      </div>
    );
  }

  // Completed state
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-8 bg-white rounded-max p-12 shadow-2xl game-card">
          <div className="text-8xl animate-bounce-gentle">✅</div>
          <h2 className="text-4xl font-bold text-gray-800 font-quicksand text-center">Bài thi của bạn đã hoàn thành!</h2>
          <p className="text-xl text-gray-600 font-quicksand">Đang chuyển đến trang kết quả...</p>
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

  if (!session || !exam) {
    return (
      <div className="student-exam-page">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }




  // --- UI rendering logic ---

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="max-w-7xl mx-auto px-5 py-8">
        {/* Rocket Progress Bar */}
        <div className="mb-10 game-card">
          <div className="rocket-progress">
            <div
              className="rocket-progress-fill"
              style={{ width: `${progressPercent}%` }}
            >
              🚀
            </div>
          </div>
          <div className="text-center mt-3 font-bold text-gray-700 font-quicksand">
            Câu {currentQuestionIndex + 1} / {questions.length}
          </div>
        </div>

        {/* Header Bar with Timer */}
        <div className="bg-white rounded-max shadow-lg p-6 mb-8 flex items-center justify-between gap-6 flex-wrap md:flex-nowrap game-card">
          {/* Timer or Loading State */}
          {isSubmitting ? (
            <div className="flex items-center gap-3 px-6 py-3 rounded-max font-bold text-lg bg-blue-200 text-blue-700">
              <span className="text-3xl animate-spin">⏳</span>
              <div className="font-quicksand">
                <div className="text-2xl">Đang nộp bài...</div>
                <div className="text-xs opacity-75">Vui lòng chờ</div>
              </div>
            </div>
          ) : (
            <div
              className={`flex items-center gap-3 px-6 py-3 rounded-max font-bold text-lg transition-all ${
                isTimeRunningOut
                  ? 'bg-red-200 text-red-700 animate-pulse'
                  : isTimeWarning
                  ? 'bg-yellow-200 text-yellow-700'
                  : 'bg-blue-200 text-blue-700'
              }`}
            >
              <span className="text-3xl">⏱️</span>
              <div className="font-quicksand">
                <div className="text-2xl">{timeText}</div>
                <div className="text-xs opacity-75">Thời gian còn lại</div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 font-quicksand">{correctCount}</div>
              <div className="text-sm text-gray-600 font-quicksand">Câu đúng</div>
            </div>
            <div className="border-l border-gray-300"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 font-quicksand">
                {Object.values(answers).reduce((sum, answer) => sum + (answer.points || 0), 0)}
              </div>
              <div className="text-sm text-gray-600 font-quicksand">Điểm</div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleAutoSubmit}
            disabled={isSubmitting}
            className="btn-3d px-8 py-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold rounded-max font-quicksand hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isSubmitting ? '⏳ Đang nộp...' : '✓ Nộp bài'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Question List */}
          <aside className="lg:col-span-1 bg-white rounded-max shadow-lg p-6 game-card">
            <h3 className="text-xl font-bold text-gray-800 mb-6 font-quicksand">Danh sách câu hỏi</h3>

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
                      setCurrentQuestionIndex(idx);
                      // 🔧 Save currentQuestion to session
                      examSessionService.updateCurrentQuestion(sessionId, user?.uid, idx).catch(err => {
                      });
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

            <div className="border-t-2 border-gray-200 pt-6 space-y-3 font-quicksand">
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
              <div className="bg-white rounded-max shadow-lg p-10 game-card">
                {/* Exercise Context (if available) */}
                {currentQuestion.exerciseContext && (
                  <div className="mb-8 p-6 bg-blue-100 border-l-4 border-blue-500 rounded-max">
                    <p className="text-blue-900 leading-relaxed whitespace-pre-wrap font-quicksand">
                      {currentQuestion.exerciseContext}
                    </p>
                  </div>
                )}

                {/* Question Text */}
                <div className="mb-10">
                  <h2 className="text-3xl font-bold text-gray-800 leading-relaxed font-quicksand">
                    {currentQuestion.text || currentQuestion.question || currentQuestion.content}
                  </h2>
                </div>

                {/* Jelly Buttons - Answer Options */}
                <div className="space-y-3 mb-10 w-full">
                  {(currentQuestion.options || []).length === 0 ? (
                    <div className="text-center py-8 text-gray-600">
                      <p>Không có câu trả lời nào cho câu hỏi này</p>
                    </div>
                  ) : (
                    (currentQuestion.options || []).map((option, idx) => {
                      const isMultipleChoice = currentQuestion.type === 'multiple';
                      const isSelected = isMultipleChoice
                        ? (Array.isArray(selectedAnswer) ? selectedAnswer.includes(idx) : false)
                        : (selectedAnswer === idx);
                      const isCorrectAnswer = (currentQuestion.correctAnswers || []).includes(idx);
                      
                      let jellyButtonClass = 'jelly-btn w-full flex items-center justify-between px-6 py-4 ';

                    if (isAnswered) {
                      if (isSelected && isCorrectAnswer) {
                        jellyButtonClass += 'feedback-correct ';
                      } else if (isSelected && !isCorrectAnswer) {
                        jellyButtonClass += 'feedback-wrong ';
                      } else if (isCorrectAnswer) {
                        jellyButtonClass += 'jelly-btn-a opacity-80 ';
                      } else {
                        jellyButtonClass += 'opacity-30 cursor-not-allowed ';
                      }
                    } else {
                      if (idx === 0) jellyButtonClass += 'jelly-btn-a ';
                      else if (idx === 1) jellyButtonClass += 'jelly-btn-b ';
                      else if (idx === 2) jellyButtonClass += 'jelly-btn-c ';
                      else jellyButtonClass += 'jelly-btn-d ';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => !isAnswered && handleSelectAnswer(idx)}
                        disabled={isAnswered}
                        className={jellyButtonClass}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <span className="w-10 h-10 flex-shrink-0 rounded-full bg-white font-bold text-lg flex items-center justify-center">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="text-left text-lg">{option}</span>
                        </div>
                        <div className="flex-shrink-0 ml-4">
                          {isAnswered && isCorrectAnswer && (
                            <span className="text-3xl font-bold">✓</span>
                          )}
                          {isAnswered && isSelected && !isCorrectAnswer && (
                            <span className="text-3xl font-bold">✗</span>
                          )}
                        </div>
                      </button>
                    );
                    })
                  )}
                </div>

                {/* Feedback with Encouragement */}
                {isAnswered && (() => {
                  const answerData = answers[currentQuestionIndex];
                  const answeredCorrectly = answerData?.isCorrect || false;
                  const feedbackMessages = {
                    correct: ['🎉 Tuyệt vời!', '⭐ Xuất sắc!', '🏆 Đúng rồi!', '💪 Siêu tuyệt!'],
                    wrong: ['💪 Cố lên!', '🎯 Lần tới sẽ được!', '📚 Cần ôn tập thêm!', '✨ Tiếp tục nỗ lực!']
                  };
                  const messageKey = answeredCorrectly ? 'correct' : 'wrong';
                  const randomMessage = feedbackMessages[messageKey][Math.floor(Math.random() * feedbackMessages[messageKey].length)];
                  
                  return (
                    <div
                      className={`flex items-center gap-4 p-8 rounded-max mb-8 font-quicksand ${
                        answeredCorrectly
                          ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-3 border-green-400'
                          : 'bg-gradient-to-r from-orange-100 to-yellow-100 border-3 border-orange-400'
                      }`}
                    >
                      <span className="text-5xl animate-bounce-gentle">
                        {answeredCorrectly ? '🎊' : '🌟'}
                      </span>
                      <div>
                        <div className="text-2xl font-bold text-gray-800">
                          {randomMessage}
                        </div>
                        <div className="text-gray-700 mt-1">
                          {answeredCorrectly
                            ? `+${answerData?.points || 0} điểm`
                            : 'Hãy cố gắng hơn ở lần tới!'}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Multiple Choice Submit Button */}
                {currentQuestion.type === 'multiple' && !isAnswered && selectedAnswer && selectedAnswer.length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={handleSubmitMultipleChoice}
                      className="btn-3d w-full px-6 py-4 bg-gradient-to-r from-blue-400 to-blue-500 text-white font-bold rounded-max font-quicksand text-lg"
                    >
                      ✓ Xác nhận đáp án
                    </button>
                  </div>
                )}

                {/* Navigation */}
                {isAnswered && (
                  <div className="grid grid-cols-2 gap-4 font-quicksand">
                    <button
                      onClick={handlePrevQuestion}
                      disabled={!canGoPrev}
                      className="btn-3d px-6 py-4 bg-gray-200 text-gray-800 font-bold rounded-max hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Câu trước
                    </button>

                    {currentQuestionIndex < questions.length - 1 ? (
                      <button
                        onClick={handleNextQuestion}
                        className="btn-3d px-6 py-4 bg-gradient-to-r from-purple-400 to-purple-500 text-white font-bold rounded-max hover:shadow-lg transition-all"
                      >
                        Câu tiếp theo →
                      </button>
                    ) : (
                      <button
                        onClick={handleAutoSubmit}
                        className="btn-3d px-6 py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold rounded-max hover:shadow-lg transition-all"
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
          <div className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-max shadow-lg flex items-center gap-3 max-w-xs animate-in font-quicksand">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-2xl font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Time Warning */}
        {isTimeWarning && !isTimeRunningOut && (
          <div className="fixed bottom-6 left-6 bg-yellow-500 text-white px-6 py-4 rounded-max shadow-lg flex items-center gap-2 max-w-xs animate-in font-quicksand">
            <span>⏰ Thời gian sắp hết! Vui lòng hoàn thành bài thi nhanh chóng.</span>
          </div>
        )}

        {isTimeRunningOut && (
          <div className="fixed bottom-6 left-6 bg-red-600 text-white px-6 py-4 rounded-max shadow-lg flex items-center gap-2 max-w-xs animate-in animate-pulse font-quicksand">
            <span>🚨 Hết giờ! Bài thi sẽ được nộp tự động.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentExamPage;
