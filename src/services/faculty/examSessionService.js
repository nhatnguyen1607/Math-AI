/**
 * Exam Session Service
 * Quản lý phiên thi trực tiếp (live exam session) với Firestore realtime
 * Dùng cho cả Faculty (tạo, điều khiển) và Student (tham gia, làm bài)
 */

import {
  db,
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  increment
} from '../../firebase';

import { ExamSession } from '../../models/ExamSession';

/**
 * ============================================================================
 * FACULTY FUNCTIONS - Giảng viên quản lý phiên thi
 * ============================================================================
 */

/**
 * Tạo một phiên thi mới (Faculty)
 * @param {string} examId - ID của bộ đề thi
 * @param {string} facultyId - ID của giảng viên
 * @param {string} classId - ID của lớp học
 * @param {number} totalQuestions - Tổng số câu hỏi
 * @returns {Promise<string>} - ID của session vừa tạo
 */
export const createExamSession = async (examId, facultyId, classId, totalQuestions = 0) => {
  try {
    const sessionRef = doc(collection(db, 'exam_sessions'));
    const sessionData = {
      examId,
      facultyId,
      classId,
      status: 'waiting', // waiting, starting, ongoing, finished
      startTime: null,
      endTime: null,
      createdAt: serverTimestamp(),
      participants: {}, // { uid: { name, score, currentQuestion, lastUpdated, answers } }
      currentLeaderboard: [],
      totalQuestions
    };

    await setDoc(sessionRef, sessionData);
    return sessionRef.id;
  } catch (error) {
    throw error;
  }
};

/**
 * Lấy session đang active cho một exam (chưa kết thúc)
 * @param {string} examId - ID của bộ đề thi
 * @returns {Promise<string|null>} - ID của session đang active hoặc null
 */
export const getActiveExamSession = async (examId) => {
  try {
    const q = query(
      collection(db, 'exam_sessions'),
      where('examId', '==', examId),
      where('status', 'in', ['waiting', 'starting', 'ongoing'])
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null; // Không có session active
    }

    // Nếu có nhiều session, lấy session được tạo gần nhất
    const sessions = snapshot.docs.map(doc => ({
      id: doc.id,
      createdAt: doc.data().createdAt
    }));

    sessions.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA; // Sắp xếp mới nhất trước
    });

    return sessions[0].id;
  } catch (error) {
    return null; // Return null thay vì throw error
  }
};

/**
 * Khởi động phiên thi (Faculty bấm Start)
 * Chuyển từ 'waiting' -> 'starting' -> 'ongoing' với serverTimestamp
 * @param {string} sessionId - ID của phiên thi
 * @returns {Promise<void>}
 */
export const startExamSession = async (sessionId) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);

    // Cập nhật status và startTime CÙNG LÚC
    await updateDoc(sessionRef, {
      status: 'starting',
      startTime: serverTimestamp()
    });

    // Tự động chuyển sang 'ongoing' sau 3 giây
    setTimeout(async () => {
      try {
        // Get current session to verify startTime was set
        const sessionSnap = await getDoc(sessionRef);
        const currentData = sessionSnap.data();

        // Ensure startTime is set - if not, set it now as fallback
        if (!currentData.startTime) {
          await updateDoc(sessionRef, {
            status: 'ongoing',
            startTime: serverTimestamp()
          });
        } else {
          // Normal transition to ongoing
          await updateDoc(sessionRef, {
            status: 'ongoing'
          });
        }

      } catch (error) {
      }
    }, 3000);
  } catch (error) {
    throw error;
  }
};

/**
 * Kết thúc phiên thi (Faculty bấm End hoặc tự động sau 7 phút)
 * @param {string} sessionId - ID của phiên thi
 * @returns {Promise<void>}
 */
