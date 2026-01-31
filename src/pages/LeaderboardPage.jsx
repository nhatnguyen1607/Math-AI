import React, { useState, useEffect } from 'react';
import resultService from '../services/resultService';
import topicService from '../services/topicService';
import problemService from '../services/problemService';

const LeaderboardPage = () => {
  const [viewMode, setViewMode] = useState('problem'); // 'problem' or 'topic'
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState('');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTopics();
  }, []);

  useEffect(() => {
    if (selectedTopic) {
      loadProblems();
    }
  }, [selectedTopic]);

  useEffect(() => {
    if (viewMode === 'problem' && selectedProblem) {
      loadProblemLeaderboard();
    } else if (viewMode === 'topic' && selectedTopic) {
      loadTopicLeaderboard();
    }
  }, [viewMode, selectedProblem, selectedTopic]);

  const loadTopics = async () => {
    try {
      const data = await topicService.getAllTopics();
      setTopics(data);
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  };

  const loadProblems = async () => {
    if (!selectedTopic) return;
    
    try {
      const data = await problemService.getProblemsByTopic(selectedTopic);
      setProblems(data);
      setSelectedProblem('');
    } catch (error) {
      console.error('Error loading problems:', error);
    }
  };

  const loadProblemLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await resultService.getProblemLeaderboard(selectedProblem);
      setLeaderboardData(data);
    } catch (error) {
      console.error('Error loading problem leaderboard:', error);
      alert('Lỗi khi tải bảng xếp hạng');
    } finally {
      setLoading(false);
    }
  };

  const loadTopicLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await resultService.getTopicLeaderboard(selectedTopic);
      setLeaderboardData(data);
    } catch (error) {
      console.error('Error loading topic leaderboard:', error);
      alert('Lỗi khi tải bảng xếp hạng');
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#4caf50';
    if (score >= 70) return '#ff9800';
    return '#f44336';
  };

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-gray-800 text-center">🏆 Bảng xếp hạng</h2>
      </div>

      <div className="flex gap-0 mb-6 border-2 border-gray-200 rounded-lg overflow-hidden max-w-lg mx-auto">
        <button
          className={`flex-1 px-6 py-3 text-base font-semibold transition-all ${
            viewMode === 'problem' ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white' : 'bg-white text-gray-600'
          }`}
          onClick={() => setViewMode('problem')}
        >
          📝 Theo bài toán
        </button>
        <button
          className={`flex-1 px-6 py-3 text-base font-semibold transition-all ${
            viewMode === 'topic' ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white' : 'bg-white text-gray-600'
          }`}
          onClick={() => setViewMode('topic')}
        >
          📚 Theo chủ đề
        </button>
      </div>

      <div className="flex gap-5 mb-8 bg-white p-5 rounded-xl shadow-md">
        <div className="flex-1">
          <label className="block mb-2 text-gray-700 font-semibold">Chọn chủ đề:</label>
          <select 
            value={selectedTopic} 
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm bg-white cursor-pointer focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="">-- Chọn chủ đề --</option>
            {topics.map(topic => (
              <option key={topic.id} value={topic.id}>
                {topic.icon} {topic.name}
              </option>
            ))}
          </select>
        </div>

        {viewMode === 'problem' && selectedTopic && (
          <div className="flex-1">
            <label className="block mb-2 text-gray-700 font-semibold">Chọn bài toán:</label>
            <select 
              value={selectedProblem} 
              onChange={(e) => setSelectedProblem(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm bg-white cursor-pointer focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="">-- Chọn bài toán --</option>
              {problems.map(problem => (
                <option key={problem.id} value={problem.id}>
                  {problem.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-lg">Đang tải bảng xếp hạng...</div>
      ) : leaderboardData.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg text-gray-400">
            {!selectedTopic 
              ? 'Vui lòng chọn chủ đề để xem bảng xếp hạng'
              : viewMode === 'problem' && !selectedProblem
              ? 'Vui lòng chọn bài toán để xem bảng xếp hạng'
              : 'Chưa có dữ liệu xếp hạng'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gradient-to-r from-purple-500 to-purple-700 text-white">
                <tr>
                  <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wide w-20">Hạng</th>
                  <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wide">Học sinh</th>
                  {viewMode === 'problem' ? (
                    <>
                      <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wide w-30">Điểm</th>
                      <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wide w-30">Thời gian</th>
                      <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wide w-30">Lượt làm</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wide w-36">Tổng điểm</th>
                      <th className="px-4 py-4 text-left font-semibold text-sm uppercase tracking-wide w-36">Bài hoàn thành</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((item, index) => (
                  <tr 
                    key={item.userId || index} 
                    className={`border-b border-gray-100 hover:bg-purple-50 transition-colors ${
                      index < 3 ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <td className="px-4 py-4 text-center">
                      <span className="text-2xl font-bold">
                        {getMedalEmoji(index + 1)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-purple-700 text-white flex items-center justify-center font-bold text-lg">
                          {item.userId?.charAt(0).toUpperCase() || '?'}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {item.userId || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    {viewMode === 'problem' ? (
                      <>
                        <td className="px-4 py-4 text-center">
                          <span 
                            className="inline-block px-4 py-1.5 rounded-full text-white font-bold text-sm"
                            style={{backgroundColor: getScoreColor(item.score)}}
                          >
                            {item.score || 0} điểm
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-600 text-sm text-center">
                          ⏱️ {formatTime(item.timeSpent)}
                        </td>
                        <td className="px-4 py-4 text-gray-600 text-sm text-center">
                          🔄 {item.attempts || 1} lần
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4 text-center">
                          <span 
                            className="inline-block px-4 py-1.5 rounded-full text-white font-bold text-sm"
                            style={{backgroundColor: getScoreColor(item.totalScore / item.completedProblems)}}
                          >
                            {item.totalScore || 0} điểm
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-600 text-sm text-center">
                          ✅ {item.completedProblems || 0} bài
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
