import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import facultyService from '../../services/faculty/facultyService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyExamLiveSessionPage = () => {
  const { examId } = useParams();
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

  useEffect(() => {
    loadExamData();
    // Polling realtime participants every 2 seconds
    const interval = setInterval(loadParticipants, 2000);
    return () => clearInterval(interval);
  }, [examId]);

  const loadExamData = async () => {
    try {
      const data = await facultyService.getExamById(examId);
      setExam(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading exam:', error);
      alert('Lỗi khi tải đề thi');
      navigate('/faculty/exam-management');
    }
  };

  const loadParticipants = async () => {
    try {
      const data = await facultyService.getExamParticipants(examId);
      setParticipants(data || []);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const handleEndExam = async () => {
    if (window.confirm('Bạn có chắc chắn muốn kết thúc phiên thi?')) {
      try {
        await facultyService.updateExamStatus(examId, 'closed');
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
    <div className="faculty-exam-live">
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
              <div className="table-header">
                <div className="col col-rank">Hạng</div>
                <div className="col col-name">Họ tên</div>
                <div className="col col-score">Điểm</div>
                <div className="col col-correct">Đúng</div>
                <div className="col col-status">Trạng thái</div>
                <div className="col col-time">Thời gian</div>
              </div>

              {sortedParticipants.map((participant, index) => (
                <div
                  key={participant.id}
                  className={`table-row ${index < 3 ? `rank-${index + 1}` : ''}`}
                >
                  <div className="col col-rank">
                    {index === 0 && '🥇'}
                    {index === 1 && '🥈'}
                    {index === 2 && '🥉'}
                    {index > 2 && `#${index + 1}`}
                  </div>
                  <div className="col col-name">{participant.studentName}</div>
                  <div className="col col-score">
                    <span className={`score ${participant.score >= exam.passingScore ? 'pass' : 'fail'}`}>
                      {participant.score || 0}%
                    </span>
                  </div>
                  <div className="col col-correct">
                    {participant.correctAnswers || 0}/{exam.questions?.length || 0}
                  </div>
                  <div className="col col-status">
                    {participant.submitted ? (
                      <span className="status-badge submitted">✓ Nộp bài</span>
                    ) : (
                      <span className="status-badge pending">⏳ Đang làm</span>
                    )}
                  </div>
                  <div className="col col-time">
                    {participant.timeSubmitted ? (
                      <span>{Math.round(participant.timeSubmitted / 60)}m</span>
                    ) : (
                      <span>-</span>
                    )}
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
