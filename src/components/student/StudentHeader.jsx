import React, { useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../../firebase';

const StudentHeader = ({ user, onLogout, onBack, navItems = [] }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);

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
      <header className="flex justify-between items-center px-12 py-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 backdrop-blur-md border-b-4 border-cyan-400 sticky top-0 z-50 shadow-lg shadow-black/20">
        {/* Logo và Title bên trái */}
        <div className="flex items-center">
          <div className="flex items-center gap-3 cursor-pointer transition-all duration-300 hover:-translate-y-0.5">
            <span className="text-2xl animate-float">📐</span>
            <span className="text-2xl font-bold text-white drop-shadow-lg tracking-wide">Trợ lí học tập ảo</span>
          </div>
        </div>

        {/* User Info và Logout bên phải */}
        <div className="flex items-center gap-5 flex-shrink-0">
          {isEditingName ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-3 py-2 rounded-lg border-2 border-white/50 bg-white/20 text-white placeholder-white/70 focus:outline-none focus:border-white"
                placeholder="Nhập tên mới"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                disabled={isUpdating}
                className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold text-sm transition-all hover:bg-green-600 disabled:opacity-50"
              >
                {isUpdating ? '...' : '✓'}
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false);
                  setNewName(user?.displayName || '');
                }}
                className="px-4 py-2 bg-red-500/70 text-white rounded-lg font-semibold text-sm transition-all hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ) : (
            <span
              onClick={() => setIsEditingName(true)}
              className="text-white text-base font-semibold whitespace-nowrap drop-shadow-md cursor-pointer hover:opacity-70 transition-opacity"
              title="Bấm để đổi tên"
            >
              Xin chào, {user?.displayName || user?.email || 'Học sinh'} ✏️
            </span>
          )}
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
        <nav className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 border-b-2 border-cyan-400 border-opacity-50 p-0 sticky top-24 z-49 shadow-md shadow-black/20">
          <div className="flex items-center gap-0 px-12 max-w-7xl mx-auto flex-wrap">
            {onBack && (
              <button className="px-6 py-4 bg-none border-none text-white text-opacity-90 font-semibold text-sm cursor-pointer transition-all duration-300 border-r-2 border-cyan-400 border-opacity-30 whitespace-nowrap hover:text-white hover:bg-cyan-400 hover:bg-opacity-20 hover:-translate-x-1" onClick={onBack} title="Quay lại">
                ← Quay lại
              </button>
            )}
            <div className="flex gap-0 flex-1">
              {navItems.map((item, index) => (
                <div
                  key={index}
                  onClick={item.action}
                  className="flex items-center gap-2.5 px-6 py-4 text-white text-opacity-90 font-bold text-xs cursor-pointer transition-all duration-300 border-b-4 border-transparent hover:text-white hover:border-cyan-400 hover:bg-cyan-400 hover:bg-opacity-10 uppercase tracking-widest"
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

export default StudentHeader;
