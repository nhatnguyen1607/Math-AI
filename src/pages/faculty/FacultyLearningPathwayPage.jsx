import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import FacultyHeader from '../../components/faculty/FacultyHeader';
import authService from '../../services/authService';

/**
 * FacultyLearningPathwayPage
 * Trang chọn mạch học tập (algebra hoặc geometry)
 * → Quản lý chủ đề → Tạo đề thi / quản lý game
 */
const FacultyLearningPathwayPage = ({ onSignOut }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams(); // 'game' hoặc 'exam'
  
  // Get classId from location.state first (from FacultyPage), then sessionStorage
  const classId = location.state?.classId || sessionStorage.getItem('selectedClassId') || null;

  useEffect(() => {
    // Save classId to sessionStorage for persistence
    if (classId) {
      sessionStorage.setItem('selectedClassId', classId);
    }
  }, [classId]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'faculty') {
          navigate('/login');
        }
      } catch (error) {
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  const handlePathwaySelect = (pathway) => {
    navigate('/faculty/topic-management', { 
      state: { 
        learningPathway: pathway,
        mode: mode,
        classId: classId
      } 
    });
  };

  const handleBack = () => {
    navigate('/faculty');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <FacultyHeader />

      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 lg:px-12 py-6 border-b-4 border-purple-400">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <button
                onClick={handleBack}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all duration-300 text-white flex items-center gap-2 font-semibold"
              >
                <span className="text-xl">←</span> Quay lại
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 lg:px-12 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-800 mb-3">Chọn Mạch Học Tập</h1>
            <p className="text-xl text-gray-600">
              {mode === 'game' 
                ? '🎮 Hãy chọn mạch để tạo trò chơi giáo dục' 
                : '📝 Hãy chọn mạch để tạo đề thi cho học sinh'}
            </p>
          </div>

          {/* Pathway Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Algebra Pathway */}
            <button
              onClick={() => handlePathwaySelect('algebra')}
              className="group p-8 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-blue-500 hover:scale-105"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="text-6xl">🔢</div>
                <div className="text-left">
                  <h2 className="text-3xl font-bold text-gray-800">Số và Phép Tính</h2>
                  <p className="text-blue-600 font-semibold mt-1">Số học cơ bản</p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                Các chủ đề liên quan đến phép tính cơ bản, số thập phân, phân số, và bài toán có lời văn
              </p>
              
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-3">Bao gồm:</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-blue-600">+</span> Phép cộng, trừ, nhân, chia
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-blue-600">+</span> Số thập phân và phân số
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-blue-600">+</span> Bài toán có lời văn
                  </li>
                </ul>
              </div>
              
              <div className="text-center text-blue-600 font-bold text-lg group-hover:text-blue-700">
                Chọn mạch →
              </div>
            </button>

            {/* Geometry Pathway */}
            <button
              onClick={() => handlePathwaySelect('geometry')}
              className="group p-8 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-purple-500 hover:scale-105"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="text-6xl">📐</div>
                <div className="text-left">
                  <h2 className="text-3xl font-bold text-gray-800">Hình học và Đo lường</h2>
                  <p className="text-purple-600 font-semibold mt-1">Hình học</p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                Các chủ đề về hình dạng, tính toán diện tích, chu vi, thể tích.
              </p>
              
              <div className="bg-purple-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-3">Bao gồm:</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-purple-600">+</span> Hình tam giác, vuông, tròn
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-purple-600">+</span> Diện tích, chu vi, thể tích
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-purple-600">+</span> Các bài toán về không gian
                  </li>
                </ul>
              </div>
              
              <div className="text-center text-purple-600 font-bold text-lg group-hover:text-purple-700">
                Chọn mạch →
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyLearningPathwayPage;
