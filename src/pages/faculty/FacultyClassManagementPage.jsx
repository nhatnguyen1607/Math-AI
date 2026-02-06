import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import classService from '../../services/classService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyClassManagementPage = ({ user, onSelectClass, onSignOut }) => {  
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState('5');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Ensure onSelectClass is a function
  const handleSelectClassSafely = useCallback((cls) => {
    if (typeof onSelectClass === 'function') {
      onSelectClass(cls);
    } else {
      navigate(`/faculty/class-management`, { state: { selectedClass: cls } });
    }
  }, [onSelectClass, navigate]);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  const loadClasses = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await classService.getClassesByFaculty(user.uid);
      setClasses(data || []);
    } catch (err) {
      setError('Lỗi khi tải danh sách lớp');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Vui lòng đăng nhập lại');
      return;
    }
    if (!className.trim()) {
      setError('Vui lòng nhập tên lớp');
      return;
    }

    try {
      await classService.createClass({
        facultyId: user.uid,
        name: className,
        grade: classGrade,
        description: ''
      });
      setClassName('');
      setShowForm(false);
      setError(null);
      await loadClasses();
    } catch (err) {
      setError('Lỗi khi tạo lớp');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-purple-500 text-xl">Đang tải...</div>;
  }

  // const navItems = [
  //   { icon: '📚', label: 'Quản lí Lớp' }
  // ];

  return (
    <div className="p-0 min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col">
      <FacultyHeader user={user} onLogout={onSignOut} />
      


      <div className="px-12 py-8 max-w-6xl mx-auto w-full">
        <button
          className="px-8 py-3.5 bg-gradient-to-r from-purple-500 to-purple-700 text-white border-none rounded-lg font-semibold cursor-pointer transition-all duration-300 shadow-lg shadow-purple-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/60"
          onClick={() => setShowForm(!showForm)}
        >
          ➕ Tạo lớp mới
        </button>
      </div>

      {showForm && (
        <div className="px-12 max-w-6xl mx-auto w-full bg-white bg-opacity-95 rounded-3xl mb-8 shadow-xl p-8">
          <form onSubmit={handleCreateClass} className="flex gap-4 flex-wrap">
            <input
              type="text"
              placeholder="Tên lớp (vd: Lớp 5A)"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="flex-1 min-w-52 px-3.5 py-3.5 border-2 border-gray-300 rounded-lg text-base transition-colors duration-300 focus:outline-none focus:border-purple-500 focus:shadow-md focus:shadow-purple-500/20"
            />
            <select
              value={classGrade}
              onChange={(e) => setClassGrade(e.target.value)}
              className="flex-1 min-w-52 px-3.5 py-3.5 border-2 border-gray-300 rounded-lg text-base transition-colors duration-300 focus:outline-none focus:border-purple-500 focus:shadow-md focus:shadow-purple-500/20"
            >
              <option value="3">Lớp 3</option>
              <option value="4">Lớp 4</option>
              <option value="5">Lớp 5</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="px-6 py-3.5 border-none rounded-lg font-semibold cursor-pointer transition-all duration-300 bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-green-500/50">✓ Tạo</button>
              <button
                type="button"
                className="px-6 py-3.5 border-none rounded-lg font-semibold cursor-pointer transition-all duration-300 bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-500/50"
                onClick={() => setShowForm(false)}
              >
                ✕ Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-800 px-6 py-4 rounded-lg mb-4 border-l-4 border-red-800 shadow-md shadow-red-800/15 mx-12 max-w-6xl">
          {error}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="text-center py-16 bg-white bg-opacity-95 rounded-3xl shadow-xl mx-12 max-w-6xl">
          <p className="text-5xl mb-0">📭 Chưa có lớp nào</p>
          <p className="mt-4 mb-0 text-gray-600 text-lg">Hãy tạo lớp mới để bắt đầu</p>
        </div>
      ) : (
        <div className="px-12 py-8 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {classes.map(cls => (
            <div
              key={cls.id}
              className="bg-white bg-opacity-95 rounded-xl p-8 shadow-lg hover:shadow-2xl text-center cursor-pointer transition-all duration-300 border-2 border-transparent hover:border-purple-500 hover:-translate-y-2 bg-white"
              onClick={() => {
                handleSelectClassSafely(cls);
              }}
            >
              <div className="text-5xl mb-4 block">🎓</div>
              <h3 className="text-2xl text-gray-900 my-2 font-bold">{cls.name}</h3>
              <p className="bg-gradient-to-r from-purple-500 to-purple-700 bg-clip-text text-transparent font-bold my-2 text-lg">Lớp {cls.grade}</p>
              <p className="text-gray-600 text-base my-2 mb-6">{cls.students?.length || 0} học sinh</p>
              <div className="bg-gray-100 px-5 py-5 rounded-lg mb-6 border-2 border-dashed border-gray-300">
                <label className="block text-sm text-gray-600 font-semibold mb-2">Mã lớp:</label>
                <div className="bg-white font-mono text-lg font-bold text-purple-500 px-3 py-3 rounded text-center mb-3 border border-gray-300 tracking-wider">{cls.joinId}</div>
                <button
                  className="w-full px-2 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white border-none rounded text-sm font-semibold cursor-pointer transition-all duration-300 shadow-md shadow-amber-500/30 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(cls.joinId);
                    alert('Đã sao chép mã lớp!');
                  }}
                >
                  📋 Sao chép
                </button>
              </div>
              <button className="w-full px-3.5 py-3.5 bg-gradient-to-r from-purple-500 to-purple-700 text-white border-none rounded-lg font-semibold cursor-pointer transition-all duration-300 shadow-lg shadow-purple-500/30 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/50">Chọn lớp</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FacultyClassManagementPage;
