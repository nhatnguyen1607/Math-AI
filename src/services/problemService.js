import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import topicService from './topicService';

class ProblemService {
  constructor() {
    this.collectionName = 'problems';
  }

  // Tạo bài toán mới
  async createProblem(problemData) {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...problemData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        attemptCount: 0,
        completionCount: 0
      });
      
      // Tăng số lượng bài toán trong chủ đề
      if (problemData.topicId) {
        await topicService.incrementProblemCount(problemData.topicId);
      }
      
      return { id: docRef.id, ...problemData };
    } catch (error) {
      throw error;
    }
  }

  // Lấy tất cả bài toán của 1 chủ đề
  async getProblemsByTopic(topicId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('topicId', '==', topicId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const problems = [];
      querySnapshot.forEach((doc) => {
        problems.push({ id: doc.id, ...doc.data() });
      });
      return problems;
    } catch (error) {
      throw error;
    }
  }

  // Lấy tất cả bài toán
  async getAllProblems() {
    try {
      const q = query(
        collection(db, this.collectionName),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const problems = [];
      querySnapshot.forEach((doc) => {
        problems.push({ id: doc.id, ...doc.data() });
      });
      return problems;
    } catch (error) {
      throw error;
    }
  }

  // Lấy thông tin 1 bài toán
  async getProblemById(problemId) {
    try {
      const docRef = doc(db, this.collectionName, problemId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("Problem not found");
      }
    } catch (error) {
      throw error;
    }
  }

  // Cập nhật bài toán
  async updateProblem(problemId, updateData) {
    try {
      const docRef = doc(db, this.collectionName, problemId);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return { id: problemId, ...updateData };
    } catch (error) {
      throw error;
    }
  }

  // Xóa bài toán
  async deleteProblem(problemId) {
    try {
      // Lấy thông tin bài toán trước khi xóa
      const problem = await this.getProblemById(problemId);
      
      const docRef = doc(db, this.collectionName, problemId);
      await deleteDoc(docRef);
      
      // Giảm số lượng bài toán trong chủ đề
      if (problem.topicId) {
        await topicService.decrementProblemCount(problem.topicId);
      }
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Tăng số lần thử
  async incrementAttemptCount(problemId) {
    try {
      const problem = await this.getProblemById(problemId);
      await this.updateProblem(problemId, {
        attemptCount: (problem.attemptCount || 0) + 1
      });
    } catch (error) {
      throw error;
    }
  }

  // Tăng số lần hoàn thành
  async incrementCompletionCount(problemId) {
    try {
      const problem = await this.getProblemById(problemId);
      await this.updateProblem(problemId, {
        completionCount: (problem.completionCount || 0) + 1
      });
    } catch (error) {
      throw error;
    }
  }
}

const problemServiceInstance = new ProblemService();
export default problemServiceInstance;
