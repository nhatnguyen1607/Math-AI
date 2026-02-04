import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import facultyService from '../../services/faculty/facultyService';
import studentService from '../../services/student/studentService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyGameLobbyPage = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unsubscribe, setUnsubscribe] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);

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
    if (examId && user?.uid) {
      loadExam();
    }
  }, [examId, user?.uid]);

  const loadExam = async () => {
    try {
      setLoading(true);
      const examData = await facultyService.getExamById(examId);
      setExam(examData);
      setGameStarted(examData.status === 'in_progress');

      // Subscribe to realtime updates
      const unsub = facultyService.subscribeToExam(examId, (updatedExam) => {
        setExam(updatedExam);
        setGameStarted(updatedExam.status === 'in_progress');
        
        // Update leaderboard when exam changes
        if (updatedExam.completedStudents && updatedExam.completedStudents.length > 0) {
          const sorted = [...updatedExam.completedStudents].sort((a, b) => b.totalScore - a.totalScore);
          setLeaderboard(sorted.map((s, idx) => ({ ...s, rank: idx + 1 })));
        }
      });

      setUnsubscribe(() => unsub);
    } catch (error) {
      console.error('Error loading exam:', error);
      alert('Lỗi khi tải thông tin trò chơi');
      navigate('/faculty/exam-management');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [unsubscribe]);

  const handleStartGame = async () => {
    try {
      if (!exam || exam.waitingStudents.length === 0) {
        alert('Chưa có học sinh tham gia. Vui lòng chờ học sinh gia nhập lobby.');
        return;
      }

      // Start game: move waiting to active, set status to in_progress
      const activeStudents = exam.waitingStudents.map(s => ({
        ...s,
        startTime: new Date(),
        currentExercise: 0,
        currentQuestion: 0,
        score: 0
      }));

      await facultyService.updateExam(examId, {
        status: 'in_progress',
        activeStudents,
        waitingStudents: [],
        startTime: new Date(),
        endTime: new Date(Date.now() + 420000) // 7 minutes
      });

      alert('Trò chơi đã bắt đầu!');
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Lỗi khi bắt đầu trò chơi');
    }
  };

  const handleEndGame = async () => {
    if (window.confirm('Bạn chắc chắn muốn kết thúc trò chơi? Học sinh vẫn đang chơi sẽ không được tính điểm.')) {
      try {
        await facultyService.endExam(examId);
        alert('Trò chơi đã kết thúc');
        navigate('/faculty/exam-management');
      } catch (error) {
        console.error('Error ending game:', error);
        alert('Lỗi khi kết thúc trò chơi');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-5 py-20 text-center">
          <p className="text-xl text-gray-600">Không tìm thấy trò chơi</p>
        </div>
      </div>
    );
  }

  const waitingCount = exam.waitingStudents?.length || 0;
  const activeCount = exam.activeStudents?.length || 0;
  const completedCount = exam.completedStudents?.length || 0;

  const navItems = [
    { icon: '🎮', label: 'Sảnh Chờ: ' + exam.title }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <FacultyHeader user={user} onLogout={() => navigate('/login')} onBack={() => navigate('/faculty/exam-management', { state: { selectedClass, selectedClassId, topicType } })} navItems={navItems} />

      <div className="max-w-7xl mx-auto px-5 py-8">
        {/* Game Controls */}
        <div className="mb-8 flex justify-end gap-3">
          {!gameStarted && (
            <button 
              className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:shadow-lg transition-all border-2 border-purple-600"
              onClick={handleStartGame}
              disabled={waitingCount === 0}
            >
              🚀 Bắt đầu
            </button>
          )}
          {gameStarted && (
            <button 
              className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all"
              onClick={handleEndGame}
            >
              ⏹️ Kết thúc
            </button>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="text-gray-600 text-sm font-semibold">Đang chờ</div>
            <div className="text-4xl font-bold text-purple-600 mt-2">{waitingCount}</div>
            <p className="text-gray-500 text-xs mt-2">Học sinh chưa bắt đầu</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="text-gray-600 text-sm font-semibold">Đang chơi</div>
            <div className="text-4xl font-bold text-blue-600 mt-2">{activeCount}</div>
            <p className="text-gray-500 text-xs mt-2">Học sinh trong trò chơi</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="text-gray-600 text-sm font-semibold">Hoàn thành</div>
            <div className="text-4xl font-bold text-green-600 mt-2">{completedCount}</div>
            <p className="text-gray-500 text-xs mt-2">Đã kết thúc</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Waiting Students */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-t-lg">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span>⏳</span>
                  Chờ bắt đầu ({waitingCount})
                </h3>
              </div>
              <div className="p-6">
                {waitingCount === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">Chưa có học sinh</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exam.waitingStudents.map((student, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                        <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center font-bold text-purple-600">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{student.name}</p>
                          <p className="text-xs text-gray-500">ID: {student.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-t-lg">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span>🏆</span>
                  Bảng xếp hạng realtime ({completedCount})
                </h3>
              </div>
              <div className="p-6">
                {leaderboard.length === 0 && activeCount === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm">Chưa có học sinh hoàn thành</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="text-left py-3 px-4 font-bold text-gray-700">Xếp hạng</th>
                          <th className="text-left py-3 px-4 font-bold text-gray-700">Tên học sinh</th>
                          <th className="text-center py-3 px-4 font-bold text-gray-700">Điểm</th>
                          <th className="text-center py-3 px-4 font-bold text-gray-700">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((student) => {
                          const timeTaken = student.endTime 
                            ? Math.floor((student.endTime - student.startTime) / 1000)
                            : 0;
                          const minutes = Math.floor(timeTaken / 60);
                          const seconds = timeTaken % 60;
                          
                          return (
                            <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-center">
                                  {student.rank === 1 && <span className="text-2xl">🥇</span>}
                                  {student.rank === 2 && <span className="text-2xl">🥈</span>}
                                  {student.rank === 3 && <span className="text-2xl">🥉</span>}
                                  {student.rank > 3 && (
                                    <span className="font-bold text-gray-600">#{student.rank}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-semibold text-gray-800">{student.name}</p>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-bold text-lg text-purple-600">{student.totalScore}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="text-sm text-gray-600">{minutes}m {seconds}s</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Active Students List */}
                {activeCount > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-bold text-gray-700 mb-3">👤 Đang chơi ({activeCount})</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {exam.activeStudents.map((student, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                          <span className="animate-pulse text-xl">⚡</span>
                          <p className="text-sm text-gray-700 truncate">{student.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Game Info */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Thông tin trò chơi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Chủ đề</p>
              <p className="text-lg font-semibold text-gray-800">{exam.description || 'Không có mô tả'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Thời gian chơi</p>
              <p className="text-lg font-semibold text-gray-800">7 phút (90s + 120s + 210s)</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tổng câu hỏi</p>
              <p className="text-lg font-semibold text-gray-800">{exam.totalQuestions}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Trạng thái</p>
              <p className="text-lg font-semibold">
                {gameStarted ? (
                  <span className="text-blue-600">🎮 Đang diễn ra</span>
                ) : (
                  <span className="text-purple-600">⏳ Chờ bắt đầu</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyGameLobbyPage;
