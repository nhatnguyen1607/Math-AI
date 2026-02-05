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
} from '../firebase';

import { ExamSession } from '../models/ExamSession';

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
    console.log('✅ Exam session created:', sessionRef.id);
    return sessionRef.id;
  } catch (error) {
    console.error('❌ Error creating exam session:', error);
    throw error;
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

    // Cập nhật status và startTime
    await updateDoc(sessionRef, {
      status: 'starting',
      startTime: serverTimestamp()
    });

    // Tự động chuyển sang 'ongoing' sau 3 giây
    setTimeout(async () => {
      try {
        await updateDoc(sessionRef, {
          status: 'ongoing'
        });
        console.log('✅ Exam session transitioned to ongoing:', sessionId);
      } catch (error) {
        console.error('❌ Error transitioning to ongoing:', error);
      }
    }, 3000);

    console.log('✅ Exam session started:', sessionId);
  } catch (error) {
    console.error('❌ Error starting exam session:', error);
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
    const finalLeaderboard = Object.entries(participants)
      .map(([uid, data]) => ({
        uid,
        name: data.name,
        score: data.score,
        currentQuestion: data.currentQuestion
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.currentQuestion === b.currentQuestion ? 0 : b.currentQuestion - a.currentQuestion;
      })
      .map((item, idx) => ({ ...item, position: idx + 1 }));

    // Cập nhật status, endTime, và leaderboard cuối cùng
    await updateDoc(sessionRef, {
      status: 'finished',
      endTime: serverTimestamp(),
      currentLeaderboard: finalLeaderboard
    });

    console.log('✅ Exam session finished:', sessionId);
  } catch (error) {
    console.error('❌ Error finishing exam session:', error);
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

    console.log('✅ Exam session deleted:', sessionId);
  } catch (error) {
    console.error('❌ Error deleting exam session:', error);
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

    console.log('✅ Student joined session:', uid, 'in session:', sessionId);
  } catch (error) {
    console.error('❌ Error joining exam session:', error);
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
      console.warn('⚠️ currentAnswers is not an array, resetting to empty array');
      currentAnswers = [];
    }

    // Thêm answer mới vào danh sách
    const updatedAnswers = [...currentAnswers, answerData];
    const pointsEarned = answerData.points || 0;

    // Sử dụng increment() để cộng điểm trực tiếp trên server (tránh race condition)
    // increment() là atomic operation - an toàn khi có nhiều request đồng thời
    await updateDoc(sessionRef, {
      [`participants.${uid}.score`]: increment(pointsEarned),
      [`participants.${uid}.currentQuestion`]: increment(1),
      [`participants.${uid}.answers`]: updatedAnswers,
      [`participants.${uid}.lastUpdated`]: serverTimestamp()
    });

    console.log('✅ Answer submitted:', uid, 'points earned:', pointsEarned);
  } catch (error) {
    console.error('❌ Error submitting answer:', error);
    throw error;
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
        completedAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      }
    });

    console.log('✅ Student completed exam:', uid);
  } catch (error) {
    console.error('❌ Error completing exam for student:', error);
    throw error;
  }
};

/**
 * ============================================================================
 * REALTIME SUBSCRIPTION FUNCTIONS - Lắng nghe thay đổi realtime
 * ============================================================================
 */

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
          // Chỉ auto-finish nếu đang 'ongoing' và hết thời gian (> 7 phút)
          if (session.status === 'ongoing' && session.getRemainingSeconds() <= 0) {
            if (session.status !== 'finished') {
              finishExamSession(sessionId);
            }
          }

          callback(session);
        } else {
          console.log('❌ Session not found:', sessionId);
          callback(null);
        }
      },
      (error) => {
        console.error('❌ Error subscribing to session:', error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error in subscribeToExamSession:', error);
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
    console.error('❌ Error subscribing to faculty sessions:', error);
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
    console.error('❌ Error subscribing to class sessions:', error);
    throw error;
  }
};

/**
 * ============================================================================
 * UTILITY FUNCTIONS - Các hàm tiện ích
 * ============================================================================
 */

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
    console.error('❌ Error getting exam session:', error);
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
      console.log(`✅ Found ${activeSessions.length} active sessions for exam ${examId}`);
      return activeSessions;
    }

    // Nếu không có session active, return session finished gần nhất
    const finishedSessions = allSessions.filter(s => s.status === 'finished');
    if (finishedSessions.length > 0) {
      console.log(`⚠️ No active sessions, found ${finishedSessions.length} finished sessions for exam ${examId}`);
      return [finishedSessions[0]]; // Return the most recent finished session
    }

    console.log(`⚠️ No active sessions found for exam ${examId}`);
    return [];
  } catch (error) {
    console.error('❌ Error getting active sessions by exam id:', error);
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
