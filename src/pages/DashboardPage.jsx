import React, { useState, useEffect } from 'react';
import topicService from '../services/topicService';
import problemService from '../services/problemService';
import resultService from '../services/resultService';

function DashboardPage({ user, onStartProblem, onSignOut }) {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [problems, setProblems] = useState([]);
  const [userResults, setUserResults] = useState({});
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('topics'); // 'topics' or 'problems'

  useEffect(() => {
    loadData();
  }, [user.uid]);

  useEffect(() => {
    if (selectedTopic) {
      loadProblems();
    }
  }, [selectedTopic]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [topicsData, stats, results] = await Promise.all([
        topicService.getAllTopics(),
        resultService.getUserStats(user.uid),
        resultService.getUserResults(user.uid)
      ]);
      
      setTopics(topicsData);
      setUserStats(stats);
      
      // Create a map of results by problemId
      const resultsMap = {};
      results.forEach(result => {
        resultsMap[result.problemId] = result;
      });
      setUserResults(resultsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProblems = async () => {
    if (!selectedTopic) return;
    
    try {
      const problemsData = await problemService.getProblemsByTopic(selectedTopic.id);
      setProblems(problemsData);
      setView('problems');
    } catch (error) {
      console.error('Error loading problems:', error);
    }
  };

  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
  };

  const handleBackToTopics = () => {
    setView('topics');
    setSelectedTopic(null);
    setProblems([]);
  };

  const handleProblemClick = (problem) => {
    // Khi nhấn vào bài toán, chuyển sang chế độ giải bài toán luôn
    onStartProblem(problem);
  };

  const isProblemCompleted = (problemId) => {
    return userResults[problemId]?.completed || false;
  };

  const getProblemScore = (problemId) => {
    return userResults[problemId]?.score || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-purple-500 to-purple-700 text-white p-5 md:px-10 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-3xl font-bold mb-1">🎓 AI Math</h1>
          <p className="opacity-90">Xin chào, {user.displayName}!</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Nút Quản trị đã bị loại bỏ, admin dùng route riêng */}
          <img 
            src={user.photoURL} 
            alt={user.displayName} 
            className="w-10 h-10 rounded-full border-2 border-white"
          />
          <button 
            onClick={onSignOut} 
            className="px-5 py-2 bg-white/20 border border-white rounded-full hover:bg-white hover:text-purple-600 transition-all"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-5 md:p-10">
        {/* Stats Section */}
        {userStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
            <div className="bg-white rounded-xl p-6 flex items-center gap-4 shadow-md hover:-translate-y-1 hover:shadow-xl transition-all">
              <div className="text-4xl">📝</div>
              <div>
                <div className="text-3xl font-bold text-purple-600">{userStats.totalProblems}</div>
                <div className="text-sm text-gray-600">Bài đã làm</div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 flex items-center gap-4 shadow-md hover:-translate-y-1 hover:shadow-xl transition-all">
              <div className="text-4xl">✅</div>
              <div>
                <div className="text-3xl font-bold text-purple-600">{userStats.completedProblems}</div>
                <div className="text-sm text-gray-600">Hoàn thành</div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 flex items-center gap-4 shadow-md hover:-translate-y-1 hover:shadow-xl transition-all">
              <div className="text-4xl">⭐</div>
              <div>
                <div className="text-3xl font-bold text-purple-600">{Math.round(userStats.averageScore)}</div>
                <div className="text-sm text-gray-600">Điểm TB</div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 flex items-center gap-4 shadow-md hover:-translate-y-1 hover:shadow-xl transition-all">
              <div className="text-4xl">⏱️</div>
              <div>
                <div className="text-3xl font-bold text-purple-600">{Math.round(userStats.totalTimeSpent / 60)}</div>
                <div className="text-sm text-gray-600">Phút học</div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-lg">Đang tải...</div>
        ) : view === 'topics' ? (
          /* Topics View */
          <>
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">📚 Chủ đề học tập</h2>
              <p className="text-gray-600">Chọn một chủ đề để bắt đầu học</p>
            </div>

            {topics.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-lg text-gray-400">Chưa có chủ đề nào. Vui lòng liên hệ giáo viên!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics.map(topic => (
                  <div 
                    key={topic.id} 
                    className="bg-white p-8 rounded-xl shadow-md border-l-4 cursor-pointer hover:-translate-y-2 hover:shadow-xl transition-all"
                    style={{borderLeftColor: topic.color}}
                    onClick={() => handleTopicClick(topic)}
                  >
                    <div className="text-5xl mb-4">{topic.icon}</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-3">{topic.name}</h3>
                    <p className="text-gray-600 leading-relaxed mb-4">{topic.description}</p>
                    <div className="pt-4 border-t border-gray-200 text-gray-500 text-sm">
                      <span>📝 {topic.problemCount || 0} bài toán</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Problems View */
          <>
            <div className="mb-6">
              <button 
                className="mb-4 px-5 py-2 bg-purple-100 text-purple-600 rounded-lg font-semibold hover:bg-purple-200 transition-colors"
                onClick={handleBackToTopics}
              >
                ← Quay lại chủ đề
              </button>
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">{selectedTopic?.icon} {selectedTopic?.name}</h2>
                <p className="text-gray-600">{selectedTopic?.description}</p>
              </div>
            </div>

            {problems.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-lg text-gray-400">Chưa có bài toán nào trong chủ đề này!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {problems.map(problem => {
                  const completed = isProblemCompleted(problem.id);
                  const score = getProblemScore(problem.id);
                  
                  return (
                    <div 
                      key={problem.id} 
                      className={`bg-white p-6 rounded-xl shadow-md cursor-pointer relative border-2 hover:-translate-y-1 hover:shadow-xl hover:border-purple-500 transition-all ${
                        completed ? 'bg-gradient-to-br from-green-50 to-white border-green-500' : 'border-transparent'
                      }`}
                      onClick={() => handleProblemClick(problem)}
                    >
                      {completed && (
                        <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-xl text-xs font-semibold">
                          ✓ Đã hoàn thành
                        </div>
                      )}
                      <h4 className="text-lg font-bold text-gray-800 mb-3 pr-28">{problem.title}</h4>
                      <p className="text-gray-600 leading-relaxed mb-4 line-clamp-3">{problem.content}</p>
                      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                        <span className={`px-3 py-1 rounded-xl text-xs font-semibold ${
                          problem.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                          problem.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {problem.difficulty === 'easy' ? '🟢 Dễ' : 
                           problem.difficulty === 'medium' ? '🟡 TB' : '🔴 Khó'}
                        </span>
                        {completed && (
                          <span className="bg-yellow-100 text-gray-800 px-3 py-1 rounded-xl text-xs font-semibold">
                            ⭐ {score} điểm
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
