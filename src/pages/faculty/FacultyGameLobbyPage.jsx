import React, { useState, useEffect, useRef } from 'react';
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
  
  // Countdown and awarding states
  const [timeRemaining, setTimeRemaining] = useState(420); // 7 minutes in seconds
  const [isAwarding, setIsAwarding] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiScriptRef = useRef(null);

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
      console.log('🎮 FacultyGameLobbyPage loadExam:', {
        status: examData.status,
        endTime: examData.endTime,
        activeStudents: examData.activeStudents?.length,
        completedStudents: examData.completedStudents?.length
      });
      setExam(examData);
      setGameStarted(examData.status === 'in_progress');

      // Subscribe to realtime updates
      const unsub = facultyService.subscribeToExam(examId, (updatedExam) => {
        console.log('📡 Exam realtime update:', {
          status: updatedExam.status,
          endTime: updatedExam.endTime,
          gameStarted: updatedExam.status === 'in_progress'
        });
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

  // Countdown timer effect
  useEffect(() => {
    if (!gameStarted) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsAwarding(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted]);

  // Countdown timer moved to FacultyExamLiveSessionPage

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

      const endTime = new Date(Date.now() + 420000); // 7 minutes
      console.log('🎮 handleStartGame - endTime:', endTime);
      
      await facultyService.updateExam(examId, {
        status: 'in_progress',
        activeStudents,
        waitingStudents: [],
        startTime: new Date(),
        endTime: endTime
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
        // Set isLocked and save finalLeaderboard
        const finalBoard = [...leaderboard].map((s, idx) => ({
          ...s,
          rank: idx + 1,
          medal: idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
        }));

        await facultyService.updateExam(examId, {
          isLocked: true,
          finalLeaderboard: finalBoard,
          status: 'finished'
        });
        
        alert('Trò chơi đã kết thúc và khóa!');
        navigate('/faculty/exam-management');
      } catch (error) {
        console.error('Error ending game:', error);
        alert('Lỗi khi kết thúc trò chơi');
      }
    }
  };

  const handleAward = async () => {
    try {
      // Load and trigger confetti
      if (!confetti && confettiScriptRef.current === null) {
        confettiScriptRef.current = true;
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js';
        script.onload = () => {
          setShowConfetti(true);
          // Trigger confetti
          if (window.confetti) {
            window.confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              duration: 3000
            });
          }
        };
        document.body.appendChild(script);
      } else if (window.confetti) {
        setShowConfetti(true);
        window.confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          duration: 3000
        });
      }
      
      // Save Final Leaderboard and lock exam
      const finalBoard = [...leaderboard].map((s, idx) => ({
        ...s,
        rank: idx + 1,
        medal: idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
      }));

      await facultyService.updateExam(examId, {
        isLocked: true,
        finalLeaderboard: finalBoard,
        status: 'finished'
      });

      // Show confetti for 3 seconds
      setTimeout(() => {
        setShowConfetti(false);
      }, 3000);

      setTimeout(() => {
        alert('🏆 Trao giải hoàn tất! Đề thi đã được khóa.');
        navigate('/faculty/exam-management');
      }, 3500);
    } catch (error) {
      console.error('Error awarding:', error);
      alert('Lỗi khi trao giải');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-5 py-20 text-center">
          <p className="text-xl text-gray-600">Không tìm thấy trò chơi</p>
        </div>
      </div>
    );
  }

  const waitingCount = exam.waitingStudents?.length || 0;
  const activeCount = exam.activeStudents?.length || 0;
  const completedCount = exam.completedStudents?.length || 0;

  // Calculate circular progress percentage
  const progressPercentage = ((420 - timeRemaining) / 420) * 100;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (progressPercentage / 100) * circumference;

  // Format time display
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <FacultyHeader user={user} onLogout={() => navigate('/login')} onBack={() => navigate('/faculty/exam-management')} />

      <div className="max-w-7xl mx-auto px-4 lg:px-5 py-6 lg:py-8">
        {/* Game Controls */}
        <div className="mb-6 lg:mb-8 flex justify-center lg:justify-end gap-3 flex-wrap">
          {!gameStarted && (
            <button 
              className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:shadow-soft-lg transition-all border-2 border-indigo-600"
              onClick={handleStartGame}
              disabled={waitingCount === 0}
            >
              🚀 Bắt đầu
            </button>
          )}
          {gameStarted && !isAwarding && (
            <button 
              className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all shadow-soft"
              onClick={handleEndGame}
            >
              ⏹️ Kết thúc
            </button>
          )}
          {isAwarding && (
            <button 
              className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl font-bold hover:shadow-soft-lg transition-all animate-pulse"
              onClick={handleAward}
            >
              🏆 Công bố Kết quả
            </button>
          )}
        </div>

        {/* Countdown Timer with Circular Progress */}
        {gameStarted && !isAwarding && (
          <div className="mb-6 lg:mb-8 flex justify-center">
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* Circular Stats */}
              <svg className="absolute w-full h-full" viewBox="0 0 120 120">
                {/* Background circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                {/* Progress circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: '60px 60px',
                    transition: 'stroke-dashoffset 1s linear'
                  }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              
              {/* Center content */}
              <div className="absolute text-center">
                <div className="text-4xl font-bold text-indigo-600 mb-2">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
                <div className="text-sm text-gray-600">Thời gian còn lại</div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 lg:mb-8">
          <div className="bg-white rounded-2xl shadow-soft p-4 lg:p-6 border-l-4 border-indigo-500">
            <div className="text-gray-600 text-sm font-semibold">Đang chờ</div>
            <div className="text-4xl font-bold text-indigo-600 mt-2">{waitingCount}</div>
            <p className="text-gray-500 text-xs mt-2">Học sinh chưa bắt đầu</p>
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-4 lg:p-6 border-l-4 border-purple-500">
            <div className="text-gray-600 text-sm font-semibold">Đang chơi</div>
            <div className="text-4xl font-bold text-purple-600 mt-2">{activeCount}</div>
            <p className="text-gray-500 text-xs mt-2">Học sinh trong trò chơi</p>
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-4 lg:p-6 border-l-4 border-green-500">
            <div className="text-gray-600 text-sm font-semibold">Hoàn thành</div>
            <div className="text-4xl font-bold text-green-600 mt-2">{completedCount}</div>
            <p className="text-gray-500 text-xs mt-2">Đã kết thúc</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Waiting Students */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-soft-lg overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span>⏳</span>
                  Chờ bắt đầu ({waitingCount})
                </h3>
              </div>
              <div className="p-4 lg:p-6 max-h-96 overflow-y-auto">
                {waitingCount === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">Chưa có học sinh</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exam.waitingStudents.map((student, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
                        <div className="w-10 h-10 bg-indigo-200 rounded-full flex items-center justify-center font-bold text-indigo-600 flex-shrink-0">
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
            <div className="bg-white rounded-2xl shadow-soft-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span>🏆</span>
                  Bảng xếp hạng realtime ({completedCount})
                </h3>
              </div>
              <div className="p-4 lg:p-6 max-h-96 overflow-y-auto">
                {leaderboard.length === 0 && activeCount === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-sm">Chưa có học sinh hoàn thành</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.map((student, idx) => {
                      const timeTaken = student.endTime 
                        ? Math.floor((student.endTime - student.startTime) / 1000)
                        : 0;
                      const minutes = Math.floor(timeTaken / 60);
                      const seconds = timeTaken % 60;
                      
                      return (
                        <div key={student.id} className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:shadow-soft transition-all">
                          <div className="text-2xl flex-shrink-0">
                            {student.rank === 1 && <span className="text-3xl">🥇</span>}
                            {student.rank === 2 && <span className="text-3xl">🥈</span>}
                            {student.rank === 3 && <span className="text-3xl">🥉</span>}
                            {student.rank > 3 && (
                              <span className="font-bold text-gray-600">#{student.rank}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{student.name}</p>
                            <p className="text-xs text-gray-500">{minutes}m {seconds}s</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-lg text-indigo-600">{student.totalScore}</p>
                            <p className="text-xs text-gray-500">điểm</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Active Students List */}
                {activeCount > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <span>⚡</span>
                      Đang chơi ({activeCount})
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {exam.activeStudents.map((student, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg animate-pulse-glow">
                          <span className="text-xl">⚡</span>
                          <p className="text-xs text-gray-700 truncate font-medium">{student.name}</p>
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
        <div className="bg-white rounded-2xl shadow-soft-lg p-4 lg:p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📋</span>
            Thông tin trò chơi
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <p className="text-sm text-indigo-600 font-semibold mb-1">Chủ đề</p>
              <p className="text-lg font-semibold text-gray-800">{exam.description || 'Không có mô tả'}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-sm text-purple-600 font-semibold mb-1">Thời gian chơi</p>
              <p className="text-lg font-semibold text-gray-800">7 phút (90s + 120s + 210s)</p>
            </div>
            <div className="p-4 bg-pink-50 rounded-xl border border-pink-200">
              <p className="text-sm text-pink-600 font-semibold mb-1">Tổng câu hỏi</p>
              <p className="text-lg font-semibold text-gray-800">{exam.totalQuestions || exam.exercises?.reduce((sum, e) => sum + e.questions.length, 0) || 0}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <p className="text-sm text-green-600 font-semibold mb-1">Trạng thái</p>
              <p className="text-lg font-semibold">
                {gameStarted ? (
                  <span className="text-blue-600">🎮 Đang diễn ra</span>
                ) : (
                  <span className="text-indigo-600">⏳ Chờ bắt đầu</span>
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
