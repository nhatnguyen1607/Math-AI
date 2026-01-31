import React from 'react';
import { signInWithGoogle } from '../services/authService';

function LoginPage() {
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
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full">
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

        <button 
          className="w-full bg-white border-2 border-gray-200 hover:border-purple-400 text-gray-700 font-semibold py-4 px-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 mb-6"
          onClick={handleGoogleSignIn}
        >
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google"
            className="w-6 h-6"
          />
          Đăng nhập bằng Google
        </button>

        <div className="text-center text-sm text-gray-600">
          <p>AI sẽ đồng hành và hướng dẫn bạn</p>
          <p>những <strong className="text-purple-600">không giải hộ</strong> đâu nhé! 😊</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
