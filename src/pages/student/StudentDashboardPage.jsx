import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import studentService from '../../services/student/studentService';
import classService from '../../services/classService';
import resultService from '../../services/resultService';
import StudentClassSelectionPage from './StudentClassSelectionPage';
import StudentHeader from '../../components/student/StudentHeader';
import StudentTopicPage from './StudentTopicPage';

const StudentDashboardPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { classId, topicId } = useParams();
  const location = window.location.pathname;
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [studentClasses, setStudentClasses] = useState([]);
  
  // Determine current view from URL path
  const currentView = location.includes('/topic-management') ? 'topic-management' : location.includes('/exam-management') ? 'exam-management' : null;

  // Load student's joined classes when user is available
  useEffect(() => {
    const loadStudentClasses = async () => {
      if (!user?.uid) {
        console.log('User not ready yet');
        return;
      }
      
      try {
        console.log('Loading student classes for user:', user.uid);
        const classes = await classService.getClassesByStudent(user.uid);
        console.log('Student classes loaded:', classes);
        setStudentClasses(classes || []);
      } catch (error) {
        console.error('Error loading student classes:', error);
      }
    };
    
    loadStudentClasses();
  }, [user?.uid]);

  const loadClassData = useCallback(async (userId) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      console.log('Loading data for class:', selectedClass?.id, 'User:', userId, 'View:', currentView);
      
      // Load data based on current view
      const topicType = currentView === 'exam-management' ? 'worksheet' : 'startup';
      const examType = currentView === 'exam-management' ? 'worksheet' : 'startup';
      
      const [topicsData, statsData, examsData] = await Promise.all([
        studentService.getAvailableTopics(selectedClass?.id, topicType),
        studentService.getStudentStats(userId),
        studentService.getAvailableExams(selectedClass?.id, examType)
      ]);
      setTopics(topicsData || []);
      setExams(examsData || []);
      
      // Debug log to show what exams were loaded with their isLocked status
      (examsData || []).forEach(e => {
        console.log(`💾 Exam loaded: title="${e.title}", isLocked=${e.isLocked}, status=${e.status}, type=${typeof e.isLocked}`);
      });
      console.log('💾 Full exam data:', JSON.stringify((examsData || []).map(e => ({id: e.id, title: e.title, isLocked: e.isLocked}))));
      
      setUserStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedClass, currentView]);

  useEffect(() => {
    if (selectedClass && user?.uid) {
      setLoading(true);
      loadClassData(user.uid);
    } else {
      setLoading(false);
    }
  }, [selectedClass, user, loadClassData]);

  // Load class data when classId URL param changes
  useEffect(() => {
    if (classId && studentClasses.length > 0) {
      // Load class from studentClasses list
      const cls = studentClasses.find(c => c.id === classId);
      if (cls) {
        console.log('Setting class from URL param:', cls);
        setSelectedClass(cls);
      }
    }
  }, [classId, studentClasses]);

  // Set first class as default if no classId in URL and no class selected yet
  useEffect(() => {
    if (!classId && !selectedClass && studentClasses.length > 0) {
      console.log('Setting first class as default:', studentClasses[0]);
      setSelectedClass(studentClasses[0]);
    }
  }, [classId, selectedClass, studentClasses]);

  // Load selected topic when topicId URL param changes
  useEffect(() => {
    if (topicId && topics.length > 0) {
      const topic = topics.find(t => t.id === topicId);
      if (topic) {
        setSelectedTopic(topic);
      }
    } else if (!topicId) {
      setSelectedTopic(null);
    }
  }, [topicId, topics]);

  const handleSelectClass = useCallback((cls) => {
    setSelectedClass(cls);
    setSelectedTopic(null);
    setShowClassSelector(false);
    navigate(`/student/${cls.id}`);
  }, [navigate]);

  const handleChangeClass = () => {
    setShowClassSelector(true);
  };

  const handleStartupClick = useCallback(() => {
    if (selectedClass) {
      navigate(`/student/${selectedClass.id}/topic-management`);
    }
  }, [navigate, selectedClass]);

  const handleWorksheetClick = useCallback(() => {
    if (selectedClass) {
      navigate(`/student/${selectedClass.id}/exam-management`);
    }
  }, [navigate, selectedClass]);

  const handleJoinExam = async (exam) => {
    try {
      console.log('🔍 handleJoinExam called:', { 
        examId: exam?.id, 
        title: exam?.title,
        isLocked: exam?.isLocked,
        type: typeof exam?.isLocked,
        status: exam?.status
      });

      // Check if exam is locked
      if (exam?.isLocked === true) {
        console.log('🔐 Exam is locked, redirecting to result page');
        // For locked exams, navigate to result page by examId
        navigate(`/student/exam-result/${exam.id}`, {
          state: { fromExam: false, examId: exam.id }
        });
        return;
      }

      console.log('🟢 Exam is not locked, proceeding with normal flow');

      // For unlocked exams, check if student has already completed
      if (user?.uid) {
        const progress = await resultService.getExamProgress(user.uid, exam.id);
        
        // If progress exists and isFirst is false, redirect to result page
        if (progress && progress.isFirst === false) {
          navigate(`/student/exam-result/${progress.sessionId || exam.id}`, {
            state: { fromExam: false, examId: exam.id }
          });
          return;
        }
      }

      // Otherwise, go to exam lobby (first time or in progress)
      window.location.href = `/student/exam-lobby/${exam.id}`;
    } catch (error) {
      console.error('Error checking exam progress:', error);
      // If there's an error, go to exam lobby as fallback
      window.location.href = `/student/exam-lobby/${exam.id}`;
    }
  };

  // Redirect if user logs out
  if (!user) {
    return null;
  }

  // Show class selector if in that mode
  if (showClassSelector) {
    return <StudentClassSelectionPage user={user} onSelectClass={handleSelectClass} onSignOut={onSignOut} />;
  }

  // If no selected class and URL has no classId, show class selector
  if (!selectedClass && !classId) {
    // Show limited dashboard with "Select Class" button
    const navItems = [
      { icon: '📚', label: 'Chọn lớp học' }
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={navItems} />
        
        <div className="px-8 py-8 max-w-7xl mx-auto w-full flex flex-col items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-800 mb-4 font-quicksand">
              Chào mừng, {user?.displayName || 'Bạn'}! 👋
            </h1>
            <p className="text-xl text-gray-600 mb-12 font-quicksand">
              Vui lòng chọn lớp học của bạn để bắt đầu
            </p>
            
            <div className="game-card bg-white rounded-max shadow-lg p-12 max-w-md">
              <div className="text-7xl mb-6">🎓</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6 font-quicksand">
                Chọn lớp học
              </h2>
              {studentClasses && studentClasses.length > 0 ? (
                <>
                  <p className="text-gray-600 mb-6 font-quicksand">
                    Bạn đã tham gia {studentClasses.length} lớp
                  </p>
                  <button
                    onClick={handleChangeClass}
                    className="btn-3d w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-4 px-6 rounded-max font-quicksand text-lg"
                  >
                    Chọn lớp →
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-6 font-quicksand">
                    Bạn chưa tham gia lớp nào. Hãy tham gia lớp của bạn bằng mã lớp.
                  </p>
                  <button
                    onClick={handleChangeClass}
                    className="btn-3d w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-4 px-6 rounded-max font-quicksand text-lg"
                  >
                    Tham gia lớp →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Hiển thị StudentTopicPage nếu đang ở topic-management view
  if (currentView === 'topic-management') {
    return (
      <StudentTopicPage 
        user={user} 
        onSignOut={onSignOut} 
        selectedClass={selectedClass} 
        topics={topics} 
        exams={exams}
        selectedTopic={selectedTopic}
        setSelectedTopic={setSelectedTopic}
        topicId={topicId}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce-gentle">✨</div>
          <div className="text-2xl font-bold text-gray-700 font-quicksand">Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  // Show options view when no specific view is selected
  if (!currentView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        
        <div className="px-8 py-8 max-w-7xl mx-auto w-full">
          {/* Change Class Button */}
          <div className="mb-8 flex gap-4">
            <button 
              onClick={handleChangeClass}
              className="btn-3d bg-blue-500 text-white py-3 px-6 rounded-max font-quicksand hover:shadow-lg transition-all font-bold"
              title="Chọn lớp khác"
            >
              🔄 Chọn lớp khác
            </button>
          </div>

          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-gray-800 mb-2 font-quicksand">
              Chào mừng, {user?.displayName || 'Bạn'}! 👋
            </h1>
            <p className="text-xl text-gray-600 font-quicksand">
              Lớp: <span className="font-bold text-gray-800">{selectedClass?.name}</span>
            </p>
          </div>

          {/* Stats Section - Card Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="game-card bg-gradient-to-br from-blue-300 to-cyan-300 rounded-max p-6 shadow-lg hover:shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="text-5xl">🏆</div>
                <div>
                  <div className="text-4xl font-bold text-gray-800 font-quicksand">
                    {userStats?.completedExams || 0}
                  </div>
                  <div className="text-gray-700 font-quicksand">Đề thi hoàn thành</div>
                </div>
              </div>
            </div>

            <div className="game-card bg-gradient-to-br from-purple-300 to-pink-300 rounded-max p-6 shadow-lg hover:shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="text-5xl">⭐</div>
                <div>
                  <div className="text-4xl font-bold text-gray-800 font-quicksand">
                    {userStats?.averageScore || 0}%
                  </div>
                  <div className="text-gray-700 font-quicksand">Điểm trung bình</div>
                </div>
              </div>
            </div>

            <div className="game-card bg-gradient-to-br from-green-300 to-emerald-300 rounded-max p-6 shadow-lg hover:shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="text-5xl">🗺️</div>
                <div>
                  <div className="text-4xl font-bold text-gray-800 font-quicksand">
                    {topics.length}
                  </div>
                  <div className="text-gray-700 font-quicksand">Chủ đề khả dụng</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Khởi động Card */}
            <div 
              onClick={handleStartupClick}
              className="group game-card bg-gradient-to-br from-yellow-300 to-orange-300 rounded-max shadow-lg p-10 cursor-pointer transition-all duration-300 transform hover:-translate-y-4 hover:shadow-2xl"
            >
              <div className="text-7xl mb-6 text-center animate-bounce-gentle">🚀</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3 font-quicksand text-center">
                🗺️ Trò chơi
              </h2>
              <p className="text-gray-700 mb-8 font-quicksand text-center">
                Chọn chủ đề và bắt đầu hành trình học tập của bạn
              </p>
              <button className="btn-3d w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-4 px-6 rounded-max font-quicksand text-lg">
                Khám phá Bản đồ →
              </button>
            </div>

            {/* Phiếu bài tập Card */}
            <div 
              onClick={handleWorksheetClick}
              className="group game-card bg-gradient-to-br from-pink-300 to-rose-300 rounded-max shadow-lg p-10 cursor-pointer transition-all duration-300 transform hover:-translate-y-4 hover:shadow-2xl"
            >
              <div className="text-7xl mb-6 text-center animate-bounce-gentle">📋</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3 font-quicksand text-center">
                📝 Bài kiểm tra
              </h2>
              <p className="text-gray-700 mb-8 font-quicksand text-center">
                Làm các bài thi hoàn chỉnh và kiểm tra kiến thức
              </p>
              <button className="btn-3d w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold py-4 px-6 rounded-max font-quicksand text-lg">
                Tham gia bài thi →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      {/* Nội dung chính */}
      <div className="p-8">
        {currentView === 'exam-management' ? (
          // Danh sách đề thi
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-10">
              <button 
                onClick={() => navigate(-1)}
                className="btn-3d bg-white text-gray-800 py-3 px-6 rounded-max font-quicksand hover:shadow-lg transition-all"
              >
                ← Quay lại
              </button>
              <h2 className="text-4xl font-bold text-gray-800 font-quicksand">Các đề thi bài tập</h2>
            </div>

            <div className="space-y-6">
              {exams && exams.length > 0 ? (
                exams.map((exam, idx) => {
                  console.log(`🎯 RENDERING EXAM CARD ${idx}: title="${exam.title}", isLocked=${exam.isLocked}`);
                  return (
                  <div 
                    key={exam.id} 
                    className="game-card bg-white rounded-max shadow-lg hover:shadow-2xl p-8 transition-all duration-300 transform hover:-translate-y-2 border-l-8 border-blue-500"
                  >
                    {/* Exam Title */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-4xl">📚</span>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-800 font-quicksand">
                          {exam.title}
                        </h3>
                      </div>
                      <span className="text-2xl">{idx + 1}</span>
                    </div>

                    {/* Exam Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b-2 border-gray-200">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 font-quicksand">
                          {exam.questions?.length || 0}
                        </div>
                        <div className="text-sm text-gray-600 font-quicksand">Câu hỏi</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 font-quicksand">
                          {exam.duration}
                        </div>
                        <div className="text-sm text-gray-600 font-quicksand">phút</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600 font-quicksand">
                          {exam.passingScore}%
                        </div>
                        <div className="text-sm text-gray-600 font-quicksand">điểm đạt</div>
                      </div>
                    </div>

                    {/* Description */}
                    {exam.description && (
                      <p className="text-gray-600 text-base mb-6 font-quicksand">
                        {exam.description}
                      </p>
                    )}

                    {/* Join Button */}
                    <button
                      className={`btn-3d w-full font-bold py-4 px-6 rounded-max transition-all duration-300 font-quicksand text-lg ${
                        exam?.isLocked === true
                          ? 'bg-gradient-to-r from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600'
                          : 'bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600'
                      } text-white`}
                      onClick={() => {
                        console.log('Button clicked, exam.isLocked:', exam?.isLocked);
                        handleJoinExam(exam);
                      }}
                    >
                      {exam?.isLocked === true ? '📊 Xem kết quả' : '🚀 Bắt đầu thi'}
                    </button>
                  </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-max shadow-lg p-16 text-center game-card">
                  <p className="text-5xl mb-4">📭</p>
                  <p className="text-gray-600 text-lg font-quicksand">Lớp này chưa có đề thi nào.</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StudentDashboardPage;
