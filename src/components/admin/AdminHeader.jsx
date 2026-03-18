import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminHeader = ({ onLogout }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-indigo-300/30 bg-gradient-to-r from-indigo-700 via-purple-700 to-fuchsia-600 shadow-lg">
        <div className="app-shell flex min-h-16 items-center justify-between gap-2 py-2 sm:min-h-20 sm:py-3">
          <h1 className="text-base font-bold text-white sm:text-xl lg:text-3xl">
            🔐 Trang Quản Trị Admin
          </h1>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => navigate('/admin')}
              className="touch-btn bg-white/20 text-white hover:bg-white/30"
            >
              👥 Người dùng
            </button>
            <button
              onClick={() => navigate('/admin/topic-management')}
              className="touch-btn bg-white/20 text-white hover:bg-white/30"
            >
              📚 Chủ đề
            </button>
            <button
              onClick={() => onLogout ? onLogout() : navigate('/admin-login')}
              className="touch-btn bg-rose-600/85 text-white hover:bg-rose-700"
            >
              Đăng xuất
            </button>
          </div>

          <button
            className="touch-btn bg-white/20 text-white hover:bg-white/30 md:hidden"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-label="Mở menu quản trị"
          >
            {isMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {isMenuOpen && (
          <div className="border-t border-white/20 bg-indigo-900/85 px-4 pb-4 pt-3 md:hidden">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate('/admin');
                }}
                className="touch-btn w-full bg-white/15 text-white hover:bg-white/25"
              >
                👥 Quản lý người dùng
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate('/admin/topic-management');
                }}
                className="touch-btn w-full bg-white/15 text-white hover:bg-white/25"
              >
                📚 Quản lý chủ đề
              </button>
              <button
                onClick={() => onLogout ? onLogout() : navigate('/admin-login')}
                className="touch-btn w-full bg-rose-600/90 text-white hover:bg-rose-700"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="app-shell flex flex-wrap gap-2 py-3">
          <button
            onClick={() => navigate('/admin')}
            className="touch-btn flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg"
          >
            👥 Quản Lý Người Dùng
          </button>
          <button
            onClick={() => navigate('/admin/topic-management')}
            className="touch-btn flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg"
          >
            📚 Quản Lý Chủ Đề
          </button>
          <button
            onClick={() => navigate('/admin/worksheet')}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg transition-all duration-300"
          >
            📋 Quản Lý Phiếu Bài Tập
          </button>
        </div>
      </div>
    </>
  );
};

export default AdminHeader;