export const finishExamSession = async (sessionId) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);

    // Lấy leaderboard cuối cùng
    const sessionSnap = await getDoc(sessionRef);
    const sessionData = sessionSnap.data();

    // Sắp xếp lại leaderboard
    const participants = sessionData.participants || {};

    // 🔧 AUTO-SUBMIT: Đánh dấu tất cả học sinh đã hoàn thành
    const updatedParticipants = Object.entries(participants).reduce((acc, [uid, data]) => {
      acc[uid] = {
        ...data,
        submitted: true,  // 🔧 Mark as submitted
        submittedAt: new Date(), // 🔧 Mark submission time
        lastUpdated: new Date()
      };
      return acc;
    }, {});

    const finalLeaderboard = Object.entries(updatedParticipants)
      .map(([uid, data]) => ({
        uid,
        name: data.name,
        score: data.score || 0,
        currentQuestion: data.currentQuestion || 0,
        rank: 0, // Will be set after sorting
        medal: {} // Will be set based on rank
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.currentQuestion === b.currentQuestion ? 0 : b.currentQuestion - a.currentQuestion;
      })
      .map((item, idx) => {
        let medal = '';
        if (idx === 0) medal = '🥇';
        else if (idx === 1) medal = '🥈';
        else if (idx === 2) medal = '🥉';
        return { ...item, rank: idx + 1, medal };
      });

    // Cập nhật status, endTime, và leaderboard cuối cùng trong exam_sessions
    await updateDoc(sessionRef, {
      status: 'finished',
      endTime: serverTimestamp(),
      participants: updatedParticipants,  // 🔧 Update all participants
      currentLeaderboard: finalLeaderboard
    });

    // QUAN TRỌNG: Cập nhật finalLeaderboard vào exams collection
    // Để FacultyExamResultsListPage có thể load được kết quả
    const examId = sessionData.examId;
    if (examId) {
      const examRef = doc(db, 'exams', examId);
      await updateDoc(examRef, {
        finalLeaderboard: finalLeaderboard,
        status: 'finished',
        isLocked: true  // 🔧 Lock exam when session finishes
      });
    }

    } catch (error) {
    throw error;
  }
};

/**
 * Xóa một phiên thi (cleanup)
 * @param {string} sessionId - ID của phiên thi
 * @returns {Promise<void>}
 */
