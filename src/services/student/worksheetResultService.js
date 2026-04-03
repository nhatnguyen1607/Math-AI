import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { getEvaluationService } from './wooksheetEvaluationRouter';

// Tạo kết quả phiếu bài tập
export const createWorksheetResult = async (resultData, worksheet) => {
  try {
    const resultId = `${resultData.studentId}_${resultData.classId}_${resultData.worksheetId}`;

    // Gọi API để đánh giá bài làm - sử dụng router để phân hóa phiếu
    const evaluationService = getEvaluationService(worksheet);
    const evaluation = await evaluationService.evaluateWorksheet(
      resultData,
      worksheet
    );

    // Merge evaluation vào result
    const finalResult = {
      ...resultData,
      bai_1: {
        ...resultData.bai_1,
        evaluation: evaluation.bai_1?.evaluation || {}
      },
      bai_2: {
        ...resultData.bai_2,
        evaluation: evaluation.bai_2?.evaluation || {}
      },
      bai_3: {
        ...resultData.bai_3,
        evaluation: evaluation.bai_3?.evaluation || {}
      },
      bai_4: {
        ...resultData.bai_4,
        evaluation: evaluation.bai_4?.evaluation || {}
      },
      tongDiem: evaluation.tongDiem || 0,
      mucNangLucChung: evaluation.mucNangLucChung || '',
      nhanXetChung: evaluation.nhanXetChung || '',
      evaluatedAt: serverTimestamp(),
      submittedAt: resultData.submittedAt || serverTimestamp()
    };

    await addDoc(collection(db, 'worksheet_results'), {
      id: resultId,
      ...finalResult
    });

    return resultId;
  } catch (error) {
    console.error('Error creating worksheet result:', error);
    throw error;
  }
};

// Lấy kết quả phiếu bài tập
export const getWorksheetResult = async (resultId) => {
  try {
    const q = query(
      collection(db, 'worksheet_results'),
      where('id', '==', resultId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null; // Return null instead of throwing error - result simply doesn't exist yet
    }

    return snapshot.docs[0].data();
  } catch (error) {
    console.error('Error getting worksheet result:', error);
    throw error;
  }
};

// Lấy tất cả kết quả của học sinh
export const getStudentWorksheetResults = async (studentId, classId) => {
  try {
    const q = query(
      collection(db, 'worksheet_results'),
      where('studentId', '==', studentId),
      where('classId', '==', classId),
      orderBy('submittedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const results = [];

    snapshot.forEach((doc) => {
      results.push(doc.data());
    });

    return results;
  } catch (error) {
    console.error('Error getting student results:', error);
    throw error;
  }
};

// Lấy kết quả của 1 phiếu bài tập
export const getWorksheetResultsByWorksheet = async (worksheetId, classId) => {
  try {
    const conditions = [
      where('worksheetId', '==', worksheetId),
      orderBy('submittedAt', 'desc')
    ];

    // Only add classId filter if it's provided
    if (classId) {
      conditions.splice(1, 0, where('classId', '==', classId));
    }

    const q = query(
      collection(db, 'worksheet_results'),
      ...conditions
    );

    const snapshot = await getDocs(q);
    const results = [];

    snapshot.forEach((doc) => {
      results.push(doc.data());
    });

    return results;
  } catch (error) {
    console.error('Error getting worksheet results:', error);
    throw error;
  }
};

// Cập nhật kết quả phiếu bài tập
export const updateWorksheetResult = async (resultId, updates) => {
  try {
    const q = query(
      collection(db, 'worksheet_results'),
      where('id', '==', resultId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error('Result not found');
    }

    await updateDoc(snapshot.docs[0].ref, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error updating worksheet result:', error);
    throw error;
  }
};

// Xóa kết quả phiếu bài tập
export const deleteWorksheetResult = async (resultId) => {
  try {
    const q = query(
      collection(db, 'worksheet_results'),
      where('id', '==', resultId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error('Result not found');
    }

    await deleteDoc(snapshot.docs[0].ref);
    return true;
  } catch (error) {
    console.error('Error deleting worksheet result:', error);
    throw error;
  }
};
