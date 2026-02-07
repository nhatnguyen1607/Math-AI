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
    
    // Competency evaluation (for game-based problem solving)
    this.competencyEvaluation = data.competencyEvaluation || {
      // TC1: Nhận biết được vấn đề cần giải quyết
      TC1: {
        level: null, // 'need_effort', 'achieved', 'good'
        score: 0, // 0-2 points
        comment: ''
      },
      // TC2: Nêu được cách thức GQVĐ
      TC2: {
        level: null,
        score: 0, // 0-2 points
        comment: ''
      },
      // TC3: Trình bày được cách thức GQVĐ
      TC3: {
        level: null,
        score: 0, // 0-2 points
        comment: ''
      },
      // TC4: Kiểm tra được giải pháp đã thực hiện
      TC4: {
        level: null,
        score: 0, // 0-2 points
        comment: ''
      },
      // Total competency score (0-8 points)
      totalCompetencyScore: 0 // Sum of TC1, TC2, TC3, TC4 scores
    };
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
      rank: this.rank,
      competencyEvaluation: this.competencyEvaluation
    };
  }

  static fromFirestore(data, id) {
    return new ExamResult({ ...data, id });
  }
}
