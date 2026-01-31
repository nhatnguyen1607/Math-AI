import React from 'react';
import { signInWithGoogle } from '../services/authService';
import './Login.css';

function Login() {
  const handleGoogleSignIn = async () => {
    try {
      console.log("Nhấn nút đăng nhập...");
      await signInWithGoogle();
      console.log("Đăng nhập hoàn tất!");
    } catch (error) {
      console.error("Lỗi:", error);
      const errorMessage = error.message || 'Đăng nhập thất bại. Vui lòng thử lại!';
      alert(errorMessage);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🎓 AI Math</h1>
          <p className="login-subtitle">Trợ lý học toán thông minh</p>
          <p className="login-description">
            Học toán theo 4 bước Polya cùng AI<br/>
            Dành cho học sinh lớp 5
          </p>
        </div>

        <div className="login-features">
          <div className="feature-item">
            <span className="feature-icon">📚</span>
            <span>Hiểu bài toán</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">💡</span>
            <span>Lập kế hoạch</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✏️</span>
            <span>Thực hiện</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✅</span>
            <span>Kiểm tra</span>
          </div>
        </div>

        <button className="google-signin-btn" onClick={handleGoogleSignIn}>
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
          />
          Đăng nhập bằng Google
        </button>

        <p className="login-footer">
          AI sẽ đồng hành và hướng dẫn bạn<br/>
          nhưng không giải hộ đâu nhé! 😊
        </p>
      </div>
    </div>
  );
}

export default Login;
