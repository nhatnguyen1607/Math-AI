import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import facultyService from '../../services/faculty/facultyService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyExamLiveSessionPage = () => {
  const { sessionId } = useParams();
  const [exam, setExam] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

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
        alert('Không tìm thấy phiên thi');
        navigate('/faculty/exam-management');
        return;
      }
      
      // Get exam session data first to get examId
      const examSessionService = (await import('../../services/examSessionService')).default;
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

  const loadParticipants = useCallback(async () => {
    try {
      if (!sessionId) return;
      const examSessionService = (await import('../../services/examSessionService')).default;
      const session = await examSessionService.getExamSession(sessionId);
      if (session && session.participants) {
        const participantList = Object.entries(session.participants).map(([uid, data]) => ({
          uid,
          ...data
        }));
        setParticipants(participantList || []);
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      loadExamData();
      // Polling realtime participants every 2 seconds
      const interval = setInterval(loadParticipants, 2000);
      return () => clearInterval(interval);
    }
  }, [sessionId, loadExamData, loadParticipants]);

  const handleEndExam = async () => {
    if (window.confirm('Bạn có chắc chắn muốn kết thúc phiên thi?')) {
      try {
        const examSessionService = (await import('../../services/examSessionService')).default;
        await examSessionService.finishExamSession(sessionId);
        alert('Phiên thi đã kết thúc!');
        navigate('/faculty/exam-management');
      } catch (error) {
        console.error('Error ending exam:', error);
        alert('Lỗi khi kết thúc phiên thi');
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

  const navItems = [
    { icon: '📊', label: 'Phiên Thi Trực Tiếp: ' + exam.title }
  ];

  return (
    <div className="faculty-exam-live-session">
      <FacultyHeader user={user} onLogout={() => navigate('/login')} onBack={() => navigate(-1)} navItems={navItems} />

      <div className="live-session-content">
        <button className="end-exam-btn" onClick={handleEndExam}>
          Kết thúc phiên thi
        </button>
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

          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-info">
              <div className="stat-value">{exam.duration}</div>
              <div className="stat-label">Phút còn lại</div>
            </div>
          </div>

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
