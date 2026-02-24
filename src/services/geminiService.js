/**
 * geminiService.js - FACADE
 * 
 * File nay da duoc tach thanh 3 file nho hon de de quan ly:
 * - geminiChatService.js: Tuong tac AI chat (Polya method)
 * - geminiFeedbackService.js: Danh gia va nhan xet
 * - geminiPracticeService.js: Tao bai luyen tap va van dung
 * 
 * File nay giu lai nhu mot facade de dam bao tuong thich nguoc.
 */

// Import tu cac service da tach
import { GeminiChatService } from "./geminiChatService";
import { GeminiFeedbackService } from "./geminiFeedbackService";
import { GeminiPracticeService } from "./geminiPracticeService";

// Re-export cac class
export { GeminiChatService, GeminiFeedbackService, GeminiPracticeService };

/**
 * GeminiService - Facade class
 * Ket hop tat ca cac phuong thuc tu cac service con
 */
export class GeminiService {
  constructor() {
    // Delegate to actual services
    this._chatService = new GeminiChatService();
    this._feedbackService = new GeminiFeedbackService();
    this._practiceService = new GeminiPracticeService();
  }

  // ============ CHAT SERVICE METHODS ============
  
  get chat() { return this._chatService.chat; }
  set chat(value) { this._chatService.chat = value; }
  
  get currentStep() { return this._chatService.currentStep; }
  set currentStep(value) { this._chatService.currentStep = value; }
  
  get currentProblem() { return this._chatService.currentProblem; }
  set currentProblem(value) { this._chatService.currentProblem = value; }
  
  get studentResponses() { return this._chatService.studentResponses; }
  set studentResponses(value) { this._chatService.studentResponses = value; }
  
  get isSessionComplete() { return this._chatService.isSessionComplete; }
  set isSessionComplete(value) { this._chatService.isSessionComplete = value; }
  
  get stepEvaluations() { return this._chatService.stepEvaluations; }
  set stepEvaluations(value) { this._chatService.stepEvaluations = value; }

  async startNewProblem(problemText) {
    return this._chatService.startNewProblem(problemText);
  }

  async processStudentResponse(studentAnswer) {
    return this._chatService.processStudentResponse(studentAnswer);
  }

  async sendStudentResponse(studentAnswer) {
    return this._chatService.sendStudentResponse(studentAnswer);
  }

  async getHint() {
    return this._chatService.getHint();
  }

  moveToNextStep() {
    return this._chatService.moveToNextStep();
  }

  evaluateStep(step, level) {
    return this._chatService.evaluateStep(step, level);
  }

  getSummary() {
    return this._chatService.getSummary();
  }

  // ============ FEEDBACK SERVICE METHODS ============

  async evaluateQuestionComments(studentAnswers, questions) {
    return this._feedbackService.evaluateQuestionComments(studentAnswers, questions);
  }

  async evaluateCompetencyFramework(studentAnswers, questions) {
    return this._feedbackService.evaluateCompetencyFramework(studentAnswers, questions);
  }

  async evaluatePolyaStep(chatHistory, problem) {
    return this._feedbackService.evaluatePolyaStep(chatHistory, problem);
  }

  async generateOverallAssessment(evaluation) {
    return this._feedbackService.generateOverallAssessment(evaluation);
  }

  // ============ PRACTICE SERVICE METHODS ============

  async generateSimilarProblem(
    problemText1,
    problemText2,
    problemContext = "",
    problemNumber = 1,
    competencyLevel = "Dat"
  ) {
    return this._practiceService.generateSimilarProblem(
      problemText1,
      problemText2,
      problemContext,
      problemNumber,
      competencyLevel
    );
  }

  async generateApplicationProblem(studentContext) {
    return this._practiceService.generateApplicationProblem(studentContext);
  }

  async generateExamFromSampleExam(topicName, lessonName, sampleExams) {
    return this._practiceService.generateExamFromSampleExam(topicName, lessonName, sampleExams);
  }
}

// Singleton instance cho backward compatibility
const geminiServiceInstance = new GeminiService();
export default geminiServiceInstance;
