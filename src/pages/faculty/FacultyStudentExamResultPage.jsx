import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import authService from '../../services/authService';
import resultService from '../../services/resultService';
import facultyService from '../../services/faculty/facultyService';
import geminiService from '../../services/geminiService';
import FacultyHeader from '../../components/faculty/FacultyHeader';
import CompetencyEvaluationDisplay from '../../components/CompetencyEvaluationDisplay';

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
  const [practiceData, setPracticeData] = useState(null);
  const [loadingPractice, setLoadingPractice] = useState(true);
  const [aiAssessment, setAiAssessment] = useState(null);
  const [loadingAiAssessment, setLoadingAiAssessment] = useState(false);

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
        
        // Load saved AI assessment if exists
        if (result.data?.assessment?.aiProgressAssessment) {
          setAiAssessment(result.data.assessment.aiProgressAssessment);
        }

        // Get student info from updated leaderboard (from student_exam_progress)
        try {
          const leaderboard = await facultyService.getExamStudentResults(examId);
          const studentData = leaderboard?.find(s => s.uid === userId);
          if (studentData) {
            setStudent(studentData);
          } else {
            // Fallback: create minimal student data
            setStudent({
              uid: userId,
              name: result.data?.studentName || `Student ${userId.substring(0, 8)}`,
              rank: '?',
              score: result.score || 0
            });
          }
        } catch (leaderboardError) {
          setStudent({
            uid: userId,
            name: result.data?.studentName || `Student ${userId.substring(0, 8)}`,
            rank: '?',
            score: result.score || 0
          });
        }
      } catch (error) {
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

  // Load practice data
  useEffect(() => {
    const loadPracticeData = async () => {
      try {
        if (!userId || !examId) {
          setLoadingPractice(false);
          return;
        }
        const practice = await resultService.getPracticeSession(userId, examId);
        const vanDung = await resultService.getVanDungSession(userId, examId);
                
        setPracticeData({
          ...practice,
          vanDung
        });
        setLoadingPractice(false);
      } catch (err) {
        setLoadingPractice(false);
      }
    };
    
    loadPracticeData();
  }, [userId, examId, activeTab]);

  // Check if all 3 parts are completed
  const isCompetencyCompletionValid = useCallback(() => {
    try {
      // Check khởi động: has submitted answers
      const khoiDongAnswers = studentResult?.data?.parts?.khoiDong?.answers;
      const khoiDongCompleted = khoiDongAnswers && (
        (Array.isArray(khoiDongAnswers) && khoiDongAnswers.length > 0) ||
        (typeof khoiDongAnswers === 'object' && Object.keys(khoiDongAnswers).length > 0)
      );

      // Check luyện tập: both bai1 and bai2 marked as completed
      const luyenTapCompleted = 
        practiceData?.bai1?.status === 'completed' && 
        practiceData?.bai2?.status === 'completed';

      // Check vận dụng: marked as completed
      const vanDungCompleted = practiceData?.vanDung?.status === 'completed';

      return khoiDongCompleted && luyenTapCompleted && vanDungCompleted;
    } catch (err) {
      return false;
    }
  }, [studentResult, practiceData]);

  // Save AI Assessment to Database
  const saveAiAssessment = useCallback(async (assessment) => {
    try {
      await resultService.updateAiProgressAssessment(userId, examId, assessment);
    } catch (err) {
    }
  }, [userId, examId]);

  // Fallback assessment when AI generation fails
  const createFallbackAssessment = useCallback(() => {
    const khoiDongEval = studentResult.competencyEvaluation || {};
    const vanDungEval = practiceData?.vanDung?.evaluation || {};
    
    // Tính điểm khởi động
    const khoiDongTotal = khoiDongEval.totalCompetencyScore || 0;
    
    // Tính điểm vận dụng (sử dụng totalCompetencyScore hoặc tongDiem)
    const vanDungTotal = vanDungEval.totalCompetencyScore || vanDungEval.tongDiem || 0;
    
    const totalImprovement = vanDungTotal - khoiDongTotal;
    let assessment = '';
    
    if (totalImprovement >= 4) {
      assessment = `Học sinh có tiến bộ rõ rệt trong quá trình học tập. Điểm số tăng từ ${khoiDongTotal} lên ${vanDungTotal} (+${totalImprovement} điểm). Em đã thể hiện sức cải thiện đáng kể qua từng giai đoạn luyện tập.\n\nTiếp tục duy trì tốc độ học tập này. Em có thể thử thách các bài toán khó hơn để phát triển tư duy toán học.`;
    } else if (totalImprovement >= 0) {
      assessment = `Học sinh có sự ổn định trong quá trình học tập. Điểm số từ ${khoiDongTotal} sang ${vanDungTotal} (${totalImprovement >= 0 ? '+' : ''}${totalImprovement} điểm). Em cần tập trung vào các phần yếu để có thể cải thiện.\n\nXác định những tiêu chí còn yếu và luyện tập những phần đó. Nâng cao mức độ chi tiết trong các bước giải.`;
    } else {
      assessment = `Học sinh có xu hướng suy giảm trong quá trình học tập. Điểm số từ ${khoiDongTotal} xuống ${vanDungTotal} (${totalImprovement} điểm). Em cần xem xét lại chiến lược học tập.\n\nTìm những khó khăn cụ thể để có phương hướng cải thiện. Yêu cầu hỗ trợ thêm nếu cần thiết.`;
    }
    setAiAssessment(assessment);
  }, [studentResult, practiceData]);

  // AI Assessment Generation
  const generateAiAssessment = useCallback(async () => {
    try {
      setLoadingAiAssessment(true);
      
      // Get data needed for AI prompt
      const khoiDongEval = studentResult.competencyEvaluation || {};
      const luyenTapBai1 = practiceData?.bai1?.evaluation || {};
      const luyenTapBai2 = practiceData?.bai2?.evaluation || {};
      const vanDungEval = practiceData?.vanDung?.evaluation || {};
      
      const khoiDongTotal = khoiDongEval.totalCompetencyScore || 0;
      const getLuyenTapTotal = () => {
        const bai1Total = luyenTapBai1.tongDiem || 0;
        const bai2Total = luyenTapBai2.tongDiem || 0;
        return Math.round((bai1Total + bai2Total) / 2);
      };
      const vanDungTotal = vanDungEval.totalCompetencyScore || 0;
      
      const luyenTapTotalScore = getLuyenTapTotal();
      
      const prompt = `Bạn là một giáo viên toán học. Hãy viết nhận xét ngắn gọn về tiến độ phát triển của học sinh:

Học sinh: ${student?.name || 'Học sinh'}
Điểm: ${khoiDongTotal}/8 (khởi động) → ${luyenTapTotalScore}/8 (luyện tập) → ${vanDungTotal}/8 (vận dụng)
Thay đổi: ${vanDungTotal - khoiDongTotal >= 0 ? '+' : ''}${vanDungTotal - khoiDongTotal} điểm

Hãy viết nhận xét chi tiết (5-6 câu) về:
- Xu hướng phát triển của học sinh
- Điều học sinh làm tốt
- Cần cải thiện ở đâu

Trả lời bằng tiếng Việt, chi tiết và chuyên nghiệp.`;

      const response = await geminiService.processExamQuestion(prompt);
      const assessment = response.message || response;
      await saveAiAssessment(assessment);
      
      setAiAssessment(assessment);
    } catch (err) {
      createFallbackAssessment();
    } finally {
      setLoadingAiAssessment(false);
    }
  }, [studentResult, practiceData, student, saveAiAssessment, createFallbackAssessment]);

  // Load AI assessment when viewing the competency evaluation tab
  useEffect(() => {
    if (activeTab === 'danhGia' && studentResult && practiceData) {
      // Check if already have assessment in DB
      if (studentResult.data?.assessment?.aiProgressAssessment) {
        setAiAssessment(studentResult.data.assessment.aiProgressAssessment);
        setLoadingAiAssessment(false);
      } else if (!aiAssessment && !loadingAiAssessment && isCompetencyCompletionValid()) {
        // Only generate if not already in state and all parts are completed
        generateAiAssessment();
      }
    }
  }, [activeTab, studentResult, practiceData, aiAssessment, loadingAiAssessment, isCompetencyCompletionValid, generateAiAssessment]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  if (!exam || !studentResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Không tìm thấy dữ liệu</p>
        </div>
      </div>
    );
  }

  const tabItems = [
    { id: 'khoiDong', label: '🚀 Khởi động', icon: '🚀', disabled: false },
    { id: 'luyenTap', label: '📚 Luyện tập', icon: '📚', disabled: false },
    { id: 'vanDung', label: '⚡ Vận dụng', icon: '⚡', disabled: false },
    { id: 'danhGia', label: '📈 Đánh giá năng lực', icon: '📈', disabled: !isCompetencyCompletionValid() }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <FacultyHeader 
        user={user} 
        onLogout={() => navigate('/login')}
      />
      
      {/* Back Button */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 px-8 lg:px-12 py-3 shadow-soft-md">
        <button
          onClick={() => navigate(`/faculty/exam-results/${examId}`)}
          className="px-4 lg:px-6 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold rounded-lg transition-all duration-300 flex items-center gap-2"
        >
          ← Quay lại
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-8">
        {/* Page Title */}
        <div className="mb-8 p-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-3xl shadow-soft-lg">
          <div className="flex items-center gap-3 mb-4">
            {student?.medal && <span className="text-4xl">{student.medal}</span>}
            <div>
              <h2 className="text-3xl font-bold">{student?.name || 'Unknown'}</h2>
              <p className="text-pink-100">Xếp hạng: <strong>#{student?.rank || '-'}</strong></p>
            </div>
          </div>
        </div>

        {/* Part Header Section - Only show for khởi động tab */}
        {activeTab === 'khoiDong' && (
          <>
            <div className="mb-8 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-3xl p-6 lg:p-8 shadow-soft-lg">
              <h3 className="text-2xl lg:text-3xl font-bold mb-2 flex items-center gap-3">
                <span>🚀</span> Phần Khởi động
              </h3>
              <p className="text-indigo-50">Nhân số thập phân</p>
            </div>

            {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
          {/* Correct Answers Card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-3xl p-6 lg:p-8 text-center shadow-soft hover:shadow-soft-lg transition-shadow">
            <div className="text-4xl lg:text-5xl font-bold text-green-600 mb-2">{studentResult.correctAnswers || 0}</div>
            <div className="text-gray-600 font-semibold mb-1">Câu đúng</div>
            <div className="text-gray-500 text-sm">({studentResult.percentage || 0}%)</div>
          </div>

          {/* Percentage Circle Card */}
          <div className="bg-gradient-to-br from-white to-indigo-50 border-2 border-indigo-200 rounded-3xl p-6 lg:p-8 flex flex-col items-center justify-center shadow-soft hover:shadow-soft-lg transition-shadow">
            <div className="relative w-28 h-28 lg:w-32 lg:h-32 mb-4">
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
                  stroke="#6366f1"
                  strokeWidth="8"
                  strokeDasharray={`${(studentResult.percentage || 0) * 3.14}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl lg:text-3xl font-bold text-indigo-700">{studentResult.percentage || 0}%</span>
              </div>
            </div>
            <p className="text-xs lg:text-sm text-gray-600 font-semibold">Tỷ lệ đúng</p>
          </div>

          {/* Status Card */}
          {(() => {
            const isPassed = (studentResult?.percentage || 0) >= 50;
            return (
              <div className={`rounded-3xl p-6 lg:p-8 flex flex-col items-center justify-center shadow-soft hover:shadow-soft-lg transition-shadow border-2 ${
                isPassed
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
                  : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300'
              }`}>
                <div className={`text-5xl lg:text-6xl font-bold mb-2 ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
                  {isPassed ? '✓' : '✗'}
                </div>
                <div className={`text-xl lg:text-2xl font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
                  {isPassed ? 'PASS' : 'FAIL'}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {isPassed ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu'}
                </p>
              </div>
            );
          })()}
        </div>
          </>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex gap-2 justify-center flex-wrap">
            {tabItems.map((tab) => (
              <div key={tab.id} className="relative group">
                <button
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`px-6 py-3 font-semibold rounded-full transition-all ${
                    tab.disabled
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-soft opacity-60'
                      : activeTab === tab.id
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-soft-lg hover:-translate-y-1'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-soft'
                  }`}
                >
                  {tab.label}
                </button>
                {tab.disabled && tab.id === 'danhGia' && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max bg-gray-800 text-white text-xs rounded px-3 py-2 hidden group-hover:block z-10 whitespace-nowrap">
                    Hoàn thành 3 phần (🚀 🎯 ⚡) trước tiên
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeTab === 'khoiDong' && (
          <div className="space-y-8">
            {/* New Competency Evaluation Section */}
            {studentResult.competencyEvaluation && (
              <CompetencyEvaluationDisplay evaluation={studentResult.competencyEvaluation} showDetails={true} />
            )}



            {/* Xem chi tiết câu trả lời */}
            <div className="border-t-4 border-indigo-200">
              <div className="p-6 lg:p-8 bg-indigo-50 space-y-6 lg:space-y-8 rounded-2xl">
                {/* Render each exercise separately */}
                {exam?.exercises && exam.exercises.length > 0 ? (
                  exam.exercises.map((exercise, exerciseIdx) => (
                    <div key={exerciseIdx} className="bg-white rounded-3xl p-5 lg:p-6 shadow-soft-md border border-indigo-100">
                      {/* Exercise Header */}
                      <div className="mb-6 pb-4 border-b-3 border-indigo-300">
                        <h4 className="text-2xl font-bold text-gray-800 mb-2">
                          {exerciseIdx === 0 ? '📝 Bài tập 1' : '📚 Bài tập 2'}
                        </h4>
                        {exercise.context && (
                          <div className="p-4 bg-indigo-50 rounded-2xl border-l-4 border-indigo-500 text-gray-700 mt-3">
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
                                className={`rounded-2xl overflow-hidden border-3 transition-all shadow-soft ${
                                  answerData.isCorrect
                                    ? 'border-green-400 bg-green-50 hover:shadow-soft-lg'
                                    : 'border-red-400 bg-red-50 hover:shadow-soft-lg'
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
                                        <div className={`p-6 border-l-4 rounded-2xl ${isAIComment ? 'bg-indigo-100 border-indigo-600' : 'bg-purple-100 border-purple-600'}`}>
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

        {/* Luyện tập Tab */}
        {activeTab === 'luyenTap' && (
          <div className="bg-white rounded-3xl shadow-soft-lg p-6 lg:p-8 border-t-4 border-blue-300">
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
              <span>📚</span> Phần Luyện tập
            </h3>

            {loadingPractice ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 animate-bounce">📚</div>
                <p className="text-gray-600 text-lg">Đang tải dữ liệu luyện tập...</p>
              </div>
            ) : !practiceData || (!practiceData.bai1 && !practiceData.bai2) ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-gray-500 text-lg">Học sinh chưa hoàn thành luyện tập</p>
              </div>
            ) : (
              <div className="space-y-12">
                {['bai1', 'bai2'].map((baiNum, idx) => {
                  const baiData = practiceData[baiNum];
                  if (!baiData) return null;

                  const evaluation = baiData.evaluation;
                  const chatHistory = baiData.chatHistory || [];

                  return (
                    <div 
                      key={baiNum}
                      className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-3xl p-6 lg:p-8 border-3 border-blue-200"
                    >
                      {/* Bài Header */}
                      <div className="mb-6 pb-4 border-b-3 border-blue-300">
                        <h4 className="text-2xl font-bold text-gray-800 mb-2">Bài {idx + 1}</h4>
                        <p className="text-gray-700 text-sm">
                          <strong>Đề bài:</strong> {baiData.deBai}
                        </p>
                      </div>

                      {/* Chat History */}
                      <div className="bg-white rounded-2xl p-6 mb-6 max-h-96 overflow-y-auto border border-blue-200">
                        <h5 className="font-bold text-gray-800 mb-4">💬 Đoạn chat:</h5>
                        <div className="space-y-4">
                          {chatHistory.length > 0 ? (
                            chatHistory.map((msg, msgIdx) => (
                              <div 
                                key={msgIdx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div 
                                  className={`max-w-xs px-4 py-3 rounded-lg text-sm ${
                                    msg.role === 'user'
                                      ? 'bg-blue-500 text-white rounded-br-none'
                                      : 'bg-gray-200 text-gray-800 rounded-bl-none'
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap">{msg.parts?.[0]?.text || msg.text || ''}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-500 text-center py-4">Không có đoạn chat</p>
                          )}
                        </div>
                      </div>

                      {/* Evaluation Results */}
                      {evaluation && (
                        <div className="space-y-4">
                          <h5 className="font-bold text-gray-800 text-lg mb-4">📊 Đánh giá 4 Tiêu chí Năng lực (Tối đa 8 điểm)</h5>
                          
                          {/* 4 Tiêu chí TC1-TC4 */}
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {['TC1', 'TC2', 'TC3', 'TC4'].map((tc) => {
                                const tcData = evaluation[tc];
                                const tcNames = {
                                  'TC1': 'Nhận biết vấn đề',
                                  'TC2': 'Nêu cách giải',
                                  'TC3': 'Trình bày giải',
                                  'TC4': 'Kiểm tra giải pháp'
                                };
                                
                                // Color based on score (0-2 per TC)
                                const score = tcData?.diem || 0;
                                const levelColor = 
                                  score === 2 ? 'border-green-500 bg-green-50' :
                                  score === 1 ? 'border-blue-500 bg-blue-50' :
                                  'border-orange-500 bg-orange-50';
                                const textColor =
                                  score === 2 ? 'text-green-700' :
                                  score === 1 ? 'text-blue-700' :
                                  'text-orange-700';
                                const levelLabel =
                                  score === 2 ? 'Tốt' :
                                  score === 1 ? 'Đạt' :
                                  'Cần cố gắng';

                                return (
                                  <div key={tc} className={`p-5 rounded-lg border-l-4 border-b border-r ${levelColor}`}>
                                    <div className="flex justify-between items-start mb-2">
                                      <p className={`font-bold text-base ${textColor}`}>{tc}. {tcNames[tc]}</p>
                                      <span className={`font-bold text-lg ${textColor}`}>{score}/2</span>
                                    </div>
                                    <p className="text-xs font-semibold mb-2" style={{ color: textColor }}>({levelLabel})</p>
                                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${textColor}`}>{tcData?.nhanXet || ''}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Nhận xét chung và Tổng điểm */}
                          {evaluation.tongNhanXet && (
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-5 rounded-lg border-l-4 border-purple-500 space-y-3">
                              <div>
                                <p className="font-bold text-gray-800 mb-2">💭 Nhận xét chung:</p>
                                <p className="text-gray-700 text-sm">{evaluation.tongNhanXet}</p>
                              </div>
                              <div className="pt-3 border-t border-purple-200">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-sm text-gray-600 font-medium">Tổng điểm 4 Tiêu chí</p>
                                    <p className={`text-2xl font-bold ${
                                      evaluation.tongDiem >= 7 ? 'text-green-600' :
                                      evaluation.tongDiem >= 4 ? 'text-blue-600' :
                                      'text-orange-600'
                                    }`}>{evaluation.tongDiem || 0}/8</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm text-gray-600 font-medium">Mức độ chung</p>
                                    <p className={`text-lg font-bold ${
                                      evaluation.mucDoChinh === 'Tốt' ? 'text-green-600' :
                                      evaluation.mucDoChinh === 'Đạt' ? 'text-blue-600' :
                                      'text-orange-600'
                                    }`}>{evaluation.mucDoChinh || '-'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {activeTab === 'vanDung' && (
          <div className="bg-white rounded-3xl shadow-soft-lg p-6 lg:p-8 border-t-4 border-yellow-300">
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
              <span>⚡</span> Phần Vận dụng
            </h3>

            {loadingPractice ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 animate-bounce">⚡</div>
                <p className="text-gray-600 text-lg">Đang tải dữ liệu vận dụng...</p>
              </div>
            ) : !practiceData?.vanDung ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">⚡</div>
                <p className="text-gray-500 text-lg">Học sinh chưa hoàn thành phần vận dụng</p>
              </div>
            ) : (
              <>
                {(() => {
                  return null;
                })()}
                <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 rounded-3xl p-6 lg:p-8 border-3 border-yellow-200">
                {/* Đề bài Header */}
                <div className="mb-6 pb-4 border-b-3 border-yellow-300">
                  <h4 className="text-2xl font-bold text-gray-800 mb-2">Bài Vận dụng</h4>
                  <p className="text-gray-700 text-sm">
                    <strong>Đề bài:</strong> {practiceData.vanDung?.deBai || 'Không có dữ liệu'}
                  </p>
                </div>

                {/* Chat History */}
                <div className="bg-white rounded-2xl p-6 mb-6 max-h-96 overflow-y-auto border border-yellow-200">
                  <h5 className="font-bold text-gray-800 mb-4">💬 Đoạn chat:</h5>
                  <div className="space-y-4">
                    {practiceData.vanDung?.chatHistory && practiceData.vanDung.chatHistory.length > 0 ? (
                      practiceData.vanDung.chatHistory.map((msg, msgIdx) => {
                        const text = msg.parts?.[0]?.text || msg.text || '';
                        return (
                          <div 
                            key={msgIdx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div 
                              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg text-sm ${
                                msg.role === 'user'
                                  ? 'bg-orange-500 text-white rounded-br-none'
                                  : 'bg-gray-200 text-gray-800 rounded-bl-none'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{text}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-4">Không có đoạn chat</p>
                    )}
                  </div>
                </div>

                {/* Evaluation Results */}
                {practiceData.vanDung?.status === 'completed' && practiceData.vanDung?.evaluation ? (
                  <div className="space-y-6">
                    <h5 className="font-bold text-gray-800 text-lg mb-4">📊 Đánh giá 4 Tiêu chí Năng lực (Tối đa 8 điểm)</h5>
                    
                    {/* 4 Tiêu chí TC1-TC4 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['TC1', 'TC2', 'TC3', 'TC4'].map((tc) => {
                        const tcData = practiceData.vanDung.evaluation[tc];
                        const tcNames = {
                          'TC1': 'Nhận biết vấn đề',
                          'TC2': 'Nêu cách giải',
                          'TC3': 'Trình bày giải',
                          'TC4': 'Kiểm tra giải pháp'
                        };
                        
                        if (!tcData) return null;
                        
                        // Color based on score (0-2 per TC)
                        const score = tcData?.diem || 0;
                        const levelColor = 
                          score === 2 ? 'border-green-500 bg-green-50' :
                          score === 1 ? 'border-blue-500 bg-blue-50' :
                          'border-orange-500 bg-orange-50';
                        const textColor =
                          score === 2 ? 'text-green-700' :
                          score === 1 ? 'text-blue-700' :
                          'text-orange-700';
                        const levelLabel =
                          score === 2 ? 'Tốt' :
                          score === 1 ? 'Đạt' :
                          'Cần cố gắng';

                        return (
                          <div key={tc} className={`p-5 rounded-lg border-l-4 border-b border-r ${levelColor}`}>
                            <div className="flex justify-between items-start mb-3">
                              <p className={`font-bold text-base ${textColor}`}>{tc}. {tcNames[tc]}</p>
                              <span className={`font-bold text-lg ${textColor}`}>{score}/2</span>
                            </div>
                            <p className="text-xs font-semibold mb-2" style={{ color: textColor }}>({levelLabel})</p>
                            {tcData?.nhanXet && (
                              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${textColor}`}>{tcData.nhanXet}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Nhận xét chung và Tổng điểm */}
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-6 rounded-lg border-l-4 border-orange-500 space-y-4">
                      {practiceData.vanDung.evaluation?.tongNhanXet && (
                        <div>
                          <p className="font-bold text-gray-800 mb-2">💭 Nhận xét chung:</p>
                          <p className="text-gray-700 text-sm leading-relaxed">{practiceData.vanDung.evaluation.tongNhanXet}</p>
                        </div>
                      )}
                      <div className={`pt-3 ${practiceData.vanDung.evaluation?.tongNhanXet ? 'border-t border-orange-200' : ''}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-600 font-medium">Tổng điểm 4 Tiêu chí</p>
                            <p className={`text-3xl font-bold ${
                              (practiceData.vanDung.evaluation?.tongDiem || 0) >= 7 ? 'text-green-600' :
                              (practiceData.vanDung.evaluation?.tongDiem || 0) >= 4 ? 'text-blue-600' :
                              'text-orange-600'
                            }`}>{practiceData.vanDung.evaluation?.tongDiem || 0}<span className="text-lg">/8</span></p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 font-medium">Mức độ chung</p>
                            <p className={`text-lg font-bold ${
                              practiceData.vanDung.evaluation?.mucDoChinh === 'Tốt' ? 'text-green-600' :
                              practiceData.vanDung.evaluation?.mucDoChinh === 'Đạt' ? 'text-blue-600' :
                              'text-orange-600'
                            }`}>{practiceData.vanDung.evaluation?.mucDoChinh || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-6 rounded-lg border-l-4 border-yellow-500 text-center">
                    <p className="text-gray-600">Phần vận dụng chưa được đánh giá</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {practiceData.vanDung?.status === 'in_progress' 
                        ? 'Đang trong quá trình thực hiện' 
                        : 'Chưa có dữ liệu đánh giá'}
                    </p>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        )}

        {/* Đánh giá Năng lực Tab */}
        {activeTab === 'danhGia' && (
          <div className="bg-white rounded-3xl shadow-soft-lg p-6 lg:p-8 border-t-4 border-purple-300">
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
              <span>📈</span> Đánh giá Tiến độ Phát triển Năng lực
            </h3>

            {!isCompetencyCompletionValid() ? (
              <div className="bg-yellow-50 border-3 border-yellow-300 rounded-3xl p-8 text-center">
                <div className="text-6xl mb-4">🔒</div>
                <h4 className="text-2xl font-bold text-yellow-800 mb-3">Chưa có dữ liệu đánh giá</h4>
                <p className="text-yellow-700 text-lg mb-6">
                  Vui lòng hoàn thành đủ 3 phần (🚀 Khởi động, 📚 Luyện tập, ⚡ Vận dụng) trước khi xem đánh giá năng lực.
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setActiveTab('khoiDong')}
                    className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
                  >
                    → Phần Khởi động
                  </button>
                  <button
                    onClick={() => setActiveTab('luyenTap')}
                    className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
                  >
                    → Phần Luyện tập
                  </button>
                  <button
                    onClick={() => setActiveTab('vanDung')}
                    className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
                  >
                    → Phần Vận dụng
                  </button>
                </div>
              </div>
            ) : loadingPractice ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 animate-bounce">📈</div>
                <p className="text-gray-600 text-lg">Đang tải dữ liệu so sánh...</p>
              </div>
            ) : (() => {
              // Extract competency data from all 3 parts
              const khoiDongEval = studentResult.competencyEvaluation || {};
              const luyenTapBai1 = practiceData?.bai1?.evaluation || {};
              const luyenTapBai2 = practiceData?.bai2?.evaluation || {};
              const vanDungEval = practiceData?.vanDung?.evaluation || {};

              // Get average score for luyenTap (average of bai1 and bai2 TOTAL scores)
              const getLuyenTapTotal = () => {
                const bai1Total = luyenTapBai1.tongDiem || 0;
                const bai2Total = luyenTapBai2.tongDiem || 0;
                return Math.round((bai1Total + bai2Total) / 2);
              };

              // Get average score for individual TC
              const getLuyenTapScore = (tc) => {
                const bai1Score = luyenTapBai1[tc]?.diem || 0;
                const bai2Score = luyenTapBai2[tc]?.diem || 0;
                return Math.round((bai1Score + bai2Score) / 2);
              };

              const getLevelLabel = (score) => {
                if (score === 2) return 'Tốt';
                if (score === 1) return 'Đạt';
                return 'Cần cố gắng';
              };

              const getLevelColor = (score) => {
                if (score === 2) return 'text-green-600';
                if (score === 1) return 'text-blue-600';
                return 'text-orange-600';
              };

              const getBgColor = (score) => {
                if (score === 2) return 'bg-green-50 border-green-300';
                if (score === 1) return 'bg-blue-50 border-blue-300';
                return 'bg-orange-50 border-orange-300';
              };

              // Calculate overall scores - LẤY ĐÚNG NƠI LƯU TRỮ
              const khoiDongTotal = khoiDongEval.totalCompetencyScore || (khoiDongEval.TC1?.score || 0) + (khoiDongEval.TC2?.score || 0) + (khoiDongEval.TC3?.score || 0) + (khoiDongEval.TC4?.score || 0);
              const luyenTapTotal = getLuyenTapTotal();
              const vanDungTotal = vanDungEval.totalCompetencyScore || vanDungEval.tongDiem || (vanDungEval.TC1?.diem || 0) + (vanDungEval.TC2?.diem || 0) + (vanDungEval.TC3?.diem || 0) + (vanDungEval.TC4?.diem || 0);

              // Analyze development for each TC - sử dụng đúng field names
              const analyzeTC = (tc) => {
                const kd = khoiDongEval[tc]?.score || 0;
                const lt = getLuyenTapScore(tc);
                const vd = vanDungEval[tc]?.diem || 0;

                let development = [];
                if (lt > kd) {
                  development.push(`↑ Luyện tập: tăng từ ${getLevelLabel(kd)} lên ${getLevelLabel(lt)}`);
                } else if (lt < kd) {
                  development.push(`↓ Luyện tập: giảm từ ${getLevelLabel(kd)} xuống ${getLevelLabel(lt)}`);
                } else {
                  development.push(`→ Luyện tập: duy trì mức ${getLevelLabel(kd)}`);
                }

                if (vd > lt) {
                  development.push(`↑ Vận dụng: nâng từ ${getLevelLabel(lt)} lên ${getLevelLabel(vd)}`);
                } else if (vd < lt) {
                  development.push(`↓ Vận dụng: giảm từ ${getLevelLabel(lt)} xuống ${getLevelLabel(vd)}`);
                } else {
                  development.push(`→ Vận dụng: duy trì mức ${getLevelLabel(lt)}`);
                }

                // Overall trend
                if (vd > kd) {
                  development.push(`📈 Xu hướng chung: cải thiện từ ${getLevelLabel(kd)} lên ${getLevelLabel(vd)}`);
                } else if (vd < kd) {
                  development.push(`📉 Xu hướng chung: suy giảm từ ${getLevelLabel(kd)} xuống ${getLevelLabel(vd)}`);
                } else {
                  development.push(`📊 Xu hướng chung: ổn định ở mức ${getLevelLabel(kd)}`);
                }

                return development;
              };

              const tcNames = {
                'TC1': { name: 'Nhận biết vấn đề', description: 'Xác định dữ kiện, yêu cầu bài toán' },
                'TC2': { name: 'Nêu cách giải', description: 'Đề xuất giải pháp, lựa chọn phép tính' },
                'TC3': { name: 'Trình bày giải', description: 'Thực hiện các bước giải, trình bày rõ ràng' },
                'TC4': { name: 'Kiểm tra & mở rộng', description: 'Kiểm tra lại kết quả, vận dụng mở rộng' }
              };

              return (
                <div className="space-y-8">
                  {/* Overall Score Comparison */}
                  <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-3xl p-6 lg:p-8 border-3 border-purple-300 shadow-soft-lg">
                    <h4 className="text-xl font-bold text-gray-800 mb-6">📊 So sánh tổng điểm toàn bộ 3 phần</h4>
                    <div className="grid grid-cols-3 gap-4 lg:gap-6">
                      {/* Khởi động */}
                      <div className="bg-white rounded-2xl p-5 border-l-4 border-indigo-500 text-center shadow-soft hover:shadow-soft-lg transition-shadow">
                        <div className="text-sm text-gray-600 font-semibold mb-2">🚀 Khởi động</div>
                        <div className={`text-4xl font-bold mb-2 ${khoiDongTotal >= 7 ? 'text-green-600' : khoiDongTotal >= 4 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {khoiDongTotal}/8
                        </div>
                        <div className="text-xs text-gray-500">{getLevelLabel(Math.round(khoiDongTotal / 4))}</div>
                      </div>

                      {/* Luyện tập */}
                      <div className="bg-white rounded-2xl p-5 border-l-4 border-blue-500 text-center shadow-soft hover:shadow-soft-lg transition-shadow">
                        <div className="text-sm text-gray-600 font-semibold mb-2">📚 Luyện tập (TB)</div>
                        <div className={`text-4xl font-bold mb-2 ${luyenTapTotal >= 7 ? 'text-green-600' : luyenTapTotal >= 4 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {luyenTapTotal}/8
                        </div>
                        <div className="text-xs text-gray-500">{getLevelLabel(Math.round(luyenTapTotal / 4))}</div>
                      </div>

                      {/* Vận dụng */}
                      <div className="bg-white rounded-2xl p-5 border-l-4 border-orange-500 text-center shadow-soft hover:shadow-soft-lg transition-shadow">
                        <div className="text-sm text-gray-600 font-semibold mb-2">⚡ Vận dụng</div>
                        <div className={`text-4xl font-bold mb-2 ${vanDungTotal >= 7 ? 'text-green-600' : vanDungTotal >= 4 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {vanDungTotal}/8
                        </div>
                        <div className="text-xs text-gray-500">{getLevelLabel(Math.round(vanDungTotal / 4))}</div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed TC1-TC4 Comparison */}
                  <div className="space-y-6">
                    <h4 className="text-xl font-bold text-gray-800">📋 Chi tiết từng tiêu chí</h4>
                    
                    {['TC1', 'TC2', 'TC3', 'TC4'].map((tc) => {
                      const kdScore = khoiDongEval[tc]?.score || 0;
                      const ltScore = getLuyenTapScore(tc);
                      const vdScore = vanDungEval[tc]?.diem || 0;
                      const development = analyzeTC(tc);

                      return (
                        <div key={tc} className="bg-white rounded-3xl p-6 lg:p-8 shadow-soft hover:shadow-soft-lg transition-shadow border border-gray-200">
                          {/* TC Header */}
                          <div className="mb-6 pb-4 border-b-2 border-gray-200">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h5 className="text-lg font-bold text-gray-800">{tc}. {tcNames[tc].name}</h5>
                                <p className="text-sm text-gray-600 mt-1">{tcNames[tc].description}</p>
                              </div>
                            </div>
                          </div>

                          {/* Score Comparison Row */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                            {/* Khởi động */}
                            <div className={`rounded-xl p-4 border-2 ${getBgColor(kdScore)}`}>
                              <div className="text-xs text-gray-600 font-semibold mb-2">🚀 Khởi động</div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className={`text-3xl font-bold ${getLevelColor(kdScore)}`}>{kdScore}</div>
                                  <div className={`text-xs font-semibold mt-1 ${getLevelColor(kdScore)}`}>{getLevelLabel(kdScore)}</div>
                                </div>
                              </div>
                            </div>

                            {/* Luyện tập */}
                            <div className={`rounded-xl p-4 border-2 ${getBgColor(ltScore)}`}>
                              <div className="text-xs text-gray-600 font-semibold mb-2">📚 Luyện tập</div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className={`text-3xl font-bold ${getLevelColor(ltScore)}`}>{ltScore}</div>
                                  <div className={`text-xs font-semibold mt-1 ${getLevelColor(ltScore)}`}>{getLevelLabel(ltScore)}</div>
                                </div>
                                {ltScore > kdScore && <div className="text-2xl">📈</div>}
                                {ltScore < kdScore && <div className="text-2xl">📉</div>}
                                {ltScore === kdScore && <div className="text-2xl">→</div>}
                              </div>
                            </div>

                            {/* Vận dụng */}
                            <div className={`rounded-xl p-4 border-2 ${getBgColor(vdScore)}`}>
                              <div className="text-xs text-gray-600 font-semibold mb-2">⚡ Vận dụng</div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className={`text-3xl font-bold ${getLevelColor(vdScore)}`}>{vdScore}</div>
                                  <div className={`text-xs font-semibold mt-1 ${getLevelColor(vdScore)}`}>{getLevelLabel(vdScore)}</div>
                                </div>
                                {vdScore > ltScore && <div className="text-2xl">📈</div>}
                                {vdScore < ltScore && <div className="text-2xl">📉</div>}
                                {vdScore === ltScore && <div className="text-2xl">→</div>}
                              </div>
                            </div>
                          </div>

                          {/* Development Analysis */}
                          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-l-4 border-purple-500">
                            <p className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                              <span>💡</span> Nhận xét phát triển:
                            </p>
                            <div className="space-y-2">
                              {development.map((item, idx) => (
                                <p key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                  <span className="text-gray-400 mt-0.5">•</span>
                                  <span>{item}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Overall Assessment */}
                  <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white rounded-3xl p-6 lg:p-8 shadow-soft-lg">
                    <h4 className="text-xl font-bold mb-6 flex items-center gap-3">
                      <span>🎯</span> Đánh giá chung về quá trình phát triển
                    </h4>

                    {loadingAiAssessment ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-3 animate-bounce">🤖</div>
                        <p className="text-indigo-100">Đang phân tích phát triển của học sinh...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {aiAssessment && (
                          <div className="flex items-start gap-3">
                            <span className="text-3xl flex-shrink-0">✨</span>
                            <p className="text-lg leading-relaxed whitespace-pre-wrap text-indigo-50">{aiAssessment}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyStudentExamResultPage;
