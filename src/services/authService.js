import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

// Cấu hình Google Provider với các scopes cần thiết
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account'
});

// Đăng nhập bằng Google
export const signInWithGoogle = async () => {
  try {
    console.log("Bắt đầu đăng nhập với Google...");
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("Đăng nhập thành công:", user.email);

    // Lưu thông tin user vào Firestore
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.log("Tạo user mới trong Firestore...");
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          totalProblems: 0,
          completedProblems: 0
        });
      }
    } catch (firestoreError) {
      console.error("Lỗi khi lưu vào Firestore:", firestoreError);
      // Không throw error để user vẫn đăng nhập được
    }

    return user;
  } catch (error) {
    console.error("Chi tiết lỗi đăng nhập:", error.code, error.message);
    
    // Xử lý các lỗi cụ thể
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup bị chặn. Vui lòng cho phép popup và thử lại.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Bạn đã đóng cửa sổ đăng nhập.');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Domain chưa được cấu hình trong Firebase. Vui lòng thêm localhost vào Authorized domains.');
    } else if (error.code === 'auth/configuration-not-found') {
      throw new Error('Firebase chưa được cấu hình đúng.');
    }
    
    throw error;
  }
};

// Đăng xuất
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export const signOutUser = signOut; // Alias để tương thích

// Theo dõi trạng thái đăng nhập
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Lấy thông tin user từ Firestore
export const getUserData = async (uid) => {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting user data:", error);
    throw error;
  }
};
