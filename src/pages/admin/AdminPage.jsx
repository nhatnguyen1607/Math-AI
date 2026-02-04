import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../../services/admin/adminService';
import { User } from '../../models';

/**
 * Admin Dashboard
 * Quản lý tài khoản, khóa/mở tài khoản, gán role
 */
function AdminPage() {
  const navigate = useNavigate();
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

  // Filter users when tab or search changes
  useEffect(() => {
    filterUsers();
  }, [users, activeTab, searchTerm]);

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

  const filterUsers = () => {
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
    <div className="admin-page">
      <div className="admin-header">
        <h1>Trang Quản Trị</h1>
        <button className="logout-btn" onClick={() => navigate('/login')}>Đăng xuất</button>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="statistics-grid">
          <div className="stat-card">
            <div className="stat-value">{statistics.totalUsers}</div>
            <div className="stat-label">Tổng người dùng</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.students}</div>
            <div className="stat-label">Học sinh</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.faculty}</div>
            <div className="stat-label">Giảng viên</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.lockedUsers}</div>
            <div className="stat-label">Tài khoản bị khóa</div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="admin-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Tìm kiếm theo email hoặc tên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Tất cả ({users.length})
          </button>
          <button
            className={`tab ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            Học sinh
          </button>
          <button
            className={`tab ${activeTab === 'faculty' ? 'active' : ''}`}
            onClick={() => setActiveTab('faculty')}
          >
            Giảng viên
          </button>
          <button
            className={`tab ${activeTab === 'locked' ? 'active' : ''}`}
            onClick={() => setActiveTab('locked')}
          >
            Bị khóa
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="users-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Tên</th>
              <th>Role</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className={user.isLocked ? 'locked' : ''}>
                <td>{user.email}</td>
                <td>{user.displayName}</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>
                    {user.role === 'student' ? 'Học sinh' : user.role === 'faculty' ? 'Giảng viên' : 'Admin'}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${user.isLocked ? 'locked' : user.isActive ? 'active' : 'inactive'}`}>
                    {user.isLocked ? 'Bị khóa' : user.isActive ? 'Hoạt động' : 'Không hoạt động'}
                  </span>
                </td>
                <td>
                  <button
                    className="action-btn view"
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
          <div className="no-results">
            <p>Không tìm thấy người dùng nào</p>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {showUserDetail && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserDetail(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi tiết người dùng</h2>
              <button className="close-btn" onClick={() => setShowUserDetail(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="user-info">
                <div className="info-row">
                  <label>Email:</label>
                  <span>{selectedUser.email}</span>
                </div>
                <div className="info-row">
                  <label>Tên:</label>
                  <span>{selectedUser.displayName}</span>
                </div>
                <div className="info-row">
                  <label>Role:</label>
                  <span>{selectedUser.role}</span>
                </div>
                <div className="info-row">
                  <label>Trạng thái:</label>
                  <span>{selectedUser.isActive ? 'Hoạt động' : 'Không hoạt động'}</span>
                </div>
                {selectedUser.isLocked && (
                  <div className="info-row locked">
                    <label>Lý do khóa:</label>
                    <span>{selectedUser.lockedReason || 'Không có lý do'}</span>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                {selectedUser.isLocked ? (
                  <button
                    className="action-btn unlock"
                    onClick={() => handleUnlockUser(selectedUser.id)}
                    disabled={actionInProgress}
                  >
                    {actionInProgress ? 'Đang xử lý...' : 'Mở khóa'}
                  </button>
                ) : (
                  <>
                    {selectedUser.isStudent() && (
                      <button
                        className="action-btn promote"
                        onClick={() => handlePromoteToFaculty(selectedUser.id)}
                        disabled={actionInProgress}
                      >
                        {actionInProgress ? 'Đang xử lý...' : 'Nâng cấp Giảng viên'}
                      </button>
                    )}
                    {selectedUser.isFaculty() && (
                      <button
                        className="action-btn demote"
                        onClick={() => handleDemoteToStudent(selectedUser.id)}
                        disabled={actionInProgress}
                      >
                        {actionInProgress ? 'Đang xử lý...' : 'Hạ xuống Học sinh'}
                      </button>
                    )}
                  </>
                )}

                {!selectedUser.isLocked && (
                  <button
                    className="action-btn lock"
                    onClick={() => {
                      const reason = prompt('Nhập lý do khóa tài khoản:');
                      if (reason !== null) {
                        handleLockUser(selectedUser.id, reason);
                      }
                    }}
                    disabled={actionInProgress}
                  >
                    {actionInProgress ? 'Đang xử lý...' : 'Khóa tài khoản'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
