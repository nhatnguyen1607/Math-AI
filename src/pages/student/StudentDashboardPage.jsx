import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import studentService from '../../services/student/studentService';
import StudentClassSelectionPage from './StudentClassSelectionPage';
import StudentHeader from '../../components/student/StudentHeader';
import StudentTopicPage from './StudentTopicPage';

const StudentDashboardPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { classId, topicId } = useParams();
  const location = window.location.pathname;
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [topicExams, setTopicExams] = useState([]);
  
  // Determine current view from URL path
  const currentView = location.includes('/topic-management') ? 'topic-management' : location.includes('/exam-management') ? 'exam-management' : null;

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
    if (classId && !selectedClass) {
      // Load class from Firestore using classId
      const loadClass = async () => {
        try {
          const cls = await studentService.getClassById(classId);
          if (cls) {
            setSelectedClass(cls);
          }
        } catch (error) {
          console.error('Error loading class:', error);
        }
      };
      loadClass();
    } else if (!classId) {
      setSelectedClass(null);
    }
  }, [classId, selectedClass]);

  // Load selected topic when topicId URL param changes
  useEffect(() => {
    if (topicId && topics.length > 0) {
      const topic = topics.find(t => t.id === topicId);
      if (topic) {
        setSelectedTopic(topic);
        const topicExamsList = exams.filter(exam => exam.topicId === topicId);
        setTopicExams(topicExamsList);
      }
    } else if (!topicId) {
      setSelectedTopic(null);
    }
  }, [topicId, topics, exams]);

  const handleSelectClass = useCallback((cls) => {
    setSelectedClass(cls);
    setSelectedTopic(null);
    navigate(`/student/${cls.id}`);
  }, [navigate]);

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

  const handleJoinExam = (examId) => {
    window.location.href = `/student/exam-lobby/${examId}`;
  };

  // Redirect if user logs out
  if (!user) {
    return null;
  }

  if (!selectedClass) {
    return <StudentClassSelectionPage user={user} onSelectClass={handleSelectClass} onSignOut={onSignOut} />;
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
        setTopicExams={setTopicExams}
      />
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white"><span className="text-2xl">Đang tải...</span></div>;
  }

  // Show options view when no specific view is selected
  if (!currentView) {
    const navItems = [
      { icon: '📚', label: 'Lớp: ' + selectedClass.name }
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <StudentHeader user={user} onLogout={onSignOut} navItems={navItems} />
        
        <div className="px-12 py-8 max-w-6xl mx-auto w-full">
          {/* Back Button */}
          <div className="mb-6">
            <button 
              onClick={() => navigate('/student')}
              className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg transition-all duration-300"
            >
              ← Quay lại
            </button>
          </div>

          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Chào mừng, {user?.displayName || 'Bạn'}! 👋</h1>
            <p className="text-white text-opacity-80">Lớp: <span className="font-bold text-lg">{selectedClass.name}</span></p>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white bg-opacity-95 rounded-lg p-4 text-center shadow-lg">
              <div className="text-3xl font-bold text-blue-600">{userStats?.completedExams || 0}</div>
              <div className="text-gray-600 text-sm mt-2">Đề thi hoàn thành</div>
            </div>
            <div className="bg-white bg-opacity-95 rounded-lg p-4 text-center shadow-lg">
              <div className="text-3xl font-bold text-purple-600">{userStats?.averageScore || 0}%</div>
              <div className="text-gray-600 text-sm mt-2">Điểm trung bình</div>
            </div>
            <div className="bg-white bg-opacity-95 rounded-lg p-4 text-center shadow-lg">
              <div className="text-3xl font-bold text-pink-600">{topics.length}</div>
              <div className="text-gray-600 text-sm mt-2">Chủ đề khả dụng</div>
            </div>
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Khởi động card */}
            <div 
              onClick={handleStartupClick}
              className="group bg-white rounded-xl shadow-lg hover:shadow-2xl p-8 cursor-pointer transition-all duration-300 hover:-translate-y-2"
            >
              <div className="text-5xl mb-4">🚀</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Khởi động</h2>
              <p className="text-gray-600 mb-6">Chọn chủ đề và làm bài tập từng phần</p>
              <button className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 rounded-lg transition-all duration-300">
                Bắt đầu
              </button>
            </div>

            {/* Phiếu bài tập card */}
            <div 
              onClick={handleWorksheetClick}
              className="group bg-white rounded-xl shadow-lg hover:shadow-2xl p-8 cursor-pointer transition-all duration-300 hover:-translate-y-2"
            >
              <div className="text-5xl mb-4">📋</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Phiếu bài tập</h2>
              <p className="text-gray-600 mb-6">Làm các bài thi hoàn chỉnh</p>
              <button className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold py-3 rounded-lg transition-all duration-300">
                Làm bài
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      {/* Nội dung chính */}
      <div className="p-8">
        {currentView === 'exam-management' ? (
          // Danh sách đề thi
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => navigate(-1)}
                className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg transition-all duration-300"
              >
                ← Quay lại
              </button>
              <h2 className="text-3xl font-bold text-gray-800">Các đề thi</h2>
            </div>

            <div className="space-y-4">
              {exams && exams.length > 0 ? (
                exams.map((exam) => (
                  <div key={exam.id} className="bg-white rounded-xl shadow-md hover:shadow-lg p-6 transition-all duration-300 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{exam.title}</h3>
                      <div className="flex gap-4 text-sm text-gray-600 mb-2">
                        <span>❓ {exam.questions?.length || 0} câu</span>
                        <span>⏱️ {exam.duration} phút</span>
                        <span>🎯 {exam.passingScore}% đạt</span>
                      </div>
                      {exam.description && (
                        <p className="text-gray-600 text-sm">{exam.description}</p>
                      )}
                    </div>
                    <button
                      className="ml-4 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold py-2 px-6 rounded-lg transition-all duration-300 whitespace-nowrap"
                      onClick={() => handleJoinExam(exam.id)}
                    >
                      Tham gia
                    </button>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                  <p className="text-gray-600 text-lg">Lớp này chưa có đề thi nào.</p>
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
