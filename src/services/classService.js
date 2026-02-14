/**
 * Class Service
 * Quản lý lớp học
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
  deleteDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from '../firebase';

class ClassService {
  /**
   * Tạo mã join 6 chữ số ngẫu nhiên
   */
  generateJoinId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Kiểm tra joinId đã tồn tại hay chưa
   */
  async checkJoinIdExists(joinId) {
    try {
      const q = query(
        collection(db, 'classes'),
        where('joinId', '==', joinId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.length > 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo mã join duy nhất
   */
  async generateUniqueJoinId() {
    let joinId;
    let exists = true;
    
    while (exists) {
      joinId = this.generateJoinId();
      exists = await this.checkJoinIdExists(joinId);
    }
    
    return joinId;
  }

  /**
   * Tạo lớp học mới
   */
  async createClass(data) {
    try {
      // Tạo joinId duy nhất
      const joinId = await this.generateUniqueJoinId();
      
      const classesRef = collection(db, 'classes');
      const docRef = await addDoc(classesRef, {
        ...data,
        joinId, // Thêm joinId
        createdAt: new Date(),
        updatedAt: new Date(),
        students: [],
        topicsAndExams: {} // { topicId: { exams: [...] } }
      });
      return { id: docRef.id, joinId, ...data };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách tất cả lớp học
   */
  async getAllClasses() {
    try {
      const snapshot = await getDocs(collection(db, 'classes'));
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách lớp của giáo viên
   */
  async getClassesByFaculty(facultyId) {
    try {
      const q = query(
        collection(db, 'classes'),
        where('facultyId', '==', facultyId)
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
   * Lấy chi tiết lớp
   */
  async getClassById(classId) {
    try {
      const docRef = doc(db, 'classes', classId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy lớp bằng joinId
   */
  async getClassByJoinId(joinId) {
    try {
      const q = query(
        collection(db, 'classes'),
        where('joinId', '==', joinId)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.docs.length > 0) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật lớp
   */
  async updateClass(classId, data) {
    try {
      const classRef = doc(db, 'classes', classId);
      await updateDoc(classRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa lớp
   */
  async deleteClass(classId) {
    try {
      const classRef = doc(db, 'classes', classId);
      await deleteDoc(classRef);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Thêm học sinh vào lớp
   */
  async addStudentToClass(classId, studentId) {
    try {
      const classRef = doc(db, 'classes', classId);
      await updateDoc(classRef, {
        students: arrayUnion(studentId),
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa học sinh khỏi lớp
   */
  async removeStudentFromClass(classId, studentId) {
    try {
      const classRef = doc(db, 'classes', classId);
      await updateDoc(classRef, {
        students: arrayRemove(studentId),
        updatedAt: new Date()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách lớp của học sinh
   */
  async getClassesByStudent(studentId) {
    try {
      const q = query(
        collection(db, 'classes'),
        where('students', 'array-contains', studentId)
      );
      const snapshot = await getDocs(q);
      const result = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return result;
    } catch (error) {
      throw error;
    }
  }
}

const instance = new ClassService();
export default instance;
