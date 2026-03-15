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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-2xl font-bold text-blue-600 font-quicksand">
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

      <div className="selection-content p-8 max-w-7xl mx-auto">
        {/* Join Form - Nâng cấp 3D */}
        <div className="join-form bg-white rounded-max shadow-lg p-8 mb-8 game-card">
          <h3 className="text-3xl font-bold text-gray-800 mb-6 font-quicksand">
            🚀 Tham gia lớp mới
          </h3>
          <form onSubmit={handleJoinClass} className="flex gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Nhập mã lớp..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="flex-1 min-w-64 px-4 py-4 border-3 border-blue-300 rounded-max text-base transition-all focus:outline-none focus:border-blue-500 font-quicksand"
            />
            <button type="submit" className="btn-3d px-8 py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-max font-quicksand">
              ✓ Tham gia
            </button>
          </form>
        </div>

        {error && (
          <div className="error-message bg-red-100 text-red-800 px-8 py-4 rounded-max mb-4 border-l-4 border-red-800 shadow-md font-quicksand">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="success-message bg-green-100 text-green-800 px-8 py-4 rounded-max mb-4 border-l-4 border-green-800 shadow-md font-quicksand">
            ✅ {success}
          </div>
        )}

        {joinedClasses.length === 0 ? (
          <div className="empty-state bg-white rounded-max shadow-lg p-16 text-center game-card">
            <p className="text-6xl mb-6">📭</p>
            <p className="text-2xl font-bold text-gray-800 mb-2 font-quicksand">
              Bạn chưa tham gia lớp nào
            </p>
            <p className="text-lg text-gray-600 font-quicksand">
              Vui lòng nhập mã lớp để bắt đầu hành trình học tập!
            </p>
          </div>
        ) : (
          <div className="classes-section">
            <h2 className="text-4xl font-bold text-gray-800 mb-8 font-quicksand">
              🎓 Các lớp của bạn
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {joinedClasses.map((cls, index) => {
                const colorScheme = pastelColors[index % pastelColors.length];
                return (
                  <div
                    key={cls.id}
                    className={`${colorScheme.bg} rounded-max p-8 cursor-pointer transition-all duration-300 transform hover:scale-110 hover:-translate-y-3 game-card shadow-lg`}
                    onClick={() => {
                      handleSelectClassSafely(cls);
                    }}
                  >
                    {/* Mascot với animation */}
                    <div className="text-7xl mb-4 text-center animate-bounce-gentle">
                      {colorScheme.mascot}
                    </div>

                    {/* Class Info */}
                    <h3 className="text-2xl font-bold text-gray-800 my-3 text-center font-quicksand">
                      {cls.name}
                    </h3>
                    <p className="text-lg font-semibold text-gray-700 my-2 text-center font-quicksand">
                      Lớp {cls.grade}
                    </p>
                    <p className="text-sm text-gray-600 my-2 text-center font-quicksand">
                      Mã: <span className="font-bold text-gray-800">{cls.joinId}</span>
                    </p>

                    {/* 3D Button */}
                    <button 
                      className="btn-3d w-full mt-6 px-6 py-4 bg-gradient-to-r from-blue-400 to-blue-500 text-white rounded-max font-bold text-lg font-quicksand"
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
