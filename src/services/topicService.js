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
      const dataToSave = {
        name: topicData.name || '',
        description: topicData.description || '',
        gradeLevel: topicData.gradeLevel || '',
        type: topicData.type || 'startup',
        createdBy: topicData.createdBy || '',
        createdByName: topicData.createdByName || '',
        sampleExams: topicData.sampleExams || [], // Array of sample exams
        learningPathway: topicData.learningPathway || 'algebra',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        examCount: 0,
        isActive: true
      };
      const docRef = await addDoc(collection(db, this.collectionName), dataToSave);
      return { id: docRef.id, ...topicData };
    } catch (error) {
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
        const data = doc.data();
        // Backward compatibility: convert old sampleExam to sampleExams
        if (data.sampleExam && !data.sampleExams) {
          data.sampleExams = [];
        }
        topics.push({ id: doc.id, ...data });
      });
      return topics;
    } catch (error) {
      throw error;
    }
  }

  // Lấy chủ đề theo classId
  async getTopicsByClass(classId) {
    try {
      const q = query(
        collection(db, this.collectionName),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const topics = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.classId === classId) {
          topics.push({ id: doc.id, ...data });
        }
      });
      return topics;
    } catch (error) {
      throw error;
    }
  }

  // Lấy thông tin 1 chủ đề
  async getTopicById(topicId) {
    try {
      const docRef = doc(db, this.collectionName, topicId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Backward compatibility
        if (data.sampleExam && !data.sampleExams) {
          data.sampleExams = [];
        }
        return { id: docSnap.id, ...data };
      } else {
        throw new Error("Topic not found");
      }
    } catch (error) {
      throw error;
    }
  }

  // Cập nhật chủ đề
  async updateTopic(topicId, updateData) {
    try {
      const dataToUpdate = { ...updateData };
      
      const docRef = doc(db, this.collectionName, topicId);
      await updateDoc(docRef, {
        ...dataToUpdate,
        updatedAt: serverTimestamp()
      });
      return { id: topicId, ...updateData };
    } catch (error) {
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
      throw error;
    }
  }

  // ===== Sample Exam Management =====
  
  // Thêm đề mẫu vào chủ đề
  async addSampleExam(topicId, sampleExam) {
    try {
      const topic = await this.getTopicById(topicId);
      const sampleExams = topic.sampleExams || [];
      const newSampleExam = {
        id: `sample_${Date.now()}`,
        lessonName: sampleExam.lessonName || '',
        content: sampleExam.content || {},
        format: sampleExam.format || 'standard',
        uploadedAt: new Date()
      };
      
      sampleExams.push(newSampleExam);
      
      const docRef = doc(db, this.collectionName, topicId);
      await updateDoc(docRef, {
        sampleExams: sampleExams,
        updatedAt: serverTimestamp()
      });
      
      return newSampleExam;
    } catch (error) {
      throw error;
    }
  }

  // Xóa đề mẫu khỏi chủ đề
  async removeSampleExam(topicId, sampleExamId) {
    try {
      const topic = await this.getTopicById(topicId);
      const sampleExams = (topic.sampleExams || []).filter(s => s.id !== sampleExamId);
      
      const docRef = doc(db, this.collectionName, topicId);
      await updateDoc(docRef, {
        sampleExams: sampleExams,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Cập nhật đề mẫu
  async updateSampleExam(topicId, sampleExamId, updateData) {
    try {
      const topic = await this.getTopicById(topicId);
      const sampleExams = (topic.sampleExams || []).map(s => 
        s.id === sampleExamId ? { ...s, ...updateData } : s
      );
      
      const docRef = doc(db, this.collectionName, topicId);
      await updateDoc(docRef, {
        sampleExams: sampleExams,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Lấy tất cả đề mẫu của một chủ đề
  async getSampleExams(topicId) {
    try {
      const topic = await this.getTopicById(topicId);
      return topic.sampleExams || [];
    } catch (error) {
      throw error;
    }
  }

  // Tăng số lượng bài toán trong chủ đề
  async incrementExamCount(topicId) {
    try {
      const topic = await this.getTopicById(topicId);
      await this.updateTopic(topicId, {
        examCount: (topic.examCount || 0) + 1
      });
    } catch (error) {
      throw error;
    }
  }

  // Giảm số lượng bài toán trong chủ đề
  async decrementExamCount(topicId) {
    try {
      const topic = await this.getTopicById(topicId);
      await this.updateTopic(topicId, {
        examCount: Math.max((topic.examCount || 0) - 1, 0)
      });
    } catch (error) {
      throw error;
    }
  }
}

const topicServiceInstance = new TopicService();
export default topicServiceInstance;
