import React from 'react';
import { useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';

const StudentTopicPage = ({ user, onSignOut, selectedClass, topics, exams, selectedTopic, setSelectedTopic, topicId }) => {
  const navigate = useNavigate();

  // Island mascots and colors for adventure map
  const islandThemes = [
    { emoji: '🏝️', color: 'from-blue-300 to-cyan-300', name: 'Island' },
    { emoji: '⛰️', color: 'from-gray-400 to-slate-400', name: 'Mountain' },
    { emoji: '🌴', color: 'from-green-300 to-emerald-300', name: 'Jungle' },
    { emoji: '🏜️', color: 'from-yellow-300 to-orange-300', name: 'Desert' },
    { emoji: '❄️', color: 'from-blue-200 to-purple-200', name: 'Tundra' },
    { emoji: '🌋', color: 'from-red-400 to-orange-400', name: 'Volcano' },
  ];

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    navigate(`/student/${selectedClass.id}/topic-management/${topic.id}`);
  };

  const handleJoinExam = (examId) => {
    window.location.href = `/student/exam-lobby/${examId}`;
  };

  const handleBack = () => {
    navigate(-1);
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

  // Danh sách chủ đề - Adventure Map View
  if (!topicId) {
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

            {topics.length === 0 ? (
              <div className="bg-white rounded-max shadow-lg p-16 text-center game-card">
                <p className="text-6xl mb-4">🗺️</p>
                <p className="text-gray-600 text-xl font-quicksand">
                  Chưa có chủ đề nào. Vui lòng quay lại sau!
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-4xl font-bold text-gray-800 mb-3 font-quicksand">
                  🗺️ Bản đồ hành trình học tập
                </h2>
                <p className="text-lg text-gray-600 mb-10 font-quicksand">
                  Khám phá các hòn đảo bí ẩn và trở thành Bậc thầy toán học!
                </p>

                {/* Adventure Map - Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 auto-rows-fr">
                  {topics.map((topic, index) => {
                    const theme = islandThemes[index % islandThemes.length];
                    const examCount = exams.filter(exam => exam.topicId === topic.id).length;
                    
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
                          {renderStarBadges(index, topics.length)}
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
  if (topicId && selectedTopic) {
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
                {selectedTopic.name}
              </h2>
            </div>

            {/* Description Card */}
            {selectedTopic.description && (
              <div className="bg-gradient-to-r from-blue-400 to-purple-400 rounded-max p-6 text-white mb-10 shadow-lg game-card font-quicksand">
                <p className="text-lg drop-shadow-md">{selectedTopic.description}</p>
              </div>
            )}

            {/* Exams Section */}
            <div className="space-y-6">
              {exams.filter(exam => exam.topicId === topicId).length > 0 ? (
                exams.filter(exam => exam.topicId === topicId).map((exam, idx) => (
                  <div 
                    key={exam.id} 
                    className="bg-white rounded-max shadow-lg hover:shadow-2xl p-8 transition-all duration-300 transform hover:-translate-y-2 game-card border-l-8 border-purple-500"
                  >
                    {/* Exam Title with Icon */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-4xl">🎯</span>
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

                    {/* Exam Description */}
                    {exam.description && (
                      <p className="text-gray-600 text-base mb-6 font-quicksand">
                        {exam.description}
                      </p>
                    )}

                    {/* Join Button */}
                    <button
                      className="btn-3d w-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-bold py-4 px-6 rounded-max transition-all duration-300 font-quicksand text-lg"
                      onClick={() => handleJoinExam(exam.id)}
                    >
                      🚀 Bắt đầu thi
                    </button>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-max shadow-lg p-16 text-center game-card">
                  <p className="text-5xl mb-4">📝</p>
                  <p className="text-gray-600 text-lg font-quicksand">
                    Chủ đề này chưa có đề thi nào.
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
