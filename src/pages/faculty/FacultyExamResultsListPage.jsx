import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import authService from '../../services/authService';
import facultyService from '../../services/faculty/facultyService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyExamResultsListPage = () => {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'faculty') {
          navigate('/login');
        } else {
          setUser(currentUser);
        }
      } catch (error) {
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const loadExamResults = async () => {
      setLoading(true);
      try {
        // Fetch exam data để lấy metadata
        const examData = await facultyService.getExamById(examId);
        if (!examData) {
          alert('Không tìm thấy đề thi');
          navigate('/faculty/exam-management');
          return;
        }
        
        setExam(examData);
        
        // Load leaderboard từ student_exam_progress (source chính xác)
        const studentResults = await facultyService.getExamStudentResults(examId);
        
        if (studentResults && studentResults.length > 0) {
          setLeaderboard(studentResults);
        } else {
          // Fallback: dùng finalLeaderboard từ exam nếu student_exam_progress trống
          if (examData.finalLeaderboard && examData.finalLeaderboard.length > 0) {
            setLeaderboard(examData.finalLeaderboard);
          } else {
            setLeaderboard([]);
          }
        }
      } catch (error) {
        alert('Lỗi khi tải kết quả');
        navigate('/faculty/exam-management');
      } finally {
        setLoading(false);
      }
    };

    if (examId) {
      loadExamResults();
    }
  }, [examId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Không tìm thấy đề thi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <FacultyHeader user={user} onLogout={() => navigate('/login')} />
      
      {/* Back Button */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 px-4 lg:px-8 py-3 shadow-soft-md">
        <button
          onClick={() => navigate('/faculty/exam-management')}
          className="px-4 lg:px-6 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold rounded-lg transition-all duration-300 flex items-center gap-2"
        >
          ← Quay lại
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-8">
        {/* Page Title */}
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <span>📊</span>
            Kết quả {exam.title}
          </h2>
          <p className="text-purple-100">
            Tổng cộng: <strong>{leaderboard.length}</strong> học sinh đã hoàn thành
          </p>
        </div>

        {/* Results List */}
        {leaderboard.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <span className="text-6xl mb-4 block">📋</span>
            <p className="text-xl text-gray-500 mb-4">Chưa có kết quả nào</p>
            <p className="text-gray-400">Đề thi này chưa được hoàn thành bởi học sinh nào</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                    <th className="px-6 py-4 text-left font-semibold">Xếp hạng</th>
                    <th className="px-6 py-4 text-left font-semibold">Tên học sinh</th>
                    <th className="px-6 py-4 text-center font-semibold">KĐ (Năng lực)</th>
                    <th className="px-6 py-4 text-center font-semibold">LT Bài 1</th>
                    <th className="px-6 py-4 text-center font-semibold">LT Bài 2</th>
                    <th className="px-6 py-4 text-center font-semibold">VD</th>
                    <th className="px-6 py-4 text-center font-semibold">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leaderboard.map((student, index) => (
                    <tr key={student.uid || index} className="hover:bg-purple-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-center">
                        <div className="flex items-center justify-center gap-2">
                          {student.medal && <span className="text-2xl">{student.medal}</span>}
                          <span className="text-gray-700">#{student.rank || index + 1}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">{student.name || 'Unknown'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-bold text-purple-600">
                            {student.khoiDongCompetencyScore || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-lg font-bold text-blue-600">
                          {student.luyenTapBai1TongDiem || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-lg font-bold text-blue-600">
                          {student.luyenTapBai2TongDiem || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-lg font-bold text-green-600">
                          {student.vanDungTongDiem || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(`/faculty/student-exam-result/${examId}/${student.uid}`)}
                          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all duration-300 text-sm"
                        >
                          📋 Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyExamResultsListPage;
