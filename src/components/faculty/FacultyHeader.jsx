import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FacultyHeader = ({ user, onLogout, onBack, navItems = [], breadcrumbs = [] }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // const handleBack = () => {
  //   if (onBack) {
  //     onBack();
  //   } else {
  //     navigate(-1);
  //   }
  // };

  return (
    <>
      {/* Main Header */}
      <header className="sticky top-0 z-50 border-b-4 border-purple-300/80 bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-600 shadow-soft-lg">
        <div className="app-shell flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:py-3">
          {/* Logo và Title bên trái */}
          <button className="flex items-center rounded-xl px-2 py-2 text-left transition-all duration-300 hover:bg-white/10" onClick={() => navigate('/faculty')}>
            <span className="text-xl sm:text-2xl lg:text-3xl animate-float">📐</span>
            <span className="ml-2 text-base font-bold text-white drop-shadow-lg tracking-wide sm:text-lg lg:text-2xl">Trợ lí học tập ảo</span>
          </button>

          {/* Desktop User Info */}
          <div className="hidden items-center gap-3 lg:flex">
            <span className="text-sm font-semibold text-indigo-50 lg:text-base">
              Xin chào, {user?.displayName || user?.email || 'Giáo viên'}
            </span>
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt="Avatar"
                className="h-11 w-11 rounded-full border-2 border-white/60 object-cover"
              />
            )}
            <button
              className="touch-btn bg-rose-600/90 text-white hover:bg-rose-700"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          </div>

          {/* Mobile menu trigger */}
          <div className="lg:hidden">
            <button
              className="touch-btn bg-white/15 text-white hover:bg-white/25"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-label="Mở menu giáo viên"
            >
              {isMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="border-t border-white/20 bg-indigo-900/85 px-4 pb-4 pt-3 lg:hidden">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-2">
              <p className="text-sm font-semibold text-indigo-50">
                Xin chào, {user?.displayName || user?.email || 'Giáo viên'}
              </p>

              {onBack && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onBack();
                  }}
                  className="touch-btn w-full bg-white/15 text-white hover:bg-white/25"
                >
                  ← Quay lại
                </button>
              )}

              <button
                className="touch-btn w-full bg-rose-600/90 text-white hover:bg-rose-700"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleLogout();
                }}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Breadcrumbs Navigation */}
      {breadcrumbs.length > 0 && (
        <nav className={`${isMenuOpen ? 'hidden lg:block' : ''} sticky top-16 z-40 border-b border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-soft sm:top-20`}>
          <div className="app-shell flex flex-wrap items-center gap-1 py-2 text-xs sm:gap-2 sm:text-sm">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="text-gray-400 mx-1">/</span>}
                {item.path ? (
                  <button
                    onClick={() => navigate(item.path)}
                    className="text-indigo-600 hover:text-purple-600 hover:underline transition-colors font-medium"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className="text-gray-600 font-medium">{item.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </nav>
      )}

      {/* Navigation Bar */}
      {navItems.length > 0 && (
        <nav className={`${isMenuOpen ? 'hidden lg:block' : ''} sticky top-[6.5rem] z-40 border-b-2 border-purple-300/70 bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-600 shadow-soft-md sm:top-[8.75rem]`}>
          <div className="app-shell flex items-center gap-2 py-1 sm:py-2">
            {onBack && (
              <button
                onClick={onBack}
                className="hidden touch-btn border border-white/30 bg-white/10 text-white hover:bg-white/20 lg:inline-flex"
              >
                ← Quay lại
              </button>
            )}

            <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
              {navItems.map((item, index) => (
                <button
                  key={index} 
                  onClick={item.action}
                  className="flex items-center gap-2.5 px-4 lg:px-6 py-3 lg:py-4 text-white text-opacity-90 font-bold text-xs lg:text-sm cursor-pointer transition-all duration-300 border-b-4 border-transparent hover:text-white hover:border-yellow-300 hover:bg-purple-500 hover:bg-opacity-20 uppercase tracking-widest whitespace-nowrap"
                >
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}
    </>
  );
};

export default FacultyHeader;
