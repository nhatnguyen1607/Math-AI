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
  getDocs
} from '../firebase';

/**
 * Tạo một phiên thi mới (exam_sessions document)
 * @param {string} examId - ID của bộ đề thi
 * @param {string} facultyId - ID của giảng viên tạo phòng
 * @param {string} classId - ID của lớp học
 * @returns {Promise<string>} - ID của session vừa tạo
 */
export const createExamSession = async (examId, facultyId, classId) => {
  try {
    const sessionRef = doc(collection(db, 'exam_sessions'));
    const sessionData = {
      examId,
      facultyId,
      classId,
      status: 'waiting', // waiting, starting, ongoing, finished
      startTime: null,
      createdAt: serverTimestamp(),
      participants: {}, // { uid: { name, score, currentQuestion, lastUpdated, answers } }
      currentLeaderboard: [],
      endTime: null,
      totalQuestions: 0
    };
    
    await setDoc(sessionRef, sessionData);
    return sessionRef.id;
  } catch (error) {
    console.error('Error creating exam session:', error);
    throw error;
  }
};

/**
 * Lắng nghe realtime một phiên thi
 * @param {string} sessionId - ID của phiên thi
 * @param {function} callback - Hàm callback nhận dữ liệu session
 * @returns {function} - Unsubscribe function
 */
export const subscribeToExamSession = (sessionId, callback) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() });
      } else {
        console.log('Session not found:', sessionId);
        callback(null);
      }
    }, (error) => {
      console.error('Error subscribing to session:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error in subscribeToExamSession:', error);
    throw error;
  }
};

/**
 * Bắt đầu phiên thi (Faculty)
 * @param {string} sessionId - ID của phiên thi
 */
export const startExamSession = async (sessionId) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    await updateDoc(sessionRef, {
      status: 'starting',
      startTime: serverTimestamp()
    });
  } catch (error) {
    console.error('Error starting exam session:', error);
    throw error;
  }
};

/**
 * Cập nhật điểm số học sinh realtime
 * @param {string} sessionId - ID của phiên thi
 * @param {string} uid - ID của học sinh
 * @param {object} updateData - { score, currentQuestion, answers, isCorrect }
 */
export const updateSessionScore = async (sessionId, uid, updateData) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    
    await updateDoc(sessionRef, {
      [`participants.${uid}`]: {
        ...updateData,
        lastUpdated: serverTimestamp()
      }
    });
  } catch (error) {
    console.error('Error updating session score:', error);
    throw error;
  }
};

/**
 * Cập nhật thông tin tham gia (khi học sinh join)
 * @param {string} sessionId - ID của phiên thi
 * @param {string} uid - ID của học sinh
 * @param {object} participantData - { name, score, currentQuestion, answers }
 */
export const updateParticipant = async (sessionId, uid, participantData) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    
    await updateDoc(sessionRef, {
      [`participants.${uid}`]: {
        ...participantData,
        lastUpdated: serverTimestamp()
      }
    });
  } catch (error) {
    console.error('Error updating participant:', error);
    throw error;
  }
};

/**
 * Cập nhật bảng xếp hạng realtime (Faculty)
 * @param {string} sessionId - ID của phiên thi
 * @param {array} leaderboard - Mảng xếp hạng [ { uid, name, score } ]
 */
export const updateLeaderboard = async (sessionId, leaderboard) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    
    await updateDoc(sessionRef, {
      currentLeaderboard: leaderboard
    });
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    throw error;
  }
};

/**
 * Lấy bảng xếp hạng từ danh sách participants
 * @param {object} participants - Map of participants
 * @returns {array} - Mảng xếp hạng
 */
export const generateLeaderboard = (participants) => {
  const leaderboard = Object.entries(participants || {})
    .map(([uid, data]) => ({
      uid,
      name: data.name || 'Unknown',
      score: data.score || 0,
      currentQuestion: data.currentQuestion || 0,
      lastUpdated: data.lastUpdated
    }))
    .sort((a, b) => b.score - a.score);
  
  return leaderboard;
};

/**
 * Kết thúc phiên thi
 * @param {string} sessionId - ID của phiên thi
 */
export const endExamSession = async (sessionId) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (sessionSnap.exists()) {
      const sessionData = sessionSnap.data();
      const finalLeaderboard = generateLeaderboard(sessionData.participants);
      
      await updateDoc(sessionRef, {
        status: 'finished',
        endTime: serverTimestamp(),
        currentLeaderboard: finalLeaderboard
      });
    }
  } catch (error) {
    console.error('Error ending exam session:', error);
    throw error;
  }
};

/**
 * Lấy một phiên thi
 * @param {string} sessionId - ID của phiên thi
 * @returns {Promise<object>}
 */
export const getExamSession = async (sessionId) => {
  try {
    const sessionRef = doc(db, 'exam_sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (sessionSnap.exists()) {
      return { id: sessionSnap.id, ...sessionSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting exam session:', error);
    throw error;
  }
};

/**
 * Lấy tất cả phiên thi đang diễn ra của một giảng viên
 * @param {string} facultyId - ID của giảng viên
 * @returns {Promise<array>}
 */
export const getActiveSessions = async (facultyId) => {
  try {
    const q = query(
      collection(db, 'exam_sessions'),
      where('facultyId', '==', facultyId),
      where('status', 'in', ['waiting', 'starting', 'ongoing'])
    );
    
    const querySnapshot = await getDocs(q);
    const sessions = [];
    querySnapshot.forEach((doc) => {
      sessions.push({ id: doc.id, ...doc.data() });
    });
    
    return sessions;
  } catch (error) {
    console.error('Error getting active sessions:', error);
    throw error;
  }
};

/**
 * Tính thời gian còn lại (tính từ serverTime)
 * @param {Timestamp} startTime - Timestamp bắt đầu
 * @param {number} durationMinutes - Thời lượng (phút)
 * @returns {number} - Giây còn lại
 */
export const calculateTimeRemaining = (startTime, durationMinutes = 7) => {
  if (!startTime) return durationMinutes * 60;
  
  const now = new Date().getTime();
  const start = startTime.toMillis ? startTime.toMillis() : startTime.getTime();
  const elapsedSeconds = Math.floor((now - start) / 1000);
  const totalSeconds = durationMinutes * 60;
  const remaining = totalSeconds - elapsedSeconds;
  
  return Math.max(0, remaining);
};

/**
 * Chuyển đổi giây thành định dạng MM:SS
 * @param {number} seconds - Số giây
 * @returns {string} - Định dạng MM:SS
 */
export const formatTimeRemaining = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Lấy thông tin đề thi theo ID
 * @param {string} examId - ID của đề thi
 * @returns {Promise<object>} - Dữ liệu đề thi
 */
export const getExamById = async (examId) => {
  try {
    const examRef = doc(db, 'exams', examId);
    const examSnap = await getDoc(examRef);
    
    if (examSnap.exists()) {
      return { id: examSnap.id, ...examSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting exam:', error);
    throw error;
  }
};

const examService = {
  createExamSession,
  subscribeToExamSession,
  startExamSession,
  updateSessionScore,
  updateParticipant,
  updateLeaderboard,
  generateLeaderboard,
  endExamSession,
  getExamSession,
  getActiveSessions,
  calculateTimeRemaining,
  formatTimeRemaining,
  getExamById
};

export default examService;
