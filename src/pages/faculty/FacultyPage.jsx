import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FacultyClassManagementPage from './FacultyClassManagementPage';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyPage = ({ user, userData, onSignOut }) => {
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showDevNotice, setShowDevNotice] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  const handleSelectClass = useCallback((cls) => {
    setSelectedClass(cls);
  }, []);

  const handleBackToClasses = useCallback(() => {
    setSelectedClass(null);
  }, []);

  const handleNavigate = (path, params = {}) => {
    navigate(path, { state: { selectedClass, classId: selectedClass?.id, ...params } });
  };

  const handleWorksheetClick = () => {
    setShowDevNotice(true);
    setTimeout(() => setShowDevNotice(false), 3000);
  };

  // Early return if loading
  if (loading) {
    return <div className="faculty-loading">Đang tải...</div>;
  }

  if (!selectedClass) {
    return <FacultyClassManagementPage user={user} onSelectClass={handleSelectClass} onSignOut={onSignOut} />;
  }

  // const navItems = [
  //   { icon: '📚', label: 'Quản lí Lớp: ' + selectedClass.name }
  // ];

  return (
    <div className="faculty-page min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <FacultyHeader user={user} onLogout={onSignOut} />

      {/* Welcome Section */}
      <div className="px-8 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto w-full">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Chào mừng, {user?.displayName || 'Giáo viên'}! 👋</h1>
              <p className="text-gray-700 text-lg">Lớp: <span className="font-bold text-xl bg-purple-100 text-purple-700 px-3 py-1 rounded-lg">{selectedClass.name}</span></p>
            </div>
            <button
              onClick={handleBackToClasses}
              className="px-4 py-2 hover:bg-purple-100 hover:text-purple-700 rounded-lg transition-all duration-300 text-gray-700 flex items-center gap-2 font-semibold"
            >
              <span className="text-lg">←</span> Quay lại
            </button>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-purple-500">
              <div className="text-3xl font-bold text-purple-600 mb-2">{selectedClass.students?.length || 0}</div>
              <div className="text-gray-700 font-semibold">Học sinh</div>
              <p className="text-gray-500 text-sm mt-1">trong lớp này</p>
            </div>
            <div className="bg-white bg-opacity-95 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="text-3xl font-bold text-blue-600 mb-2">0</div>
              <div className="text-gray-700 font-semibold">Chủ đề</div>
              <p className="text-gray-500 text-sm mt-1">được tạo</p>
            </div>
            <div className="bg-white bg-opacity-95 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="text-3xl font-bold text-green-600 mb-2">0</div>
              <div className="text-gray-700 font-semibold">Đề thi</div>
              <p className="text-gray-500 text-sm mt-1">đã tạo</p>
            </div>
            <div className="bg-white bg-opacity-95 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="text-3xl font-bold text-orange-600 mb-2">0</div>
              <div className="text-gray-700 font-semibold">Phiên học</div>
              <p className="text-gray-500 text-sm mt-1">đang hoạt động</p>
            </div>
          </div>

          {/* Main Actions */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Quản lí lớp học</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer p-8" onClick={() => handleNavigate('/faculty/learning-pathway/game', { type: 'startup' })}>
                <div className="text-6xl mb-4">🚀</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Trò chơi</h3>
                <p className="text-gray-600 mb-6">Tạo trò chơi giáo dục để giúp học sinh học tập theo cách vui vẻ và tương tác</p>
                <button className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  Bắt đầu →
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer p-8" onClick={handleWorksheetClick}>
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Phiếu bài tập</h3>
                <p className="text-gray-600 mb-6">Tạo và quản lý đề thi, kích hoạt phiên học trực tiếp, và xem kết quả chi tiết</p>
                <button className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  Quản lý →
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white bg-opacity-95 rounded-2xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">🚀 Hành động nhanh</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="p-4 bg-gradient-to-br from-purple-100 to-purple-50 hover:from-purple-200 hover:to-purple-100 rounded-xl transition-all duration-300 text-center font-semibold text-purple-700 hover:shadow-lg" onClick={() => handleNavigate('/faculty/learning-pathway/exam')}>
                ➕ Thêm chủ đề
              </button>
              <button className="p-4 bg-gradient-to-br from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 rounded-xl transition-all duration-300 text-center font-semibold text-blue-700 hover:shadow-lg" onClick={() => handleNavigate('/faculty/learning-pathway/exam')}>
                ➕ Tạo đề thi
              </button>
              <button className="p-4 bg-gradient-to-br from-green-100 to-green-50 hover:from-green-200 hover:to-green-100 rounded-xl transition-all duration-300 text-center font-semibold text-green-700 hover:shadow-lg">
                👥 Danh sách HS
              </button>
              <button className="p-4 bg-gradient-to-br from-orange-100 to-orange-50 hover:from-orange-200 hover:to-orange-100 rounded-xl transition-all duration-300 text-center font-semibold text-orange-700 hover:shadow-lg">
                📊 Báo cáo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Development Notice Modal */}
      {showDevNotice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl animate-pulse">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Nội dung đang phát triển</h3>
            <p className="text-gray-600">Tính năng này sẽ sớm được cập nhật. Vui lòng quay lại sau!</p>
          </div>
        </div>
      )}
    </div>
  );
};


export default FacultyPage;