export const deleteExamSession = async (sessionId) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    await updateDoc(sessionRef, {
      status: 'cancelled',
      endTime: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

/**
 * ============================================================================
 * STUDENT FUNCTIONS - Học sinh tham gia và làm bài
 * ============================================================================
 */

/**
 * Tham gia phiên thi (Student join)
 * Thêm học sinh vào map participants
 * @param {string} sessionId - ID của phiên thi
 * @param {string} uid - ID của học sinh
 * @param {string} name - Tên của học sinh
 * @returns {Promise<void>}
 */
export const joinExamSession = async (sessionId, uid, name) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);

    const participantData = {
      name,
      score: 0,
      currentQuestion: 0,
      answers: [], // [ { questionId, answer, isCorrect, timeUsed } ]
      joinedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    };

    await updateDoc(sessionRef, {
      [`participants.${uid}`]: participantData
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Cập nhật điểm số học sinh ngay khi trả lời (realtime update)
 * @param {string} sessionId - ID của phiên thi
 * @param {string} uid - ID của học sinh
 * @param {object} answerData - { questionId, answer, isCorrect, points, basePoints, bonusPoints, timeUsed }
 * @returns {Promise<void>}
 */
export const submitAnswer = async (sessionId, uid, answerData) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);

    // Đọc data hiện tại một lần
    const sessionSnap = await getDoc(sessionRef);
    const sessionData = sessionSnap.data();
    
    // Ensure answers is an array
    let currentAnswers = sessionData?.participants?.[uid]?.answers;
    if (!Array.isArray(currentAnswers)) {
      currentAnswers = [];
    }

    // Thêm answer mới vào danh sách
    const updatedAnswers = [...currentAnswers, answerData];
    const pointsEarned = answerData.points || 0;

    await updateDoc(sessionRef, {
      [`participants.${uid}.score`]: increment(pointsEarned),
      [`participants.${uid}.answers`]: updatedAnswers,
      [`participants.${uid}.lastUpdated`]: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

/**
 * 🔧 Cập nhật câu hỏi hiện tại (khi học sinh navigate)
 * @param {string} sessionId - ID của phiên thi
 * @param {string} uid - ID của học sinh
 * @param {number} questionIndex - Index của câu hỏi hiện tại
 * @returns {Promise<void>}
 */
export const updateCurrentQuestion = async (sessionId, uid, questionIndex) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    await updateDoc(sessionRef, {
      [`participants.${uid}.currentQuestion`]: questionIndex,
      [`participants.${uid}.lastUpdated`]: serverTimestamp()
    });
  } catch (error) {
    // Not throwing error - this is not critical
  }
};

/**
 * Hoàn thành phiên thi cho học sinh
 * Đánh dấu học sinh đã hoàn thành tất cả câu hỏi
 * @param {string} sessionId - ID của phiên thi
 * @param {string} uid - ID của học sinh
 * @param {object} finalData - { score, answers, completedAt }
 * @returns {Promise<void>}
 */
export const completeExamForStudent = async (sessionId, uid, finalData) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    const sessionData = sessionSnap.data();
    const currentParticipant = sessionData?.participants?.[uid] || {};

    await updateDoc(sessionRef, {
      [`participants.${uid}`]: {
        ...currentParticipant,
        ...finalData,
        isCompleted: true,
        submitted: true,      // 🔧 Thêm để hiển thị đúng số "Đã nộp bài"
        completedAt: serverTimestamp(),
        submittedAt: serverTimestamp(), // 🔧 Thêm thời gian nộp
        lastUpdated: serverTimestamp()
      }
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Lắng nghe một phiên thi realtime
 * Dùng cho cả Faculty (xem leaderboard) và Student (xem status, countdown)
 * @param {string} sessionId - ID của phiên thi
 * @param {function} callback - Hàm callback nhận ExamSession object
 * @returns {function} - Unsubscribe function
 */
export const subscribeToExamSession = (sessionId, callback) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);

    const unsubscribe = onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const session = new ExamSession({
            id: docSnap.id,
            ...data
          });

          // Tự động kết thúc phiên thi sau 7 phút nếu vẫn chưa kết thúc
          // Chỉ auto-finish nếu đang 'ongoing' VÀ hết thời gian (> 7 phút) VÀ chưa finished
          if (session.status === 'ongoing' && session.getRemainingSeconds() <= 0 && session.status !== 'finished') {
            finishExamSession(sessionId);
          }

          callback(session);
        } else {
          callback(null);
        }
      },
      (error) => {
      }
    );

    return unsubscribe;
  } catch (error) {
    throw error;
  }
};

/**
 * Lắng nghe tất cả phiên thi của một giảng viên
 * Dùng cho Faculty dashboard
 * @param {string} facultyId - ID của giảng viên
 * @param {function} callback - Hàm callback nhận mảng sessions
 * @returns {function} - Unsubscribe function
 */
export const subscribeFacultyActiveSessions = (facultyId, callback) => {
  try {
    const q = query(
      collection(db, 'exam_sessions'),
      where('facultyId', '==', facultyId),
      where('status', 'in', ['waiting', 'starting', 'ongoing'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map((doc) => new ExamSession({
        id: doc.id,
        ...doc.data()
      }));

      callback(sessions);
    });

    return unsubscribe;
  } catch (error) {
    throw error;
  }
};

/**
 * Lắng nghe tất cả phiên thi của một lớp học
 * Dùng cho Student lobby page
 * @param {string} classId - ID của lớp học
 * @param {function} callback - Hàm callback nhận mảng sessions
 * @returns {function} - Unsubscribe function
 */
export const subscribeClassActiveSessions = (classId, callback) => {
  try {
    const q = query(
      collection(db, 'exam_sessions'),
      where('classId', '==', classId),
      where('status', 'in', ['waiting', 'starting', 'ongoing'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map((doc) => new ExamSession({
        id: doc.id,
        ...doc.data()
      }));

      callback(sessions);
    });

    return unsubscribe;
  } catch (error) {
    throw error;
  }
};


/**
 * Lấy một phiên thi bằng ID (one-time fetch)
 * @param {string} sessionId - ID của phiên thi
 * @returns {Promise<ExamSession|null>} - Session object hoặc null
 */
export const getExamSession = async (sessionId) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    const docSnap = await getDoc(sessionRef);

    if (docSnap.exists()) {
      return new ExamSession({
        id: docSnap.id,
        ...docSnap.data()
      });
    }

    return null;
  } catch (error) {
    throw error;
  }
};

