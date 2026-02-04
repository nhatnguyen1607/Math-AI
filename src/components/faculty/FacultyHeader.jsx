import React from 'react';

const FacultyHeader = ({ user, onLogout, onBack, navItems = [] }) => {
  const handleLogout = async () => {
    try {
      await onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      {/* Main Header */}
      <header className="flex justify-between items-center px-12 py-6 bg-gradient-to-r from-gray-700 via-gray-600 to-slate-700 backdrop-blur-md border-b-4 border-purple-500 sticky top-0 z-50 shadow-lg shadow-black/20">
        {/* Logo và Title bên trái */}
        <div className="flex items-center">
          <div className="flex items-center gap-3 cursor-pointer transition-all duration-300 hover:-translate-y-0.5">
            <span className="text-2xl animate-float">📐</span>
            <span className="text-2xl font-bold text-white drop-shadow-lg tracking-wide">MathAI</span>
          </div>
        </div>

        {/* User Info và Logout bên phải */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <span className="text-white text-base font-semibold whitespace-nowrap drop-shadow-md">
            Xin chào, {user?.displayName || user?.email || 'Giáo viên'}
          </span>
          {user?.photoURL && (
            <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-white border-opacity-40 shadow-md hover:border-opacity-80 object-cover transition-all duration-300 hover:shadow-lg hover:shadow-black/30" />
          )}
          <button className="px-8 py-3 bg-red-600 bg-opacity-80 text-white border-none rounded-lg font-semibold cursor-pointer transition-all duration-300 text-base backdrop-blur-md shadow-lg shadow-red-600/30 whitespace-nowrap hover:bg-opacity-100 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-600/40 active:translate-y-0" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
      {navItems.length > 0 && (
        <nav className="bg-gradient-to-r from-gray-600 via-slate-600 to-gray-700 border-b-2 border-purple-500 border-opacity-50 p-0 sticky top-24 z-49 shadow-md shadow-black/20">
          <div className="flex items-center gap-0 px-12 max-w-7xl mx-auto flex-wrap">
            {onBack && (
              <button className="px-6 py-4 bg-none border-none text-white text-opacity-90 font-semibold text-sm cursor-pointer transition-all duration-300 border-r-2 border-purple-500 border-opacity-40 whitespace-nowrap hover:text-white hover:bg-purple-500 hover:bg-opacity-20 hover:-translate-x-1" onClick={onBack} title="Quay lại">
                ← Quay lại
              </button>
            )}
            <div className="flex gap-0 flex-1">
              {navItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2.5 px-6 py-4 text-white text-opacity-90 font-bold text-xs cursor-pointer transition-all duration-300 border-b-4 border-transparent hover:text-white hover:border-purple-500 hover:bg-purple-500 hover:bg-opacity-10 uppercase tracking-widest">
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </nav>
      )}
    </>
  );
};

export default FacultyHeader;
