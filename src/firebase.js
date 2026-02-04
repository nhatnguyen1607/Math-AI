import { initializeApp } from "firebase/app";
import { getFirestore, doc, collection, setDoc, updateDoc, deleteDoc, getDoc, query, where, orderBy, getDocs, onSnapshot, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Cấu hình từ Firebase Console
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Xuất các dịch vụ để sử dụng
export const db = getFirestore(app);
export const auth = getAuth(app);

// Xuất các Firestore functions
export { doc, collection, setDoc, updateDoc, deleteDoc, getDoc, query, where, orderBy, getDocs, onSnapshot, serverTimestamp };

export default app;
