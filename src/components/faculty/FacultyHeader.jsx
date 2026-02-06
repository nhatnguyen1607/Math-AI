import React from 'react';
import { useNavigate } from 'react-router-dom';

const FacultyHeader = ({ user, onLogout, onBack, navItems = [], breadcrumbs = [] }) => {
  const navigate = useNavigate();

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
      <header className="flex justify-between items-center px-8 lg:px-12 py-4 lg:py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 backdrop-blur-md border-b-4 border-purple-400 sticky top-0 z-50 shadow-soft-lg">
        {/* Logo và Title bên trái */}
        <div className="flex items-center cursor-pointer transition-all duration-300 hover:scale-105" onClick={() => navigate('/faculty')}>
          <span className="text-2xl lg:text-3xl animate-float">📐</span>
          <span className="text-xl lg:text-2xl font-bold text-white drop-shadow-lg tracking-wide ml-3 hidden sm:inline">MathAI</span>
        </div>

        {/* User Info và Logout bên phải */}
        <div className="flex items-center gap-3 lg:gap-5 flex-shrink-0">
          <span className="text-white text-sm lg:text-base font-semibold whitespace-nowrap drop-shadow-md hidden sm:inline">
            Xin chào, {user?.displayName || user?.email || 'Giáo viên'}
          </span>
          {user?.photoURL && (
            <img 
              src={user.photoURL} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full border-2 border-white border-opacity-40 shadow-md hover:border-opacity-80 object-cover transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/50" 
            />
          )}
          <button 
            className="px-4 lg:px-8 py-2 lg:py-3 bg-red-600 bg-opacity-80 text-white border-none rounded-xl font-semibold cursor-pointer transition-all duration-300 text-sm lg:text-base backdrop-blur-md shadow-soft hover:bg-opacity-100 hover:-translate-y-1 hover:shadow-soft-lg active:translate-y-0" 
            onClick={handleLogout}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Breadcrumbs Navigation */}
      {breadcrumbs.length > 0 && (
        <nav className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-200 px-8 lg:px-12 py-3 sticky top-20 z-40 shadow-soft">
          <div className="flex items-center gap-2 text-sm">
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
        <nav className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 border-b-2 border-purple-400 border-opacity-50 p-0 sticky top-24 lg:top-32 z-40 shadow-soft-md overflow-x-auto">
          <div className="flex items-center gap-0 px-8 lg:px-12 max-w-7xl mx-auto flex-wrap min-h-16 lg:min-h-20">
            <div className="flex gap-0 flex-1 overflow-x-auto">
              {navItems.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2.5 px-4 lg:px-6 py-3 lg:py-4 text-white text-opacity-90 font-bold text-xs lg:text-sm cursor-pointer transition-all duration-300 border-b-4 border-transparent hover:text-white hover:border-yellow-300 hover:bg-purple-500 hover:bg-opacity-20 uppercase tracking-widest whitespace-nowrap"
                >
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
