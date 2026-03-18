import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOutUser, getUserData } from './services/authService';
import adminAuthService from './services/admin/adminAuthService';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminPage from './pages/admin/AdminPage';
import AdminTopicPage from './pages/admin/AdminTopicPage';
import AdminWorksheetPage from './pages/admin/AdminWorksheetPage';
import AdminWorksheetEditorPage from './pages/admin/AdminWorksheetEditorPage';
import StudentDashboardPage from './pages/student/StudentDashboardPage';
// import StudentTopicPage from './pages/student/StudentTopicPage';
import StudentLearningPathwayPage from './pages/student/StudentLearningPathwayPage';
import StudentExamLobbyPage from './pages/student/StudentExamLobbyPage';
import StudentExamPage from './pages/student/StudentExamPage';
import StudentExamResultPage from './pages/student/StudentExamResultPage';
import StudentPracticePage from './pages/student/StudentPracticePage';
import StudentVanDungPage from './pages/student/StudentVanDungPage';
import FacultyPage from './pages/faculty/FacultyPage';
import FacultyLearningPathwayPage from './pages/faculty/FacultyLearningPathwayPage';
import FacultyTopicManagementPage from './pages/faculty/FacultyTopicManagementPage';
import FacultyExamManagementPage from './pages/faculty/FacultyExamManagementPage';
import FacultyExamLobbyPage from './pages/faculty/FacultyExamLobbyPage';
import FacultyExamLiveSessionPage from './pages/faculty/FacultyExamLiveSessionPage';
import FacultyExamResultsListPage from './pages/faculty/FacultyExamResultsListPage';
import FacultyStudentExamResultPage from './pages/faculty/FacultyStudentExamResultPage';
import FacultyWorksheetEditorPage from './pages/faculty/FacultyWorksheetEditorPage';
import FacultyWorksheetManagementPage from './pages/faculty/FacultyWorksheetManagementPage';
import FacultyWorksheetResultListPage from './pages/faculty/FacultyWorksheetResultListPage';
import FacultyWorksheetResultPage from './pages/faculty/FacultyWorksheetResultPage';
import StudentWorksheetSelectionPage from './pages/student/StudentWorksheetSelectionPage';
import StudentWorksheetPage from './pages/student/StudentWorksheetPage';
import StudentWorksheetResultPage from './pages/student/StudentWorksheetResultPage';
import TestRobotPage from './pages/TestRobotPage';

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [lockError, setLockError] = useState(null);

  useEffect(() => {
    // 1. CHECK LOCALSTORAGE FIRST (for Custom Phone/Username + Password Auth)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Create a mock user object compatible with Firebase user structure
        setUser({
          uid: parsedUser.uid,
          email: parsedUser.email,
          displayName: parsedUser.displayName,
          authMethod: 'custom'
        });
        
        // For custom auth, create userData object from localStorage
        const customUserData = {
          id: parsedUser.uid,
          email: parsedUser.email,
          displayName: parsedUser.displayName,
          username: parsedUser.username,
          role: parsedUser.role || 'student',
          authMethod: 'custom',
          isFaculty: () => (parsedUser.role === 'faculty'),
          isLocked: false
        };
        setUserData(customUserData);
        setLoading(false);
        return; // Exit early - no need to check Firebase Auth
      } catch (err) {
        console.warn('Invalid localStorage user data:', err);
        localStorage.removeItem('user'); // Clear corrupted data
      }
    }

    // 2. FALLBACK TO FIREBASE AUTH (for Google Sign-in)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Kiểm tra tài khoản bị khóa
        try {
          const data = await getUserData(currentUser.uid);
          setUserData(data);
          
          if (data && data.isLocked) {
            setLockError('Tài khoản của bạn đã bị khóa');
            await signOutUser();
            setUser(null);
            setUserData(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
      
      setLoading(false);
    });

    // Kiểm tra admin session
    setIsAdminAuthenticated(adminAuthService.isAuthenticated());

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      // Clear localStorage (for custom auth)
      localStorage.removeItem('user');
      
      // Sign out from Firebase (for Google auth)
      await signOutUser();
      
      // Reset state
      setUser(null);
      setUserData(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleAdminLogout = () => {
    adminAuthService.logout();
    setIsAdminAuthenticated(false);
    setUser(null);
    window.history.pushState({}, '', '/');
  };

  const handleAdminLoginSuccess = () => {
    // Tạo user object cho admin
    const adminSession = adminAuthService.getAdminSession();
    if (adminSession && adminSession.uid) {
      setUser({
        uid: adminSession.uid,
        email: adminSession.username + '@admin.local',
        displayName: 'Admin'
      });
    }
    setIsAdminAuthenticated(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="glass-panel w-full max-w-sm p-6 text-center shadow-soft sm:p-8">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-4 border-t-4 border-indigo-500 sm:h-14 sm:w-14"></div>
          <p className="mt-4 text-base font-semibold text-slate-700 sm:text-lg">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Hiển thị thông báo khóa tài khoản
  if (lockError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-rose-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-soft-md sm:p-8">
          <p className="mb-3 text-3xl sm:text-4xl">🔒</p>
          <h2 className="mb-2 text-xl font-bold text-rose-700 sm:text-2xl">Tài khoản bị khóa</h2>
          <p className="mb-5 text-sm text-slate-600 sm:text-base">{lockError}</p>
          <p className="text-xs text-slate-500 sm:text-sm">Vui lòng liên hệ với quản trị viên để được mở khóa</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Admin routes */}
        <Route path="/admin" element={!isAdminAuthenticated ? <AdminLoginPage onLoginSuccess={handleAdminLoginSuccess} /> : <AdminPage onLogout={handleAdminLogout} />} />
        <Route path="/admin/topic-management" element={!isAdminAuthenticated ? <AdminLoginPage onLoginSuccess={handleAdminLoginSuccess} /> : <AdminTopicPage onLogout={handleAdminLogout} />} />
        <Route path="/admin/worksheet" element={!isAdminAuthenticated ? <AdminLoginPage onLoginSuccess={handleAdminLoginSuccess} /> : <AdminWorksheetPage user={user} onLogout={handleAdminLogout} />} />
        <Route path="/admin/worksheet/editor" element={!isAdminAuthenticated ? <AdminLoginPage onLoginSuccess={handleAdminLoginSuccess} /> : <AdminWorksheetEditorPage user={user} onLogout={handleAdminLogout} />} />
        
        {/* Login route */}
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={userData?.isFaculty?.() === true ? '/faculty' : '/student'} replace />} />
        {/* Test robot page */}
        <Route path="/test-robot" element={<TestRobotPage />} />
        
        {/* Faculty routes */}
        <Route path="/faculty" element={userData && userData.isFaculty() ? <FacultyPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/learning-pathway/:mode" element={userData && userData.isFaculty() ? <FacultyLearningPathwayPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/topic-management" element={userData && userData.isFaculty() ? <FacultyTopicManagementPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/exam-management" element={userData && userData.isFaculty() ? <FacultyExamManagementPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/exam-lobby/:sessionId" element={userData && userData.isFaculty() ? <FacultyExamLobbyPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/exam-live/:sessionId" element={userData && userData.isFaculty() ? <FacultyExamLiveSessionPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/exam-results/:examId" element={userData && userData.isFaculty() ? <FacultyExamResultsListPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/student-exam-result/:examId/:userId" element={userData && userData.isFaculty() ? <FacultyStudentExamResultPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/worksheet/management" element={userData && userData.isFaculty() ? <FacultyWorksheetManagementPage user={user} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/worksheet/editor" element={userData && userData.isFaculty() ? <FacultyWorksheetEditorPage user={user} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/worksheet/:worksheetId/results" element={userData && userData.isFaculty() ? <FacultyWorksheetResultListPage user={user} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/worksheet/:worksheetId/result/:studentId" element={userData && userData.isFaculty() ? <FacultyWorksheetResultPage user={user} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        
        {/* Student routes */}
        <Route path="/student" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/pathways" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/pathway/:pathway" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/pathway/:pathway/:topicId" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/pathway/:pathway/:topicId/exams" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/learning-pathway/:mode" element={user && (!userData || !userData.isFaculty()) ? <StudentLearningPathwayPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        {/* <Route path="/student/topic-management/:learningPathway/:mode" element={user && (!userData || !userData.isFaculty()) ? <StudentTopicPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} /> */}
        <Route path="/student/:classId/topic-management" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/topic-management/:topicId" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/exam-management" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/exam-lobby/:examId" element={user && (!userData || !userData.isFaculty()) ? <StudentExamLobbyPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/exam/:sessionId" element={user && (!userData || !userData.isFaculty()) ? <StudentExamPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/exam-result/:sessionId" element={user && (!userData || !userData.isFaculty()) ? <StudentExamResultPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/practice/:examId" element={user && (!userData || !userData.isFaculty()) ? <StudentPracticePage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/van-dung/:examId" element={user && (!userData || !userData.isFaculty()) ? <StudentVanDungPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/worksheets" element={user && (!userData || !userData.isFaculty()) ? <StudentWorksheetSelectionPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/worksheet/:worksheetId" element={user && (!userData || !userData.isFaculty()) ? <StudentWorksheetPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/worksheet/:worksheetId/result/:resultId" element={user && (!userData || !userData.isFaculty()) ? <StudentWorksheetResultPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        
        {/* Default route */}
        <Route path="/" element={user ? (userData?.isFaculty?.() === true ? <Navigate to="/faculty" replace /> : <Navigate to="/student" replace />) : <Navigate to="/login" replace />} />
        
        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
