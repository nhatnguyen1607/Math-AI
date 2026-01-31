import React, { useState } from 'react';
import TopicManagementPage from './TopicManagementPage';
import ProblemManagementPage from './ProblemManagementPage';
import LeaderboardPage from './LeaderboardPage';

const AdminPage = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('topics');

  const tabs = [
    { id: 'topics', label: '📚 Quản lý Chủ đề', icon: '📚' },
    { id: 'problems', label: '📝 Quản lý Bài toán', icon: '📝' },
    { id: 'leaderboard', label: '🏆 Bảng xếp hạng', icon: '🏆' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-700 pb-10">
      <div className="bg-white shadow-md p-8 mb-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">🔧 Trang quản trị</h1>
            <p className="text-lg text-gray-600">Quản lý chủ đề, bài toán và theo dõi kết quả học sinh</p>
          </div>
          <button
            onClick={onLogout}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 mb-8">
        <div className="flex gap-3">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all shadow-md ${
                activeTab === tab.id
                  ? 'bg-white shadow-xl -translate-y-1'
                  : 'bg-white/90 hover:bg-white hover:-translate-y-0.5 hover:shadow-lg'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="text-2xl">{tab.icon}</span>
              <span className="text-gray-800">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5">
        <div className="bg-white/95 rounded-2xl shadow-lg min-h-[calc(100vh-280px)]">
          {activeTab === 'topics' && <TopicManagementPage />}
          {activeTab === 'problems' && <ProblemManagementPage />}
          {activeTab === 'leaderboard' && <LeaderboardPage />}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
