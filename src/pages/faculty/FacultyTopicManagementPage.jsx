import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import topicService from '../../services/faculty/topicService';
import authService from '../../services/authService';
import facultyService from '../../services/faculty/facultyService';
import TopicCard from '../../components/cards/TopicCard';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyTopicManagementPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  
  const [selectedClassId] = useState(() => {
    const fromState = location.state?.classId;
    const fromSession = sessionStorage.getItem('selectedClassId');
    return fromState || fromSession || null;
  });

  // Extract learningPathway from location.state
  const learningPathway = location.state?.learningPathway;

  useEffect(() => {
    if (selectedClassId) {
      sessionStorage.setItem('selectedClassId', selectedClassId);
    }
  }, [selectedClassId]);

  const loadTopics = useCallback(async () => {
    if (!selectedClassId) {
      console.warn('No classId available');
      return;
    }

    setLoading(true);
    try {
      // Load ALL topics from system
      const data = await topicService.getAllTopics();
      
      // Filter topics by learningPathway
      const filteredByPathway = learningPathway 
        ? data.filter(t => t.learningPathway === learningPathway)
        : data;
      
      // Fetch exam count for each topic filtered by classId and topicId
      const topicsWithExamCount = await Promise.all(
        filteredByPathway.map(async (topic) => {
          try {
            // Only count exams that belong to this class and topic
            const exams = await facultyService.getExamsByTopic(topic.id);
            const classFilteredExams = exams.filter(exam => exam.classId === selectedClassId);
            return {
              ...topic,
              examCount: classFilteredExams.length
            };
          } catch (error) {
            return {
              ...topic,
              examCount: 0
            };
          }
        })
      );
      
      setTopics(topicsWithExamCount);
    } catch (error) {
      console.error('Lỗi khi tải danh sách chủ đề:', error);
      alert('Lỗi khi tải danh sách chủ đề');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, learningPathway]);

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
    if (selectedClassId) {
      loadTopics();
    }
  }, [selectedClassId, loadTopics]);

  const handleCreateExam = (topicId) => {
    navigate(`/faculty/exam-management?classId=${selectedClassId}&topicId=${topicId}`, { 
      state: { 
        topicId,
        classId: selectedClassId
      }
    });
  };

  if (loading && topics.length === 0) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center"><span className="text-gray-800 text-xl">Đang tải...</span></div>;
  }

  // const navItems = [
  //   { icon: '📚', label: 'Quản lí Chủ Đề' }
  // ];

  return (
    <div className="faculty-topic-management min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <FacultyHeader user={user} onLogout={() => navigate('/login')} />

      {/* Warning Message */}
      {!selectedClassId && (
        <div className="px-8 lg:px-12 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-800 rounded-lg">
              <p className="font-semibold">⚠️ Chưa chọn lớp học</p>
              <p className="text-sm text-red-700 mt-1">Vui lòng quay lại để chọn lớp học trước khi chọn mạch.</p>
              <button 
                onClick={() => navigate('/faculty')}
                className="mt-3 px-4 py-2 bg-red-200 hover:bg-red-300 rounded-lg transition-all duration-300 text-red-800 font-semibold"
              >
                ← Quay lại chọn lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topics Grid */}
      <div className="px-8 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto w-full">
          {/* Pathway Title */}
          {learningPathway && (
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <span className="text-4xl">
                  {learningPathway === 'algebra' ? '🔢' : '📐'}
                </span>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">
                    {learningPathway === 'algebra' ? 'Số và Phép Tính' : 'Hình học và Đo lường'}
                  </h1>
                  <p className="text-gray-600 text-sm mt-1">Chọn chủ đề để tạo đề thi cho lớp học</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/faculty/learning-pathway/exam')}
                className="mt-4 px-4 py-2 hover:bg-purple-100 hover:text-purple-700 rounded-lg transition-all duration-300 text-gray-700 flex items-center gap-2 font-semibold"
              >
                <span className="text-lg">←</span> Quay lại
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin text-5xl mb-4">⏳</div>
              <p className="text-gray-700 text-lg">Đang tải chủ đề...</p>
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-800 text-xl font-semibold mb-2">Không có chủ đề</p>
              <p className="text-gray-600">Hiện tại không có chủ đề nào trong mạch {learningPathway === 'algebra' ? 'Số và Phép Tính' : 'Hình học và Đo lường'} của hệ thống.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={{
                    ...topic,
                    icon: topic.icon || '📚',
                    color: topic.color || '#4CAF50'
                  }}
                  onCreateExam={handleCreateExam}
                  showActions={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyTopicManagementPage;
