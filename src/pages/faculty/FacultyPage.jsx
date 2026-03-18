import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FacultyClassManagementPage from './FacultyClassManagementPage';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyPage = ({ user, userData, onSignOut }) => {
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
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
    handleNavigate('/faculty/worksheet/management');
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
      <div className="app-shell section-shell">
        <div className="w-full">
          <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-gray-800 sm:text-3xl lg:text-4xl">Chào mừng, {user?.displayName || 'Giáo viên'}! 👋</h1>
              <p className="text-sm text-gray-700 sm:text-base lg:text-lg">
                Lớp:{' '}
                <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-base font-bold text-purple-700 sm:text-lg lg:text-xl">{selectedClass.name}</span>
              </p>
            </div>
            <button
              onClick={handleBackToClasses}
              className="touch-btn w-full rounded-lg text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-purple-100 hover:text-purple-700 sm:w-auto sm:text-base"
            >
              <span className="text-lg">←</span> Quay lại
            </button>
          </div>

          {/* Stats Section */}
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <div className="rounded-xl border-l-4 border-purple-500 bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-6">
              <div className="text-3xl font-bold text-purple-600 mb-2">{selectedClass.students?.length || 0}</div>
              <div className="text-gray-700 font-semibold">Học sinh</div>
              <p className="text-gray-500 text-sm mt-1">trong lớp này</p>
            </div>
            <div className="rounded-xl bg-white bg-opacity-95 p-5 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-6">
              <div className="text-3xl font-bold text-blue-600 mb-2">0</div>
              <div className="text-gray-700 font-semibold">Chủ đề</div>
              <p className="text-gray-500 text-sm mt-1">được tạo</p>
            </div>
            <div className="rounded-xl bg-white bg-opacity-95 p-5 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-6">
              <div className="text-3xl font-bold text-green-600 mb-2">0</div>
              <div className="text-gray-700 font-semibold">Đề thi</div>
              <p className="text-gray-500 text-sm mt-1">đã tạo</p>
            </div>
            <div className="rounded-xl bg-white bg-opacity-95 p-5 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-6">
              <div className="text-3xl font-bold text-orange-600 mb-2">0</div>
              <div className="text-gray-700 font-semibold">Phiên học</div>
              <p className="text-gray-500 text-sm mt-1">đang hoạt động</p>
            </div>
          </div>

          {/* Main Actions */}
          <div className="mb-8">
            <h2 className="mb-5 text-2xl font-bold text-gray-800 sm:mb-6 sm:text-3xl">Quản lí lớp học</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:gap-8">
              <div className="cursor-pointer rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-8" onClick={() => handleNavigate('/faculty/learning-pathway/game', { type: 'startup' })}>
                <div className="mb-3 text-5xl sm:mb-4 sm:text-6xl">🚀</div>
                <h3 className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">Trò chơi</h3>
                <p className="mb-5 text-sm text-gray-600 sm:mb-6 sm:text-base">Tạo trò chơi giáo dục để giúp học sinh học tập theo cách vui vẻ và tương tác</p>
                <button className="touch-btn w-full rounded-lg bg-gradient-to-r from-purple-500 to-purple-700 text-base font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl">
                  Bắt đầu →
                </button>
              </div>

              <div className="cursor-pointer rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-8" onClick={handleWorksheetClick}>
                <div className="mb-3 text-5xl sm:mb-4 sm:text-6xl">📋</div>
                <h3 className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">Phiếu bài tập</h3>
                <p className="mb-5 text-sm text-gray-600 sm:mb-6 sm:text-base">Tạo và quản lý đề thi, kích hoạt phiên học trực tiếp, và xem kết quả chi tiết</p>
                <button className="touch-btn w-full rounded-lg bg-gradient-to-r from-blue-500 to-blue-700 text-base font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl">
                  Quản lý →
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl bg-white bg-opacity-95 p-5 shadow-xl sm:p-8">
            <h3 className="mb-4 text-xl font-bold text-gray-800 sm:mb-6 sm:text-2xl">🚀 Hành động nhanh</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              <button className="touch-btn h-auto min-h-11 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 p-4 text-center text-sm font-semibold text-purple-700 transition-all duration-300 hover:from-purple-200 hover:to-purple-100 hover:shadow-lg sm:text-base" onClick={() => handleNavigate('/faculty/learning-pathway/exam')}>
                ➕ Thêm chủ đề
              </button>
              <button className="touch-btn h-auto min-h-11 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 p-4 text-center text-sm font-semibold text-blue-700 transition-all duration-300 hover:from-blue-200 hover:to-blue-100 hover:shadow-lg sm:text-base" onClick={() => handleNavigate('/faculty/learning-pathway/exam')}>
                ➕ Tạo đề thi
              </button>
              <button className="touch-btn h-auto min-h-11 rounded-xl bg-gradient-to-br from-green-100 to-green-50 p-4 text-center text-sm font-semibold text-green-700 transition-all duration-300 hover:from-green-200 hover:to-green-100 hover:shadow-lg sm:text-base">
                👥 Danh sách HS
              </button>
              <button className="touch-btn h-auto min-h-11 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 p-4 text-center text-sm font-semibold text-orange-700 transition-all duration-300 hover:from-orange-200 hover:to-orange-100 hover:shadow-lg sm:text-base">
                📊 Báo cáo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default FacultyPage;
