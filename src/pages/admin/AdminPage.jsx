import React, { useEffect, useState, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
import adminService from '../../services/admin/adminService';
import AdminHeader from '../../components/admin/AdminHeader';
import './AdminPage.css';

/**
 * Admin Dashboard
 * Quản lý tài khoản, khóa/mở tài khoản, gán role
 */
function AdminPage({ onLogout }) {
  // const navigate = useNavigate();
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
      alert('Người dùng đã được nâng cấp thành Giáo viên');
    } catch (error) {
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
      alert('Lỗi: Không thể hạ xuống người dùng');
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="rounded-2xl bg-white px-6 py-5 text-center shadow-soft sm:px-8 sm:py-6">
          <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500 sm:h-12 sm:w-12"></div>
          <div className="text-base font-semibold text-slate-700 sm:text-lg">Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <AdminHeader onLogout={onLogout} />

      {/* Statistics */}
      {statistics && (
        <div className="app-shell pt-5 sm:pt-6">
          <div className="mx-auto w-full max-w-7xl">
            <h2 className="mb-3 text-lg font-bold text-gray-800 sm:mb-4 sm:text-xl">📊 Thống Kê</h2>
            <div className="statistics-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
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
                <div className="stat-label text-gray-600 mt-2">👨‍🏫 Giáo viên</div>
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
      <div className="app-shell py-5 sm:py-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="admin-controls">
            <div className="search-box mb-4 sm:mb-6">
              <input
                type="text"
                placeholder="🔍 Tìm kiếm theo email hoặc tên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full rounded-xl border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-base"
              />
            </div>

            <div className="filter-tabs flex flex-wrap gap-2 sm:gap-3">
              <button
                className={`touch-btn tab rounded-xl px-4 text-sm font-semibold transition-all sm:text-base ${
                  activeTab === 'all'
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => setActiveTab('all')}
              >
                Tất cả ({users.length})
              </button>
              <button
                className={`touch-btn tab rounded-xl px-4 text-sm font-semibold transition-all sm:text-base ${
                  activeTab === 'students'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => setActiveTab('students')}
              >
                🎓 Học sinh
              </button>
              <button
                className={`touch-btn tab rounded-xl px-4 text-sm font-semibold transition-all sm:text-base ${
                  activeTab === 'faculty'
                    ? 'bg-purple-500 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => setActiveTab('faculty')}
              >
                👨‍🏫 Giáo viên
              </button>
              <button
                className={`touch-btn tab rounded-xl px-4 text-sm font-semibold transition-all sm:text-base ${
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
      <div className="app-shell pb-8">
        <div className="mx-auto w-full max-w-7xl">
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filteredUsers.map((user) => (
              <div key={user.id} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${user.isLocked ? 'opacity-80' : ''}`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 break-all">{user.email}</p>
                  <button
                    className="touch-btn rounded-lg bg-blue-500 px-3 text-xs font-semibold text-white hover:bg-blue-600"
                    onClick={() => {
                      setSelectedUser(user);
                      setShowUserDetail(true);
                    }}
                  >
                    Chi tiết
                  </button>
                </div>
                <p className="mb-2 text-xs text-slate-500 break-all">ID: {user.id}</p>
                <p className="mb-2 text-sm text-slate-700">{user.displayName}</p>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    user.role === 'student' ? 'bg-blue-100 text-blue-800' :
                    user.role === 'faculty' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {user.role === 'student' ? '🎓 Học sinh' : user.role === 'faculty' ? '👨‍🏫 Giáo viên' : '🔐 Admin'}
                  </span>
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    user.isLocked ? 'bg-red-100 text-red-800' :
                    user.isActive ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {user.isLocked ? '🔒 Bị khóa' : user.isActive ? '✅ Hoạt động' : '⏸️ Không hoạt động'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="users-container bg-white rounded-lg shadow-md overflow-hidden">
            <table className="users-table hidden w-full md:table">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
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
                    <td className="px-6 py-4 text-sm text-gray-700 break-all">{user.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{user.displayName}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`role-badge inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'student' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'faculty' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role === 'student' ? '🎓 Học sinh' : user.role === 'faculty' ? '👨‍🏫 Giáo viên' : '🔐 Admin'}
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
                        className="action-btn touch-btn rounded-lg bg-blue-500 px-4 text-xs font-semibold text-white transition-all hover:bg-blue-600"
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
              <div className="no-results text-center py-10 sm:py-12">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-gray-500 text-base sm:text-lg">Không tìm thấy người dùng nào</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {showUserDetail && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowUserDetail(false)}>
          <div className="modal-content max-h-screen w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between sm:mb-6">
              <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">👤 Chi tiết người dùng</h2>
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
                    {selectedUser.role === 'student' ? '🎓 Học sinh' : selectedUser.role === 'faculty' ? '👨‍🏫 Giáo viên' : '🔐 Admin'}
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
                  className="action-btn unlock touch-btn bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all disabled:opacity-50"
                  onClick={() => handleUnlockUser(selectedUser.id)}
                  disabled={actionInProgress}
                >
                  {actionInProgress ? '⏳ Đang xử lý...' : '🔓 Mở khóa'}
                </button>
              ) : (
                <>
                  {selectedUser.isStudent() && (
                    <button
                      className="action-btn promote touch-btn bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition-all disabled:opacity-50"
                      onClick={() => handlePromoteToFaculty(selectedUser.id)}
                      disabled={actionInProgress}
                    >
                      {actionInProgress ? '⏳ Đang xử lý...' : '⬆️ Nâng cấp Giáo viên'}
                    </button>
                  )}
                  {selectedUser.isFaculty() && (
                    <button
                      className="action-btn demote touch-btn bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-all disabled:opacity-50"
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
                  className="action-btn lock touch-btn bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-all disabled:opacity-50"
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
                className="touch-btn bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400 transition-all"
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
