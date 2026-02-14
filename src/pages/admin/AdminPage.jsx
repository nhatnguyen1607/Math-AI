import React, { useEffect, useState, useCallback } from 'react';
import adminService from '../../services/admin/adminService';
import AdminHeader from '../../components/admin/AdminHeader';
import './AdminPage.css';

/**
 * Admin Dashboard
 * Quản lý tài khoản, khóa/mở tài khoản, gán role
 */
function AdminPage({ onLogout }) {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'students', 'faculty', 'locked'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Load users on mount
  useEffect(() => {
    loadUsers();
    loadStatistics();
  }, []);

  const filterUsers = useCallback(() => {
    let filtered = users;

    // Filter by tab
    if (activeTab === 'students') {
      filtered = filtered.filter(u => u.isStudent());
    } else if (activeTab === 'faculty') {
      filtered = filtered.filter(u => u.isFaculty());
    } else if (activeTab === 'locked') {
      filtered = filtered.filter(u => u.isLocked);
    }

    // Filter by search
    if (searchTerm.trim()) {
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  }, [users, activeTab, searchTerm]);

  // Filter users when tab or search changes
  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await adminService.getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Lỗi: Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await adminService.getUserStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const handleLockUser = async (userId, reason) => {
    try {
      setActionInProgress(true);
      await adminService.lockUser(userId, reason);
      await adminService.sendLockNotification(userId, reason);
      
      // Reload users
      await loadUsers();
      setShowUserDetail(false);
      alert('Tài khoản đã bị khóa thành công');
    } catch (error) {
      console.error('Error locking user:', error);
      alert('Lỗi: Không thể khóa tài khoản');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleUnlockUser = async (userId) => {
    try {
      setActionInProgress(true);
      await adminService.unlockUser(userId);
      await adminService.sendUnlockNotification(userId);
      
      // Reload users
      await loadUsers();
      setShowUserDetail(false);
      alert('Tài khoản đã mở khóa thành công');
    } catch (error) {
      console.error('Error unlocking user:', error);
      alert('Lỗi: Không thể mở khóa tài khoản');
    } finally {
      setActionInProgress(false);
    }
  };

  const handlePromoteToFaculty = async (userId) => {
    try {
      setActionInProgress(true);
      await adminService.assignFacultyRole(userId);
      await adminService.sendPromotionNotification(userId);
      
      // Reload users
      await loadUsers();
      setShowUserDetail(false);
      alert('Người dùng đã được nâng cấp thành Giảng viên');
    } catch (error) {
      console.error('Error promoting user:', error);
      alert('Lỗi: Không thể nâng cấp người dùng');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDemoteToStudent = async (userId) => {
    try {
      setActionInProgress(true);
      await adminService.removeFacultyRole(userId);
      
      // Reload users
      await loadUsers();
      setShowUserDetail(false);
      alert('Người dùng đã được hạ xuống Học sinh');
    } catch (error) {
      console.error('Error demoting user:', error);
      alert('Lỗi: Không thể hạ xuống người dùng');
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading">Đang tải dữ liệu...</div>
      </div>
    );
  }

  return (
    <div className="admin-page min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <AdminHeader onLogout={onLogout} />

      {/* Statistics */}
      {statistics && (
        <div className="px-8 py-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Thống Kê</h2>
            <div className="statistics-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat-card bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all">
                <div className="stat-value text-3xl font-bold text-blue-600">{statistics.totalUsers}</div>
                <div className="stat-label text-gray-600 mt-2">👥 Tổng người dùng</div>
              </div>
              <div className="stat-card bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all">
                <div className="stat-value text-3xl font-bold text-green-600">{statistics.students}</div>
                <div className="stat-label text-gray-600 mt-2">🎓 Học sinh</div>
              </div>
              <div className="stat-card bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all">
                <div className="stat-value text-3xl font-bold text-purple-600">{statistics.faculty}</div>
                <div className="stat-label text-gray-600 mt-2">👨‍🏫 Giảng viên</div>
              </div>
              <div className="stat-card bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all">
                <div className="stat-value text-3xl font-bold text-red-600">{statistics.lockedUsers}</div>
                <div className="stat-label text-gray-600 mt-2">🔒 Bị khóa</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="admin-controls">
            <div className="search-box mb-6">
              <input
                type="text"
                placeholder="🔍 Tìm kiếm theo email hoặc tên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="filter-tabs flex flex-wrap gap-3">
              <button
                className={`tab px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => setActiveTab('all')}
              >
                Tất cả ({users.length})
              </button>
              <button
                className={`tab px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === 'students'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => setActiveTab('students')}
              >
                🎓 Học sinh
              </button>
              <button
                className={`tab px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === 'faculty'
                    ? 'bg-purple-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => setActiveTab('faculty')}
              >
                👨‍🏫 Giảng viên
              </button>
              <button
                className={`tab px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === 'locked'
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => setActiveTab('locked')}
              >
                🔒 Bị khóa
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="px-8 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="users-container bg-white rounded-lg shadow-md overflow-hidden">
            <table className="users-table w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tên</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Trạng thái</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr key={user.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-200 hover:bg-blue-50 transition-all ${user.isLocked ? 'opacity-70' : ''}`}>
                    <td className="px-6 py-4 text-sm text-gray-800">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{user.displayName}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`role-badge inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'student' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'faculty' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role === 'student' ? '🎓 Học sinh' : user.role === 'faculty' ? '👨‍🏫 Giảng viên' : '🔐 Admin'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`status-badge inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        user.isLocked ? 'bg-red-100 text-red-800' :
                        user.isActive ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.isLocked ? '🔒 Bị khóa' : user.isActive ? '✅ Hoạt động' : '⏸️ Không hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        className="action-btn px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all font-semibold text-xs"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowUserDetail(true);
                        }}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="no-results text-center py-12">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-gray-500 text-lg">Không tìm thấy người dùng nào</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {showUserDetail && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowUserDetail(false)}>
          <div className="modal-content bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-screen overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">👤 Chi tiết người dùng</h2>
              <button className="close-btn text-gray-400 hover:text-gray-600 text-2xl font-bold transition-colors" onClick={() => setShowUserDetail(false)}>×</button>
            </div>

            <div className="modal-body space-y-4 mb-6 pb-6 border-b border-gray-200">
              <div className="user-info space-y-4">
                <div className="info-row">
                  <label className="block text-sm font-semibold text-gray-700">📧 Email:</label>
                  <span className="text-gray-800 text-sm break-all">{selectedUser.email}</span>
                </div>
                <div className="info-row">
                  <label className="block text-sm font-semibold text-gray-700">📝 Tên:</label>
                  <span className="text-gray-800 text-sm">{selectedUser.displayName}</span>
                </div>
                <div className="info-row">
                  <label className="block text-sm font-semibold text-gray-700">🔖 Role:</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedUser.role === 'student' ? 'bg-blue-100 text-blue-800' :
                    selectedUser.role === 'faculty' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedUser.role === 'student' ? '🎓 Học sinh' : selectedUser.role === 'faculty' ? '👨‍🏫 Giảng viên' : '🔐 Admin'}
                  </span>
                </div>
                <div className="info-row">
                  <label className="block text-sm font-semibold text-gray-700">⚡ Trạng thái:</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedUser.isLocked ? 'bg-red-100 text-red-800' :
                    selectedUser.isActive ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedUser.isLocked ? '🔒 Bị khóa' : selectedUser.isActive ? '✅ Hoạt động' : '⏸️ Không hoạt động'}
                  </span>
                </div>
                {selectedUser.isLocked && (
                  <div className="info-row bg-red-50 p-3 rounded-lg">
                    <label className="block text-sm font-semibold text-red-700">⚠️ Lý do khóa:</label>
                    <span className="text-red-800 text-sm">{selectedUser.lockedReason || 'Không có lý do'}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions flex flex-col gap-3">
              {selectedUser.isLocked ? (
                <button
                  className="action-btn unlock px-4 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all disabled:opacity-50"
                  onClick={() => handleUnlockUser(selectedUser.id)}
                  disabled={actionInProgress}
                >
                  {actionInProgress ? '⏳ Đang xử lý...' : '🔓 Mở khóa'}
                </button>
              ) : (
                <>
                  {selectedUser.isStudent() && (
                    <button
                      className="action-btn promote px-4 py-3 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition-all disabled:opacity-50"
                      onClick={() => handlePromoteToFaculty(selectedUser.id)}
                      disabled={actionInProgress}
                    >
                      {actionInProgress ? '⏳ Đang xử lý...' : '⬆️ Nâng cấp Giảng viên'}
                    </button>
                  )}
                  {selectedUser.isFaculty() && (
                    <button
                      className="action-btn demote px-4 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-all disabled:opacity-50"
                      onClick={() => handleDemoteToStudent(selectedUser.id)}
                      disabled={actionInProgress}
                    >
                      {actionInProgress ? '⏳ Đang xử lý...' : '⬇️ Hạ xuống Học sinh'}
                    </button>
                  )}
                </>
              )}

              {!selectedUser.isLocked && (
                <button
                  className="action-btn lock px-4 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-all disabled:opacity-50"
                  onClick={() => {
                    const reason = prompt('Nhập lý do khóa tài khoản:');
                    if (reason !== null) {
                      handleLockUser(selectedUser.id, reason);
                    }
                  }}
                  disabled={actionInProgress}
                >
                  {actionInProgress ? '⏳ Đang xử lý...' : '🔒 Khóa tài khoản'}
                </button>
              )}

              <button
                className="px-4 py-3 bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400 transition-all"
                onClick={() => setShowUserDetail(false)}
              >
                ❌ Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
