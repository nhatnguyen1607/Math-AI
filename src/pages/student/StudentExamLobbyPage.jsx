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
            setError('Phiên thi đã kết thúc. Vui lòng chờ giảng viên bắt đầu phiên thi mới.');
            setLoading(false);
          } else {
            // Use the active session
            const activeSessionId = session.id;
            navigate(`/student/exam-lobby/${actualExamId}?sessionId=${activeSessionId}`, { replace: true });
          }
        } else {
          setError('Chưa có phiên thi nào được bắt đầu cho đề thi này. Vui lòng chờ giảng viên kích hoạt phiên thi.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error finding active session:', err);
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
                  console.error('Error loading exam:', err);
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
        console.error('Error subscribing to session:', err);
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
    if (!showCountdown) return;

    let countdownTimer;
    let startTime = Date.now();

    const updateCountdown = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, 3 - elapsed);

      setCountdown(remaining);

      if (remaining <= 0) {
        // Chuyển đến trang làm bài
        navigate(`/student/exam/${actualSessionId}`, { state: { sessionId: actualSessionId } });
      } else {
        countdownTimer = setTimeout(updateCountdown, 100);
      }
    };

    updateCountdown();

    return () => {
      if (countdownTimer) clearTimeout(countdownTimer);
    };
  }, [showCountdown, actualSessionId, navigate]);

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
      console.error('Error joining exam:', err);
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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-white rounded-full animate-spin"></div>
          <p className="text-white text-lg font-medium">Đang tải phiên thi...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex flex-col items-center justify-center gap-8 px-5 py-20">
          <div className="text-8xl">⚠️</div>
          <h2 className="text-white text-2xl font-bold">{error}</h2>
          <button
            onClick={handleLeaveExam}
            className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:shadow-lg hover:scale-105 transition-all"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex items-center justify-center pt-20">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-white rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Countdown screen (3-2-1)
  if (showCountdown) {
    const countdownText = countdown > 0 ? countdown : '🎯 BẮT ĐẦU!';

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-2xl font-semibold mb-8">Chuẩn bị bắt đầu...</p>
          <div
            className={`text-9xl font-bold mb-8 ${
              countdown === 0 ? 'text-green-300 animate-bounce' : 'text-white animate-pulse'
            }`}
            style={{
              animation: countdown === 0 ? 'bounce 0.6s ease infinite' : 'pulse 1s ease-in-out infinite'
            }}
          >
            {countdownText}
          </div>
          <p className="text-white text-xl">
            {countdown > 0
              ? 'Chuẩn bị chứng tỏ kiến thức của bạn! 🚀'
              : 'Chúc bạn làm bài tốt! 💪'}
          </p>
        </div>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 pb-10">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="max-w-4xl mx-auto px-5 pt-10">
        {/* Exam Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 mb-10 text-center animate-in slide-in-from-bottom duration-500">
          <div className="text-6xl mb-4">📝</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3">{exam?.title || 'Phòng thi trực tiếp'}</h1>
          {exam?.description && (
            <p className="text-gray-600 text-lg">{exam.description}</p>
          )}
        </div>

        {/* Status & Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-sm text-gray-500 font-semibold uppercase mb-2">Trạng thái</div>
            <div className="text-lg font-bold text-purple-600">{statusText[session.status]}</div>
          </div>

          <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-sm text-gray-500 font-semibold uppercase mb-2">Người tham gia</div>
            <div className="text-lg font-bold text-purple-600">{participants.length}</div>
          </div>

          <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
            <div className="text-3xl mb-2">⏱️</div>
            <div className="text-sm text-gray-500 font-semibold uppercase mb-2">Thời lượng</div>
            <div className="text-lg font-bold text-purple-600">7 phút</div>
          </div>

          <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
            <div className="text-3xl mb-2">❓</div>
            <div className="text-sm text-gray-500 font-semibold uppercase mb-2">Số câu</div>
            <div className="text-lg font-bold text-purple-600">{session.totalQuestions || 0}</div>
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-10">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">👥 Người tham gia ({participantNames.length})</h3>

          {participantNames.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10 text-gray-400">
              <div className="text-6xl">🦗</div>
              <p className="text-lg">Chưa có ai tham gia</p>
            </div>
          ) : (
            <div className="space-y-3">
              {participantNames.map((participant) => (
                <div
                  key={participant.uid}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                    participant.isCurrentUser
                      ? 'bg-purple-50 border-2 border-purple-400'
                      : 'bg-gray-50 border-2 border-gray-200'
                  }`}
                >
                  <div className="relative">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                        participant.isCurrentUser
                          ? 'bg-gradient-to-br from-purple-600 to-purple-700'
                          : 'bg-gradient-to-br from-blue-600 to-blue-700'
                      }`}
                    >
                      {(participant.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 flex items-center gap-2">
                      {participant.name || 'Unknown'}
                      {participant.isCurrentUser && (
                        <span className="text-xs bg-purple-600 text-white px-3 py-1 rounded-full font-bold">
                          Bạn
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-green-600 font-semibold text-sm">🟢 Online</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg mb-8 animate-in">
            <span className="text-xl">⚠️</span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-xl font-bold">✕</button>
          </div>
        )}

        {!joined && session.status !== 'finished' && (
          <div className="flex items-center gap-3 bg-blue-500 text-white px-6 py-4 rounded-lg shadow-lg mb-8">
            <span className="text-xl">ℹ️</span>
            <span>Hãy nhấn "Tham gia" để sẵn sàng. Chờ giảng viên bắt đầu khi tất cả đã sẵn sàng.</span>
          </div>
        )}

        {joined && session.status === 'waiting' && (
          <div className="flex items-center gap-3 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg mb-8">
            <span className="text-xl">✅</span>
            <span>Bạn đã tham gia thành công. Chờ giảng viên bắt đầu...</span>
          </div>
        )}

        {!joined && session.status === 'waiting' && (
          <div className="flex items-center gap-3 bg-yellow-500 text-white px-6 py-4 rounded-lg shadow-lg mb-8">
            <span className="text-xl">⚠️</span>
            <span>Chuẩn bị sẵn sàng: Bạn sẽ có 7 phút để hoàn thành bài thi.</span>
          </div>
        )}

        {session.status === 'finished' && (
          <div className="flex items-center gap-3 bg-teal-500 text-white px-6 py-4 rounded-lg shadow-lg mb-8">
            <span className="text-xl">✅</span>
            <span>Phiên thi đã kết thúc. Vui lòng chờ để xem kết quả...</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-5 mb-10 flex-col md:flex-row">
          {!joined && session.status !== 'finished' && (
            <>
              <button
                onClick={handleJoinExam}
                disabled={joiningLoading}
                className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold text-lg rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
                className="flex-1 py-4 bg-white text-purple-600 font-bold text-lg rounded-xl border-2 border-purple-600 hover:shadow-lg transition-all"
              >
                ✕ Quay lại
              </button>
            </>
          )}

          {joined && session.status === 'waiting' && (
            <button
              onClick={handleLeaveExam}
              className="w-full py-4 bg-white text-purple-600 font-bold text-lg rounded-xl border-2 border-purple-600 hover:shadow-lg transition-all"
            >
              ✕ Rời khỏi phòng
            </button>
          )}

          {session.status === 'finished' && (
            <button
              onClick={() => navigate(`/student/exam-result/${actualSessionId}`)}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold text-lg rounded-xl hover:shadow-lg transition-all"
            >
              📊 Xem kết quả
            </button>
          )}
        </div>

        {/* Tips Section */}
        <div className="bg-white rounded-3xl shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">💡 Lời khuyên trước khi bắt đầu</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-gray-700">
              <span className="text-2xl flex-shrink-0">✓</span>
              <span>Kiểm tra kết nối Internet ổn định</span>
            </li>
            <li className="flex items-start gap-3 text-gray-700">
              <span className="text-2xl flex-shrink-0">✓</span>
              <span>Đảm bảo pin thiết bị đầy đủ</span>
            </li>
            <li className="flex items-start gap-3 text-gray-700">
              <span className="text-2xl flex-shrink-0">✓</span>
              <span>Tìm một nơi yên tĩnh để tập trung</span>
            </li>
            <li className="flex items-start gap-3 text-gray-700">
              <span className="text-2xl flex-shrink-0">✓</span>
              <span>Đọc kỹ từng câu hỏi trước khi trả lời</span>
            </li>
            <li className="flex items-start gap-3 text-gray-700">
              <span className="text-2xl flex-shrink-0">✓</span>
              <span>Quản lý thời gian hợp lý (7 phút cho tất cả)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StudentExamLobbyPage;
