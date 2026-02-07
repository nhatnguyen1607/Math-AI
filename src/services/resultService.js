import { 
  collection, 
  addDoc, 
  getDocs, 
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import problemService from './problemService';

class ResultService {
  constructor() {
    this.collectionName = 'results';
  }

  // Lưu kết quả làm bài
  async saveResult(resultData) {
    try {
      // Prepare the data to save
      const {
        userId,
        problemId,
        topicId,
        stepEvaluations,
        totalScore,
        completionTime, // tính bằng giây
        isCompleted
      } = resultData;

      const docRef = await addDoc(
        collection(db, this.collectionName),
        {
          userId,
          problemId,
          topicId: topicId || null,
          stepEvaluations: stepEvaluations || {},
          totalScore,
          completionTime,
          isCompleted,
          createdAt: serverTimestamp()
        }
      );

      // Cập nhật attempt count
      await problemService.incrementAttemptCount(problemId);

      // Nếu hoàn thành thì tăng completion count
      if (isCompleted) {
        await problemService.incrementCompletionCount(problemId);
      }

      return { id: docRef.id, ...resultData };
    } catch (error) {
      console.error("Error saving result:", error);
      throw error;
    }
  }

  // Lấy lịch sử làm bài của 1 user cho 1 bài toán
  async getUserProblemHistory(userId, problemId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('problemId', '==', problemId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      return results;
    } catch (error) {
      console.error("Error getting user problem history:", error);
      throw error;
    }
  }

  // Lấy kết quả tốt nhất của user cho 1 bài toán
  async getUserBestResult(userId, problemId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('problemId', '==', problemId),
        orderBy('totalScore', 'desc'),
        orderBy('completionTime', 'asc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error("Error getting user best result:", error);
      throw error;
    }
  }

  // Kiểm tra user đã hoàn thành bài toán chưa
  async hasUserCompletedProblem(userId, problemId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('problemId', '==', problemId),
        where('isCompleted', '==', true),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking completion:", error);
      throw error;
    }
  }

  // Lấy tất cả kết quả của user (tất cả bài toán)
  async getUserResults(userId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      return results;
    } catch (error) {
      console.error("Error getting user results:", error);
      throw error;
    }
  }

  // Lấy bảng xếp hạng cho 1 bài toán
  async getProblemLeaderboard(problemId, limitCount = 10) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('problemId', '==', problemId),
        orderBy('totalScore', 'desc'),
        orderBy('completionTime', 'asc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      const leaderboard = [];
      
      querySnapshot.forEach((doc) => {
        leaderboard.push({ id: doc.id, ...doc.data()});
      });
      
      // Group by userId và chỉ lấy kết quả tốt nhất của mỗi user
      const userBestResults = {};
      leaderboard.forEach(result => {
        if (!userBestResults[result.userId] || 
            result.totalScore > userBestResults[result.userId].totalScore ||
            (result.totalScore === userBestResults[result.userId].totalScore && 
             result.completionTime < userBestResults[result.userId].completionTime)) {
          userBestResults[result.userId] = result;
        }
      });
      
      return Object.values(userBestResults)
        .sort((a, b) => {
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          return a.completionTime - b.completionTime;
        })
        .slice(0, limitCount);
        
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      throw error;
    }
  }

  // Lấy danh sách bài toán user đã hoàn thành trong 1 chủ đề
  async getUserCompletedProblemsInTopic(userId, topicId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('topicId', '==', topicId),
        where('isCompleted', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const completedProblemIds = new Set();
      
      querySnapshot.forEach((doc) => {
        completedProblemIds.add(doc.data().problemId);
      });
      
      return Array.from(completedProblemIds);
    } catch (error) {
      console.error("Error getting completed problems:", error);
      throw error;
    }
  }

  // Lấy bảng xếp hạng cho 1 chủ đề
  async getTopicLeaderboard(topicId, limitCount = 10) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('topicId', '==', topicId),
        where('isCompleted', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const results = [];
      
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      
      // Tính tổng điểm và số bài hoàn thành của mỗi user
      const userStats = {};
      results.forEach(result => {
        if (!userStats[result.userId]) {
          userStats[result.userId] = {
            userId: result.userId,
            totalScore: 0,
            completedProblems: 0,
            problemIds: new Set()
          };
        }
        
        // Chỉ tính 1 lần cho mỗi bài toán (lấy điểm cao nhất)
        if (!userStats[result.userId].problemIds.has(result.problemId)) {
          userStats[result.userId].problemIds.add(result.problemId);
          userStats[result.userId].totalScore += result.totalScore || 0;
          userStats[result.userId].completedProblems += 1;
        } else {
          // Cập nhật điểm nếu cao hơn
          const currentProblems = results.filter(r => 
            r.userId === result.userId && r.problemId === result.problemId
          );
          const maxScore = Math.max(...currentProblems.map(r => r.totalScore || 0));
          userStats[result.userId].totalScore = 
            userStats[result.userId].totalScore - (result.totalScore || 0) + maxScore;
        }
      });
      
      return Object.values(userStats)
        .map(stat => ({
          userId: stat.userId,
          totalScore: stat.totalScore,
          completedProblems: stat.completedProblems
        }))
        .sort((a, b) => {
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          return b.completedProblems - a.completedProblems;
        })
        .slice(0, limitCount);
        
    } catch (error) {
      console.error("Error getting topic leaderboard:", error);
      throw error;
    }
  }

  // Lấy thống kê của user
  async getUserStats(userId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const results = [];
      
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      
      // Tính số bài đã làm và hoàn thành
      const attemptedProblems = new Set();
      const completedProblems = new Set();
      let totalScore = 0;
      let totalTime = 0;
      
      results.forEach(result => {
        attemptedProblems.add(result.problemId);
        if (result.isCompleted) {
          completedProblems.add(result.problemId);
          totalScore += result.totalScore || 0;
          totalTime += result.completionTime || 0;
        }
      });
      
      return {
        attemptedCount: attemptedProblems.size,
        completedCount: completedProblems.size,
        totalScore,
        averageScore: completedProblems.size > 0 ? Math.round(totalScore / completedProblems.size) : 0,
        totalTime
      };
    } catch (error) {
      console.error("Error getting user stats:", error);
      throw error;
    }
  }

  // Tính điểm dựa trên step evaluations
  calculateScore(stepEvaluations) {
    const scoreMap = {
      'good': 100,
      'pass': 70,
      'need_effort': 40
    };
    
    let totalScore = 0;
    let stepCount = 0;
    
    Object.values(stepEvaluations).forEach(evaluation => {
      if (evaluation) {
        totalScore += scoreMap[evaluation] || 0;
        stepCount++;
      }
    });
    
    return stepCount > 0 ? Math.round(totalScore / stepCount) : 0;
  }

  // ===== EXAM SESSION RESULTS (Live Exam) =====

  /**
   * Lưu kết quả thi trực tiếp của một học sinh
   */
  async saveExamSessionResult(sessionId, uid, examId, resultData) {
    try {
      const resultRef = doc(collection(db, 'exam_results'));
      
      const result = {
        sessionId,
        userId: uid,
        examId,
        score: resultData.score || 0,
        totalQuestions: resultData.totalQuestions || 0,
        correctAnswers: resultData.answers?.filter(a => a.isCorrect).length || 0,
        incorrectAnswers: resultData.answers?.filter(a => !a.isCorrect).length || 0,
        percentage: resultData.totalQuestions > 0 
          ? Math.round((resultData.score / resultData.totalQuestions) * 100) 
          : 0,
        answers: resultData.answers || [],
        timeSpent: resultData.timeSpent || 0,
        submittedAt: serverTimestamp(),
        aiAnalysis: null,
        leaderboardPosition: 1
      };
      
      await setDoc(resultRef, result);
      return { id: resultRef.id, ...result };
    } catch (error) {
      console.error('Error saving exam session result:', error);
      throw error;
    }
  }

  /**
   * Lấy kết quả thi của một học sinh từ một phiên thi
   */
  async getExamSessionResult(sessionId, uid) {
    try {
      const q = query(
        collection(db, 'exam_results'),
        where('sessionId', '==', sessionId),
        where('userId', '==', uid)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting exam session result:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả kết quả từ một phiên thi
   */
  async getSessionResults(sessionId) {
    try {
      const q = query(
        collection(db, 'exam_results'),
        where('sessionId', '==', sessionId)
      );
      
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      
      return results;
    } catch (error) {
      console.error('Error getting session results:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả kết quả thi của một học sinh
   */
  async getUserExamResults(uid) {
    try {
      const q = query(
        collection(db, 'exam_results'),
        where('userId', '==', uid),
        orderBy('submittedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      
      return results;
    } catch (error) {
      console.error('Error getting user exam results:', error);
      throw error;
    }
  }

  /**
   * Lấy thống kê học sinh cho một bộ đề
   */
  async getStudentExamStatistics(uid, examId) {
    try {
      const q = query(
        collection(db, 'exam_results'),
        where('userId', '==', uid),
        where('examId', '==', examId)
      );
      
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      
      if (results.length === 0) {
        return {
          totalAttempts: 0,
          bestScore: 0,
          averageScore: 0,
          lastAttempt: null,
          results: []
        };
      }
      
      const scores = results.map(r => r.percentage || 0);
      const bestScore = Math.max(...scores);
      const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      
      return {
        totalAttempts: results.length,
        bestScore,
        averageScore,
        lastAttempt: results[0]?.submittedAt,
        results
      };
    } catch (error) {
      console.error('Error getting student exam statistics:', error);
      throw error;
    }
  }

  /**
   * Cập nhật vị trí xếp hạng
   */
  async updateLeaderboardPosition(resultId, position) {
    try {
      const resultRef = doc(db, 'exam_results', resultId);
      await updateDoc(resultRef, {
        leaderboardPosition: position
      });
    } catch (error) {
      console.error('Error updating leaderboard position:', error);
      throw error;
    }
  }

  // ===== EXAM PROGRESS (Khởi động, Luyện tập, Vận dụng) =====

  /**
   * Lưu hoặc cập nhật tiến trình thi của học sinh
   * Document ID: {userId}_{examId}
   * Always save the latest sessionId for result display without session reference
   */
  async upsertExamProgress(userId, examId, progressData) {
    try {
      const docId = `${userId}_${examId}`;
      const progressRef = doc(db, 'student_exam_progress', docId);

      // Lấy dữ liệu hiện tại nếu tồn tại
      const existingDoc = await getDoc(progressRef);
      let updateData = {};

      if (existingDoc.exists()) {
        // Nếu document đã tồn tại, cập nhật phần tương ứng
        const existingData = existingDoc.data();
        const { part, data, sessionId } = progressData;

        updateData = {
          ...existingData,
          parts: {
            ...existingData.parts,
            [part]: data
          },
          latestSessionId: sessionId || null, // Luôn lưu sessionId gần nhất
          lastUpdatedAt: serverTimestamp()
        };

        // Cập nhật status nếu phần hoàn thành
        if (part === 'khoiDong' && data.completedAt) {
          updateData.status = 'khoiDong_done';
        } else if (part === 'luyenTap' && data.completedAt) {
          updateData.status = 'luyenTap_done';
        } else if (part === 'vanDung' && data.completedAt) {
          updateData.status = 'all_done';
          updateData.isFirst = false;
        }
      } else {
        // Tạo document mới
        const { part, data, sessionId } = progressData;
        updateData = {
          userId,
          examId,
          isFirst: true,
          status: 'khoiDong_done',
          latestSessionId: sessionId || null, // Lưu sessionId
          parts: {
            khoiDong: part === 'khoiDong' ? data : null,
            luyenTap: part === 'luyenTap' ? data : null,
            vanDung: part === 'vanDung' ? data : null
          },
          createdAt: serverTimestamp(),
          lastUpdatedAt: serverTimestamp()
        };
      }

      await setDoc(progressRef, updateData, { merge: true });
      return { id: docId, ...updateData };
    } catch (error) {
      console.error('Error upserting exam progress:', error);
      throw error;
    }
  }

  /**
   * Lấy tiến trình thi của học sinh
   */
  async getExamProgress(userId, examId) {
    try {
      const docId = `${userId}_${examId}`;
      const progressRef = doc(db, 'student_exam_progress', docId);
      const docSnapshot = await getDoc(progressRef);

      if (docSnapshot.exists()) {
        return { id: docSnapshot.id, ...docSnapshot.data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting exam progress:', error);
      throw error;
    }
  }

  /**
   * Cập nhật flag isFirst
   */
  async updateIsFirstFlag(userId, examId, isFirst) {
    try {
      const docId = `${userId}_${examId}`;
      const progressRef = doc(db, 'student_exam_progress', docId);
      
      await updateDoc(progressRef, {
        isFirst,
        lastUpdatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating isFirst flag:', error);
      throw error;
    }
  }

  /**
   * Lấy kết quả thi cuối cùng của học sinh từ student_exam_progress
   * Dùng khi exam.isLocked === true để hiển thị kết quả mà không cần sessionId
   */
  async getFinalExamResults(userId, examId) {
    try {
      const progress = await this.getExamProgress(userId, examId);
      
      if (!progress) {
        return null;
      }

      // Trích xuất dữ liệu từ phần khoiDong (Khởi động)
      const khoiDongData = progress.parts?.khoiDong;
      
      if (!khoiDongData) {
        return null;
      }

      return {
        userId,
        examId,
        latestSessionId: progress.latestSessionId,
        completedAt: khoiDongData.completedAt,
        score: khoiDongData.score,
        totalQuestions: khoiDongData.totalQuestions,
        correctAnswers: khoiDongData.correctAnswers,
        percentage: khoiDongData.percentage,
        answers: khoiDongData.answers,
        timeSpent: khoiDongData.timeSpent,
        aiAnalysis: khoiDongData.aiAnalysis,
        competencyEvaluation: khoiDongData.competencyEvaluation,
        isLocked: true,
        data: progress // Return full progress data for UI rendering
      };
    } catch (error) {
      console.error('Error getting final exam results:', error);
      throw error;
    }
  }
}

const resultServiceInstance = new ResultService();
export default resultServiceInstance;
