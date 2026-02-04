import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import studentService from '../../services/student/studentService';
import StudentHeader from '../../components/student/StudentHeader';

const StudentExamLobbyPage = () => {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [examStatus, setExamStatus] = useState('waiting'); // waiting, starting, started, ended
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'student') {
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
    // Polling exam status every 1 second
    const interval = setInterval(loadExamData, 1000);
    return () => clearInterval(interval);
  }, [examId, loadExamData]);

  const loadExamData = async () => {
    try {
      const [examData, participantsData] = await Promise.all([
        studentService.getExamById(examId),
        studentService.getExamParticipants(examId)
      ]);

      setExam(examData);
      setParticipants(participantsData || []);

      // Kiểm tra trạng thái đề thi
      if (examData.status === 'open') {
        setExamStatus('waiting');
      } else if (examData.status === 'starting') {
        setExamStatus('starting');
        // Chuyển sang trang thi sau 3 giây countdown
        setTimeout(() => {
          navigate(`/student/exam/${examId}`);
        }, 3000);
      } else if (examData.status === 'started') {
        setExamStatus('started');
        navigate(`/student/exam/${examId}`);
      } else if (examData.status === 'closed') {
        setExamStatus('ended');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading exam:', error);
      alert('Lỗi khi tải thông tin đề thi');
      navigate('/student');
    }
  };

  if (loading || !exam) {
    return <div className="loading">Đang tải...</div>;
  }

  const navItems = [
    { icon: '📝', label: 'Sảnh Chờ: ' + exam.title }
  ];

  return (
    <div className="exam-lobby">
      <StudentHeader user={user} onLogout={() => navigate('/login')} onBack={() => navigate('/student')} navItems={navItems} />

      {examStatus === 'starting' && (
        <div className="countdown-overlay">
          <div className="countdown-box">
            <h2>Bắt đầu sau</h2>
            <div className="countdown-animation">
              <div className="pulse">3... 2... 1...</div>
            </div>
            <p>Chuẩn bị sẵn sàng!</p>
          </div>
        </div>
      )}

      {examStatus === 'ended' && (
        <div className="ended-overlay">
          <div className="ended-box">
            <h2>⏰ Phiên thi đã kết thúc</h2>
            <p>Giáo viên đã kết thúc phiên thi.</p>
            <button className="btn-back" onClick={() => navigate('/student')}>
              Quay lại trang chủ
            </button>
          </div>
        </div>
      )}

      <div className="lobby-content">
        <div className="lobby-main">
          {/* Thông tin đề thi */}
          <div className="exam-card">
            <h2>Thông tin đề thi</h2>
            {exam.description && <p className="description">{exam.description}</p>}
            
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Số câu hỏi</span>
                <span className="value">{exam.questions?.length || 0}</span>
              </div>
              <div className="info-item">
                <span className="label">Thời gian làm bài</span>
                <span className="value">{exam.duration} phút</span>
              </div>
              <div className="info-item">
                <span className="label">Điểm đạt</span>
                <span className="value">{exam.passingScore}%</span>
              </div>
              <div className="info-item">
                <span className="label">Trạng thái</span>
                <span className={`status ${examStatus}`}>
                  {examStatus === 'waiting' && '⏳ Chờ bắt đầu'}
                  {examStatus === 'starting' && '🚀 Chuẩn bị bắt đầu'}
                  {examStatus === 'started' && '✍️ Đang diễn ra'}
                  {examStatus === 'ended' && '✓ Đã kết thúc'}
                </span>
              </div>
            </div>
          </div>

          {/* Hướng dẫn */}
          <div className="instructions-card">
            <h3>⚠️ Lưu ý quan trọng</h3>
            <ul>
              <li>Hãy chắc chắn kết nối internet ổn định</li>
              <li>Không rời khỏi trang trong lúc làm bài</li>
              <li>Sau khi nộp bài, bạn không thể chỉnh sửa câu trả lời</li>
              <li>Thời gian đếm ngược sẽ bắt đầu khi giáo viên bấm "Bắt đầu"</li>
            </ul>
          </div>
        </div>

        {/* Danh sách thí sinh */}
        <div className="participants-card">
          <h2>Thí sinh trong phòng ({participants.length})</h2>
          <div className="participants-list">
            {participants.length === 0 ? (
              <p className="empty">Bạn là thí sinh đầu tiên</p>
            ) : (
              participants.map((participant) => (
                <div key={participant.id} className="participant-item">
                  <span className="name">{participant.studentName}</span>
                  <span className={`status ${participant.status}`}>
                    {participant.status === 'joined' && '✓ Đã vào'}
                    {participant.status === 'ongoing' && '⏳ Đang làm'}
                    {participant.status === 'submitted' && '✓ Nộp bài'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentExamLobbyPage;
