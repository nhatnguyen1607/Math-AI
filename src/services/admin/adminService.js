/**
 * Admin Service
 * Quản lý tài khoản người dùng, khóa/mở tài khoản, gán role
 */

import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  getDoc,
  orderBy
} from 'firebase/firestore';
import { db } from '../../firebase';
import { User } from '../../models';

class AdminService {
  /**
   * Lấy danh sách tất cả người dùng
   */
  async getAllUsers(filters = {}) {
    try {
      let q = collection(db, 'users');
      const queryRef = query(q, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(queryRef);
      
      let users = snapshot.docs.map(doc => User.fromFirestore(doc.data(), doc.id));
      
      // Apply filters
      if (filters.role) {
        users = users.filter(u => u.role === filters.role);
      }
      if (filters.isActive !== undefined) {
        users = users.filter(u => u.isActive === filters.isActive);
      }
      if (filters.isLocked !== undefined) {
        users = users.filter(u => u.isLocked === filters.isLocked);
      }
      
      return users;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thông tin người dùng theo ID
   */
  async getUserById(userId) {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return User.fromFirestore(docSnap.data(), docSnap.id);
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Khóa tài khoản người dùng
   */
  async lockUser(userId, reason = '') {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isLocked: true,
        isActive: false,
        lockedReason: reason,
        lockedAt: new Date(),
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mở khóa tài khoản người dùng
   */
  async unlockUser(userId) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isLocked: false,
        isActive: true,
        lockedReason: '',
        lockedAt: null,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gán role faculty cho người dùng
   */
  async assignFacultyRole(userId) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: 'faculty',
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bỏ role faculty, trở lại student
   */
  async removeFacultyRole(userId) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: 'student',
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gửi email thông báo khóa tài khoản
   */
  async sendLockNotification(userId, reason) {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');

      const emailData = {
        to: user.email,
        subject: 'Tài khoản của bạn đã bị khóa',
        message: `Tài khoản ${user.displayName} đã bị khóa vì lý do: ${reason || 'Vi phạm quy tắc sử dụng'}`,
        type: 'account_locked',
        timestamp: new Date()
      };
      
      return emailData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gửi email thông báo mở khóa tài khoản
   */
  async sendUnlockNotification(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');

      const emailData = {
        to: user.email,
        subject: 'Tài khoản của bạn đã mở khóa',
        message: `Tài khoản ${user.displayName} đã được mở khóa. Bạn có thể đăng nhập lại vào hệ thống.`,
        type: 'account_unlocked',
        timestamp: new Date()
      };

      return emailData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gửi email thông báo nâng cấp lên giảng viên
   */
  async sendPromotionNotification(userId) {
    try {
      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');

      const emailData = {
        to: user.email,
        subject: 'Bạn được nâng cấp lên Giảng viên',
        message: `Chúc mừng ${user.displayName}! Bạn đã được nâng cấp lên role Giảng viên. Vui lòng đăng nhập lại để cập nhật quyền và bắt đầu tạo bài tập.`,
        type: 'promoted_to_faculty',
        timestamp: new Date()
      };
      
      return emailData;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy thống kê người dùng
   */
  async getUserStatistics() {
    try {
      const users = await this.getAllUsers();
      
      return {
        totalUsers: users.length,
        students: users.filter(u => u.isStudent()).length,
        faculty: users.filter(u => u.isFaculty()).length,
        admins: users.filter(u => u.isAdmin()).length,
        activeUsers: users.filter(u => u.isActive).length,
        lockedUsers: users.filter(u => u.isLocked).length
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tìm kiếm người dùng theo email hoặc tên
   */
  async searchUsers(searchTerm) {
    try {
      const users = await this.getAllUsers();
      
      return users.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error) {
      throw error;
    }
  }
}

const adminServiceInstance = new AdminService();

export default adminServiceInstance;
