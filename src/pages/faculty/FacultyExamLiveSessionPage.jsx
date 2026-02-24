import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import facultyService from '../../services/faculty/facultyService';
import examSessionService from '../../services/examSessionService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyExamLiveSessionPage = () => {
  const { sessionId } = useParams();
  const [exam, setExam] = useState(null);
  const [session, setSession] = useState(null); // 🔧 ADD: Track session data
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const unsubscribeRef = useRef(null);
  
  // Countdown state
  const [timeRemaining, setTimeRemaining] = useState(420); // 7 minutes in seconds

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

  const loadExamData = useCallback(async () => {
    try {
      if (!sessionId) {
        alert('Không tìm thấy trò chơi');
        navigate('/faculty/exam-management');
        return;
      }
      
      // Get exam session data first to get examId
      const session = await examSessionService.getExamSession(sessionId);
      
      if (session && session.examId) {
        const data = await facultyService.getExamById(session.examId);
        setExam(data);
      } else {
        alert('Không tìm thấy đề thi');
        navigate('/faculty/exam-management');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading exam:', error);
      alert('Lỗi khi tải đề thi');
      navigate('/faculty/exam-management');
    }
  }, [sessionId, navigate]);

  // Subscribe to realtime session updates - THAY setInterval bằng onSnapshot
  useEffect(() => {
    if (!sessionId) return;

    // Load exam data once
    loadExamData();

    // Subscribe to participants realtime updates
    unsubscribeRef.current = examSessionService.subscribeToExamSession(
      sessionId,
      (sessionData) => {
        // 🔧 SAVE session data for timer calculation
        setSession(sessionData);
        
        if (sessionData && sessionData.participants) {
          const participantList = Object.entries(sessionData.participants).map(([uid, data]) => ({
            uid,
            ...data
          }));
          setParticipants(participantList || []);
        }
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [sessionId, loadExamData]);

  // Countdown timer effect - calculate from session startTime
  useEffect(() => {
    if (!sessionId || !session || !session.startTime) {
      console.log('⏳ Timer not ready:', { sessionId, hasSession: !!session, hasStartTime: !!session?.startTime });
      return;
    }

    console.log('📊 Timer initialized with session:', {
      status: session.status,
      startTime: session.startTime,
      startTimeType: typeof session.startTime
    });

    const timer = setInterval(() => {
      const remaining = session.getRemainingSeconds();

      console.log(`⏱️ Timer tick: remaining=${remaining}s, status=${session.status}`);

      setTimeRemaining(remaining);

      // When time is up, auto-lock exam
      if (remaining <= 0 && session.status === 'ongoing') {
        clearInterval(timer);
        // Auto-finish exam without asking
        examSessionService.finishExamSession(sessionId)
          .then(() => {
            alert('⏰ Hết giờ! trò chơi đã kết thúc và khóa. Bài làm của tất cả học sinh đã được nộp tự động.');
            navigate('/faculty/exam-management');
          })
          .catch((error) => {
            alert('Lỗi khi kết thúc trò chơi tự động');
          });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId, session, navigate]);

  const handleEndExam = async () => {
    if (window.confirm('Bạn có chắc chắn muốn kết thúc trò chơi? Bài làm của tất cả học sinh sẽ được nộp tự động.')) {
      try {
        // 🔧 Finish exam session (auto-submits all students & locks exam)
        await examSessionService.finishExamSession(sessionId);
        
        alert('✅ Trò chơi đã kết thúc! Bài làm của tất cả học sinh đã được nộp tự động.');
        navigate('/faculty/exam-management');
      } catch (error) {
        console.error('Error ending exam:', error);
        alert('Lỗi khi kết thúc trò chơi');
      }
    }
  };

  if (loading || !exam) {
    return <div className="loading">Đang tải...</div>;
  }

  // Sắp xếp participants theo điểm (giảm dần)
  const sortedParticipants = [...participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.timeSubmitted && b.timeSubmitted) {
      return a.timeSubmitted - b.timeSubmitted;
    }
    return 0;
  });

  // const navItems = [
  //   { icon: '📊', label: 'trò chơi Trực Tiếp: ' + exam.title }
  // ];

  return (
    <div className="faculty-exam-live-session">
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
      <FacultyHeader user={user} onLogout={() => navigate('/login')} />
      
      {/* Back Button */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 px-8 lg:px-12 py-3 shadow-soft-md">
        <button
          onClick={() => navigate(-1)}
          className="px-4 lg:px-6 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold rounded-lg transition-all duration-300 flex items-center gap-2"
        >
          ← Quay lại
        </button>
      </div>

      <div className="live-session-content" style={{ padding: '20px' }}>
        {/* Game Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px' }}>
          <button 
            className="end-exam-btn" 
            onClick={handleEndExam}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⏹️ Kết thúc trò chơi
          </button>
        </div>

        {/* Countdown Timer - Only show when session has started */}
        {session?.startTime && (
          <div style={{
            marginBottom: '16px',
            background: 'linear-gradient(to right, #3b82f6, #9333ea)',
            borderRadius: '8px',
            boxShadow: '0 10px 15px rgba(0,0,0,0.1)',
            padding: '24px',
            textAlign: 'center',
            color: 'white'
          }}>
            <p style={{ fontSize: '14px', fontWeight: 600, opacity: 0.9, marginBottom: '8px' }}>⏱️ Thời gian còn lại</p>
            <div style={{ fontSize: '48px', fontWeight: 700, fontFamily: 'monospace' }}>
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </div>
            {timeRemaining <= 60 && timeRemaining > 0 && (
              <p style={{ fontSize: '18px', marginTop: '12px', animation: 'pulse 1s infinite' }}>⚠️ Sắp hết giờ!</p>
            )}
            {timeRemaining === 0 && (
              <p style={{ fontSize: '18px', marginTop: '12px', color: '#fca5a5' }}>❌ Đã hết giờ</p>
            )}
          </div>
        )}
      </div>

      <div className="live-content">
        {/* Thống kê */}
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <div className="stat-value">{participants.length}</div>
              <div className="stat-label">Học sinh tham gia</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <div className="stat-value">
                {participants.filter(p => p.submitted).length}
              </div>
              <div className="stat-label">Đã nộp bài</div>
            </div>
          </div>

          {/* <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-info">
              <div className="stat-value">{exam.duration}</div>
              <div className="stat-label">Phút còn lại</div>
            </div>
          </div> */}

          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-info">
              <div className="stat-value">
                {Math.round(
                  (participants.filter(p => (p.score || 0) >= exam.passingScore).length /
                    Math.max(participants.length, 1)) *
                    100
                )}%
              </div>
              <div className="stat-label">Đạt điểm</div>
            </div>
          </div>
        </div>

        {/* Bảng xếp hạng */}
        <div className="leaderboard-container">
          <h2>Bảng xếp hạng</h2>
          {sortedParticipants.length === 0 ? (
            <div className="empty-state">
              <p>Chưa có học sinh tham gia</p>
            </div>
          ) : (
            <div className="leaderboard-table">
              <style>{`
                .leaderboard-table {
                  width: 100%;
                }
                .leaderboard-table .table-header,
                .leaderboard-table .table-row {
                  display: grid;
                  grid-template-columns: 100px 1fr 150px;
                  gap: 20px;
                  align-items: center;
                  padding: 15px 20px;
                  border-bottom: 1px solid #f0f0f0;
                }
                .leaderboard-table .table-header {
                  background: #f5f5f5;
                  font-weight: bold;
                  border-bottom: 2px solid #ddd;
                }
                .leaderboard-table .table-row {
                  background: white;
                }
                .leaderboard-table .table-row:hover {
                  background: #fafafa;
                }
                .leaderboard-table .col {
                  padding: 0;
                }
                .leaderboard-table .col-rank {
                  text-align: center;
                  font-weight: bold;
                  font-size: 18px;
                }
                .leaderboard-table .col-name {
                  text-align: left;
                }
                .leaderboard-table .col-score {
                  text-align: center;
                }
                .leaderboard-table .score {
                  font-weight: bold;
                  padding: 8px 12px;
                  border-radius: 6px;
                  color: #333;
                  background: transparent;
                }
              `}</style>
              <div className="table-header">
                <div className="col col-rank">Hạng</div>
                <div className="col col-name">Họ tên</div>
                <div className="col col-score">Điểm</div>
              </div>

              {sortedParticipants.map((participant, index) => (
                <div
                  key={participant.uid || participant.id}
                  className={`table-row ${index < 3 ? `rank-${index + 1}` : ''}`}
                >
                  <div className="col col-rank">
                    {index === 0 && '🥇'}
                    {index === 1 && '🥈'}
                    {index === 2 && '🥉'}
                    {index > 2 && `#${index + 1}`}
                  </div>
                  <div className="col col-name">{participant.studentName || participant.name || 'Ẩn danh'}</div>
                  <div className="col col-score">
                    <span className="score">
                      {Math.round(participant.score || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyExamLiveSessionPage;
