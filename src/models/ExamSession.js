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
    if (!this.startTime) return 0;
    
    const now = new Date();
    let startMs = 0;
    
    // Handle Firestore Timestamp objects
    if (this.startTime.toDate) {
      // Firestore Timestamp
      startMs = this.startTime.toDate().getTime();
    } else if (this.startTime.getTime) {
      // JavaScript Date
      startMs = this.startTime.getTime();
    } else if (typeof this.startTime === 'number') {
      // Unix timestamp in milliseconds
      startMs = this.startTime;
    }
    
    return Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
  }

  getRemainingSeconds() {
    const elapsed = this.getElapsedSeconds();
    const remaining = Math.max(0, this.duration - elapsed);
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
