/**
 * Student Service
 * Quản lý tương tác của học sinh với đề thi và kết quả
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Exam, ExamResult } from '../../models';

class StudentService {
  async getAvailableExams(classId = null, type = null) {
    try {
      console.log('🔍 getAvailableExams called with:', { classId, type });
      // Get all exams without status filter (filter in memory to avoid needing composite index)
      const q = query(
        collection(db, 'exams'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      let exams = snapshot.docs.map(doc => Exam.fromFirestore(doc.data(), doc.id));
      console.log('📊 Total exams found:', exams.length);

      // Filter in memory for flexibility (classId, type)
      // Always show all exams regardless of status - UI layer will check isLocked to determine button
      
      // Only filter by classId if provided and valid
      if (classId && classId.trim()) {
        console.log('🔍 Filtering by classId:', classId);
        exams = exams.filter(e => {
          console.log('  exam.classId:', e.classId, 'match:', e.classId === classId);
          return e.classId === classId;
        });
        console.log('📊 After classId filter:', exams.length);
      }
      // Only filter by type if provided and valid
      if (type && type.trim()) {
        console.log('🔍 Filtering by type:', type);
        exams = exams.filter(e => e.type === type);
        console.log('📊 After type filter:', exams.length);
      }

      console.log('✅ Final exams:', exams.length);
      
      // Debug log to show isLocked status of each exam
      exams.forEach(exam => {
        console.log(`📋 Exam details: id=${exam.id}, title="${exam.title}", isLocked=${exam.isLocked} (type: ${typeof exam.isLocked}), status=${exam.status}`);
      });
      console.log('📋 Full exams JSON:', JSON.stringify(exams.map(e => ({id: e.id, title: e.title, isLocked: e.isLocked}))));
      
      return exams;
    } catch (error) {
      console.error('Error getting available exams:', error);
      throw error;
    }
  }

  /**
   * Lấy đề thi theo topic (chỉ những đề không phải draft)
   */
  async getExamsByTopic(topicId) {
    try {
      const q = query(
        collection(db, 'exams'),
        where('topicId', '==', topicId),
        where('status', 'in', ['open', 'started', 'closed'])
      );

      const snapshot = await getDocs(q);
      const exams = snapshot.docs.map(doc => Exam.fromFirestore(doc.data(), doc.id));
      
      // Sort by createdAt on client side
      return exams.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
      console.error('Error getting exams by topic:', error);
      throw error;
    }
  }

  /**
   * Lấy đề thi theo topic AND classId (cho học sinh load đề thi của lớp)
   */
  async getExamsByTopicAndClass(topicId, classId) {
    try {
      const q = query(
        collection(db, 'exams'),
        where('topicId', '==', topicId),
        where('classId', '==', classId),
        where('status', 'in', ['open', 'started', 'closed'])
      );

      const snapshot = await getDocs(q);
      const exams = snapshot.docs.map(doc => Exam.fromFirestore(doc.data(), doc.id));
      
      // Sort by createdAt on client side
      return exams.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch (error) {
      console.error('Error getting exams by topic and class:', error);
      throw error;
    }
  }

  /**
   * Lấy thông tin đề thi
   */
  async getExamById(examId) {
    try {
      const docRef = doc(db, 'exams', examId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return Exam.fromFirestore(docSnap.data(), docSnap.id);
      }
      return null;
    } catch (error) {
      console.error('Error getting exam:', error);
      throw error;
    }
  }

  /**
   * Lấy câu hỏi của đề thi
   */
  async getExamQuestions(examId) {
    try {
      const q = query(
        collection(db, 'questions'),
        where('examId', '==', examId),
        orderBy('order', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        // Ẩn đáp án đúng khi gửi cho học sinh
        correctAnswer: null,
        correctAnswers: null
      }));
    } catch (error) {
      console.error('Error getting exam questions:', error);
      throw error;
    }
  }

  /**
   * Tạo kết quả làm bài cho học sinh
   */
  async createExamResult(examId, studentId, studentName, studentPhotoURL) {
    try {
      const examResult = new ExamResult({
        examId,
        studentId,
        studentName,
        studentPhotoURL,
        status: 'in_progress',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const docRef = await addDoc(
        collection(db, 'examResults'),
        examResult.toJSON()
      );

      return { ...examResult, id: docRef.id };
    } catch (error) {
      console.error('Error creating exam result:', error);
      throw error;
    }
  }

  /**
   * Lấy kết quả làm bài của học sinh
   */
  async getStudentExamResult(examId, studentId) {
    try {
      const q = query(
        collection(db, 'examResults'),
        where('examId', '==', examId),
        where('studentId', '==', studentId)
      );

      const snapshot = await getDocs(q);
      if (snapshot.docs.length > 0) {
        return ExamResult.fromFirestore(
          snapshot.docs[0].data(),
          snapshot.docs[0].id
        );
      }
      return null;
    } catch (error) {
      console.error('Error getting student exam result:', error);
      throw error;
    }
  }

  /**
   * Cập nhật câu trả lời và điểm số
   */
  async submitAnswer(
    resultId,
    questionId,
    answer,
    isCorrect,
    points,
    correctAnswers
  ) {
    try {
      const resultRef = doc(db, 'examResults', resultId);
      const resultSnap = await getDoc(resultRef);
      const result = ExamResult.fromFirestore(resultSnap.data(), resultSnap.id);

      // Thêm câu trả lời
      result.answers.push({
        questionId,
        answer,
        isCorrect,
        points,
        answeredAt: new Date()
      });

      // Cập nhật điểm số
      if (isCorrect) {
        result.correctAnswers += 1;
      }
      result.totalScore += points;

      await updateDoc(resultRef, {
        answers: result.answers,
        correctAnswers: result.correctAnswers,
        totalScore: result.totalScore,
        updatedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error submitting answer:', error);
      throw error;
    }
  }

  /**
   * Hoàn thành đề thi
   */
  async completeExam(resultId, totalQuestions, maxScore) {
    try {
      const resultRef = doc(db, 'examResults', resultId);
      const resultSnap = await getDoc(resultRef);
      const result = ExamResult.fromFirestore(resultSnap.data(), resultSnap.id);

      const timeTaken = Math.floor(
        (new Date() - result.createdAt) / 1000
      );

      const percentageScore = (result.totalScore / maxScore) * 100;

      await updateDoc(resultRef, {
        status: 'completed',
        submittedAt: new Date(),
        totalQuestions,
        maxScore,
        timeTaken,
        percentageScore,
        updatedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error completing exam:', error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử đề thi của học sinh
   */
  async getStudentExamHistory(studentId) {
    try {
      const q = query(
        collection(db, 'examResults'),
        where('studentId', '==', studentId),
        where('status', '==', 'completed'),
        orderBy('submittedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => 
        ExamResult.fromFirestore(doc.data(), doc.id)
      );
    } catch (error) {
      console.error('Error getting student exam history:', error);
      throw error;
    }
  }

  /**
   * Lắng nghe thay đổi đề thi realtime
   */
  subscribeToExam(examId, callback) {
    const examRef = doc(db, 'exams', examId);
    return onSnapshot(examRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(Exam.fromFirestore(docSnap.data(), docSnap.id));
      }
    });
  }

  /**
   * Lắng nghe thay đổi kết quả realtime
   */
  subscribeToExamResult(resultId, callback) {
    const resultRef = doc(db, 'examResults', resultId);
    return onSnapshot(resultRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(ExamResult.fromFirestore(docSnap.data(), docSnap.id));
      }
    });
  }

  /**
   * Lắng nghe bảng xếp hạng realtime
   */
  subscribeToLeaderboard(examId, callback) {
    const q = query(
      collection(db, 'examResults'),
      where('examId', '==', examId),
      where('status', '==', 'completed'),
      orderBy('totalScore', 'desc'),
      orderBy('timeTaken', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map((doc, index) => ({
        ...ExamResult.fromFirestore(doc.data(), doc.id),
        rank: index + 1
      }));
      callback(results);
    });
  }

  /**
   * Lấy thống kê học sinh
   */
  async getStudentStatistics(studentId) {
    try {
      const q = query(
        collection(db, 'examResults'),
        where('studentId', '==', studentId),
        where('status', '==', 'completed')
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => 
        ExamResult.fromFirestore(doc.data(), doc.id)
      );

      const totalExams = results.length;
      const totalScore = results.reduce((sum, r) => sum + r.totalScore, 0);
      const averageScore = totalExams > 0 ? totalScore / totalExams : 0;
      const totalTimeSpent = results.reduce((sum, r) => sum + r.timeTaken, 0);

      return {
        totalExams,
        totalScore,
        averageScore: Math.round(averageScore * 100) / 100,
        totalTimeSpent: Math.round(totalTimeSpent / 60) // Tính theo phút
      };
    } catch (error) {
      console.error('Error getting student statistics:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách chủ đề có sẵn theo lớp và loại
   */
  async getAvailableTopics(classId = null, type = null) {
    try {
      console.log('getAvailableTopics called with classId:', classId, 'type:', type);
      // First, get all topics (không filter theo classId nữa vì topic không có classId)
      const q = query(collection(db, 'topics'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      let topics = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('All topics from Firestore:', topics);

      // Only filter by type if provided and valid
      if (type && type.trim()) {
        topics = topics.filter(t => t.type === type);
        console.log('After filtering by type:', type, topics);
      }

      console.log('Final topics to return:', topics);
      for (let topic of topics) {
        try {
          // Load exams của topic này cho classId cụ thể
          const exams = classId 
            ? await this.getExamsByTopicAndClass(topic.id, classId)
            : await this.getExamsByTopic(topic.id);
          topic.exams = exams;
          topic.examsCount = exams.length;
        } catch (e) {
          topic.exams = [];
          topic.examsCount = 0;
        }
      }

      return topics;
    } catch (error) {
      console.error('Error getting available topics:', error);
      throw error;
    }
  }

  /**
   * Lấy thống kê của học sinh
   */
  async getStudentStats(studentId) {
    try {
      const q = query(
        collection(db, 'examResults'),
        where('studentId', '==', studentId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => doc.data());

      const completedExams = results.filter(r => r.submitted).length;
      const scores = results.filter(r => r.score).map(r => r.score);
      const averageScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      return {
        completedExams,
        averageScore,
        streak: 0, // TODO: Tính chuỗi liên tiếp
        ranking: '-' // TODO: Lấy xếp hạng từ database
      };
    } catch (error) {
      console.error('Error getting student stats:', error);
      return {
        completedExams: 0,
        averageScore: 0,
        streak: 0,
        ranking: '-'
      };
    }
  }

  /**
   * Lấy danh sách thí sinh tham gia đề thi
   */
  async getExamParticipants(examId) {
    try {
      const q = query(
        collection(db, 'examResults'),
        where('examId', '==', examId)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting exam participants:', error);
      return [];
    }
  }

  /**
   * Nộp bài thi
   */
  async submitExam(result) {
    try {
      const examResultsRef = collection(db, 'examResults');
      const docRef = await addDoc(examResultsRef, {
        ...result,
        submitted: true,
        submittedAt: new Date()
      });

      return { id: docRef.id, ...result };
    } catch (error) {
      console.error('Error submitting exam:', error);
      throw error;
    }
  }

  /**
   * Tham gia exam (thêm vào waitingStudents)
   */
  async joinExam(examId, studentId, studentName) {
    try {
      if (!examId || !studentId) {
        throw new Error('Exam ID and Student ID are required');
      }

      const exam = await this.getExamById(examId);
      
      // Kiểm tra xem học sinh đã tham gia chưa
      const isWaiting = exam.waitingStudents?.some(s => s.id === studentId);
      const isActive = exam.activeStudents?.some(s => s.id === studentId);
      const isCompleted = exam.completedStudents?.some(s => s.id === studentId);

      if (isWaiting || isActive || isCompleted) {
        throw new Error('Student already joined this exam');
      }

      // Thêm vào waitingStudents
      const examRef = doc(db, 'exams', examId);
      const updatedWaitingStudents = [...(exam.waitingStudents || []), { id: studentId, name: studentName }];

      await updateDoc(examRef, {
        waitingStudents: updatedWaitingStudents,
        updatedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error joining exam:', error);
      throw error;
    }
  }

}

const instance = new StudentService();
export default instance;
