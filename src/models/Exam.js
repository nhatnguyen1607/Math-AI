/**
 * Exam Model
 * Đại diện cho một đề thi/quiz hoặc trò chơi học tập
 * Status: 'draft' | 'active' | 'in_progress' | 'closed' | 'finished'
 * 
 * Cấu trúc:
 * - 2 bài tập: BT vận dụng, ứng dụng (120s), BT GQVĐ (300s)
 * - Tổng: 7 phút (420s)
 * - Hệ thống điểm dựa trên tính đúng/sai và tốc độ
 */

export class Exam {
  constructor(data = {}) {
    this.id = data.id || '';
    this.topicId = data.topicId || '';
    this.title = data.title || '';
    this.description = data.description || '';
    this.classId = data.classId || '';
    this.type = data.type || 'startup'; // 'startup' or 'worksheet'
    this.createdBy = data.createdBy || ''; // Faculty ID
    this.createdByName = data.createdByName || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    // Exam details
    this.duration = data.duration || 420; // 7 minutes in seconds
    this.totalQuestions = data.totalQuestions || 2;
    this.status = data.status || 'draft'; // 'draft', 'active', 'in_progress', 'closed', 'finished'
    
    // 2 bài tập trong exam (exercises)
    this.exercises = data.exercises || []; // Array of exercise objects
    // exercises[0]: { name, duration: 120, questions: [...], scoring: { correct: 12, incorrect: 2, bonus: 4 } }
    // exercises[1]: { name, duration: 300, questions: [...], scoring: { correct: 12, incorrect: 2, bonus: 4 } }
    
    // Timing
    this.startTime = data.startTime || null;
    this.endTime = data.endTime || null;
    
    // Participants (lobby)
    this.waitingStudents = data.waitingStudents || []; // Chờ bắt đầu
    this.activeStudents = data.activeStudents || []; // Đang làm
    this.completedStudents = data.completedStudents || []; // Hoàn thành
    
    // Exam lock and results
    this.isLocked = data.isLocked === true; // Luôn là boolean (true/false), không undefined
    this.finalLeaderboard = data.finalLeaderboard || []; // Bảng xếp hạng cuối cùng sau khi trao giải
    
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  canEditQuestion() {
    return this.status === 'draft';
  }

  isDraft() {
    return this.status === 'draft';
  }

  isActive() {
    return this.status === 'active';
  }

  isInProgress() {
    return this.status === 'in_progress';
  }

  isClosed() {
    return this.status === 'closed';
  }

  isFinished() {
    return this.status === 'finished';
  }

  // Game-specific methods
  getTotalGameScore(answers) {
    let totalScore = 0;
    this.exercises.forEach((exercise, idx) => {
      const exerciseAnswers = answers.filter(a => a.exerciseIndex === idx);
      exerciseAnswers.forEach(answer => {
        const scoring = exercise.scoring;
        if (answer.isCorrect) {
          totalScore += scoring.correct;
          // Bonus nếu trả lời nhanh
          if (answer.timeUsed && answer.timeUsed < scoring.bonusTimeThreshold) {
            totalScore += scoring.bonus;
          }
        } else {
          totalScore += scoring.incorrect;
        }
      });
    });
    return totalScore;
  }

  toJSON() {
    // Đảm bảo duration được tính từ exercises nếu chưa có
    const totalDuration = this.exercises.reduce((sum, e) => sum + (e.duration || 0), 0) || this.duration;
    
    return {
      topicId: this.topicId,
      title: this.title,
      description: this.description,
      classId: this.classId,
      type: this.type,
      createdBy: this.createdBy,
      createdByName: this.createdByName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      duration: totalDuration,
      totalQuestions: this.totalQuestions,
      status: this.status,
      exercises: this.exercises,
      startTime: this.startTime,
      endTime: this.endTime,
      waitingStudents: this.waitingStudents,
      activeStudents: this.activeStudents,
      completedStudents: this.completedStudents,
      isLocked: this.isLocked,
      finalLeaderboard: this.finalLeaderboard,
      isActive: this.isActive
    };
  }

  static fromFirestore(data, id) {
    const examData = { ...data, id };
    
    // Convert Firebase Timestamp to Date if needed
    if (data.createdAt && typeof data.createdAt.toDate === 'function') {
      examData.createdAt = data.createdAt.toDate();
    }
    if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
      examData.updatedAt = data.updatedAt.toDate();
    }
    
    return new Exam(examData);
  }
}