/**
 * Lấy active sessions cho một đề thi (one-time fetch)
 * Student dùng cái này để tìm session đang hoạt động của đề thi
 * Priority: waiting > starting > ongoing > (không lấy finished)
 * @param {string} examId - ID của đề thi
 * @returns {Promise<array>} - Mảng session objects, sắp xếp theo thời gian tạo (mới nhất trước)
 */
export const getActiveSessionsByExamId = async (examId) => {
  try {
    // Lấy tất cả session cho exam này (không filter status)
    const q = query(
      collection(db, 'exam_sessions'),
      where('examId', '==', examId),
      orderBy('createdAt', 'desc') // Mới nhất trước
    );

    const snapshot = await getDocs(q);
    const allSessions = snapshot.docs.map((doc) => new ExamSession({
      id: doc.id,
      ...doc.data()
    }));

    // Filter: lấy những session còn active (waiting, starting, ongoing)
    // Nếu không có, lấy session finished gần nhất (có thể student muốn xem kết quả)
    const activeSessions = allSessions.filter(s => 
      ['waiting', 'starting', 'ongoing'].includes(s.status)
    );

    if (activeSessions.length > 0) {
      return activeSessions;
    }

    // Nếu không có session active, return session finished gần nhất
    const finishedSessions = allSessions.filter(s => s.status === 'finished');
    if (finishedSessions.length > 0) {
      return [finishedSessions[0]]; // Return the most recent finished session
    }
    return [];
  } catch (error) {
    throw error;
  }
};

/**
 * Tính toán bảng xếp hạng hiện tại từ participants
 * @param {object} participants - Map participants từ session data
 * @returns {array} - Mảng leaderboard sắp xếp theo score
 */
export const calculateLeaderboard = (participants = {}) => {
  return Object.entries(participants)
    .map(([uid, data]) => ({
      uid,
      name: data.name || 'Unknown',
      score: data.score || 0,
      currentQuestion: data.currentQuestion || 0,
      lastUpdated: data.lastUpdated
    }))
    .sort((a, b) => {
      // Sắp xếp theo điểm giảm dần
      if (b.score !== a.score) return b.score - a.score;
      // Nếu điểm bằng nhau, sắp xếp theo câu hỏi hoàn thành
      if (a.currentQuestion !== b.currentQuestion) {
        return b.currentQuestion - a.currentQuestion;
      }
      // Nếu bằng, sắp xếp theo thời gian (ai nhanh hơn xếp trước)
      const aTime = a.lastUpdated?.getTime?.() || 0;
      const bTime = b.lastUpdated?.getTime?.() || 0;
      return aTime - bTime;
    })
    .map((item, idx) => ({
      ...item,
      position: idx + 1
    }));
};

/**
 * Format thời gian còn lại thành chuỗi "MM:SS"
 * @param {number} seconds - Số giây còn lại
 * @returns {string} - Chuỗi "MM:SS"
 */
export const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Kiểm tra xem phiên thi đã hết giờ chưa
 * @param {number} startTime - Timestamp bắt đầu (ms)
 * @param {number} duration - Thời lượng (giây), mặc định 420 (7 phút)
 * @returns {boolean} - true nếu hết giờ, false nếu vẫn còn giờ
 */
export const isSessionExpired = (startTime, duration = 420) => {
  if (!startTime) return false;
  const now = new Date();
  const startMs = typeof startTime === 'object' ? startTime.getTime() : startTime;
  const elapsedSeconds = (now.getTime() - startMs) / 1000;
  return elapsedSeconds >= duration;
};

const examSessionService = {
  // Faculty
  createExamSession,
  startExamSession,
  finishExamSession,
  deleteExamSession,

  // Student
  joinExamSession,
  submitAnswer,
  updateCurrentQuestion,
  completeExamForStudent,

  // Subscriptions
  subscribeToExamSession,
  subscribeFacultyActiveSessions,
  subscribeClassActiveSessions,

  // Utilities
  getExamSession,
  getActiveSessionsByExamId,
  calculateLeaderboard,
  formatTime,
  isSessionExpired
};

export default examSessionService;
