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
      // Parse sampleExam if it's a JSON string
      let sampleExamData = topicData.sampleExam || '';
      if (typeof sampleExamData === 'string' && sampleExamData.trim().startsWith('[')) {
        try {
          sampleExamData = JSON.parse(sampleExamData);
        } catch (e) {
        }
      }

      const dataToSave = {
        name: topicData.name || '',
        description: topicData.description || '',
        gradeLevel: topicData.gradeLevel || '',
        type: topicData.type || 'startup', // 'startup' or 'worksheet'
        createdBy: topicData.createdBy || '',
        createdByName: topicData.createdByName || '',
        sampleExam: sampleExamData, // Template Exam content (can be string or structured data)
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        problemCount: 0
      };
      const docRef = await addDoc(collection(db, this.collectionName), dataToSave);
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

  // Lấy chủ đề theo classId
  async getTopicsByClass(classId) {
    try {
      // Lấy tất cả topics rồi filter phía client để tránh vấn đề composite index
      const q = query(
        collection(db, this.collectionName),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const topics = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter theo classId phía client
        if (data.classId === classId) {
          topics.push({ id: doc.id, ...data });
        }
      });
      return topics;
    } catch (error) {
      console.error("Error getting topics by class:", error);
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
      // Parse sampleExam if it's a JSON string
      const dataToUpdate = { ...updateData };
      if (updateData.sampleExam !== undefined) {
        let sampleExamData = updateData.sampleExam || '';
        if (typeof sampleExamData === 'string' && sampleExamData.trim().startsWith('[')) {
          try {
            dataToUpdate.sampleExam = JSON.parse(sampleExamData);
          } catch (e) {
            // If not valid JSON, keep as string
            dataToUpdate.sampleExam = sampleExamData;
          }
        }
      }

      const docRef = doc(db, this.collectionName, topicId);
      await updateDoc(docRef, {
        ...dataToUpdate,
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
