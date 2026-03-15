import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc, 
  getDoc,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import { Worksheet } from "../models";

// Tạo phiếu bài tập mới
export const createWorksheet = async (classId, userId, worksheetData) => {
  try {
    const worksheet = new Worksheet({
      ...worksheetData,
      classId,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const worksheetRef = await addDoc(collection(db, "worksheets"), worksheet.toJSON());
    return { id: worksheetRef.id, ...worksheet.toJSON() };
  } catch (error) {
    console.error('Error creating worksheet:', error);
    throw error;
  }
};

// Lấy phiếu bài tập theo ID
export const getWorksheetById = async (worksheetId) => {
  try {
    const worksheetRef = doc(db, "worksheets", worksheetId);
    const worksheetSnap = await getDoc(worksheetRef);
    
    if (worksheetSnap.exists()) {
      return { id: worksheetSnap.id, ...worksheetSnap.data() };
    } else {
      throw new Error('Worksheet not found');
    }
  } catch (error) {
    console.error('Error getting worksheet:', error);
    throw error;
  }
};

// Lấy tất cả phiếu bài tập theo lớp
export const getWorksheetsByClass = async (classId) => {
  try {
    const q = query(
      collection(db, "worksheets"),
      where("classId", "==", classId),
      orderBy("createdAt", "desc")
    );
    
    const worksheetSnap = await getDocs(q);
    const worksheets = [];
    
    worksheetSnap.forEach((doc) => {
      worksheets.push({ id: doc.id, ...doc.data() });
    });
    
    return worksheets;
  } catch (error) {
    console.error('Error getting worksheets:', error);
    throw error;
  }
};

// Lấy phiếu bài tập theo loại (input/output) và lớp
export const getWorksheetsByClassAndType = async (classId, type) => {
  try {
    const q = query(
      collection(db, "worksheets"),
      where("classId", "==", classId),
      where("type", "==", type),
      orderBy("createdAt", "desc")
    );
    
    const worksheetSnap = await getDocs(q);
    const worksheets = [];
    
    worksheetSnap.forEach((doc) => {
      worksheets.push({ id: doc.id, ...doc.data() });
    });
    
    return worksheets;
  } catch (error) {
    console.error('Error getting worksheets by type:', error);
    throw error;
  }
};

// Cập nhật phiếu bài tập
export const updateWorksheet = async (worksheetId, worksheetData) => {
  try {
    const worksheetRef = doc(db, "worksheets", worksheetId);
    
    const updateData = {
      ...worksheetData,
      updatedAt: new Date()
    };
    
    await updateDoc(worksheetRef, updateData);
    return { id: worksheetId, ...updateData };
  } catch (error) {
    console.error('Error updating worksheet:', error);
    throw error;
  }
};

// Xóa phiếu bài tập
export const deleteWorksheet = async (worksheetId) => {
  try {
    await deleteDoc(doc(db, "worksheets", worksheetId));
    return true;
  } catch (error) {
    console.error('Error deleting worksheet:', error);
    throw error;
  }
};

// Thêm câu hỏi vào Bài 1
export const addBai1Question = async (worksheetId, questionText) => {
  try {
    const worksheet = await getWorksheetById(worksheetId);
    const question = {
      id: `q_${Date.now()}_${Math.random()}`,
      text: questionText
    };
    
    worksheet.bai_1.questions.push(question);
    await updateWorksheet(worksheetId, worksheet);
    
    return question;
  } catch (error) {
    console.error('Error adding Bai 1 question:', error);
    throw error;
  }
};

// Xóa câu hỏi từ Bài 1
export const removeBai1Question = async (worksheetId, questionId) => {
  try {
    const worksheet = await getWorksheetById(worksheetId);
    worksheet.bai_1.questions = worksheet.bai_1.questions.filter(q => q.id !== questionId);
    await updateWorksheet(worksheetId, worksheet);
    return true;
  } catch (error) {
    console.error('Error removing Bai 1 question:', error);
    throw error;
  }
};

// Thêm câu hỏi vào Bài 2
export const addBai2Question = async (worksheetId, questionText) => {
  try {
    const worksheet = await getWorksheetById(worksheetId);
    const question = {
      id: `q_${Date.now()}_${Math.random()}`,
      text: questionText
    };
    
    worksheet.bai_2.questions.push(question);
    await updateWorksheet(worksheetId, worksheet);
    
    return question;
  } catch (error) {
    console.error('Error adding Bai 2 question:', error);
    throw error;
  }
};

// Xóa câu hỏi từ Bài 2
export const removeBai2Question = async (worksheetId, questionId) => {
  try {
    const worksheet = await getWorksheetById(worksheetId);
    worksheet.bai_2.questions = worksheet.bai_2.questions.filter(q => q.id !== questionId);
    await updateWorksheet(worksheetId, worksheet);
    return true;
  } catch (error) {
    console.error('Error removing Bai 2 question:', error);
    throw error;
  }
};

// Cập nhật số cách giải Bài 2
export const updateBai2Solutions = async (worksheetId, soSolutions) => {
  try {
    const worksheet = await getWorksheetById(worksheetId);
    worksheet.bai_2.so_cach_giai = soSolutions;
    await updateWorksheet(worksheetId, worksheet);
    return true;
  } catch (error) {
    console.error('Error updating Bai 2 solutions:', error);
    throw error;
  }
};

// Thêm câu hỏi vào Bài 4
export const addBai4Question = async (worksheetId, questionText) => {
  try {
    const worksheet = await getWorksheetById(worksheetId);
    const questionIndex = worksheet.bai_4.questions.length;
    const label = String.fromCharCode(97 + questionIndex); // a, b, c, ...
    
    const question = {
      id: `q_${Date.now()}_${Math.random()}`,
      text: questionText,
      label: label,
      type: null,
      content: null
    };
    
    worksheet.bai_4.questions.push(question);
    await updateWorksheet(worksheetId, worksheet);
    
    return question;
  } catch (error) {
    console.error('Error adding Bai 4 question:', error);
    throw error;
  }
};

// Xóa câu hỏi từ Bài 4
export const removeBai4Question = async (worksheetId, questionId) => {
  try {
    const worksheet = await getWorksheetById(worksheetId);
    worksheet.bai_4.questions = worksheet.bai_4.questions.filter(q => q.id !== questionId);
    await updateWorksheet(worksheetId, worksheet);
    return true;
  } catch (error) {
    console.error('Error removing Bai 4 question:', error);
    throw error;
  }
};

// Cập nhật loại câu hỏi Bài 4 (thêm so_cach_giai hoặc cau_hoi_nho)
export const updateBai4QuestionType = async (worksheetId, questionId, type, content) => {
  try {
    const worksheet = await getWorksheetById(worksheetId);
    const question = worksheet.bai_4.questions.find(q => q.id === questionId);
    
    if (question) {
      question.type = type; // 'so_cach_giai' or 'cau_hoi_nho'
      question.content = content;
      await updateWorksheet(worksheetId, worksheet);
      return question;
    } else {
      throw new Error('Question not found');
    }
  } catch (error) {
    console.error('Error updating Bai 4 question type:', error);
    throw error;
  }
};
