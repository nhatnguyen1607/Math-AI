import React, { useState, useEffect, useCallback } from 'react';
import classService from '../../services/classService';
import StudentHeader from '../../components/student/StudentHeader';

const StudentClassSelectionPage = ({ user, onSelectClass, onSignOut }) => {
  console.log('📥 StudentClassSelectionPage received props:', { user: user?.uid, onSelectClass: typeof onSelectClass, onSignOut: typeof onSignOut });
  
  const [joinedClasses, setJoinedClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Ensure onSelectClass is a function
  const handleSelectClassSafely = useCallback((cls) => {
    console.log('🎓 StudentClassSelectionPage: handleSelectClassSafely called with:', cls);
    console.log('🎓 onSelectClass type:', typeof onSelectClass);
    if (typeof onSelectClass === 'function') {
      console.log('✅ Calling onSelectClass...');
      onSelectClass(cls);
      console.log('✅ onSelectClass completed');
    } else {
      console.error('❌ onSelectClass is not a function:', onSelectClass);
    }
  }, [onSelectClass]);

  const loadClasses = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📥 loadClasses: fetching classes for user:', user.uid);
      const classes = await classService.getClassesByStudent(user.uid);
      console.log('📥 loadClasses: received classes:', classes);
      setJoinedClasses(classes || []);
    } catch (err) {
      console.error('Error loading classes:', err);
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
      console.error('Error joining class:', err);
      setError('Lỗi khi tham gia lớp');
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  const navItems = [
    { icon: '📚', label: 'Chọn Lớp Học' }
  ];

  return (
    <div className="student-class-selection">
      <StudentHeader user={user} onLogout={onSignOut} navItems={navItems} />

      <div className="selection-content">
        <div className="join-form">
          <h3>Tham gia lớp mới</h3>
          <form onSubmit={handleJoinClass}>
            <input
              type="text"
              placeholder="Nhập mã lớp..."
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="input-field"
            />
            <button type="submit" className="btn-join">✓ Tham gia</button>
          </form>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {success && (
          <div className="success-message">{success}</div>
        )}

        {joinedClasses.length === 0 ? (
          <div className="empty-state">
            <p>📭 Bạn chưa tham gia lớp nào</p>
            <p>Vui lòng nhập mã lớp để tham gia</p>
          </div>
        ) : (
          <div className="classes-section">
            <h2>Các lớp của bạn</h2>
            <div className="classes-grid">
              {joinedClasses.map(cls => (
                <div
                  key={cls.id}
                  className="class-card"
                  onClick={() => {
                    console.log('🖱️ Class card clicked:', cls.name);
                    handleSelectClassSafely(cls);
                  }}
                >
                  <div className="class-icon">🎓</div>
                  <h3>{cls.name}</h3>
                  <p className="class-grade">Lớp {cls.grade}</p>
                  <p className="class-code">Mã: {cls.joinId}</p>
                  <button className="btn-select">Chọn lớp</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentClassSelectionPage;
