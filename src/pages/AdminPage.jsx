import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const AdminPage = ({ onLogout }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLoggedInUsers();
  }, []);

  const fetchLoggedInUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setUsers(userList);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Chưa đăng nhập';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('vi-VN');
  };

  const getFilteredUsers = () => {
    if (!searchTerm) return users;
    
    const term = searchTerm.toLowerCase();
    return users.filter(user => {
      const email = (user.email || '').toLowerCase();
      const displayName = (user.displayName || '').toLowerCase();
      return email.includes(term) || displayName.includes(term);
    });
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      student: { bg: 'bg-blue-100', text: 'text-blue-800', label: '📚 Học sinh' },
      faculty: { bg: 'bg-green-100', text: 'text-green-800', label: '👨‍🏫 Giáo viên' },
      admin: { bg: 'bg-red-100', text: 'text-red-800', label: '⚙️ Quản trị' }
    };
    const config = roleConfig[role] || roleConfig.student;
    return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${config.bg} ${config.text}`}>{config.label}</span>;
  };

  const handleLockUser = async (userId, isLocked) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isLocked: !isLocked,
        updatedAt: new Date()
      });
      fetchLoggedInUsers();
    } catch (error) {
      console.error('Error updating lock status:', error);
      alert('Lỗi khi cập nhật trạng thái khóa');
    }
  };

  const handlePromoteToFaculty = async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: 'faculty',
        updatedAt: new Date()
      });
      fetchLoggedInUsers();
    } catch (error) {
      console.error('Error promoting to faculty:', error);
      alert('Lỗi khi gán vai trò giảng viên');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-700 pb-10">
      {/* Header */}
      <div className="bg-white shadow-md p-8 mb-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">🔧 Trang quản trị</h1>
            <p className="text-lg text-gray-600">Quản lý tài khoản đã đăng nhập vào hệ thống</p>
          </div>
          <button
            onClick={onLogout}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-5">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Danh sách tài khoản đã đăng nhập</h2>
            <p className="text-gray-600 mb-4">Tổng cộng: <span className="font-semibold">{users.length}</span> tài khoản</p>
            
            {/* Search Bar */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="🔍 Tìm kiếm theo email hoặc tên người dùng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
              <p className="text-gray-600 mt-4">Đang tải dữ liệu...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">Chưa có tài khoản nào đăng nhập vào hệ thống</p>
            </div>
          ) : getFilteredUsers().length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">Không tìm thấy tài khoản nào phù hợp với tìm kiếm</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">#</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">Tên người dùng</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">Email</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">Vai trò</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">Lần đăng nhập cuối</th>
                    <th className="text-center py-4 px-4 font-semibold text-gray-700">Trạng thái</th>
                    <th className="text-center py-4 px-4 font-semibold text-gray-700">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredUsers().map((user, index) => (
                    <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 text-gray-700 font-medium">{index + 1}</td>
                      <td className="py-4 px-4 text-gray-800 font-medium">{user.displayName || 'N/A'}</td>
                      <td className="py-4 px-4 text-gray-700">{user.email || 'N/A'}</td>
                      <td className="py-4 px-4">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="py-4 px-4 text-gray-700">{formatDate(user.updatedAt)}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? '✓ Hoạt động' : '✗ Vô hiệu'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex gap-2 justify-center flex-wrap">
                          <button
                            onClick={() => handleLockUser(user.id, user.isLocked)}
                            className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                              user.isLocked
                                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
                                : 'bg-orange-100 hover:bg-orange-200 text-orange-800'
                            }`}
                          >
                            {user.isLocked ? '🔓 Mở khóa' : '🔒 Khóa'}
                          </button>
                          {user.role !== 'faculty' && user.role !== 'admin' && (
                            <button
                              onClick={() => handlePromoteToFaculty(user.id)}
                              className="px-3 py-1 rounded-lg text-sm font-semibold bg-green-100 hover:bg-green-200 text-green-800 transition-colors"
                            >
                              👨‍🏫 Gán GV
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
