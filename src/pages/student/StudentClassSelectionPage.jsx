import React, { useState, useEffect, useCallback } from 'react';
import classService from '../../services/faculty/classService';
import StudentHeader from '../../components/student/StudentHeader';

const StudentClassSelectionPage = ({ user, onSelectClass, onSignOut }) => {
  
  const [joinedClasses, setJoinedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Pastel color palette for class cards
  const pastelColors = [
    { bg: 'card-pastel-pink', mascot: '🐷', name: 'Piggy' },
    { bg: 'card-pastel-green', mascot: '🐸', name: 'Froggy' },
    { bg: 'card-pastel-yellow', mascot: '🐥', name: 'Chicky' },
    { bg: 'card-pastel-blue', mascot: '🐬', name: 'Dolphin' },
    { bg: 'card-pastel-purple', mascot: '🦄', name: 'Unicorn' },
    { bg: 'card-pastel-orange', mascot: '🐯', name: 'Tiger' },
  ];

  // Ensure onSelectClass is a function
  const handleSelectClassSafely = useCallback((cls) => {
    if (typeof onSelectClass === 'function') {
      onSelectClass(cls);
    } else {
    }
  }, [onSelectClass]);

  const loadClasses = useCallback(async () => {
    try {
      setLoading(true);
      const classes = await classService.getClassesByStudent(user.uid);
      setJoinedClasses(classes || []);
    } catch (err) {
      setError('Lỗi khi tải danh sách lớp');
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleJoinClass = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setError('Vui lòng nhập mã lớp');
      return;
    }

    try {
      // Tìm lớp theo joinId (mã 6 chữ số)
      const classData = await classService.getClassByJoinId(joinCode.trim());
      if (!classData) {
        setError('Mã lớp không tồn tại');
        return;
      }

      // Kiểm tra đã join chưa
      if (classData.students?.includes(user.uid)) {
        setError('Bạn đã là thành viên của lớp này');
        return;
      }

      // Thêm vào lớp
      await classService.addStudentToClass(classData.id, user.uid);
      setJoinCode('');
      setError(null);
      setSuccess('Tham gia lớp thành công!');
      setTimeout(() => setSuccess(null), 2000);
      await loadClasses();
    } catch (err) {
      setError('Lỗi khi tham gia lớp');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
        <div className="text-xl font-bold text-blue-600 font-quicksand sm:text-2xl">
          ✨ Đang tải dữ liệu...
        </div>
      </div>
    );
  }

  // const navItems = [
  //   { icon: '📚', label: 'Chọn Lớp Học' }
  // ];

  return (
    <div className="student-class-selection min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <StudentHeader user={user} onLogout={onSignOut}  />

      <div className="app-shell section-shell">
        {/* Join Form - Nâng cấp 3D */}
        <div className="join-form game-card mb-6 rounded-[2rem] bg-white p-5 shadow-lg sm:mb-8 sm:p-6 lg:p-8">
          <h3 className="mb-4 text-2xl font-bold text-gray-800 font-quicksand sm:mb-6 sm:text-3xl">
            🚀 Tham gia lớp mới
          </h3>
          <form onSubmit={handleJoinClass} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <input
              type="text"
              placeholder="Nhập mã lớp..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="h-11 flex-1 rounded-[2rem] border-2 border-blue-300 px-4 text-sm transition-all focus:outline-none focus:border-blue-500 font-quicksand sm:min-w-64 sm:text-base"
            />
            <button type="submit" className="touch-btn btn-3d rounded-[2rem] bg-gradient-to-r from-green-400 to-green-500 px-5 text-white font-quicksand sm:px-8">
              ✓ Tham gia
            </button>
          </form>
        </div>

        {error && (
          <div className="error-message mb-4 rounded-[2rem] border-l-4 border-red-800 bg-red-100 px-4 py-3 text-sm text-red-800 shadow-md font-quicksand sm:px-6 sm:text-base lg:px-8">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="success-message mb-4 rounded-[2rem] border-l-4 border-green-800 bg-green-100 px-4 py-3 text-sm text-green-800 shadow-md font-quicksand sm:px-6 sm:text-base lg:px-8">
            ✅ {success}
          </div>
        )}

        {joinedClasses.length === 0 ? (
          <div className="empty-state game-card rounded-[2rem] bg-white p-8 text-center shadow-lg sm:p-12 lg:p-16">
            <p className="mb-4 text-5xl sm:mb-6 sm:text-6xl">📭</p>
            <p className="mb-2 text-xl font-bold text-gray-800 font-quicksand sm:text-2xl">
              Bạn chưa tham gia lớp nào
            </p>
            <p className="text-sm text-gray-600 font-quicksand sm:text-base lg:text-lg">
              Vui lòng nhập mã lớp để bắt đầu hành trình học tập!
            </p>
          </div>
        ) : (
          <div className="classes-section">
            <h2 className="mb-5 text-2xl font-bold text-gray-800 font-quicksand sm:mb-6 sm:text-3xl lg:mb-8 lg:text-4xl">
              🎓 Các lớp của bạn
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:gap-8">
              {joinedClasses.map((cls, index) => {
                const colorScheme = pastelColors[index % pastelColors.length];
                return (
                  <div
                    key={cls.id}
                    className={`${colorScheme.bg} game-card cursor-pointer rounded-[2rem] p-5 shadow-lg transition-all duration-300 hover:-translate-y-2 sm:p-6 lg:p-7`}
                    onClick={() => {
                      handleSelectClassSafely(cls);
                    }}
                  >
                    {/* Mascot với animation */}
                    <div className="mb-3 text-center text-5xl animate-bounce-gentle sm:mb-4 sm:text-6xl lg:text-7xl">
                      {colorScheme.mascot}
                    </div>

                    {/* Class Info */}
                    <h3 className="my-2 text-center text-xl font-bold text-gray-800 font-quicksand sm:my-3 sm:text-2xl">
                      {cls.name}
                    </h3>
                    <p className="my-1.5 text-center text-base font-semibold text-gray-700 font-quicksand sm:my-2 sm:text-lg">
                      Lớp {cls.grade}
                    </p>
                    <p className="my-1.5 text-center text-sm text-gray-600 font-quicksand sm:my-2">
                      Mã: <span className="font-bold text-gray-800">{cls.joinId}</span>
                    </p>

                    {/* 3D Button */}
                    <button 
                      className="touch-btn btn-3d mt-4 w-full rounded-[2rem] bg-gradient-to-r from-blue-400 to-blue-500 px-5 text-sm font-bold text-white font-quicksand sm:mt-6 sm:text-base lg:text-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectClassSafely(cls);
                      }}
                    >
                      Chọn lớp →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentClassSelectionPage;
