import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';

/**
 * StudentLearningPathwayPage
 * Chỉ dùng để chọn mạch học tập (algebra hoặc geometry)
 * Sau khi chọn, navigate đến StudentTopicPage với pathway param
 */
const StudentLearningPathwayPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { mode } = useParams(); // 'exam' hoặc 'practice'

  const handlePathwaySelect = (pathway) => {
    // Navigate to StudentTopicPage with the selected pathway
    // pathway sẽ được lưu vào state để StudentTopicPage có thể sử dụng
    navigate(`/student/topic-management/${pathway}/${mode}`, {
      state: { learningPathway: pathway, mode }
    });
  };

  const handleBack = () => {
    navigate('/student/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onSignOut={onSignOut} />

      <div className="p-8">
        <div className="px-8 py-8 max-w-7xl mx-auto w-full">
          {/* Back Button */}
          <div className="mb-10">
            <button 
              onClick={handleBack}
              className="btn-3d bg-white text-gray-800 py-3 px-6 rounded-max font-quicksand hover:shadow-lg transition-all"
            >
              ← Quay lại
            </button>
          </div>

          <div className="space-y-6">
            <div className="text-center mb-16">
              <h1 className="text-5xl font-bold text-gray-800 mb-4 font-quicksand">Chọn Mạch Học Tập</h1>
              <p className="text-xl text-gray-600 font-quicksand">
                {mode === 'exam' ? '🎓 Hãy chọn mạch học tập để bắt đầu thi' : '📝 Hãy chọn mạch học tập để luyện tập'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Algebra Pathway */}
              <button
                onClick={() => handlePathwaySelect('algebra')}
                className="group p-10 bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-blue-500 transform hover:-translate-y-2"
              >
                <div className="text-8xl mb-6 text-center">🔢</div>
                <h2 className="text-3xl font-bold text-gray-800 mb-3 text-center font-quicksand">Số và Phép Tính</h2>
                <p className="text-gray-600 text-center mb-6 leading-relaxed">
                  Luyện tập các phép tính cơ bản, số thập phân, phân số, và các bài toán liên quan đến số học
                </p>
                <div className="text-start text-sm text-gray-600 mb-6 bg-blue-50 p-4 rounded-lg">
                  <ul className="list-disc list-inside space-y-2">
                    <li>Phép cộng, trừ, nhân, chia</li>
                    <li>Số thập phân</li>
                    <li>Phân số</li>
                    <li>Bài toán có lời văn</li>
                  </ul>
                </div>
                <div className="text-center text-blue-600 font-bold text-lg group-hover:text-blue-700 transition-colors">
                  Chọn mạch →
                </div>
              </button>

              {/* Geometry Pathway */}
              <button
                onClick={() => handlePathwaySelect('geometry')}
                className="group p-10 bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-purple-500 transform hover:-translate-y-2"
              >
                <div className="text-8xl mb-6 text-center">📐</div>
                <h2 className="text-3xl font-bold text-gray-800 mb-3 text-center font-quicksand">Hình học và Đo lường</h2>
                <p className="text-gray-600 text-center mb-6 leading-relaxed">
                  Khám phá các hình dạng, tính toán diện tích, chu vi, và các khái niệm không gian
                </p>
                <div className="text-start text-sm text-gray-600 mb-6 bg-purple-50 p-4 rounded-lg">
                  <ul className="list-disc list-inside space-y-2">
                    <li>Hình tam giác, hình vuông, hình tròn</li>
                    <li>Diện tích và chu vi</li>
                    <li>Đơn vị đo lường</li>
                    <li>Các bài toán về không gian</li>
                  </ul>
                </div>
                <div className="text-center text-purple-600 font-bold text-lg group-hover:text-purple-700 transition-colors">
                  Chọn mạch →
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLearningPathwayPage;
