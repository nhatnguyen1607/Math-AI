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

  // Early return if loading
  if (loading) {
    return <div className="faculty-loading">Đang tải...</div>;
  }

  if (!selectedClass) {
    return <FacultyClassManagementPage user={user} onSelectClass={handleSelectClass} onSignOut={onSignOut} />;
  }

  // Return class details page if class selected
  const navItems = [
    { icon: '📚', label: 'Quản lí Lớp: ' + selectedClass.name }
  ];

  return (
    <div className="faculty-page min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600">
      <FacultyHeader user={user} onLogout={onSignOut} onBack={handleBackToClasses} navItems={navItems} />
      
      <div className="px-12 py-8 max-w-6xl mx-auto w-full">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Chào mừng, {user?.displayName || 'Giáo viên'}! 👋</h1>
          <p className="text-white text-opacity-80">Lớp: <span className="font-bold text-lg">{selectedClass.name}</span></p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white bg-opacity-95 rounded-lg p-4 text-center shadow-lg">
            <div className="text-3xl font-bold text-purple-600">{selectedClass.students?.length || 0}</div>
            <div className="text-gray-600 text-sm mt-2">Học sinh</div>
          </div>
          <div className="bg-white bg-opacity-95 rounded-lg p-4 text-center shadow-lg">
            <div className="text-3xl font-bold text-blue-600">0</div>
            <div className="text-gray-600 text-sm mt-2">Chủ đề</div>
          </div>
          <div className="bg-white bg-opacity-95 rounded-lg p-4 text-center shadow-lg">
            <div className="text-3xl font-bold text-green-600">0</div>
            <div className="text-gray-600 text-sm mt-2">Đề thi</div>
          </div>
          <div className="bg-white bg-opacity-95 rounded-lg p-4 text-center shadow-lg">
            <div className="text-3xl font-bold text-orange-600">0</div>
            <div className="text-gray-600 text-sm mt-2">Phiên học</div>
          </div>
        </div>

        {/* Main Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Quản lí lớp học</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="option-card startup-card bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer p-8" onClick={() => handleNavigate('/faculty/topic-management', { type: 'startup' })}>
              <div className="option-icon text-5xl mb-4">🚀</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Khởi động</h2>
              <p className="text-gray-600 mb-6">Tạo chủ đề mới và đề thi cho lớp học</p>
              <button className="option-btn btn-startup w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border-none cursor-pointer">Bắt đầu</button>
            </div>

            <div className="option-card worksheet-card bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer p-8" onClick={() => handleNavigate('/faculty/exam-management', { type: 'worksheet' })}>
              <div className="option-icon text-5xl mb-4">📋</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Phiếu bài tập</h2>
              <p className="text-gray-600 mb-6">Quản lý đề thi, kích hoạt phiên học, xem kết quả</p>
              <button className="option-btn btn-worksheet w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border-none cursor-pointer">Quản lý</button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white bg-opacity-95 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Hành động nhanh</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 bg-gradient-to-r from-purple-100 to-purple-50 hover:from-purple-200 hover:to-purple-100 rounded-lg transition-all duration-300 text-center font-semibold text-purple-700" onClick={() => handleNavigate('/faculty/topic-management')}>
              ➕ Thêm chủ đề
            </button>
            <button className="p-4 bg-gradient-to-r from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 rounded-lg transition-all duration-300 text-center font-semibold text-blue-700" onClick={() => handleNavigate('/faculty/exam-management')}>
              ➕ Tạo đề thi
            </button>
            <button className="p-4 bg-gradient-to-r from-green-100 to-green-50 hover:from-green-200 hover:to-green-100 rounded-lg transition-all duration-300 text-center font-semibold text-green-700">
              👥 Danh sách HS
            </button>
            <button className="p-4 bg-gradient-to-r from-orange-100 to-orange-50 hover:from-orange-200 hover:to-orange-100 rounded-lg transition-all duration-300 text-center font-semibold text-orange-700">
              📊 Báo cáo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default FacultyPage;
