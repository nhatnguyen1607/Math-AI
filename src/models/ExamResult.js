/**
 * ExamResult Model
 * Lưu kết quả làm bài thi của học sinh
 */

export class ExamResult {
  constructor(data = {}) {
    this.id = data.id || '';
    this.examId = data.examId || '';
    this.studentId = data.studentId || '';
    this.studentName = data.studentName || '';
    this.studentPhotoURL = data.studentPhotoURL || '';
    this.createdAt = data.createdAt || new Date();
    this.submittedAt = data.submittedAt || null;
    this.updatedAt = data.updatedAt || new Date();
    
    // Answers
    this.answers = data.answers || []; // Array of {questionId, answer, isCorrect, points}
    
    // Results
    this.totalScore = data.totalScore || 0;
    this.maxScore = data.maxScore || 0;
    this.percentageScore = data.percentageScore || 0;
    this.correctAnswers = data.correctAnswers || 0;
    this.totalQuestions = data.totalQuestions || 0;
    this.timeTaken = data.timeTaken || 0; // in seconds
    this.status = data.status || 'in_progress'; // 'in_progress', 'completed'
    
    // Ranking
    this.rank = data.rank || 0;
  }

  isCompleted() {
    return this.status === 'completed';
  }

  calculatePercentageScore() {
    if (this.maxScore === 0) return 0;
    this.percentageScore = (this.totalScore / this.maxScore) * 100;
    return this.percentageScore;
  }

  addAnswer(questionId, answer, isCorrect, points) {
    this.answers.push({
      questionId,
      answer,
      isCorrect,
      points,
      answeredAt: new Date()
    });
  }

  toJSON() {
    return {
      id: this.id,
      examId: this.examId,
      studentId: this.studentId,
      studentName: this.studentName,
      studentPhotoURL: this.studentPhotoURL,
      createdAt: this.createdAt,
      submittedAt: this.submittedAt,
      updatedAt: this.updatedAt,
      answers: this.answers,
      totalScore: this.totalScore,
      maxScore: this.maxScore,
      percentageScore: this.percentageScore,
      correctAnswers: this.correctAnswers,
      totalQuestions: this.totalQuestions,
      timeTaken: this.timeTaken,
      status: this.status,
      rank: this.rank
    };
  }

  static fromFirestore(data, id) {
    return new ExamResult({ ...data, id });
  }
}
