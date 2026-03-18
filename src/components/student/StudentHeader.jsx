import React, { useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../../firebase';

const StudentHeader = ({ user, onLogout, onBack, navItems = [] }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      alert('Vui lòng nhập tên');
      return;
    }

    try {
      setIsUpdating(true);
      
      // Update Firebase Auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: newName.trim()
        });
      }

      // Update Firestore user document
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: newName.trim(),
          updatedAt: new Date()
        });
      }

      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating name:', error);
      alert('Lỗi khi cập nhật tên. Vui lòng thử lại!');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      {/* Main Header */}
      <header className="sticky top-0 z-50 border-b-4 border-cyan-300/80 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 shadow-lg shadow-cyan-900/20">
        <div className="app-shell flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-20 sm:py-3">
          {/* Logo và Title bên trái */}
          <div className="flex items-center">
            <div className="flex items-center gap-2.5 transition-all duration-300 hover:-translate-y-0.5">
              <span className="text-xl animate-float sm:text-2xl">📐</span>
              <span className="text-base font-bold text-white drop-shadow-lg tracking-wide sm:text-xl lg:text-2xl">Trợ lí học tập ảo</span>
            </div>
          </div>

          {/* Desktop User Area */}
          <div className="hidden items-center gap-3 lg:flex">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-11 rounded-xl border-2 border-white/50 bg-white/20 px-3 text-white placeholder-white/70 focus:outline-none focus:border-white"
                  placeholder="Nhập tên mới"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={isUpdating}
                  className="touch-btn bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isUpdating ? '...' : '✓'}
                </button>
                <button
                  onClick={() => {
                    setIsEditingName(false);
                    setNewName(user?.displayName || '');
                  }}
                  className="touch-btn bg-rose-500/80 text-white hover:bg-rose-600"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="touch-btn bg-white/15 text-white hover:bg-white/25"
                title="Bấm để đổi tên"
              >
                Xin chào, {user?.displayName || user?.email || 'Học sinh'} ✏️
              </button>
            )}
            {user?.photoURL && (
              <img src={user.photoURL} alt="Avatar" className="h-11 w-11 rounded-full border-2 border-white/50 object-cover shadow-md" />
            )}
            <button className="touch-btn bg-rose-600/90 text-white hover:bg-rose-700" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>

          {/* Mobile quick actions */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              className="touch-btn bg-white/15 text-white hover:bg-white/25"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-label="Mở menu"
            >
              {isMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMenuOpen && (
          <div className="border-t border-white/20 bg-cyan-700/95 px-4 pb-4 pt-3 lg:hidden">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
              <p className="text-sm font-semibold text-cyan-50">Xin chào, {user?.displayName || user?.email || 'Học sinh'}</p>

              {isEditingName ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-11 rounded-xl border-2 border-white/50 bg-white/20 px-3 text-white placeholder-white/70 focus:outline-none focus:border-white"
                    placeholder="Nhập tên mới"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isUpdating}
                    className="touch-btn bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {isUpdating ? '...' : 'Lưu tên'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false);
                      setNewName(user?.displayName || '');
                    }}
                    className="touch-btn bg-rose-500/80 text-white hover:bg-rose-600"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="touch-btn w-full bg-white/15 text-white hover:bg-white/25"
                >
                  Đổi tên hiển thị
                </button>
              )}

              <button
                className="touch-btn w-full bg-rose-600/90 text-white hover:bg-rose-700"
                onClick={handleLogout}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Navigation Bar */}
      {navItems.length > 0 && (
        <nav className={`${isMenuOpen ? 'hidden lg:block' : ''} sticky top-16 z-40 border-b-2 border-cyan-300/70 bg-gradient-to-r from-cyan-600 to-blue-600 shadow-md sm:top-20`}>
          <div className="app-shell flex items-center gap-2 py-1">
            {onBack && (
              <button className="touch-btn border border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={onBack} title="Quay lại">
                ← Quay lại
              </button>
            )}
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
              {navItems.map((item, index) => (
                <button
                  key={index}
                  onClick={item.action}
                  className="touch-btn whitespace-nowrap border border-white/25 bg-white/10 text-white hover:bg-white/20"
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

export default StudentHeader;
