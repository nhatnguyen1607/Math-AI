/**
 * Question Model
 * Đại diện cho một câu hỏi trong đề thi
 * Type: 'multiple_choice' | 'short_answer'
 */

export class Question {
  constructor(data = {}) {
    this.id = data.id || '';
    this.examId = data.examId || '';
    this.content = data.content || '';
    this.type = data.type || 'multiple_choice'; // 'multiple_choice', 'short_answer'
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    // Multiple choice options
    this.options = data.options || []; // Array of {id, text, isCorrect}
    
    // Correct answer(s)
    this.correctAnswer = data.correctAnswer || '';
    this.correctAnswers = data.correctAnswers || []; // For multiple choice multiple selection
    
    // Question metadata
    this.points = data.points || 10;
    this.difficulty = data.difficulty || 'medium'; // 'easy', 'medium', 'hard'
    this.order = data.order || 0;
  }

  isMultipleChoice() {
    return this.type === 'multiple_choice';
  }

  isShortAnswer() {
    return this.type === 'short_answer';
  }

  toJSON() {
    return {
      id: this.id,
      examId: this.examId,
      content: this.content,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      options: this.options,
      correctAnswer: this.correctAnswer,
      correctAnswers: this.correctAnswers,
      points: this.points,
      difficulty: this.difficulty,
      order: this.order
    };
  }

  static fromFirestore(data, id) {
    return new Question({ ...data, id });
  }
}
