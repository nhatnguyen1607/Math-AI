import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';

const StudentTopicSelectionPage = ({ 
  user, 
  onSignOut, 
  selectedClass, 
  topics, 
  exams,
  selectedTopic,
  setSelectedTopic,
  topicId
}) => {
  const navigate = useNavigate();
  const { pathway } = useParams();

  // Island mascots and colors for adventure map
  const islandThemes = [
    { emoji: "🏝️", color: "from-blue-300 to-cyan-300", name: "Island" },
    { emoji: "⛰️", color: "from-gray-400 to-slate-400", name: "Mountain" },
    { emoji: "🌴", color: "from-green-300 to-emerald-300", name: "Jungle" },
    { emoji: "🏜️", color: "from-yellow-300 to-orange-300", name: "Desert" },
    { emoji: "❄️", color: "from-blue-200 to-purple-200", name: "Tundra" },
    { emoji: "🌋", color: "from-red-400 to-orange-400", name: "Volcano" },
  ];

  // Filter topics by pathway if pathway param is present
  const filteredTopics = useMemo(() => {
    if (!pathway || !topics) return topics;
    
    // Filter topics that belong to the selected pathway
    return topics.filter(topic => topic.learningPathway === pathway);
  }, [topics, pathway]);

  const handleExamsClick = (topic) => {
    navigate(`/student/${selectedClass?.id}/pathway/${pathway}/${topic.id}/exams`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="p-8">
        <div className="px-8 py-8 max-w-7xl mx-auto w-full">
          {/* Back Button */}
          <div className="mb-10">
            <button 
              onClick={() => navigate(`/student/${selectedClass?.id}/pathways`)}
              className="btn-3d bg-white text-gray-800 py-3 px-6 rounded-max font-quicksand hover:shadow-lg transition-all"
            >
              ← Quay lại
            </button>
          </div>
          {filteredTopics.length === 0 ? (
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
                {filteredTopics.map((topic, index) => {
                  const theme = islandThemes[index % islandThemes.length];
                  const examCount = exams.filter(
                    (exam) => exam.topicId === topic.id && exam.status !== 'draft',
                  ).length;

                  return (
                    <div
                      key={topic.id}
                      onClick={() => handleExamsClick(topic)}
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
                        <div className="flex gap-1">
                          {[...Array(3)].map((_, i) => (
                            <span key={i} className="text-lg">
                              ⭐
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Exam Count & Explore */}
                      <div className="flex items-center justify-between pt-4 border-t-2 border-white/50">
                        <span className="text-sm font-bold text-white font-quicksand drop-shadow-md">
                          📝 {examCount} đề thi
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
};

export default StudentTopicSelectionPage;
