import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

class TopicService {
  constructor() {
    this.collectionName = 'topics';
  }

  // Tạo chủ đề mới
  async createTopic(topicData) {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...topicData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        problemCount: 0
      });
      return { id: docRef.id, ...topicData };
    } catch (error) {
      console.error("Error creating topic:", error);
      throw error;
    }
  }

  // Lấy tất cả chủ đề
  async getAllTopics() {
    try {
      const q = query(
        collection(db, this.collectionName),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const topics = [];
      querySnapshot.forEach((doc) => {
        topics.push({ id: doc.id, ...doc.data() });
      });
      return topics;
    } catch (error) {
      console.error("Error getting topics:", error);
      throw error;
    }
  }

  // Lấy thông tin 1 chủ đề
  async getTopicById(topicId) {
    try {
      const docRef = doc(db, this.collectionName, topicId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("Topic not found");
      }
    } catch (error) {
      console.error("Error getting topic:", error);
      throw error;
    }
  }

  // Cập nhật chủ đề
  async updateTopic(topicId, updateData) {
    try {
      const docRef = doc(db, this.collectionName, topicId);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return { id: topicId, ...updateData };
    } catch (error) {
      console.error("Error updating topic:", error);
      throw error;
    }
  }

  // Xóa chủ đề
  async deleteTopic(topicId) {
    try {
      const docRef = doc(db, this.collectionName, topicId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error("Error deleting topic:", error);
      throw error;
    }
  }

  // Tăng số lượng bài toán trong chủ đề
  async incrementProblemCount(topicId) {
    try {
      const topic = await this.getTopicById(topicId);
      await this.updateTopic(topicId, {
        problemCount: (topic.problemCount || 0) + 1
      });
    } catch (error) {
      console.error("Error incrementing problem count:", error);
      throw error;
    }
  }

  // Giảm số lượng bài toán trong chủ đề
  async decrementProblemCount(topicId) {
    try {
      const topic = await this.getTopicById(topicId);
      await this.updateTopic(topicId, {
        problemCount: Math.max((topic.problemCount || 0) - 1, 0)
      });
    } catch (error) {
      console.error("Error decrementing problem count:", error);
      throw error;
    }
  }
}

const topicServiceInstance = new TopicService();
export default topicServiceInstance;
