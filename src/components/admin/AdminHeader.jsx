import React from 'react';
import { useNavigate } from 'react-router-dom';

const AdminHeader = ({ onLogout }) => {
  const navigate = useNavigate();

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-white text-3xl font-bold">
            🔐 Trang Quản Trị Admin
          </h1>
          <button
            onClick={() => onLogout ? onLogout() : navigate('/admin-login')}
            className="px-6 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold rounded-lg transition-all duration-300"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg transition-all duration-300"
          >
            👥 Quản Lý Người Dùng
          </button>
          <button
            onClick={() => navigate('/admin/topic-management')}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg transition-all duration-300"
          >
            📚 Quản Lý Chủ Đề
          </button>
        </div>
      </div>
    </>
  );
};

export default AdminHeader;
