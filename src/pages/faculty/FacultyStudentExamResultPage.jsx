import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import authService from '../../services/authService';
import resultService from '../../services/resultService';
import facultyService from '../../services/faculty/facultyService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyStudentExamResultPage = () => {
  const navigate = useNavigate();
  const { examId, userId } = useParams();
  const [exam, setExam] = useState(null);
  const [studentResult, setStudentResult] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('khoiDong');
  const [expandedQuestions, setExpandedQuestions] = useState({});

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'faculty') {
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
    const loadResults = async () => {
      setLoading(true);
      try {
        // Fetch exam data
        const examData = await facultyService.getExamById(examId);
        if (!examData) {
          alert('Không tìm thấy đề thi');
          navigate(`/faculty/exam-results/${examId}`);
          return;
        }
        setExam(examData);

        // Fetch student results using getFinalExamResults
        const result = await resultService.getFinalExamResults(userId, examId);
        if (!result) {
          alert('Không tìm thấy kết quả của học sinh');
          navigate(`/faculty/exam-results/${examId}`);
          return;
        }
        
        setStudentResult(result);

        // Get student info from finalLeaderboard
        const studentData = examData.finalLeaderboard?.find(s => s.uid === userId);
        if (studentData) {
          setStudent(studentData);
        }
      } catch (error) {
        console.error('Error loading student results:', error);
        alert('Lỗi khi tải kết quả');
        navigate(`/faculty/exam-results/${examId}`);
      } finally {
        setLoading(false);
      }
    };

    if (examId && userId) {
      loadResults();
    }
  }, [examId, userId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  if (!exam || !studentResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Không tìm thấy dữ liệu</p>
        </div>
      </div>
    );
  }

  const tabItems = [
    { id: 'khoiDong', label: '🚀 Khởi động', icon: '🚀' }
    // These can be added later
    // { id: 'luyenTap', label: '📝 Luyện tập', icon: '📝' },
    // { id: 'vanDung', label: '⚡ Vận dụng', icon: '⚡' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <FacultyHeader 
        user={user} 
        onLogout={() => navigate('/login')} 
        onBack={() => navigate(`/faculty/exam-results/${examId}`)} 
      />

      <div className="max-w-6xl mx-auto px-5 py-8">
        {/* Page Title */}
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            {student?.medal && <span className="text-4xl">{student.medal}</span>}
            <div>
              <h2 className="text-3xl font-bold">{student?.name || 'Unknown'}</h2>
              <p className="text-purple-100">Xếp hạng: <strong>#{student?.rank || '-'}</strong></p>
            </div>
          </div>
        </div>

        {/* Part Header Section */}
        <div className="mb-8 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-2xl p-8 shadow-lg">
          <h3 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span>🚀</span> Phần Khởi động
          </h3>
          <p className="text-green-50">Nhân số thập phân</p>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Correct Answers Card */}
          <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-8 text-center">
            <div className="text-5xl font-bold text-green-600 mb-2">{studentResult.correctAnswers || 0}</div>
            <div className="text-gray-600 font-semibold mb-1">Câu đúng</div>
            <div className="text-gray-500 text-sm">({studentResult.percentage || 0}%)</div>
          </div>

          {/* Percentage Circle Card */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeDasharray={`${(studentResult.percentage || 0) * 3.14}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-800">{studentResult.percentage || 0}%</span>
              </div>
            </div>
          </div>

          {/* Status Card */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-8 flex flex-col items-center justify-center">
            <div className="text-6xl font-bold text-yellow-500 mb-2">✓</div>
            <div className="text-2xl font-bold text-yellow-600">PASS</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex gap-2 justify-center flex-wrap">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-semibold rounded-full transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeTab === 'khoiDong' && (
          <div className="space-y-8">
            {/* AI Analysis Section */}
            {studentResult.data?.parts?.khoiDong?.aiAnalysis && (
              <div className="bg-white rounded-2xl shadow-lg p-8 border-t-4 border-gray-200">
                <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  <span>📊</span> Đánh giá năng lực (TC1-TC3)
                </h3>
                
                {/* Competence Assessment Cards with Details */}
                {studentResult.data.parts.khoiDong.aiAnalysis.competenceAssessment && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {Object.entries(studentResult.data.parts.khoiDong.aiAnalysis.competenceAssessment).map(([comp, data]) => {
                      const levelText = typeof data === 'string' ? data : data?.level || JSON.stringify(data);
                      const reason = typeof data === 'object' && data?.reason ? data.reason : '';
                      const levelColor = levelText.includes('Tốt') ? 'green' : levelText.includes('Đạt') ? 'yellow' : 'orange';
                      const bgColor = levelColor === 'green' ? 'bg-green-100 border-green-400' : levelColor === 'yellow' ? 'bg-yellow-100 border-yellow-400' : 'bg-orange-100 border-orange-400';
                      const textColor = levelColor === 'green' ? 'text-green-800' : levelColor === 'yellow' ? 'text-yellow-800' : 'text-orange-800';
                      
                      return (
                        <div key={comp} className={`border-2 ${bgColor} rounded-xl p-4 hover:shadow-lg transition-shadow`}>
                          <div className={`text-lg font-bold ${textColor} mb-3`}>{comp}</div>
                          <div className={`text-base ${textColor} font-semibold mb-3`}>{levelText}</div>
                          {reason && (
                            <div className="text-sm text-gray-700 bg-white bg-opacity-60 p-3 rounded border-l-3 border-current">
                              {reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Overall Assessment */}
                {studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment && (
                  <div className="mt-8 space-y-4 bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-xl border-2 border-purple-300">
                    <div>
                      <p className="font-bold text-lg text-gray-800 mb-2">
                        🎯 Mức năng lực chung: <span className="text-purple-600">
                          {typeof studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment === 'string' 
                            ? studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment 
                            : studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment?.level || 'Đạt'}
                        </span></p>
                      <p className="text-gray-700">
                        {typeof studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment === 'string' 
                          ? studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment 
                          : studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment?.summary || ''}
                      </p>
                    </div>

                    {/* Strengths and Areas to Improve */}
                    {!typeof studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment !== 'string' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment?.strengths && (
                          <div className="p-4 bg-green-100 rounded-lg border-l-4 border-green-600">
                            <p className="font-bold text-green-800 mb-2">💪 Điểm mạnh:</p>
                            <ul className="text-sm text-green-700 space-y-1">
                              {(Array.isArray(studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment.strengths) 
                                ? studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment.strengths 
                                : [studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment.strengths]).map((strength, idx) => (
                                <li key={idx}>• {strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment?.areasToImprove && (
                          <div className="p-4 bg-orange-100 rounded-lg border-l-4 border-orange-600">
                            <p className="font-bold text-orange-800 mb-2">🎯 Cần cải thiện:</p>
                            <ul className="text-sm text-orange-700 space-y-1">
                              {(Array.isArray(studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment.areasToImprove) 
                                ? studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment.areasToImprove 
                                : [studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment.areasToImprove]).map((area, idx) => (
                                <li key={idx}>• {area}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment?.recommendations && (
                      <div className="p-4 bg-blue-100 rounded-lg border-l-4 border-blue-600">
                        <p className="font-bold text-blue-800 mb-2">💡 Lời khuyên:</p>
                        <p className="text-sm text-blue-700">
                          {studentResult.data.parts.khoiDong.aiAnalysis.overallAssessment.recommendations}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Xem chi tiết câu trả lời */}
            <div className="border-t-4 border-gray-200">
              <div className="p-8 bg-gray-50 space-y-8">
                {/* Render each exercise separately */}
                {exam?.exercises && exam.exercises.length > 0 ? (
                  exam.exercises.map((exercise, exerciseIdx) => (
                    <div key={exerciseIdx} className="bg-white rounded-2xl p-6 shadow-md">
                      {/* Exercise Header */}
                      <div className="mb-6 pb-4 border-b-3 border-blue-300">
                        <h4 className="text-2xl font-bold text-gray-800 mb-2">
                          {exerciseIdx === 0 ? '📝 Bài tập 1' : exerciseIdx === 1 ? '📚 Bài tập 2' : '🎯 Bài tập 3'}
                        </h4>
                        {exercise.context && (
                          <div className="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500 text-gray-700">
                            <p className="font-bold text-sm uppercase mb-2">Bài toán:</p>
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

                            // Handle both array and object formats of answers
                            let answerData;
                            if (Array.isArray(studentResult.data?.parts?.khoiDong?.answers)) {
                              // Array format - find by questionIndex or use index directly
                              answerData = studentResult.data.parts.khoiDong.answers.find(a => a.questionIndex === globalQuestionIndex) || studentResult.data.parts.khoiDong.answers[globalQuestionIndex];
                            } else {
                              // Object format - use key directly
                              answerData = studentResult.data?.parts?.khoiDong?.answers?.[globalQuestionIndex];
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
                                  className={`flex justify-between items-center p-6 cursor-pointer hover:bg-gray-100 transition-colors ${
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
                                  <div className="p-8">
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
                                                ✓ Học sinh chọn
                                              </span>
                                            )}
                                            {showAsWrong && (
                                              <span className="px-4 py-2 bg-red-600 text-white rounded-max text-sm font-bold flex-shrink-0">
                                                ✓ Học sinh chọn
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
                                      // Find the AI comment for this question
                                      const aiComment = studentResult.data?.parts?.khoiDong?.aiAnalysis?.questionComments?.find(
                                        (c) => c.questionNum === globalQuestionIndex + 1
                                      );
                                      const displayText = aiComment?.comment || question.explanation;
                                      const isAIComment = !!aiComment?.comment;

                                      return displayText && (
                                        <div className={`p-6 border-l-4 rounded-max ${isAIComment ? 'bg-blue-100 border-blue-600' : 'bg-purple-100 border-purple-600'}`}>
                                          <h4 className="text-sm font-bold text-gray-800 uppercase mb-3">
                                            {isAIComment ? '💡 Nhận xét:' : '📚 Giải thích:'}
                                          </h4>
                                          <p className="text-gray-800 leading-relaxed text-base">{displayText}</p>
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
            </div>
          </div>
        )}

        {/* Placeholder for other tabs */}
        {(activeTab === 'luyenTap' || activeTab === 'vanDung') && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-500 text-lg">Phần này sẽ được phát triển sớm</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyStudentExamResultPage;
