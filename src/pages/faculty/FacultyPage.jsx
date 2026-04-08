import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FacultyClassManagementPage from './FacultyClassManagementPage';
import FacultyHeader from '../../components/faculty/FacultyHeader';
import { query, where, getDocs, collection, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const FacultyPage = ({ user, userData, onSignOut }) => {
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showStudentList, setShowStudentList] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [studentDetails, setStudentDetails] = useState({}); // Lưu thông tin chi tiết học sinh
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // Fetch thông tin chi tiết học sinh khi selectedClass thay đổi
  useEffect(() => {
    const fetchStudentDetails = async () => {
      if (!selectedClass || !selectedClass.students) return;

      const details = {};
      for (const studentId of selectedClass.students) {
        try {
          const userSnap = await getDoc(doc(db, 'users', studentId));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            details[studentId] = {
              displayName: userData.displayName || userData.name || 'Học sinh',
              email: userData.email || studentId
            };
          } else {
            details[studentId] = {
              displayName: 'Học sinh (không tìm thấy)',
              email: studentId
            };
          }
        } catch (error) {
          console.error('Error fetching student details:', error);
          details[studentId] = {
            displayName: 'Học sinh',
            email: studentId
          };
        }
      }
      setStudentDetails(details);
    };

    fetchStudentDetails();
  }, [selectedClass]);

  const handleSelectClass = useCallback((cls) => {
    setSelectedClass(cls);
  }, []);

  const handleBackToClasses = useCallback(() => {
    setSelectedClass(null);
  }, []);

  const handleNavigate = (path, params = {}) => {
    navigate(path, { state: { selectedClass, classId: selectedClass?.id, ...params } });
  };

  const handleWorksheetClick = () => {
    handleNavigate('/faculty/worksheet/management');
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa học sinh "${studentName}" khỏi lớp?\n\nTất cả phiếu bài tập của học sinh này sẽ bị xóa.`)) {
      return;
    }

    setDeleting(studentId);
    try {
      // Lấy tất cả worksheet_result của học sinh này trong lớp
      const q = query(
        collection(db, 'worksheet_results'),
        where('studentId', '==', studentId),
        where('classId', '==', selectedClass.id)
      );

      const querySnapshot = await getDocs(q);

      // Xóa từng worksheet result
      for (const docSnapshot of querySnapshot.docs) {
        await deleteDoc(doc(db, 'worksheet_results', docSnapshot.id));
      }

      // Xóa học sinh khỏi mảng students của lớp
      const updatedStudents = selectedClass.students.filter(s => {
        const id = typeof s === 'string' ? s : s.id;
        return id !== studentId;
      });

      await updateDoc(doc(db, 'classes', selectedClass.id), {
        students: updatedStudents
      });

      // Cập nhật lại selectedClass
      setSelectedClass({
        ...selectedClass,
        students: updatedStudents
      });

      alert('Xóa học sinh thành công!');
    } catch (error) {
      console.error('Lỗi khi xóa học sinh:', error);
      alert('Có lỗi xảy ra khi xóa học sinh. Vui lòng thử lại.');
    } finally {
      setDeleting(null);
    }
  };

  // Early return if loading
  if (loading) {
    return <div className="faculty-loading">Đang tải...</div>;
  }

  if (!selectedClass) {
    return <FacultyClassManagementPage user={user} onSelectClass={handleSelectClass} onSignOut={onSignOut} />;
  }

  // const navItems = [
  //   { icon: '📚', label: 'Quản lí Lớp: ' + selectedClass.name }
  // ];

  return (
    <div className="faculty-page min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <FacultyHeader user={user} onLogout={onSignOut} />

      {/* Welcome Section */}
      <div className="app-shell section-shell">
        <div className="w-full">
          <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-gray-800 sm:text-3xl lg:text-4xl">Chào mừng, {user?.displayName || 'Giáo viên'}! 👋</h1>
              <p className="text-sm text-gray-700 sm:text-base lg:text-lg">
                Lớp:{' '}
                <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-base font-bold text-purple-700 sm:text-lg lg:text-xl">{selectedClass.name}</span>
              </p>
            </div>
            <button
              onClick={handleBackToClasses}
              className="touch-btn w-full rounded-lg text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-purple-100 hover:text-purple-700 sm:w-auto sm:text-base"
            >
              <span className="text-lg">←</span> Quay lại
            </button>
          </div>

          {/* Stats Section */}
          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <div className="rounded-xl border-l-4 border-purple-500 bg-white p-5 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-6">
              <div className="text-3xl font-bold text-purple-600 mb-2">{selectedClass.students?.length || 0}</div>
              <div className="text-gray-700 font-semibold">Học sinh</div>
              <p className="text-gray-500 text-sm mt-1">trong lớp này</p>
            </div>
            <div className="rounded-xl bg-white bg-opacity-95 p-5 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-6">
              <div className="text-3xl font-bold text-blue-600 mb-2">0</div>
              <div className="text-gray-700 font-semibold">Chủ đề</div>
              <p className="text-gray-500 text-sm mt-1">được tạo</p>
            </div>
            <div className="rounded-xl bg-white bg-opacity-95 p-5 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-6">
              <div className="text-3xl font-bold text-green-600 mb-2">0</div>
              <div className="text-gray-700 font-semibold">Đề thi</div>
              <p className="text-gray-500 text-sm mt-1">đã tạo</p>
            </div>
            <div className="rounded-xl bg-white bg-opacity-95 p-5 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-6">
              <div className="text-3xl font-bold text-orange-600 mb-2">0</div>
              <div className="text-gray-700 font-semibold">Phiên học</div>
              <p className="text-gray-500 text-sm mt-1">đang hoạt động</p>
            </div>
          </div>

          {/* Main Actions */}
          <div className="mb-8">
            <h2 className="mb-5 text-2xl font-bold text-gray-800 sm:mb-6 sm:text-3xl">Quản lí lớp học</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:gap-8">
              <div className="cursor-pointer rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-8" onClick={() => handleNavigate('/faculty/learning-pathway/game', { type: 'startup' })}>
                <div className="mb-3 text-5xl sm:mb-4 sm:text-6xl">🚀</div>
                <h3 className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">Trò chơi</h3>
                <p className="mb-5 text-sm text-gray-600 sm:mb-6 sm:text-base">Tạo trò chơi giáo dục để giúp học sinh học tập theo cách vui vẻ và tương tác</p>
                <button className="touch-btn w-full rounded-lg bg-gradient-to-r from-purple-500 to-purple-700 text-base font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl">
                  Bắt đầu →
                </button>
              </div>

              <div className="cursor-pointer rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-8" onClick={handleWorksheetClick}>
                <div className="mb-3 text-5xl sm:mb-4 sm:text-6xl">📋</div>
                <h3 className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">Phiếu bài tập</h3>
                <p className="mb-5 text-sm text-gray-600 sm:mb-6 sm:text-base">Tạo và quản lý đề thi, kích hoạt phiên học trực tiếp, và xem kết quả chi tiết</p>
                <button className="touch-btn w-full rounded-lg bg-gradient-to-r from-blue-500 to-blue-700 text-base font-bold text-white shadow-lg transition-all duration-300 hover:shadow-xl">
                  Quản lý →
                </button>
              </div>
            </div>
          </div>

          {/* Student List Section */}
          <div className="mt-10">
            <button
              onClick={() => setShowStudentList(!showStudentList)}
              className="mb-5 flex w-full items-center justify-between rounded-xl bg-white px-6 py-4 shadow-lg transition-all duration-300 hover:shadow-xl sm:w-auto"
            >
              <span className="text-lg font-bold text-gray-800">👥 Danh sách học sinh ({selectedClass.students?.length || 0})</span>
              <span className={`text-2xl transition-transform duration-300 ${showStudentList ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {showStudentList && (
              <div className="rounded-xl bg-white p-6 shadow-xl sm:p-8">
                {/* Search Box */}
                <div className="mb-6">
                  <input
                    type="text"
                    placeholder="🔍 Tìm kiếm tên học sinh..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-300 px-4 py-2 text-base transition-all duration-300 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Student List */}
                <div className="space-y-2">
                  {(!selectedClass.students || selectedClass.students.length === 0) ? (
                    <div className="py-8 text-center text-gray-500">
                      <p className="text-lg">Chưa có học sinh trong lớp</p>
                    </div>
                  ) : (
                    selectedClass.students
                      .filter((studentId) => {
                        const studentInfo = studentDetails[studentId];
                        if (!studentInfo) return true;
                        const searchText = `${studentInfo.displayName} ${studentInfo.email}`.toLowerCase();
                        return searchText.includes(studentSearch.toLowerCase());
                      })
                      .map((studentId, idx) => {
                        const studentInfo = studentDetails[studentId] || {
                          displayName: '...',
                          email: ''
                        };
                        
                        return (
                          <div
                            key={studentId}
                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 transition-all duration-300 hover:bg-gray-100"
                          >
                            <div className="flex-1">
                              <div className="text-base font-medium text-gray-800">{studentInfo.displayName}</div>
                              <div className="text-sm text-gray-500">{studentInfo.email}</div>
                            </div>
                            <button
                              onClick={() => handleDeleteStudent(studentId, studentInfo.displayName)}
                              disabled={deleting === studentId}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 transition-all duration-300 hover:bg-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Xóa học sinh"
                            >
                              {deleting === studentId ? '...' : '×'}
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


export default FacultyPage;
