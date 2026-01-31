// Dịch vụ xác thực admin (username/password)
class AdminAuthService {
  constructor() {
    this.ADMIN_CREDENTIALS = {
      username: 'admin',
      password: 'admin123' // Nên thay đổi trong production
    };
    this.ADMIN_SESSION_KEY = 'admin_session';
  }

  // Đăng nhập admin
  login(username, password) {
    if (username === this.ADMIN_CREDENTIALS.username && 
        password === this.ADMIN_CREDENTIALS.password) {
      const session = {
        username,
        loginTime: new Date().toISOString(),
        isAdmin: true
      };
      sessionStorage.setItem(this.ADMIN_SESSION_KEY, JSON.stringify(session));
      return { success: true, session };
    }
    return { success: false, error: 'Sai tên đăng nhập hoặc mật khẩu' };
  }

  // Đăng xuất admin
  logout() {
    sessionStorage.removeItem(this.ADMIN_SESSION_KEY);
  }

  // Kiểm tra admin đã đăng nhập chưa
  isAuthenticated() {
    const session = sessionStorage.getItem(this.ADMIN_SESSION_KEY);
    if (!session) return false;
    
    try {
      const data = JSON.parse(session);
      return data.isAdmin === true;
    } catch {
      return false;
    }
  }

  // Lấy thông tin session
  getSession() {
    const session = sessionStorage.getItem(this.ADMIN_SESSION_KEY);
    if (!session) return null;
    
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  }
}

const adminAuthService = new AdminAuthService();
export default adminAuthService;
