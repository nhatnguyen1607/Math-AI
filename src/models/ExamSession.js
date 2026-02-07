/**
 * ExamSession Model
 * Đại diện cho một phiên thi trực tiếp (live exam session)
 * Status: 'waiting' | 'starting' | 'ongoing' | 'finished'
 * 
 * Cấu trúc:
 * - Khởi tạo khi giảng viên tạo phòng thi
 * - Lắng nghe realtime bằng onSnapshot
 * - Cập nhật điểm học sinh ngay khi trả lời
 * - Tự động kết thúc sau 7 phút hoặc khi giảng viên bấm End
 */

export class ExamSession {
  constructor(data = {}) {
    this.id = data.id || '';
    
    // Exam reference
    this.examId = data.examId || '';
    this.facultyId = data.facultyId || '';
    this.classId = data.classId || '';
    
    // Session timing & status
    this.status = data.status || 'waiting'; // 'waiting', 'starting', 'ongoing', 'finished'
    this.startTime = data.startTime || null; // ServerTimestamp
    this.endTime = data.endTime || null;
    this.createdAt = data.createdAt || new Date();
    this.duration = 420; // 7 minutes in seconds
    
    // Participants mapping: { uid: { name, score, currentQuestion, lastUpdated, answers } }
    this.participants = data.participants || {};
    
    // Leaderboard: sorted array [ { uid, name, score, position } ]
    this.currentLeaderboard = data.currentLeaderboard || [];
    
    // Statistics
    this.totalQuestions = data.totalQuestions || 0;
  }

  // Getter methods
  getParticipantCount() {
    return Object.keys(this.participants).length;
  }

  getCompletedCount() {
    return Object.values(this.participants).filter(
      p => p.currentQuestion >= this.totalQuestions
    ).length;
  }

  getParticipantsList() {
    return Object.entries(this.participants).map(([uid, data]) => ({
      uid,
      ...data
    }));
  }

  // Status checks
  isWaiting() {
    return this.status === 'waiting';
  }

  isStarting() {
    return this.status === 'starting';
  }

  isOngoing() {
    return this.status === 'ongoing';
  }

  isFinished() {
    return this.status === 'finished';
  }

  // Leaderboard calculation
  calculateLeaderboard() {
    const sorted = this.getParticipantsList()
      .sort((a, b) => {
        // Sắp xếp theo điểm giảm dần
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Nếu điểm bằng nhau, sắp xếp theo thời gian cập nhật (nhanh hơn xếp trước)
        const aTime = a.lastUpdated?.getTime?.() || 0;
        const bTime = b.lastUpdated?.getTime?.() || 0;
        return aTime - bTime;
      })
      .map((p, index) => ({
        ...p,
        position: index + 1
      }));

    return sorted;
  }

  // Time calculations
  getElapsedSeconds() {
    if (!this.startTime) {
      console.warn('⚠️ startTime is not set yet, returning 0');
      return 0;
    }
    
    const now = new Date();
    let startMs = 0;
    
    // Handle Firestore Timestamp objects
    if (this.startTime && typeof this.startTime === 'object') {
      if (this.startTime.toDate && typeof this.startTime.toDate === 'function') {
        // Firestore Timestamp
        try {
          startMs = this.startTime.toDate().getTime();
          console.log('🕐 Using Firestore Timestamp, converted to ms:', startMs);
        } catch (e) {
          console.error('❌ Error converting Firestore Timestamp:', e, this.startTime);
          return 0;
        }
      } else if (this.startTime.getTime && typeof this.startTime.getTime === 'function') {
        // JavaScript Date
        startMs = this.startTime.getTime();
        console.log('🕐 Using JavaScript Date, ms:', startMs);
      } else {
        console.warn('⚠️ startTime is object but not a recognized format:', this.startTime);
        return 0;
      }
    } else if (typeof this.startTime === 'number') {
      // Unix timestamp in milliseconds
      startMs = this.startTime;
      console.log('🕐 Using unix timestamp (ms):', startMs);
    } else {
      console.warn('⚠️ startTime has unexpected type:', typeof this.startTime, this.startTime);
      return 0;
    }
    
    const elapsed = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
    console.log(`🕐 Elapsed calculation: now=${now.getTime()}, startMs=${startMs}, elapsed=${elapsed}s`);
    return elapsed;
  }

  getRemainingSeconds() {
    // If status is not 'ongoing', return 0 or duration based on status
    if (this.status === 'waiting' || this.status === 'starting') {
      console.log('⚠️ Session status is', this.status, '- exam has not started yet');
      return this.duration;
    }
    
    if (this.status === 'finished') {
      console.log('⚠️ Session status is finished - time already expired');
      return 0;
    }
    
    if (!this.startTime) {
      console.warn('⚠️ Session is ongoing but startTime is not set! This should not happen');
      return this.duration; // Return full time if startTime not set
    }
    
    const elapsed = this.getElapsedSeconds();
    const remaining = Math.max(0, this.duration - elapsed);
    
    console.log(`📊 Timer: elapsed=${elapsed}s, duration=${this.duration}s, remaining=${remaining}s`);
    
    return remaining;
  }

  getProgressPercent() {
    const elapsed = this.getElapsedSeconds();
    return Math.min(100, (elapsed / this.duration) * 100);
  }

  // Format helpers
  formatRemainingTime() {
    const remaining = this.getRemainingSeconds();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  toJSON() {
    return {
      examId: this.examId,
      facultyId: this.facultyId,
      classId: this.classId,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      participants: this.participants,
      currentLeaderboard: this.currentLeaderboard,
      totalQuestions: this.totalQuestions
    };
  }
}
