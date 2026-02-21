import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import examSessionService from '../../services/examSessionService';
import examService from '../../services/examService';

/**
 * StudentExamLobbyPage
 * Lobby page cho học sinh trước khi bắt đầu thi
 * - Tham gia phòng thi
 * - Xem danh sách người tham gia
 * - Chờ giảng viên bắt đầu
 * - Đếm ngược 3-2-1 khi giảng viên bắt đầu
 * - Chuyển đến trang làm bài
 */

const StudentExamLobbyPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { sessionId, examId } = useParams();
  const [searchParams] = useSearchParams();
  
  // Determine which ID to use - sessionId from query params, route params, or examId
  const actualSessionId = searchParams.get('sessionId') || sessionId;
  const actualExamId = examId;

  // Session & Exam state
  const [session, setSession] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Join state
  const [joined, setJoined] = useState(false);
  const [joiningLoading, setJoiningLoading] = useState(false);

  // Countdown state
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(false);

  // Find active session for exam ID
  useEffect(() => {
    if (!actualExamId || actualSessionId) return; // Skip if we already have sessionId
    
    const findActiveSession = async () => {
      try {
        // Get all active sessions for this exam
        const activeSessions = await examSessionService.getActiveSessionsByExamId(actualExamId);
        
        if (activeSessions && activeSessions.length > 0) {
          const session = activeSessions[0];
          
          // Check if session is finished
          if (session.status === 'finished') {
            setError('Phiên thi đã kết thúc. Vui lòng chờ giáo viên bắt đầu phiên thi mới.');
            setLoading(false);
          } else {
            // Use the active session
            const activeSessionId = session.id;
            navigate(`/student/exam-lobby/${actualExamId}?sessionId=${activeSessionId}`, { replace: true });
          }
        } else {
          setError('Chưa có phiên thi nào được bắt đầu cho đề thi này. Vui lòng chờ giáo viên kích hoạt phiên thi.');
          setLoading(false);
        }
      } catch (err) {
        setError('Lỗi khi tìm phiên thi: ' + err.message);
        setLoading(false);
      }
    };
    
    findActiveSession();
  }, [actualExamId, actualSessionId, navigate]);

  // Lắng nghe realtime session
  useEffect(() => {
    if (!actualSessionId) {
      // If we don't have sessionId yet, wait for it
      return;
    }

    let unsubscribe;

    const subscribeToSession = async () => {
      try {
        unsubscribe = examSessionService.subscribeToExamSession(
          actualSessionId,
          async (sessionData) => {
            if (sessionData) {
              setSession(sessionData);
              setError(null);

              // Check if current user has joined (is in participants)
              const userInParticipants = sessionData.participants && sessionData.participants[user?.uid];

              // Lấy dữ liệu đề thi nếu chưa có
              if (!exam && sessionData.examId) {
                try {
                  const examData = await examService.getExamById(sessionData.examId);
                  setExam(examData);
                } catch (err) {
                }
              }

              // Nếu status là 'starting' và đã join thì hiển thị countdown
              if (sessionData.status === 'starting' && !showCountdown && userInParticipants) {
                setShowCountdown(true);
              }

              // Nếu status là 'ongoing' và đã join, chuyển đến trang làm bài
              if (sessionData.status === 'ongoing' && userInParticipants && !showCountdown) {
                navigate(`/student/exam/${actualSessionId}`, { state: { sessionId: actualSessionId } });
              }

              // Nếu session đã finished, chuyển đến trang kết quả
              if (sessionData.status === 'finished' && showCountdown) {
                // Cho đủ thời gian countdown kết thúc trước
                setTimeout(() => {
                  navigate(`/student/exam-result/${actualSessionId}`);
                }, 3000);
              }
            } else {
              setError('Phiên thi không tồn tại');
            }

            setLoading(false);
          }
        );
      } catch (err) {
        setError('Lỗi khi kết nối phiên thi');
        setLoading(false);
      }
    };

    subscribeToSession();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [actualSessionId, exam, showCountdown, navigate, user?.uid]);

  // Xử lý countdown khi Faculty bắt đầu
  useEffect(() => {
    if (!showCountdown || !session || !session.startTime) return;

    let countdownTimer;

    const updateCountdown = () => {
      // Convert Firestore Timestamp to milliseconds if needed
      let startTimeMs = session.startTime;
      if (typeof session.startTime === 'object' && session.startTime.toDate) {
        // Firestore Timestamp object
        startTimeMs = session.startTime.toDate().getTime();
      } else if (typeof session.startTime === 'object' && session.startTime.seconds) {
        // Firestore Timestamp with seconds property
        startTimeMs = session.startTime.seconds * 1000;
      }

      const now = Date.now();
      const timeElapsed = Math.floor((now - startTimeMs) / 1000);
      const remaining = Math.max(0, 3 - timeElapsed);

      setCountdown(remaining);

      if (remaining <= 0) {
        // Chuyển đến trang làm bài
        navigate(`/student/exam/${actualSessionId}`, { state: { sessionId: actualSessionId } });
      } else {
        // Update mỗi 100ms để smooth
        countdownTimer = setTimeout(updateCountdown, 100);
      }
    };

    updateCountdown();

    return () => {
      if (countdownTimer) clearTimeout(countdownTimer);
    };
  }, [showCountdown, actualSessionId, navigate, session]);

  // Handler: Tham gia phòng thi
  const handleJoinExam = async () => {
    try {
      if (!user?.uid) {
        setError('Vui lòng đăng nhập trước');
        return;
      }

      if (!actualSessionId) {
        setError('Không tìm thấy ID phiên thi');
        return;
      }

      setJoiningLoading(true);

      await examSessionService.joinExamSession(actualSessionId, user.uid, user.displayName || 'Unknown');

      setJoined(true);
      setError(null);
    } catch (err) {
      setError('Không thể tham gia phòng thi. Vui lòng thử lại.');
    } finally {
      setJoiningLoading(false);
    }
  };

  // Handler: Rời khỏi phòng thi
  const handleLeaveExam = () => {
    navigate(-1);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="text-6xl animate-bounce-gentle">🐻</div>
          <div className="text-2xl font-bold text-gray-700 font-quicksand">Đang tải phiên thi...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">⚠️</div>
          <h2 className="text-gray-800 text-3xl font-bold font-quicksand text-center">{error}</h2>
          <button
            onClick={handleLeaveExam}
            className="btn-3d px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-quicksand rounded-max hover:shadow-lg transition-all"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex items-center justify-center pt-20">
          <div className="text-6xl animate-bounce-gentle">🐻</div>
        </div>
      </div>
    );
  }

  // Countdown screen with colorful animated numbers
  if (showCountdown) {
    const countdownColors = {
      3: 'countdown-3',
      2: 'countdown-2',
      1: 'countdown-1',
      0: 'countdown-go'
    };

    const countdownText = countdown > 0 ? countdown : '🎯';

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Mascot Waiting */}
        <div className="absolute top-10 left-10 text-8xl animate-bounce-gentle">🐻</div>
        
        <p className="text-gray-800 text-3xl font-bold mb-12 font-quicksand">
          🚀 Chuẩn bị bắt đầu...
        </p>
        
        <div className={`countdown-number ${countdownColors[countdown]} mb-12 font-quicksand`}>
          {countdownText}
        </div>
        
        <p className="text-gray-700 text-2xl font-quicksand">
          {countdown > 0
            ? '⏰ Chứng tỏ kiến thức của bạn!'
            : '💪 Chúc bạn làm bài tốt!'}
        </p>
      </div>
    );
  }

  // Lobby screen
  const participants = Object.values(session.participants || {});
  const participantNames = Object.entries(session.participants || {})
    .map(([uid, p]) => ({
      uid,
      name: p.name,
      isCurrentUser: uid === user?.uid
    }))
    .sort((a, b) => (b.isCurrentUser ? 1 : 0));

  const statusText = {
    waiting: '⏳ Chờ bắt đầu',
    starting: '🚀 Đang đếm ngược',
    ongoing: '⏱️ Đang diễn ra',
    finished: '✅ Đã kết thúc'
  };

  // Avatar colors palette
  const avatarColors = [
    'avatar-circle-pink',
    'avatar-circle-green',
    'avatar-circle-blue',
    'avatar-circle-yellow'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 pb-10">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="max-w-5xl mx-auto px-5 pt-10">
        {/* Exam Card - Nâng cấp */}
        <div className="game-card bg-gradient-to-br from-purple-300 to-pink-300 rounded-max shadow-2xl p-12 mb-12 text-center">
          <div className="text-8xl mb-6">📝</div>
          <h1 className="text-5xl font-bold text-gray-800 mb-4 font-quicksand">{exam?.title || 'Phòng thi trực tiếp'}</h1>
          {exam?.description && (
            <p className="text-gray-700 text-xl font-quicksand">{exam.description}</p>
          )}
        </div>

        {/* Status & Info Grid - Nâng cấp với Pastel */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="game-card bg-card-pastel-blue rounded-max p-6 text-center shadow-lg">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-sm text-gray-700 font-bold font-quicksand mb-2">Trạng thái</div>
            <div className="text-xl font-bold text-blue-700 font-quicksand">{statusText[session.status]}</div>
          </div>

          <div className="game-card bg-card-pastel-pink rounded-max p-6 text-center shadow-lg">
            <div className="text-4xl mb-3">👥</div>
            <div className="text-sm text-gray-700 font-bold font-quicksand mb-2">Người tham gia</div>
            <div className="text-xl font-bold text-pink-700 font-quicksand">{participants.length}</div>
          </div>

          <div className="game-card bg-card-pastel-green rounded-max p-6 text-center shadow-lg">
            <div className="text-4xl mb-3">⏱️</div>
            <div className="text-sm text-gray-700 font-bold font-quicksand mb-2">Thời lượng</div>
            <div className="text-xl font-bold text-green-700 font-quicksand">
              {7} phút
            </div>
          </div>

          <div className="game-card bg-card-pastel-yellow rounded-max p-6 text-center shadow-lg">
            <div className="text-4xl mb-3">❓</div>
            <div className="text-sm text-gray-700 font-bold font-quicksand mb-2">Số câu</div>
            <div className="text-xl font-bold text-yellow-700 font-quicksand">{session.totalQuestions || 0}</div>
          </div>
        </div>

        {/* Participants Section - Avatar Circle */}
        <div className="bg-white rounded-max shadow-lg p-10 mb-12 game-card">
          <h3 className="text-3xl font-bold text-gray-800 mb-8 font-quicksand">👥 Người tham gia ({participantNames.length})</h3>

          {participantNames.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-gray-400">
              <div className="text-7xl">🦗</div>
              <p className="text-xl font-quicksand">Chưa có ai tham gia</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6 justify-center">
              {participantNames.map((participant, idx) => (
                <div key={participant.uid} className="flex flex-col items-center">
                  {/* Avatar Circle */}
                  <div className={`avatar-circle ${avatarColors[idx % avatarColors.length]} mb-3`}>
                    {(participant.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  
                  {/* Name and Status */}
                  <p className="font-bold text-gray-800 text-center font-quicksand">
                    {participant.name || 'Unknown'}
                  </p>
                  
                  {participant.isCurrentUser && (
                    <span className="text-xs bg-purple-600 text-white px-3 py-1 rounded-full font-bold mt-2">
                      Bạn
                    </span>
                  )}
                  
                  <p className="text-green-600 font-semibold text-sm mt-2 font-quicksand">
                    🟢 Online
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="flex items-center gap-3 bg-red-400 text-white px-6 py-4 rounded-max shadow-lg mb-8 font-quicksand">
            <span className="text-2xl">⚠️</span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-2xl font-bold">✕</button>
          </div>
        )}

        {!joined && session.status !== 'finished' && (
          <div className="flex items-center gap-3 bg-blue-400 text-white px-6 py-4 rounded-max shadow-lg mb-8 font-quicksand">
            <span className="text-2xl">ℹ️</span>
            <span>Hãy nhấn "Tham gia" để sẵn sàng. Chờ giáo viên bắt đầu khi tất cả đã sẵn sàng.</span>
          </div>
        )}

        {joined && session.status === 'waiting' && (
          <div className="flex items-center gap-3 bg-green-400 text-white px-6 py-4 rounded-max shadow-lg mb-8 font-quicksand">
            <span className="text-2xl">✅</span>
            <span>Bạn đã tham gia thành công. Chờ giáo viên bắt đầu...</span>
          </div>
        )}

        {!joined && session.status === 'waiting' && (
          <div className="flex items-center gap-3 bg-yellow-400 text-white px-6 py-4 rounded-max shadow-lg mb-8 font-quicksand">
            <span className="text-2xl">⚠️</span>
            <span>Chuẩn bị sẵn sàng: Bạn sẽ có {exam?.duration || 7} phút để hoàn thành bài thi.</span>
          </div>
        )}

        {session.status === 'finished' && (
          <div className="flex items-center gap-3 bg-teal-400 text-white px-6 py-4 rounded-max shadow-lg mb-8 font-quicksand">
            <span className="text-2xl">✅</span>
            <span>Phiên thi đã kết thúc. Vui lòng chờ để xem kết quả...</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-6 mb-12 flex-col md:flex-row">
          {!joined && session.status !== 'finished' && (
            <>
              <button
                onClick={handleJoinExam}
                disabled={joiningLoading}
                className="btn-3d flex-1 py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold text-lg rounded-max hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-quicksand"
              >
                {joiningLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Đang tham gia...
                  </>
                ) : (
                  <>✓ Tham gia phòng thi</>
                )}
              </button>
              <button
                onClick={handleLeaveExam}
                className="btn-3d flex-1 py-4 bg-white text-gray-800 font-bold text-lg rounded-max border-3 border-gray-400 hover:shadow-lg transition-all font-quicksand"
              >
                ✕ Quay lại
              </button>
            </>
          )}

          {joined && session.status === 'waiting' && (
            <button
              onClick={handleLeaveExam}
              className="btn-3d w-full py-4 bg-white text-gray-800 font-bold text-lg rounded-max border-3 border-gray-400 hover:shadow-lg transition-all font-quicksand"
            >
              ✕ Rời khỏi phòng
            </button>
          )}

          {session.status === 'finished' && (
            <button
              onClick={() => navigate(`/student/exam-result/${actualSessionId}`)}
              className="btn-3d w-full py-4 bg-gradient-to-r from-purple-400 to-pink-400 text-white font-bold text-lg rounded-max hover:shadow-lg transition-all font-quicksand"
            >
              📊 Xem kết quả
            </button>
          )}
        </div>

        {/* Tips Section */}
        <div className="bg-white rounded-max shadow-lg p-10 game-card">
          <h3 className="text-3xl font-bold text-gray-800 mb-8 font-quicksand">💡 Lời khuyên trước khi bắt đầu</h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-3 text-gray-700 font-quicksand">
              <span className="text-3xl flex-shrink-0">✓</span>
              <span className="text-lg">Kiểm tra kết nối Internet ổn định</span>
            </li>
            <li className="flex items-start gap-3 text-gray-700 font-quicksand">
              <span className="text-3xl flex-shrink-0">✓</span>
              <span className="text-lg">Đảm bảo pin thiết bị đầy đủ</span>
            </li>
            <li className="flex items-start gap-3 text-gray-700 font-quicksand">
              <span className="text-3xl flex-shrink-0">✓</span>
              <span className="text-lg">Tìm một nơi yên tĩnh để tập trung</span>
            </li>
            <li className="flex items-start gap-3 text-gray-700 font-quicksand">
              <span className="text-3xl flex-shrink-0">✓</span>
              <span className="text-lg">Đọc kỹ từng câu hỏi trước khi trả lời</span>
            </li>
            <li className="flex items-start gap-3 text-gray-700 font-quicksand">
              <span className="text-3xl flex-shrink-0">✓</span>
              <span className="text-lg">Quản lý thời gian hợp lý ({exam?.duration || 7} phút cho tất cả)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StudentExamLobbyPage;
