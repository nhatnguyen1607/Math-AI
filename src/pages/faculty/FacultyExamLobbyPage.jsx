import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import examSessionService from '../../services/examSessionService';
import facultyService from '../../services/faculty/facultyService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyExamLobbyPage = () => {
  const { sessionId } = useParams();
  const [exam, setExam] = useState(null);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [startingExam, setStartingExam] = useState(false);
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

  // Load exam data
  const loadExamData = useCallback(async () => {
    try {
      if (!sessionId) {
        navigate('/faculty/exam-management');
        return;
      }

      const sessionData = await examSessionService.getExamSession(sessionId);

      if (sessionData && sessionData.examId) {
        const examData = await facultyService.getExamById(sessionData.examId);
        setExam(examData);
        setSession(sessionData);
      } else {
        navigate('/faculty/exam-management');
      }
      setLoading(false);
    } catch (error) {
      navigate('/faculty/exam-management');
    }
  }, [sessionId, navigate]);

  // Load participants
  const loadParticipants = useCallback(async () => {
    try {
      if (!sessionId) return;
      const sessionData = await examSessionService.getExamSession(sessionId);
      if (sessionData && sessionData.participants) {
        const participantList = Object.entries(sessionData.participants).map(([uid, data]) => ({
          uid,
          ...data
        }));
        setParticipants(participantList || []);
        setSession(sessionData);
      }
    } catch (error) {
    }
  }, [sessionId]);

  useEffect(() => {
    loadExamData();
  }, [loadExamData]);

  // Polling participants every 2 seconds
  useEffect(() => {
    if (sessionId) {
      const interval = setInterval(loadParticipants, 2000);
      return () => clearInterval(interval);
    }
  }, [sessionId, loadParticipants]);

  const handleStartExam = async () => {
    if (participants.length === 0) {
      alert('Cần có ít nhất 1 học sinh tham gia trước khi bắt đầu');
      return;
    }

    try {
      setStartingExam(true);
      await examSessionService.startExamSession(sessionId);
      // Navigate to live session page after starting
      setTimeout(() => {
        navigate(`/faculty/exam-live/${sessionId}`);
      }, 1000);
    } catch (error) {
      alert('Lỗi khi bắt đầu phiên thi');
      setStartingExam(false);
    }
  };

  const handleBackToManagement = () => {
    navigate('/faculty/exam-management');
  };

  if (loading || !exam || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p className="text-white text-lg font-medium">Đang tải phiên thi...</p>
        </div>
      </div>
    );
  }

  // const navItems = [
  //   { icon: '📝', label: 'Phòng Thi: ' + exam.title }
  // ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 pb-10">
      <FacultyHeader user={user} onLogout={() => navigate('/login')} />
      
      {/* Back Button */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 px-8 lg:px-12 py-3 shadow-soft-md">
        <button
          onClick={() => navigate('/faculty/exam-management')}
          className="px-4 lg:px-6 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold rounded-lg transition-all duration-300 flex items-center gap-2"
        >
          ← Quay lại
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-5 pt-10">
        {/* Exam Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 mb-10 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3">{exam.title}</h1>
          {exam.description && (
            <p className="text-gray-600 text-lg">{exam.description}</p>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-sm text-gray-500 font-semibold uppercase mb-2">Tham gia</div>
            <div className="text-lg font-bold text-blue-600">{participants.length}</div>
          </div>

          <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-sm text-gray-500 font-semibold uppercase mb-2">Đã nộp bài</div>
            <div className="text-lg font-bold text-green-600">{participants.filter(p => p.submitted).length}</div>
          </div>

          <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
            <div className="text-3xl mb-2">⏱️</div>
            <div className="text-sm text-gray-500 font-semibold uppercase mb-2">Thời lượng</div>
            <div className="text-lg font-bold text-blue-600">7 phút</div>
          </div>

          <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
            <div className="text-3xl mb-2">❓</div>
            <div className="text-sm text-gray-500 font-semibold uppercase mb-2">Số câu</div>
            <div className="text-lg font-bold text-blue-600">{exam.exercises?.reduce((sum, e) => sum + e.questions.length, 0) || 0}</div>
          </div>

          <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-sm text-gray-500 font-semibold uppercase mb-2">Đạt điểm</div>
            <div className="text-lg font-bold text-blue-600">{exam.passingScore}%</div>
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-white rounded-3xl shadow-lg p-8 mb-10">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">👥 Học sinh tham gia ({participants.length})</h3>

          {participants.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-gray-400">
              <div className="text-6xl">⏳</div>
              <p className="text-lg">Chờ học sinh tham gia...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {participants.map((participant, index) => (
                <div
                  key={participant.uid}
                  className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border-2 border-gray-200"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-blue-600 to-blue-700">
                    {(participant.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">
                      {index + 1}. {participant.name || 'Unknown'}
                    </div>
                  </div>
                  <div className="text-green-600 font-semibold text-sm">🟢 Sẵn sàng</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-5 mb-10 flex-col md:flex-row">
          <button
            onClick={handleStartExam}
            disabled={startingExam || participants.length === 0}
            className="flex-1 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {startingExam ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Đang bắt đầu...
              </>
            ) : (
              <>🚀 Bắt đầu</>
            )}
          </button>
          <button
            onClick={handleBackToManagement}
            className="flex-1 py-4 bg-white text-gray-800 font-bold text-lg rounded-xl border-2 border-gray-300 hover:shadow-lg transition-all"
          >
            ✕ Hủy
          </button>
        </div>

      </div>
    </div>
  );
};

export default FacultyExamLobbyPage;
