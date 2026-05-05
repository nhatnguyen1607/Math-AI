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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-4 border-t-4 border-purple-500 sm:h-16 sm:w-16"></div>
          <p className="text-base text-gray-600 sm:text-lg">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 px-4">
        <div className="text-center">
          <p className="text-base text-gray-600 sm:text-lg">Không tìm thấy đề thi</p>
        </div>
      </div>
    );
  }

  const getLevelFromTotalScore = (score = 0) => {
    if (score >= 7) return { label: 'Tốt', textClass: 'text-green-600' };
    if (score >= 4) return { label: 'Đạt', textClass: 'text-blue-600' };
    return { label: 'Cần cố gắng', textClass: 'text-orange-600' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <FacultyHeader user={user} onLogout={() => navigate('/login')} />
      
      {/* Back Button */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 shadow-soft-md">
        <div className="app-shell py-2 sm:py-3">
        <button
          onClick={() => navigate('/faculty/exam-management')}
          className="touch-btn bg-white/20 text-sm font-semibold text-white transition-all duration-300 hover:bg-white/30 sm:text-base"
        >
          ← Quay lại
        </button>
        </div>
      </div>

      <div className="app-shell py-5 sm:py-6 lg:py-8">
        {/* Page Title */}
        <div className="mb-6 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 p-4 text-white shadow-lg sm:mb-8 sm:p-6">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold sm:gap-3 sm:text-2xl lg:text-3xl">
            <span>📊</span>
            Kết quả {exam.title}
          </h2>
          <p className="text-sm text-purple-100 sm:text-base">
            Tổng cộng: <strong>{leaderboard.length}</strong> học sinh đã hoàn thành
          </p>
        </div>

        {/* Results List */}
        {leaderboard.length === 0 ? (
          <div className="rounded-xl bg-white py-14 text-center shadow-md sm:py-20">
            <span className="mb-4 block text-5xl sm:text-6xl">📋</span>
            <p className="mb-3 text-lg text-gray-500 sm:mb-4 sm:text-xl">Chưa có kết quả nào</p>
            <p className="px-4 text-sm text-gray-400 sm:text-base">Đề thi này chưa được hoàn thành bởi học sinh nào</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-lg">
            {/* Mobile cards */}
            <div className="space-y-3 p-3 sm:p-4 md:hidden">
              {leaderboard.map((student, index) => (
                <div key={student.uid || index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {student.medal && <span className="text-xl">{student.medal}</span>}
                      <span className="text-sm font-bold text-gray-700">#{student.rank || index + 1}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/faculty/student-exam-result/${examId}/${student.uid}`)}
                      className="touch-btn rounded-lg bg-gradient-to-r from-purple-500 to-purple-700 px-3 text-xs font-semibold text-white"
                    >
                      📋 Chi tiết
                    </button>
                  </div>

                  <p className="mb-3 text-sm font-semibold text-gray-800">{student.name || 'Unknown'}</p>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-purple-50 px-3 py-2 text-center">
                      <p className="text-xs text-purple-700">KĐ</p>
                      <p className={`text-base font-bold ${getLevelFromTotalScore(student.khoiDongCompetencyScore || 0).textClass}`}>
                        {getLevelFromTotalScore(student.khoiDongCompetencyScore || 0).label}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
                      <p className="text-xs text-blue-700">LT Bài 1</p>
                      <p className={`text-base font-bold ${getLevelFromTotalScore(student.luyenTapBai1TongDiem || 0).textClass}`}>
                        {getLevelFromTotalScore(student.luyenTapBai1TongDiem || 0).label}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 px-3 py-2 text-center">
                      <p className="text-xs text-blue-700">LT Bài 2</p>
                      <p className={`text-base font-bold ${getLevelFromTotalScore(student.luyenTapBai2TongDiem || 0).textClass}`}>
                        {getLevelFromTotalScore(student.luyenTapBai2TongDiem || 0).label}
                      </p>
                    </div>
                    <div className="rounded-lg bg-green-50 px-3 py-2 text-center">
                      <p className="text-xs text-green-700">VD</p>
                      <p className={`text-base font-bold ${getLevelFromTotalScore(student.vanDungTongDiem || 0).textClass}`}>
                        {getLevelFromTotalScore(student.vanDungTongDiem || 0).label}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
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
                        <div className={`text-base font-bold ${getLevelFromTotalScore(student.khoiDongCompetencyScore || 0).textClass}`}>
                          {getLevelFromTotalScore(student.khoiDongCompetencyScore || 0).label}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`text-base font-bold ${getLevelFromTotalScore(student.luyenTapBai1TongDiem || 0).textClass}`}>
                          {getLevelFromTotalScore(student.luyenTapBai1TongDiem || 0).label}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`text-base font-bold ${getLevelFromTotalScore(student.luyenTapBai2TongDiem || 0).textClass}`}>
                          {getLevelFromTotalScore(student.luyenTapBai2TongDiem || 0).label}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`text-base font-bold ${getLevelFromTotalScore(student.vanDungTongDiem || 0).textClass}`}>
                          {getLevelFromTotalScore(student.vanDungTongDiem || 0).label}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(`/faculty/student-exam-result/${examId}/${student.uid}`)}
                          className="touch-btn rounded-lg bg-gradient-to-r from-purple-500 to-purple-700 px-4 text-sm font-semibold text-white transition-all duration-300 hover:shadow-lg"
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
