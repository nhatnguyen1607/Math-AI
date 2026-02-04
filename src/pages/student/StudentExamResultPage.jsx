import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import authService from '../../services/authService';
import studentService from '../../services/student/studentService';
import StudentHeader from '../../components/student/StudentHeader';

const StudentExamResultPage = () => {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
    // Lấy result từ location state hoặc từ database
    if (location.state?.result) {
      setResult(location.state.result);
      loadExamData();
    } else {
      loadExamDataAndResult();
    }
  }, [examId]);

  const loadExamData = async () => {
    try {
      const examData = await studentService.getExamById(examId);
      setExam(examData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading exam:', error);
      setLoading(false);
    }
  };

  const loadExamDataAndResult = async () => {
    try {
      const [examData, resultData] = await Promise.all([
        studentService.getExamById(examId),
        studentService.getExamResult(examId, user?.uid)
      ]);
      setExam(examData);
      setResult(resultData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleRetakExam = () => {
    navigate(`/student/exam-lobby/${examId}`);
  };

  const handleBackToDashboard = () => {
    navigate('/student');
  };

  if (loading) {
    return <div className="loading">Đang tải kết quả...</div>;
  }

  if (!result || !exam) {
    return (
      <div className="error-page">
        <p>Không tìm thấy kết quả bài thi</p>
        <button className="back-btn" onClick={handleBackToDashboard}>
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  const scorePercentage = result.score;
  const isPassed = result.passed;

  const navItems = [
    { icon: '📊', label: 'Kết Quả: ' + (exam?.title || 'Bài Thi') }
  ];

  return (
    <div className="exam-result-page">
      <StudentHeader user={user} onLogout={() => navigate('/login')} onBack={() => navigate('/student')} navItems={navItems} />

      <div className="result-container">
        {/* Header */}
        <div className={`result-header ${isPassed ? 'passed' : 'failed'}`}>
          <div className="result-icon">
            {isPassed ? '🎉' : '📖'}
          </div>
          <h1>{isPassed ? 'Chúc mừng!' : 'Cố gắng lên!'}</h1>
          <p className="exam-title">{exam.title}</p>
        </div>

        {/* Score Display */}
        <div className="score-section">
          <div className="score-circle">
            <div className="score-number">{result.score}%</div>
            <div className="passing-score">
              Điểm đạt: {exam.passingScore}%
            </div>
          </div>

          <div className="score-details">
            <div className={`detail-item ${result.passed ? 'pass' : 'fail'}`}>
              <span className="detail-label">Kết quả</span>
              <span className="detail-value">
                {result.passed ? '✓ Đạt' : '✗ Không đạt'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Câu đúng</span>
              <span className="detail-value">
                {result.correctAnswers}/{result.totalQuestions}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Thời gian</span>
              <span className="detail-value">
                {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{
              width: `${scorePercentage}%`,
              background: isPassed 
                ? 'linear-gradient(90deg, #26a69a 0%, #2e7d32 100%)'
                : 'linear-gradient(90deg, #ff6b6b 0%, #d32f2f 100%)'
            }}>
            </div>
          </div>
          <p className="progress-text">
            {result.correctAnswers} câu đúng trong {result.totalQuestions} câu
          </p>
        </div>

        {/* Toggle Answers */}
        <div className="toggle-section">
          <button
            className="toggle-btn"
            onClick={() => setShowAnswers(!showAnswers)}
          >
            {showAnswers ? '▼' : '▶'} Chi tiết đáp án
          </button>
        </div>

        {/* Detailed Answers */}
        {showAnswers && (
          <div className="answers-section">
            {exam.questions.map((question, index) => {
              const isCorrect = result.answers[index] === question.correctAnswer;
              const userAnswer = result.answers[index];

              return (
                <div key={index} className={`answer-card ${isCorrect ? 'correct' : 'incorrect'}`}>
                  <div className="answer-header">
                    <span className={`question-number ${isCorrect ? 'correct' : 'incorrect'}`}>
                      {isCorrect ? '✓' : '✗'} Câu {index + 1}
                    </span>
                  </div>

                  <div className="question-text">
                    <p>{question.question}</p>
                  </div>

                  <div className="options-display">
                    {question.options.map((option, optIndex) => {
                      const isCorrectOption = optIndex === question.correctAnswer;
                      const isUserChoice = optIndex === userAnswer;

                      return (
                        <div
                          key={optIndex}
                          className={`option-display ${
                            isCorrectOption ? 'correct-answer' : ''
                          } ${
                            isUserChoice && !isCorrect ? 'wrong-answer' : ''
                          }`}
                        >
                          <span className="option-letter">
                            {String.fromCharCode(65 + optIndex)}.
                          </span>
                          <span className="option-content">{option}</span>
                          {isCorrectOption && <span className="badge">✓ Đúng</span>}
                          {isUserChoice && !isCorrect && <span className="badge wrong">✗ Bạn chọn</span>}
                        </div>
                      );
                    })}
                  </div>

                  {question.explanation && (
                    <div className="explanation">
                      <h4>💡 Giải thích:</h4>
                      <p>{question.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="action-buttons">
          <button className="btn-primary" onClick={handleRetakExam}>
            Làm lại bài thi
          </button>
          <button className="btn-secondary" onClick={handleBackToDashboard}>
            Quay lại trang chủ
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentExamResultPage;
