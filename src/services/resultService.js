import { 
  collection, 
  addDoc, 
  getDocs, 
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc
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
}

const resultServiceInstance = new ResultService();
export default resultServiceInstance;
