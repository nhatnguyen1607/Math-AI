import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { User } from "../models";

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

    // Kiểm tra tài khoản bị khóa
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.isLocked) {
          // Logout user nếu tài khoản bị khóa
          await firebaseSignOut(auth);
          throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ với quản trị viên');
        }
      }
    } catch (lockCheckError) {
      if (lockCheckError.message.includes('đã bị khóa')) {
        throw lockCheckError;
      }
      console.error("Lỗi khi kiểm tra tài khoản:", lockCheckError);
    }

    // Lưu thông tin user vào Firestore
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.log("Tạo user mới trong Firestore...");
        const newUser = new User({
          id: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: 'student', // Mặc định là student
          isActive: true,
          isLocked: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await setDoc(userRef, newUser.toJSON());
      } else {
        // Cập nhật updatedAt mỗi lần đăng nhập
        const existingData = userSnap.data();
        const updateData = {
          updatedAt: new Date()
        };
        
        // Update displayName nếu chưa có
        if (!existingData.displayName && user.displayName) {
          updateData.displayName = user.displayName;
        }
        
        await updateDoc(userRef, updateData);
      }
    } catch (firestoreError) {
      console.error("Lỗi khi lưu vào Firestore:", firestoreError);
      // Không throw error để user vẫn đăng nhập được
    }

    return user;
  } catch (error) {
    console.error("Chi tiết lỗi đăng nhập:", error.code, error.message);
    
    // Xử lý các lỗi cụ thể
    if (error.message && error.message.includes('đã bị khóa')) {
      throw error;
    } else if (error.code === 'auth/popup-blocked') {
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
      return User.fromFirestore(userSnap.data(), userSnap.id);
    }
    return null;
  } catch (error) {
    console.error("Error getting user data:", error);
    throw error;
  }
};

// Kiểm tra quyền - có phải admin không
export const isAdmin = async (uid) => {
  const user = await getUserData(uid);
  return user && user.isAdmin && user.isActive && !user.isLocked;
};

// Kiểm tra quyền - có phải faculty không
export const isFaculty = async (uid) => {
  const user = await getUserData(uid);
  return user && user.isFaculty() && user.isActive && !user.isLocked;
};

// Kiểm tra quyền - có phải student không
export const isStudent = async (uid) => {
  const user = await getUserData(uid);
  return user && user.isStudent() && user.isActive && !user.isLocked;
};

// Kiểm tra user bị khóa hay không
export const isUserLocked = async (uid) => {
  const user = await getUserData(uid);
  return user && user.isLocked;
};

// Lấy role của user
export const getUserRole = async (uid) => {
  const user = await getUserData(uid);
  return user ? user.role : null;
};

// Default export with object API for compatibility
const authService = {
  signInWithGoogle,
  signOut,
  signOutUser,
  onAuthChange,
  getUserData,
  isAdmin,
  isFaculty,
  isStudent,
  isUserLocked,
  getUserRole,
  getCurrentUser: async () => {
    // Get current user from Firebase auth
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        unsubscribe();
        if (currentUser) {
          try {
            const userData = await getUserData(currentUser.uid);
            resolve(userData);
          } catch (error) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }
};

export default authService;
