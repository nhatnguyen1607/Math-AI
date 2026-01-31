import React, { useState, useEffect, useCallback } from 'react';
import { getUserProblemHistory } from '../services/firestoreService';
import './Dashboard.css';

function Dashboard({ user, onStartProblem, onSignOut }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const sessions = await getUserProblemHistory(user.uid, 5);
      setHistory(sessions);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);


  const getEvaluationText = (level) => {
    if (!level) return '—';
    const map = {
      'need_effort': 'Cần cố gắng',
      'pass': 'Đạt',
      'good': 'Tốt'
    };
    return map[level] || '—';
  };

  const getEvaluationColor = (level) => {
    const map = {
      'need_effort': '#ff6b6b',
      'pass': '#ffd93d',
      'good': '#6bcf7f'
    };
    return map[level] || '#ddd';
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>🎓 AI Math</h1>
          <p>Xin chào, {user.displayName}!</p>
        </div>
        <div className="header-right">
          <img 
            src={user.photoURL} 
            alt={user.displayName} 
            className="user-avatar"
          />
          <button onClick={onSignOut} className="signout-btn">
            Đăng xuất
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="welcome-section">
          <h2>Sẵn sàng giải toán chưa? 😊</h2>
          <p>AI sẽ đồng hành cùng bạn qua 4 bước giải toán của Polya</p>
          <button 
            className="start-problem-btn"
            onClick={onStartProblem}
          >
            ✏️ Bắt đầu bài toán mới
          </button>
        </div>

        <div className="steps-info">
          <h3>4 Bước Giải Toán</h3>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h4>Hiểu bài toán</h4>
              <p>Xác định dữ kiện và yêu cầu</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h4>Lập kế hoạch</h4>
              <p>Tìm cách giải phù hợp</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h4>Thực hiện</h4>
              <p>Giải bài toán theo kế hoạch</p>
            </div>
            <div className="step-card">
              <div className="step-number">4</div>
              <h4>Kiểm tra</h4>
              <p>Đánh giá và mở rộng</p>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="history-section">
            <h3>Lịch sử bài tập gần đây</h3>
            {loading ? (
              <p>Đang tải...</p>
            ) : (
              <div className="history-list">
                {history.map((session, index) => (
                  <div key={session.id} className="history-item">
                    <div className="history-header">
                      <span className="history-number">#{history.length - index}</span>
                      <span className="history-status">
                        {session.status === 'completed' ? '✅ Hoàn thành' : '⏳ Đang làm'}
                      </span>
                    </div>
                    <p className="history-problem">
                      {session.problemText?.substring(0, 100)}
                      {session.problemText?.length > 100 ? '...' : ''}
                    </p>
                    {session.status === 'completed' && (
                      <div className="history-evaluations">
                        <span>Đánh giá: </span>
                        {[1, 2, 3, 4].map(step => (
                          <span 
                            key={step}
                            className="eval-badge"
                            style={{ 
                              background: getEvaluationColor(session.stepEvaluations[`step${step}`])
                            }}
                          >
                            B{step}: {getEvaluationText(session.stepEvaluations[`step${step}`])}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
