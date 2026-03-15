/**
 * Faculty Service
 * Quản lý chủ đề, đề thi và tương tác realtime với học sinh
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Topic, Exam, Question, ExamResult } from '../../models';

class FacultyService {
  /**
   * Tạo chủ đề mới
   */
  async createTopic(topicData, facultyId) {
    try {
      const topic = new Topic({
        ...topicData,
        createdBy: facultyId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const docRef = await addDoc(collection(db, 'topics'), topic.toJSON());
      return { ...topic, id: docRef.id };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy tất cả chủ đề của faculty
   */
  async getFacultyTopics(facultyId) {
    try {
      const q = query(
        collection(db, 'topics'),
        where('createdBy', '==', facultyId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => Topic.fromFirestore(doc.data(), doc.id));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật chủ đề
   */
  async updateTopic(topicId, updates) {
    try {
      const topicRef = doc(db, 'topics', topicId);
      await updateDoc(topicRef, {
        ...updates,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa chủ đề (cũng xóa tất cả đề thi liên quan)
   */
  async deleteTopic(topicId) {
    try {
      // Xóa tất cả đề thi của chủ đề
      const exams = await this.getExamsByTopic(topicId);
      const batch = writeBatch(db);

      exams.forEach(exam => {
        batch.delete(doc(db, 'exams', exam.id));
      });

      batch.delete(doc(db, 'topics', topicId));
      await batch.commit();
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy tất cả chủ đề
   */
  async getTopics(classId = null) {
    try {
      // Load tất cả topics (bỏ qua classId filter)
      // vì không phải tất cả topics đều có classId
      const q = query(
        collection(db, 'topics'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo đề thi mới
   */
  async createExam(examData, facultyId) {
    try {
      // Validate required fields
      if (!examData.classId) {
        throw new Error('classId là bắt buộc');
      }
      if (!examData.topicId) {
        throw new Error('topicId là bắt buộc');
      }
      if (!examData.title) {
        throw new Error('title là bắt buộc');
      }
      if (!examData.exercises || examData.exercises.length === 0) {
        throw new Error('Phải có ít nhất một exercise');
      }

      const exam = new Exam({
        ...examData,
        createdBy: facultyId,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const jsonData = exam.toJSON();
      
      const docRef = await addDoc(collection(db, 'exams'), jsonData);
      return { ...exam, id: docRef.id };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy đề thi theo ID
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
      throw error;
    }
  }

  /**
   * Lấy tất cả đề thi của một chủ đề
   */
  async getExamsByTopic(topicId) {
    try {
      const q = query(
        collection(db, 'exams'),
        where('topicId', '==', topicId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => Exam.fromFirestore(doc.data(), doc.id));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy tất cả đề thi của faculty (có thể filter theo classId hoặc topicId)
   */
  async getFacultyExams(facultyId, classId = null, topicId = null) {
    try {
      
      const conditions = [];

      if (classId) {
        conditions.push(where('classId', '==', classId));
      }

      if (topicId) {
        conditions.push(where('topicId', '==', topicId));
      }

      const q = query(
        collection(db, 'exams'),
        ...conditions
      );

      const snapshot = await getDocs(q);
      
      const exams = snapshot.docs.map(doc => {
        const data = doc.data();
        return Exam.fromFirestore(data, doc.id);
      });
      
      // Sort by createdAt descending on client side
      exams.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      
      return exams;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy tất cả đề thi của faculty (alias) - có thể filter theo classId hoặc topicId
   */
  async getExamsByFaculty(facultyId, classId = null, topicId = null) {
    return this.getFacultyExams(facultyId, classId, topicId);
  }

  /**
   * Cập nhật đề thi
   */
  async updateExam(examId, updates) {
    try {
      const examRef = doc(db, 'exams', examId);
      await updateDoc(examRef, {
        ...updates,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thêm câu hỏi vào đề thi
   */
  async addQuestion(examId, questionData) {
    try {
      const question = new Question({
        ...questionData,
        examId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const docRef = await addDoc(collection(db, 'questions'), question.toJSON());
      
      // Cập nhật số lượng câu hỏi trong đề thi
      const exam = await this.getExamById(examId);
      await this.updateExam(examId, {
        totalQuestions: (exam.totalQuestions || 0) + 1
      });

      return { ...question, id: docRef.id };
    } catch (error) {
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
      return snapshot.docs.map(doc => Question.fromFirestore(doc.data(), doc.id));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật câu hỏi
   */
  async updateQuestion(questionId, updates) {
    try {
      const questionRef = doc(db, 'questions', questionId);
      await updateDoc(questionRef, {
        ...updates,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa câu hỏi
   */
  async deleteQuestion(questionId, examId) {
    try {
      await deleteDoc(doc(db, 'questions', questionId));
      
      // Cập nhật số lượng câu hỏi
      const exam = await this.getExamById(examId);
      await this.updateExam(examId, {
        totalQuestions: Math.max(0, (exam.totalQuestions || 1) - 1)
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Kích hoạt đề thi (chuyển từ draft sang open)
   */
  async activateExam(examId) {
    try {
      const exam = await this.getExamById(examId);
      
      if (!exam.isDraft()) {
        throw new Error('Chỉ có thể kích hoạt đề thi ở trạng thái draft');
      }

      await this.updateExam(examId, {
        status: 'open',
        waitingStudents: [],
        activeStudents: [],
        completedStudents: []
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bắt đầu đề thi (tạo exam session)
   * @param {string} examId - ID của bộ đề thi
   * @param {string} facultyId - ID của giảng viên
   * @param {string} classId - ID của lớp học
   * @returns {Promise<string>} - ID của session vừa tạo
   */
  async startExam(examId, facultyId, classId) {
    try {
      // Import examSessionService để tạo hoặc lấy session
      const { createExamSession, getActiveExamSession } = await import('./examSessionService');
      
      // 🔧 KIỂM TRA: Có session active cho exam này chưa?
      const existingSessionId = await getActiveExamSession(examId);
      
      if (existingSessionId) {
        return existingSessionId; // Trả về session cũ thay vì tạo mới
      }
      
      // Lấy thông tin đề thi để biết tổng số câu hỏi
      const exam = await this.getExamById(examId);
      const totalQuestions = exam?.exercises?.reduce((sum, e) => sum + e.questions.length, 0) || 0;
      
      // Tạo exam session mới với status = 'waiting'
      const sessionId = await createExamSession(examId, facultyId, classId, totalQuestions);
      
      // Cập nhật exam status
      const now = new Date();
      await this.updateExam(examId, {
        status: 'in_progress',
        startTime: now,
        endTime: new Date(now.getTime() + 420000) // 7 minutes
      });
      return sessionId;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Kết thúc đề thi (chuyển từ in_progress sang finished)
   */
  async finishExam(examId) {
    try {
      await this.updateExam(examId, {
        status: 'finished',
        endTime: new Date()
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thêm học sinh vào sảnh chờ
   */
  async addStudentToWaiting(examId, studentId) {
    try {
      const exam = await this.getExamById(examId);
      const waitingStudents = [...(exam.waitingStudents || [])];

      if (!waitingStudents.includes(studentId)) {
        waitingStudents.push(studentId);
        await this.updateExam(examId, { waitingStudents });
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lắng nghe thay đổi realtime của đề thi
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
  subscribeToExamResults(examId, callback) {
    const q = query(
      collection(db, 'examResults'),
      where('examId', '==', examId)
    );

    return onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => 
        ExamResult.fromFirestore(doc.data(), doc.id)
      );
      callback(results);
    });
  }

  /**
   * Lấy bảng xếp hạng của đề thi
   */
  async getExamLeaderboard(examId) {
    try {
      const q = query(
        collection(db, 'examResults'),
        where('examId', '==', examId),
        where('status', '==', 'completed'),
        orderBy('totalScore', 'desc'),
        orderBy('timeTaken', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc, index) => ({
        ...ExamResult.fromFirestore(doc.data(), doc.id),
        rank: index + 1
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật trạng thái đề thi
   */
  async updateExamStatus(examId, status) {
    try {
      const examRef = doc(db, 'exams', examId);
      await updateDoc(examRef, {
        status,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa đề thi
   */
  async deleteExam(examId) {
    try {
      const examRef = doc(db, 'exams', examId);
      await deleteDoc(examRef);
      return true;
    } catch (error) {
      throw error;
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
        studentName: doc.data().studentName,
        score: doc.data().score,
        correctAnswers: doc.data().correctAnswers,
        submitted: doc.data().submitted,
        status: doc.data().status,
        timeSubmitted: doc.data().timeTaken,
        ...doc.data()
      }));
    } catch (error) {
      return [];
    }
  }

  async updateExamExercises(examId, exercises) {
    try {
      if (!exercises || exercises.length !== 2) {
        throw new Error('Must have exactly 2 exercises');
      }

      const totalQuestions = exercises.reduce((sum, ex) => sum + (ex.questions?.length || 0), 0);
      
      await this.updateExam(examId, {
        exercises,
        totalQuestions
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lưu câu trả lời của học sinh và tính điểm
   */
  async submitAnswer(examId, studentId, exerciseIndex, questionId, selectedOptions, isCorrect, timeUsed) {
    try {
      if (!examId || !studentId) {
        throw new Error('Exam ID and Student ID are required');
      }

      const exam = await this.getExamById(examId);
      const exercise = exam.exercises[exerciseIndex];
      
      let score = 0;
      if (isCorrect) {
        score = exercise.scoring.correct;
        // Bonus nếu trả lời nhanh
        if (timeUsed < exercise.scoring.bonusTimeThreshold) {
          score += exercise.scoring.bonus;
        }
      } else {
        score = exercise.scoring.incorrect;
      }

      // Lưu câu trả lời
      const answerRef = doc(
        collection(db, 'examResults', examId, 'answers'),
        `${studentId}_${exerciseIndex}_${questionId}`
      );

      await setDoc(answerRef, {
        studentId,
        exerciseIndex,
        questionId,
        selectedOptions,
        isCorrect,
        score,
        timeUsed,
        submittedAt: new Date()
      });

      return score;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Hoàn thành exam cho học sinh
   */
  async completeExamForStudent(examId, studentId, totalScore) {
    try {
      if (!examId || !studentId) {
        throw new Error('Exam ID and Student ID are required');
      }

      const exam = await this.getExamById(examId);
      const activeStudent = exam.activeStudents?.find(s => s.id === studentId);

      if (!activeStudent) {
        throw new Error('Student not found in active list');
      }

      // Cập nhật exam
      const updatedActiveStudents = (exam.activeStudents || []).filter(s => s.id !== studentId);
      const completedStudent = {
        ...activeStudent,
        endTime: new Date(),
        totalScore
      };

      await this.updateExam(examId, {
        activeStudents: updatedActiveStudents,
        completedStudents: [...(exam.completedStudents || []), completedStudent]
      });

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy bảng xếp hạng của exam (sắp xếp theo điểm giảm dần)
   */
  /**
   * Lấy kết quả hoàn thành của tất cả học sinh cho một đề thi từ student_exam_progress
   * Đây là nguồn dữ liệu chính xác hơn finalLeaderboard vì nó có tất cả học sinh đã làm
   * @param {string} examId - ID của đề thi
   * @returns {Promise<Array>} - Mảng học sinh với điểm số, sắp xếp theo rank năng lực
   */
  async getExamStudentResults(examId) {
    try {
      // Load exam data để lấy student names
      const exam = await this.getExamById(examId);
      const completedStudentsMap = {};
      
      // Build map {uid -> name} từ exam.completedStudents hoặc finalLeaderboard
      if (exam?.completedStudents) {
        exam.completedStudents.forEach(s => {
          completedStudentsMap[s.uid] = s.name;
        });
      }
      if (exam?.finalLeaderboard) {
        exam.finalLeaderboard.forEach(s => {
          completedStudentsMap[s.uid] = s.name;
        });
      }

      const q = query(
        collection(db, 'student_exam_progress'),
        where('examId', '==', examId)
      );

      const snapshot = await getDocs(q);
      const results = [];

      // Lặp qua tất cả student_exam_progress documents
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const userId = data.userId;

        // Lấy tên từ map, nếu không có thì query từ users collection
        let studentName = completedStudentsMap[userId];
        
        if (!studentName) {
          try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              studentName = userSnap.data().displayName || userSnap.data().name || `Student ${userId.substring(0, 8)}`;
            } else {
              studentName = `Student ${userId.substring(0, 8)}`;
            }
          } catch (e) {
            studentName = `Student ${userId.substring(0, 8)}`;
          }
        }

        // Lấy điểm từ phần khoiDong (Khởi động) - phần chính của exam
        const khoiDongData = data.parts?.khoiDong;
        
        if (khoiDongData && khoiDongData.completedAt) {
          // 🎯 TỐN ĐIỂM NĂNG LỰC từ cả 3 phần: khoiDong, luyenTap, vanDung
          // ✅ Lấy competencyEvaluation từ khoiDongData (chứa TC1, TC2, TC3, TC4)
          const khoiDongEval = khoiDongData.competencyEvaluation || {};
          const khoiDongCompetencyScore = khoiDongEval.totalCompetencyScore || 
            (khoiDongEval.TC1?.score || 0) + (khoiDongEval.TC2?.score || 0) + (khoiDongEval.TC3?.score || 0) + (khoiDongEval.TC4?.score || 0);
          
          // Lấy từ evaluation.diemTC cho luyenTap, vanDung
          const luyenTapBai1TC = data.parts?.luyenTap?.bai1?.evaluation?.diemTC || { tc1: 0, tc2: 0, tc3: 0, tc4: 0 };
          const luyenTapBai2TC = data.parts?.luyenTap?.bai2?.evaluation?.diemTC || { tc1: 0, tc2: 0, tc3: 0, tc4: 0 };
          const vanDungEval = data.parts?.vanDung?.evaluation || {};
          const vanDungCompetencyScore = vanDungEval.totalCompetencyScore || 
            (vanDungEval.TC1?.diem || 0) + (vanDungEval.TC2?.diem || 0) + (vanDungEval.TC3?.diem || 0) + (vanDungEval.TC4?.diem || 0);

          // Tính tổng điểm năng lực từ cả 3 phần
          const totalCompetencyScore = 
            khoiDongCompetencyScore +
            (luyenTapBai1TC.tc1 || 0) + (luyenTapBai1TC.tc2 || 0) + (luyenTapBai1TC.tc3 || 0) + (luyenTapBai1TC.tc4 || 0) +
            (luyenTapBai2TC.tc1 || 0) + (luyenTapBai2TC.tc2 || 0) + (luyenTapBai2TC.tc3 || 0) + (luyenTapBai2TC.tc4 || 0) +
            vanDungCompetencyScore;

          results.push({
            uid: userId,
            name: studentName,
            score: khoiDongData.score || 0,
            correctAnswers: khoiDongData.correctAnswers || 0,
            totalQuestions: khoiDongData.totalQuestions || 0,
            percentage: khoiDongData.percentage || 0,
            completedAt: khoiDongData.completedAt,
            timeSpent: khoiDongData.timeSpent || 0,
            // 🎯 THÊM tổng điểm năng lực
            totalCompetencyScore: totalCompetencyScore,
            khoiDongCompetencyScore: khoiDongCompetencyScore,  // Điểm riêng phần khởi động
            competencyDetails: {
              khoiDong: khoiDongEval,
              luyenTapBai1: luyenTapBai1TC,
              luyenTapBai2: luyenTapBai2TC,
              vanDung: vanDungEval
            },
            // 🎯 THÊM tongDiem từ các phần luyenTap và vanDung
            luyenTapBai1TongDiem: data.parts?.luyenTap?.bai1?.evaluation?.tongDiem || 0,
            luyenTapBai2TongDiem: data.parts?.luyenTap?.bai2?.evaluation?.tongDiem || 0,
            vanDungTongDiem: data.parts?.vanDung?.evaluation?.tongDiem || 0
          });
        }
      }

      // 🎯 SẮP XẾP THEO ĐIỂM NĂNG LỰC KHỞI ĐỘNG GIẢM DẦN (từ cao đến thấp)
      results.sort((a, b) => {
        // Ưu tiên sắp xếp theo điểm năng lực khởi động
        if (b.khoiDongCompetencyScore !== a.khoiDongCompetencyScore) {
          return b.khoiDongCompetencyScore - a.khoiDongCompetencyScore;
        }
        // Nếu điểm năng lực khởi động bằng nhau, sắp xếp theo tổng điểm năng lực
        if (b.totalCompetencyScore !== a.totalCompetencyScore) {
          return b.totalCompetencyScore - a.totalCompetencyScore;
        }
        // Nếu vẫn bằng nhau, sắp xếp theo điểm khởi động (phần thi)
        if (b.score !== a.score) return b.score - a.score;
        // Nếu vẫn bằng nhau, sắp xếp theo số câu đúng
        return b.correctAnswers - a.correctAnswers;
      });

      // Thêm rank vào
      const leaderboard = results.map((student, idx) => ({
        ...student,
        rank: idx + 1,
        medal: idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''
      }));

      return leaderboard;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy kết quả hoàn thành từ finalLeaderboard (backup nếu student_exam_progress không đầy đủ)
   */
  async getExamLeaderboardByStatus(examId) {
    try {
      const exam = await this.getExamById(examId);
      
      // Sắp xếp completedStudents theo điểm giảm dần
      const leaderboard = [...(exam.completedStudents || [])].sort((a, b) => b.totalScore - a.totalScore);
      
      // Thêm rank
      return leaderboard.map((student, idx) => ({
        ...student,
        rank: idx + 1
      }));
    } catch (error) {
      throw error;
    }
  }
}

const facultyServiceInstance = new FacultyService();
export default facultyServiceInstance;
