import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import topicService from '../../services/topicService';
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

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      // Load ALL topics from system (not filtered by class)
      const data = await topicService.getAllTopics();
      
      // Fetch exam count for each topic filtered by classId and topicId
      const topicsWithExamCount = await Promise.all(
        data.map(async (topic) => {
          try {
            // Only count exams that belong to this class and topic
            const exams = await facultyService.getExamsByTopic(topic.id);
            const classFilteredExams = exams.filter(exam => exam.classId === selectedClassId);
            return {
              ...topic,
              examCount: classFilteredExams.length
            };
          } catch (error) {
            console.error(`Error fetching exams for topic ${topic.id}:`, error);
            return {
              ...topic,
              examCount: 0
            };
          }
        })
      );
      
      setTopics(topicsWithExamCount);
    } catch (error) {
      alert('Lỗi khi tải danh sách chủ đề');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId]);

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
      sessionStorage.setItem('selectedClassId', selectedClassId);
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
    return <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 flex items-center justify-center"><span className="text-white text-xl">Đang tải...</span></div>;
  }

  // const navItems = [
  //   { icon: '📚', label: 'Quản lí Chủ Đề' }
  // ];

  return (
    <div className="faculty-topic-management min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600">
      <FacultyHeader user={user} onLogout={() => navigate('/login')} />
      
      {/* Back Button */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 px-8 lg:px-12 py-3 shadow-soft-md">
        <button
          onClick={() => navigate('/faculty/class-management')}
          className="px-4 lg:px-6 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold rounded-lg transition-all duration-300 flex items-center gap-2"
        >
          ← Quay lại
        </button>
      </div>

      <div className="topic-header-actions px-12 pt-8 mb-8">
        {/* Create button removed - Topics are now managed by Admin only */}
      </div>

      <div className="topics-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-12 pb-8 max-w-6xl mx-auto w-full">
        {topics.length === 0 ? (
          <div className="empty-state col-span-full text-center py-12 text-white text-xl font-semibold">
            <p>Chưa có chủ đề nào trong hệ thống.</p>
          </div>
        ) : (
          topics.map((topic) => (
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
          ))
        )}
      </div>
    </div>
  );
};

export default FacultyTopicManagementPage;
