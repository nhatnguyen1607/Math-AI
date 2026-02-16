import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import topicService from '../../services/topicService';
import examService from '../../services/examService';
import resultService from '../../services/resultService';

const StudentTopicPage = ({ user, onSignOut, selectedClass, topics: propTopics, exams: propExams, selectedTopic: propSelectedTopic, setSelectedTopic: setPropsSelectedTopic, topicId }) => {
  const navigate = useNavigate();
  const { learningPathway, mode } = useParams();

  // Island mascots and colors for adventure map
  const islandThemes = [
    { emoji: '🏝️', color: 'from-blue-300 to-cyan-300', name: 'Island' },
    { emoji: '⛰️', color: 'from-gray-400 to-slate-400', name: 'Mountain' },
    { emoji: '🌴', color: 'from-green-300 to-emerald-300', name: 'Jungle' },
    { emoji: '🏜️', color: 'from-yellow-300 to-orange-300', name: 'Desert' },
    { emoji: '❄️', color: 'from-blue-200 to-purple-200', name: 'Tundra' },
    { emoji: '🌋', color: 'from-red-400 to-orange-400', name: 'Volcano' },
  ];

  // State for pathway-based flow
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const classId = sessionStorage.getItem('selectedClassId') || null;

  // Determine if using pathway-based flow (new) or class-based flow (old)
  const isPathwayMode = !!learningPathway;

  const loadTopicsForPathway = useCallback(async () => {
    try {
      setLoading(true);
      const allTopics = await topicService.getAllTopics();
      const filteredTopics = allTopics.filter(t => t.learningPathway === learningPathway);
      setTopics(filteredTopics);
      
      // Load exams for all topics to get exam counts
      const allExams = await examService.getExamsByTopic(null, classId) || [];
      setExams(allExams);
      setError(null);
    } catch (err) {
      setError('Lỗi khi tải danh sách chủ đề');
    } finally {
      setLoading(false);
    }
  }, [learningPathway, classId]);

  // Load topics when pathway is selected
  useEffect(() => {
    if (isPathwayMode) {
      loadTopicsForPathway();
    }
  }, [isPathwayMode, loadTopicsForPathway]);

  const loadExamsForTopic = useCallback(async (topicId) => {
    try {
      setLoading(true);
      const topicExams = await examService.getExamsByTopic(topicId, classId);
      setExams(topicExams || []);
      setError(null);
    } catch (err) {
      setError('Lỗi khi tải danh sách đề thi');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  const handleSelectTopic = (topic) => {
    if (isPathwayMode) {
      setSelectedTopic(topic);
      loadExamsForTopic(topic.id);
    } else {
      // Old workflow
      setPropsSelectedTopic?.(topic);
      navigate(`/student/${selectedClass.id}/topic-management/${topic.id}`);
    }
  };

  const handleJoinExam = async (exam) => {
    try {
      if (exam?.isLocked === true) {
        navigate(`/student/exam-result/${exam.id}`, { state: { fromExam: false, examId: exam.id } });
        return;
      }

      if (user?.uid && !isPathwayMode) {
        const progress = await resultService.getExamProgress(user.uid, exam.id);
        if (progress && progress.isFirst === false) {
          navigate(`/student/exam-result/${progress.sessionId || exam.id}`, {
            state: { fromExam: false, examId: exam.id }
          });
          return;
        }
      }

      if (mode === 'exam') {
        window.location.href = `/student/exam-lobby/${exam.id}`;
      } else if (mode === 'practice') {
        navigate(`/student/practice/${exam.id}`);
      } else {
        window.location.href = `/student/exam-lobby/${exam.id}`;
      }
    } catch (error) {
      if (mode === 'exam') {
        window.location.href = `/student/exam-lobby/${exam.id}`;
      } else if (mode === 'practice') {
        navigate(`/student/practice/${exam.id}`);
      } else {
        window.location.href = `/student/exam-lobby/${exam.id}`;
      }
    }
  };

  const handleBack = () => {
    if (isPathwayMode) {
      if (selectedTopic) {
        setSelectedTopic(null);
        setExams([]);
      } else {
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  };

  // Render star badges based on completion
  const renderStarBadges = (index, maxIndex) => {
    return (
      <div className="flex gap-1">
        {[...Array(3)].map((_, i) => (
          <span key={i} className={i < (index % 3) + 1 ? 'star-earned' : 'star-empty'}>
            ⭐
          </span>
        ))}
      </div>
    );
  };

  // Use pathway-loaded topics if available, otherwise use prop topics
  const displayTopics = isPathwayMode ? topics : (propTopics || []);
  const displayExams = isPathwayMode ? exams : (propExams || []);
  const displaySelectedTopic = isPathwayMode ? selectedTopic : propSelectedTopic;

  // Danh sách chủ đề - Adventure Map View
  if (!topicId && !displaySelectedTopic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

        <div className="p-8">
          <div className="px-8 py-8 max-w-7xl mx-auto w-full">
            {/* Back Button */}
            <div className="mb-10">
              <button 
                onClick={handleBack}
                className="btn-3d bg-white text-gray-800 py-3 px-6 rounded-max font-quicksand hover:shadow-lg transition-all"
              >
                ← Quay lại
              </button>
            </div>

            {isPathwayMode && loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin text-4xl">⏳</div>
                <p className="mt-4 text-gray-600">Đang tải chủ đề...</p>
              </div>
            ) : isPathwayMode && error ? (
              <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            ) : displayTopics.length === 0 ? (
              <div className="bg-white rounded-max shadow-lg p-16 text-center game-card">
                <p className="text-6xl mb-4">🗺️</p>
                <p className="text-gray-600 text-xl font-quicksand">
                  Chưa có chủ đề nào. Vui lòng quay lại sau!
                </p>
              </div>
            ) : (
              <div>
                {isPathwayMode && (
                  <>
                    <h2 className="text-4xl font-bold text-gray-800 mb-3 font-quicksand">
                      🗺️ Bản đồ hành trình học tập
                    </h2>
                    <p className="text-lg text-gray-600 mb-10 font-quicksand">
                      Khám phá các hòn đảo bí ẩn và trở thành Bậc thầy toán học!
                    </p>
                  </>
                )}

                {/* Adventure Map - Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 auto-rows-fr">
                  {displayTopics.map((topic, index) => {
                    const theme = islandThemes[index % islandThemes.length];
                    const examCount = displayExams.filter(exam => exam.topicId === topic.id).length;
                    
                    return (
                      <div
                        key={topic.id}
                        onClick={() => handleSelectTopic(topic)}
                        className={`adventure-card bg-gradient-to-br ${theme.color} rounded-max p-8 cursor-pointer transform hover:-translate-y-3 transition-all duration-300 shadow-lg hover:shadow-2xl animate-bounce-gentle`}
                      >
                        {/* Island Icon */}
                        <div className="text-6xl mb-4 text-center filter drop-shadow-lg">
                          {theme.emoji}
                        </div>

                        {/* Topic Name */}
                        <h3 className="text-2xl font-bold text-white mb-3 text-center font-quicksand drop-shadow-md">
                          {topic.name}
                        </h3>

                        {/* Description */}
                        {topic.description && (
                          <p className="text-white text-sm mb-4 line-clamp-2 font-quicksand drop-shadow-md">
                            {topic.description}
                          </p>
                        )}

                        {/* Stars Achievement */}
                        <div className="flex justify-center mb-4">
                          {renderStarBadges(index, displayTopics.length)}
                        </div>

                        {/* Exam Count & Explore */}
                        <div className="flex items-center justify-between pt-4 border-t-2 border-white/50">
                          <span className="text-sm font-bold text-white font-quicksand drop-shadow-md">
                            🎯 {examCount} đề thi
                          </span>
                          <button className="text-white font-bold font-quicksand drop-shadow-md hover:scale-110 transition-transform">
                            Khám phá →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chi tiết chủ đề và danh sách đề thi của topic
  if ((topicId || displaySelectedTopic) && displaySelectedTopic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={handleBack}
                className="btn-3d bg-white text-gray-800 py-3 px-6 rounded-max font-quicksand hover:shadow-lg transition-all"
              >
                ← Quay lại
              </button>
              <h2 className="text-4xl font-bold text-gray-800 font-quicksand">
                {displaySelectedTopic.name}
              </h2>
            </div>

            {/* Description Card */}
            {displaySelectedTopic.description && (
              <div className="bg-gradient-to-r from-blue-400 to-purple-400 rounded-max p-6 text-white mb-10 shadow-lg game-card font-quicksand">
                <p className="text-lg drop-shadow-md">{displaySelectedTopic.description}</p>
              </div>
            )}

            {/* Exams Section */}
            <div className="space-y-6">
              {isPathwayMode && loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin text-4xl">⏳</div>
                  <p className="mt-4 text-gray-600">Đang tải danh sách đề thi...</p>
                </div>
              ) : isPathwayMode && error ? (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  {error}
                </div>
              ) : displayExams.filter(exam => !topicId ? exam.topicId === displaySelectedTopic.id : exam.topicId === topicId && exam.status !== 'draft').length > 0 ? (
                displayExams.filter(exam => !topicId ? exam.topicId === displaySelectedTopic.id : exam.topicId === topicId && exam.status !== 'draft').map((exam, idx) => {
                  return (
                  <button
                    key={exam.id} 
                    onClick={() => handleJoinExam(exam)}
                    className="w-full bg-white rounded-max shadow-lg hover:shadow-2xl p-8 transition-all duration-300 transform hover:-translate-y-2 game-card border-l-8 border-purple-500 text-left"
                  >
                    {/* Exam Title with Icon */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-4xl">🎯</span>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-800 font-quicksand">
                          {exam.name || exam.title}
                        </h3>
                      </div>
                      <span className="text-2xl">{idx + 1}</span>
                    </div>

                    {/* Exam Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b-2 border-gray-200">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 font-quicksand">
                          {exam.totalQuestions || exam.exercises?.reduce((sum, e) => sum + e.questions?.length || 0, 0) || 0}
                        </div>
                        <div className="text-sm text-gray-600 font-quicksand">Bài tập</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 font-quicksand">
                          {exam.duration || '?'}
                        </div>
                        <div className="text-sm text-gray-600 font-quicksand">giây</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600 font-quicksand">
                          {exam.passingScore || '?'}%
                        </div>
                        <div className="text-sm text-gray-600 font-quicksand">điểm đạt</div>
                      </div>
                    </div>

                    {/* Exam Description */}
                    {exam.description && (
                      <p className="text-gray-600 text-base mb-6 font-quicksand">
                        {exam.description}
                      </p>
                    )}

                    {/* Join Button */}
                    <div className={`btn-3d w-full font-bold py-4 px-6 rounded-max transition-all duration-300 font-quicksand text-lg text-white ${
                      exam.isLocked === true
                        ? 'bg-gradient-to-r from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600'
                        : 'bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600'
                    }`}>
                      {exam.isLocked === true ? '📊 Xem kết quả' : '🚀 Bắt đầu ' + (mode === 'exam' ? 'thi' : 'luyện tập')}
                    </div>
                  </button>
                );
                })
              ) : (
                <div className="bg-white rounded-max shadow-lg p-16 text-center game-card">
                  <p className="text-5xl mb-4">📝</p>
                  <p className="text-gray-600 text-lg font-quicksand">
                    Chủ đề này chưa có {mode === 'exam' ? 'đề thi' : 'bài luyện tập'} nào.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default StudentTopicPage;
