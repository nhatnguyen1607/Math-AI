import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import studentService from '../../services/student/studentService';
import StudentHeader from '../../components/student/StudentHeader';

const StudentExamPage = () => {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'student') {
          navigate('/login');
        } else {
          setUser(currentUser);
        }
      } catch (error) {
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    loadExamData();
  }, [examId]);

  const loadExamData = async () => {
    try {
      const examData = await studentService.getExamById(examId);
      setExam(examData);
      setTimeLeft(examData.duration * 60); // Convert minutes to seconds
      setLoading(false);
    } catch (error) {
      console.error('Error loading exam:', error);
      alert('Lỗi khi tải đề thi');
      navigate('/student');
    }
  };

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 && exam) {
      handleSubmitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, exam]);

  const handleSelectAnswer = (questionIndex, answerIndex) => {
    setAnswers({
      ...answers,
      [questionIndex]: answerIndex
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestion < exam.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleGoToQuestion = (index) => {
    setCurrentQuestion(index);
  };

  const handleSubmitExam = async () => {
    if (submitting) return;

    setSubmitting(true);
    try {
      // Tính điểm
      let correctCount = 0;
      exam.questions.forEach((question, index) => {
        if (answers[index] === question.correctAnswer) {
          correctCount++;
        }
      });

      const score = Math.round((correctCount / exam.questions.length) * 100);
      const passed = score >= exam.passingScore;

      const result = {
        studentId: user.uid,
        studentName: user.displayName,
        examId: exam.id,
        examTitle: exam.title,
        answers,
        correctAnswers: correctCount,
        totalQuestions: exam.questions.length,
        score,
        passed,
        submittedAt: new Date(),
        timeTaken: exam.duration * 60 - timeLeft
      };

      // Lưu kết quả
      await studentService.submitExam(result);
      
      // Chuyển tới trang kết quả
      navigate(`/student/exam-result/${examId}`, { state: { result } });
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Lỗi khi nộp bài');
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const isTimeRunningOut = timeLeft < 60; // Less than 1 minute

  if (loading || !exam) {
    return <div className="min-h-screen flex justify-center items-center text-2xl text-white bg-gradient-to-br from-indigo-500 to-purple-600">Đang tải...</div>;
  }

  const question = exam.questions[currentQuestion];
  const answered = answers.hasOwnProperty(currentQuestion);

  const navItems = [
    { icon: '📝', label: 'Làm Bài: ' + exam.title }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col">
      <StudentHeader user={user} onLogout={() => navigate('/login')} onBack={() => navigate(-1)} navItems={navItems} />

      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[1000] animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-sm w-full mx-4 animate-scale-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Nộp bài thi</h2>
            <p className="text-gray-600 text-base mb-2">Bạn chắc chắn muốn nộp bài?</p>
            <div className="bg-gradient-to-r from-slate-100 to-slate-200 border-l-4 border-indigo-500 rounded-lg p-4 my-5">
              <p className="text-indigo-600 font-bold text-base">
                Bạn đã trả lời {Object.keys(answers).length}/{exam.questions.length} câu
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleSubmitExam}
                disabled={submitting}
              >
                {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
              <button
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
              >
                Tiếp tục làm bài
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        {/* Timer Bar */}
        <div className="sticky top-[72px] z-50 bg-white/10 backdrop-blur-md border-b border-white/20 px-8 py-6 flex justify-between items-center shadow-lg">
          <div className="text-center">
            <div className={`text-4xl font-bold font-mono tracking-widest ${isTimeRunningOut ? 'text-red-300 animate-pulse' : 'text-yellow-100'}`}>
              {formatTime(timeLeft)}
            </div>
            <p className="text-white/80 text-sm font-medium">Thời gian còn lại</p>
          </div>
          <button
            className="bg-red-500/80 hover:bg-red-500 text-white border-2 border-white font-bold py-3 px-6 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg"
            onClick={() => setShowSubmitConfirm(true)}
          >
            Nộp bài
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full">
          {/* Left Sidebar - Question List */}
          <aside className="w-40 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-xl p-5 sticky top-32">
              <h3 className="text-center font-bold text-gray-800 mb-5 text-base">Danh sách câu hỏi</h3>
              
              {/* Question Buttons */}
              <div className="grid grid-cols-5 gap-2 mb-6">
                {exam.questions.map((_, index) => (
                  <button
                    key={index}
                    className={`aspect-square rounded-xl font-bold text-sm transition-all duration-300 transform hover:-translate-y-1 ${
                      currentQuestion === index
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg scale-105'
                        : answers.hasOwnProperty(index)
                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 text-green-700 font-bold shadow-sm hover:shadow-md'
                        : 'bg-white border-2 border-gray-300 text-gray-600 hover:border-indigo-400 hover:shadow-md'
                    }`}
                    onClick={() => handleGoToQuestion(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              {/* Legend */}
              <div className="border-t border-gray-200 pt-4 mb-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-gray-700">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Đã trả lời</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <div className="w-4 h-4 border-2 border-gray-300 rounded"></div>
                  <span>Chưa trả lời</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <div className="w-4 h-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded"></div>
                  <span>Câu hiện tại</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2 px-3 rounded-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg text-xs"
                onClick={() => setShowSubmitConfirm(true)}
              >
                Nộp bài ({Object.keys(answers).length}/{exam.questions.length})
              </button>
            </div>
          </aside>

          {/* Main Content - Question */}
          <main className="flex-1 bg-white rounded-2xl shadow-2xl p-8 flex flex-col">
            {question && (
              <>
                {/* Question Card */}
                <div className="mb-8 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-indigo-100">
                  <h2 className="text-2xl font-bold text-gray-800 leading-relaxed mb-6">
                    {question.question}
                  </h2>

                  {/* Options */}
                  <div className="space-y-3">
                    {question.options.map((option, index) => (
                      <label
                        key={index}
                        className={`flex items-start p-5 rounded-xl cursor-pointer transition-all duration-300 border-2 relative group ${
                          answers[currentQuestion] === index
                            ? 'bg-white border-indigo-500 shadow-lg'
                            : 'bg-white border-gray-300 hover:border-indigo-400 hover:bg-slate-50 hover:shadow-md'
                        }`}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        <input
                          type="radio"
                          name={`question-${currentQuestion}`}
                          value={index}
                          checked={answers[currentQuestion] === index}
                          onChange={() => handleSelectAnswer(currentQuestion, index)}
                          className="w-5 h-5 mt-1 mr-4 flex-shrink-0 cursor-pointer accent-indigo-500"
                        />
                        
                        <div className="flex-1">
                          <span className="font-bold text-indigo-500 text-lg mr-2">
                            {String.fromCharCode(65 + index)}.
                          </span>
                          <span className={`text-gray-700 font-medium transition-colors duration-300 ${
                            answers[currentQuestion] === index ? 'text-indigo-600 font-semibold' : ''
                          }`}>
                            {option}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Explanation Hint */}
                  {question.explanation && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 rounded-lg">
                      <p className="text-indigo-600 font-medium text-sm">💡 Hãy suy nghĩ kỹ trước khi chọn đáp án</p>
                    </div>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-4 justify-center pt-6 border-t border-gray-300 mt-auto">
                  <button
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    onClick={handlePrevQuestion}
                    disabled={currentQuestion === 0}
                  >
                    ← Câu trước
                  </button>
                  <button
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    onClick={handleNextQuestion}
                    disabled={currentQuestion === exam.questions.length - 1}
                  >
                    Câu sau →
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default StudentExamPage;
