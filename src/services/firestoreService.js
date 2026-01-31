import { 
  collection, 
  addDoc, 
  updateDoc,
  doc, 
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebase";

// Tạo bài toán mới
export const createProblemSession = async (userId, problemText) => {
  try {
    const sessionRef = await addDoc(collection(db, "problemSessions"), {
      userId,
      problemText,
      currentStep: 1,
      status: "in_progress", // in_progress, completed
      startedAt: serverTimestamp(),
      stepEvaluations: {
        step1: null,
        step2: null,
        step3: null,
        step4: null
      },
      chatHistory: []
    });

    return sessionRef.id;
  } catch (error) {
    console.error("Error creating problem session:", error);
    throw error;
  }
};

// Cập nhật session
export const updateProblemSession = async (sessionId, data) => {
  try {
    const sessionRef = doc(db, "problemSessions", sessionId);
    await updateDoc(sessionRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating problem session:", error);
    throw error;
  }
};

// Lưu tin nhắn vào chat history
export const saveChatMessage = async (sessionId, message, isStudent) => {
  try {
    const sessionRef = doc(db, "problemSessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (sessionSnap.exists()) {
      const currentHistory = sessionSnap.data().chatHistory || [];
      const newMessage = {
        text: message,
        isStudent,
        timestamp: new Date().toISOString(),
        step: sessionSnap.data().currentStep
      };
      
      await updateDoc(sessionRef, {
        chatHistory: [...currentHistory, newMessage],
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Error saving chat message:", error);
    throw error;
  }
};

// Lấy thông tin session
export const getProblemSession = async (sessionId) => {
  try {
    const sessionRef = doc(db, "problemSessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (sessionSnap.exists()) {
      return { id: sessionSnap.id, ...sessionSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting problem session:", error);
    throw error;
  }
};

// Lấy lịch sử bài toán của user
export const getUserProblemHistory = async (userId, limit = 10) => {
  try {
    // Query đơn giản hơn, không cần index
    const q = query(
      collection(db, "problemSessions"),
      where("userId", "==", userId)
    );
    
    const querySnapshot = await getDocs(q);
    const sessions = [];
    
    querySnapshot.forEach((doc) => {
      sessions.push({ id: doc.id, ...doc.data() });
    });
    
    // Sắp xếp ở client side để tránh cần index
    sessions.sort((a, b) => {
      const timeA = a.startedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const timeB = b.startedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return timeB - timeA; // Mới nhất lên đầu
    });
    
    return sessions.slice(0, limit);
  } catch (error) {
    console.error("Error getting user problem history:", error);
    // Trả về mảng rỗng thay vì throw error để app vẫn chạy được
    return [];
  }
};

// Hoàn thành session
export const completeProblemSession = async (sessionId, stepEvaluations) => {
  try {
    const sessionRef = doc(db, "problemSessions", sessionId);
    await updateDoc(sessionRef, {
      status: "completed",
      completedAt: serverTimestamp(),
      stepEvaluations,
      updatedAt: serverTimestamp()
    });

    // Cập nhật thống kê user
    const sessionSnap = await getDoc(sessionRef);
    if (sessionSnap.exists()) {
      const userId = sessionSnap.data().userId;
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const currentCompleted = userSnap.data().completedProblems || 0;
        await updateDoc(userRef, {
          completedProblems: currentCompleted + 1
        });
      }
    }
  } catch (error) {
    console.error("Error completing problem session:", error);
    throw error;
  }
};

// Lưu phiên làm bài (alias)
export const saveProblemSession = async (userId, sessionData) => {
  try {
    const sessionRef = await addDoc(collection(db, "problemSessions"), {
      userId,
      problemText: sessionData.problemText,
      messages: sessionData.messages,
      evaluations: sessionData.evaluations,
      status: "completed",
      completedAt: sessionData.completedAt || serverTimestamp(),
      createdAt: serverTimestamp()
    });

    // Cập nhật số bài đã làm
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const currentCompleted = userSnap.data().completedProblems || 0;
      await updateDoc(userRef, {
        completedProblems: currentCompleted + 1
      });
    }

    return sessionRef.id;
  } catch (error) {
    console.error("Error saving problem session:", error);
    throw error;
  }
};
