import React, { useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc 
} from 'firebase/firestore';
import { 
  signInWithGoogle 
} from '../services/authService';
import CryptoJS from 'crypto-js';
// note: other firebase/auth imports were removed since not used
// User model import removed because it's unused
// navigation now uses window.location instead of react-router
import { db } from '../firebase';

const ENCRYPTION_SECRET = process.env.REACT_APP_ENCRYPTION_SECRET || 'default-secret-key';

function LoginPage() {
  // navigation performed via window.location for smoother redirect
  // Toggle between Login and Registration modes
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Helper: hash password
  const hashPassword = (pwd) => {
    return CryptoJS.SHA256(pwd + ENCRYPTION_SECRET).toString();
  };

  // Handle Phone/Username + Password Login
  const handleCustomLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (!username.trim() || !password.trim()) {
        setErrorMessage('⚠️ Vui lòng điền đầy đủ tên đăng nhập và mật khẩu');
        setLoading(false);
        return;
      }

      // Query Firestore for user by username
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErrorMessage('❌ Tên đăng nhập không tồn tại. Vui lòng kiểm tra lại!');
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Check if account is locked
      if (userData.isLocked) {
        setErrorMessage('🔒 Tài khoản của bạn đã bị khóa. Vui lòng liên hệ với quản trị viên');
        setLoading(false);
        return;
      }

      // Verify password - use same hashing method as registration
      const hashedInput = hashPassword(password);
      if (userData.passwordHash !== hashedInput) {
        setErrorMessage('❌ Mật khẩu không đúng. Vui lòng thử lại!');
        setLoading(false);
        return;
      }

      // SUCCESS: Create user session object
      const userSession = {
        uid: userData.id || userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        username: userData.username,
        role: userData.role || 'student',
        authMethod: 'custom'
      };

      // Save session to localStorage
      localStorage.setItem('user', JSON.stringify(userSession));

      // Clear form fields
      setUsername('');
      setPassword('');
      setErrorMessage('');

      // Navigate immediately (smooth redirect like Google auth)
      // navigate('/student');
      window.location.href = '/student/dashboard';
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage(`⚠️ Lỗi khi đăng nhập. Vui lòng thử lại: ${error.message}`);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle Phone/Username + Password Registration
  const handleCustomRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      // Validation
      if (!username.trim() || !password.trim() || !fullName.trim()) {
        setErrorMessage('⚠️ Vui lòng điền đầy đủ thông tin');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setErrorMessage('⚠️ Mật khẩu phải có ít nhất 6 ký tự');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('⚠️ Mật khẩu xác nhận không trùng khớp');
        setLoading(false);
        return;
      }

      // Check if username already exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setErrorMessage('❌ Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác!');
        setLoading(false);
        return;
      }

      // Create local account (generate a pseudo-UID for non-Firebase auth)
      const customId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const hashedPassword = hashPassword(password);

      // Save to Firestore
      // Bỏ 'new User' đi, chỉ dùng ngoặc nhọn {} tạo Object bình thường
      const newUser = {
        id: customId,
        email: username + '@local',
        displayName: fullName,
        username: username.trim(),
        passwordHash: hashedPassword,
        authMethod: 'custom', // distinguish from Google auth
        isLocked: false,
        createdAt: new Date().toISOString(),
        role: 'student'
      };

      const userRef = doc(db, 'users', customId);
      await setDoc(userRef, newUser);

      setSuccessMessage('✅ Đăng ký thành công! Đang chuyển hướng...');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');

      // Auto-switch to login mode or auto-login
      setTimeout(() => {
        setIsLoginMode(true);
        setSuccessMessage('');
      }, 2000);
    } catch (error) {
      console.error('Registration error:', error);
      setErrorMessage(`⚠️ Lỗi khi đăng ký: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign-in
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      console.log('Nhấn nút đăng nhập Google...');
      await signInWithGoogle();
      console.log('Đăng nhập Google hoàn tất!');
    window.location.href = '/student/dashboard';
    } catch (error) {
      console.error('Google login error:', error);
      const errorMessage = error.message || '❌ Đăng nhập Google thất bại. Vui lòng thử lại!';
      setErrorMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mb-3">
            🎓 AI Math
          </h1>
          <p className="text-xl font-semibold text-gray-700 mb-2">
            Trợ lý học toán thông minh
          </p>
          <p className="text-sm text-gray-500">
            Học toán theo 4 bước Polya cùng AI<br/>
            Dành cho học sinh lớp 5
          </p>
        </div>

        {/* Polya Steps Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="text-center bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
            <span className="text-3xl mb-2 block">📚</span>
            <span className="text-xs text-gray-700 font-semibold">Hiểu bài toán</span>
          </div>
          <div className="text-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <span className="text-3xl mb-2 block">💡</span>
            <span className="text-xs text-gray-700 font-semibold">Lập kế hoạch</span>
          </div>
          <div className="text-center bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4">
            <span className="text-3xl mb-2 block">✏️</span>
            <span className="text-xs text-gray-700 font-semibold">Thực hiện</span>
          </div>
          <div className="text-center bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
            <span className="text-3xl mb-2 block">✅</span>
            <span className="text-xs text-gray-700 font-semibold">Kiểm tra</span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setIsLoginMode(true)}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
              isLoginMode
                ? 'bg-purple-500 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔑 Đăng nhập
          </button>
          <button
            onClick={() => setIsLoginMode(false)}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
              !isLoginMode
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ✍️ Đăng ký
          </button>
        </div>

        {/* Login Form */}
        {isLoginMode ? (
          <form onSubmit={handleCustomLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                👤 Tên đăng nhập hoặc số điện thoại
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên hoặc số điện thoại..."
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔐 Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 disabled:bg-gray-100"
              />
            </div>

            {/* Error & Success Messages */}
            {errorMessage && (
              <div className="p-3 bg-red-100 border-2 border-red-300 rounded-lg text-red-700 text-sm font-semibold">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-green-100 border-2 border-green-300 rounded-lg text-green-700 text-sm font-semibold">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Đang xử lý...' : '🚀 Đăng nhập'}
            </button>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleCustomRegister} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                😊 Tên đầy đủ
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                👤 Tên đăng nhập hoặc số điện thoại
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Chọn tên để nhân biết trong app..."
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔐 Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu (ít nhất 6 ký tự)..."
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ✅ Nhập lại mật khẩu
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại để chắc chắn..."
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>

            {/* Error & Success Messages */}
            {errorMessage && (
              <div className="p-3 bg-red-100 border-2 border-red-300 rounded-lg text-red-700 text-sm font-semibold">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-green-100 border-2 border-green-300 rounded-lg text-green-700 text-sm font-semibold">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Đang xử lý...' : '✍️ Đăng ký'}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-300"></div>
          <span className="text-gray-500 font-semibold text-sm">hoặc</span>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>

        {/* Google Sign-in Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border-2 border-gray-200 hover:border-purple-400 text-gray-700 font-semibold py-4 px-6 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-6 h-6"
          />
          Đăng nhập bằng Google
        </button>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 mt-8">
          <p>AI sẽ đồng hành và hướng dẫn bạn</p>
          <p>những <strong className="text-purple-600">không giải hộ</strong> đâu nhé! 😊</p>
          <hr className="my-4" />
          <a
            href="/admin"
            className="text-purple-600 hover:text-purple-800 font-semibold inline-flex items-center gap-1"
          >
            🔐 Đăng nhập quản trị
          </a>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
