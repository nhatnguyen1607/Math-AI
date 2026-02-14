import { doc, getDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { User } from "../../models";

/**
 * Admin Authorization Service
 * Quản lý quyền truy cập admin
 */
class AdminAuthService {
  constructor() {
    this.ADMIN_SESSION_KEY = 'admin_session';
  }

  /**
   * Kiểm tra user có phải admin không
   * @param {string} uid - User ID từ Firebase Auth
   * @returns {Promise<boolean>}
   */
  async isAdmin(uid) {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) return false;
      
      const userData = User.fromFirestore(userSnap.data(), userSnap.id);
      return userData.isAdmin && userData.isActive && !userData.isLocked;
    } catch (error) {
      return false;
    }
  }

  /**
   * Lấy user data với kiểm tra admin
   * @param {string} uid 
   * @returns {Promise<User|null>}
   */
  async getAdminUser(uid) {
    try {
      const isAdminUser = await this.isAdmin(uid);
      if (!isAdminUser) return null;
      
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      
      return userSnap.exists() ? User.fromFirestore(userSnap.data(), userSnap.id) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Lấy danh sách tất cả users
   * @returns {Promise<User[]>}
   */
  async getAllUsers() {
    try {
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);
      
      return querySnapshot.docs.map(doc => User.fromFirestore(doc.data(), doc.id));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách users theo role
   * @param {string} role - 'student', 'faculty', 'admin'
   * @returns {Promise<User[]>}
   */
  async getUsersByRole(role) {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("role", "==", role));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => User.fromFirestore(doc.data(), doc.id));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Khóa tài khoản user
   * @param {string} userId 
   * @param {string} reason 
   * @returns {Promise<void>}
   */
  async lockUser(userId, reason = "") {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isLocked: true,
        lockedReason: reason,
        lockedAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mở khóa tài khoản user
   * @param {string} userId 
   * @returns {Promise<void>}
   */
  async unlockUser(userId) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isLocked: false,
        lockedReason: "",
        lockedAt: null,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate tài khoản user
   * @param {string} userId 
   * @returns {Promise<void>}
   */
  async deactivateUser(userId) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isActive: false,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Activate tài khoản user
   * @param {string} userId 
   * @returns {Promise<void>}
   */
  async activateUser(userId) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isActive: true,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gán role faculty cho user
   * @param {string} userId 
   * @returns {Promise<void>}
   */
  async promoteToFaculty(userId) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        role: "faculty",
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Hạ xuống role student
   * @param {string} userId 
   * @returns {Promise<void>}
   */
  async demoteToStudent(userId) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        role: "student",
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật role user
   * @param {string} userId 
   * @param {string} role - 'student', 'faculty', 'admin'
   * @returns {Promise<void>}
   */
  async updateUserRole(userId, role) {
    try {
      const validRoles = ['student', 'faculty', 'admin'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role: ${role}`);
      }

      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        role: role,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lưu session admin
   * @param {object} sessionData 
   */
  setAdminSession(sessionData) {
    sessionStorage.setItem(this.ADMIN_SESSION_KEY, JSON.stringify(sessionData));
  }

  /**
   * Lấy session admin hiện tại
   * @returns {object|null}
   */
  getAdminSession() {
    const session = sessionStorage.getItem(this.ADMIN_SESSION_KEY);
    if (!session) return null;
    
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  }

  /**
   * Xóa session admin
   */
  clearAdminSession() {
    sessionStorage.removeItem(this.ADMIN_SESSION_KEY);
  }

  /**
   * Kiểm tra admin đã đăng nhập
   * @returns {boolean}
   */
  isAuthenticated() {
    const session = this.getAdminSession();
    return session !== null && session.isAdmin === true;
  }

  /**
   * Admin login (đơn giản - kiểm tra username/password)
   * Trong thực tế nên sử dụng Firebase Auth
   * @param {string} username 
   * @param {string} password 
   * @returns {{success: boolean, error?: string}}
   */
  login(username, password) {
    // Hardcoded credentials - chỉ để demo
    // TODO: Thay thế bằng Firebase Auth
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'admin123';

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const session = {
        isAdmin: true,
        loginTime: new Date().toISOString()
      };
      this.setAdminSession(session);
      return { success: true };
    }

    return { 
      success: false, 
      error: 'Tên đăng nhập hoặc mật khẩu không đúng' 
    };
  }

  /**
   * Admin logout
   */
  logout() {
    this.clearAdminSession();
    return { success: true };
  }
}

const adminAuthService = new AdminAuthService();
export default adminAuthService;
