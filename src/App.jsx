import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOutUser, getUserData } from './services/authService';
import adminAuthService from './services/admin/adminAuthService';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminPage from './pages/admin/AdminPage';
import StudentDashboardPage from './pages/student/StudentDashboardPage';
import StudentExamLobbyPage from './pages/student/StudentExamLobbyPage';
import StudentExamPage from './pages/student/StudentExamPage';
import StudentExamResultPage from './pages/student/StudentExamResultPage';
import StudentPracticePage from './pages/student/StudentPracticePage';
import FacultyPage from './pages/faculty/FacultyPage';
import FacultyTopicManagementPage from './pages/faculty/FacultyTopicManagementPage';
import FacultyExamManagementPage from './pages/faculty/FacultyExamManagementPage';
import FacultyExamLobbyPage from './pages/faculty/FacultyExamLobbyPage';
import FacultyExamLiveSessionPage from './pages/faculty/FacultyExamLiveSessionPage';
import FacultyExamResultsListPage from './pages/faculty/FacultyExamResultsListPage';
import FacultyStudentExamResultPage from './pages/faculty/FacultyStudentExamResultPage';

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [lockError, setLockError] = useState(null);

  useEffect(() => {
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
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleAdminLogout = () => {
    adminAuthService.logout();
    setIsAdminAuthenticated(false);
    window.history.pushState({}, '', '/');
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
        <p className="mt-4 text-gray-600 text-lg">Đang tải...</p>
      </div>
    );
  }

  // Hiển thị thông báo khóa tài khoản
  if (lockError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-3xl mb-4">🔒</p>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Tài khoản bị khóa</h2>
          <p className="text-gray-600 mb-6">{lockError}</p>
          <p className="text-sm text-gray-500">Vui lòng liên hệ với quản trị viên để được mở khóa</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin routes */}
        <Route path="/admin" element={!isAdminAuthenticated ? <AdminLoginPage onLoginSuccess={handleAdminLoginSuccess} /> : <AdminPage onLogout={handleAdminLogout} />} />
        
        {/* Login route */}
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={userData && userData.isFaculty() ? '/faculty' : '/student'} replace />} />
        
        {/* Faculty routes */}
        <Route path="/faculty" element={userData && userData.isFaculty() ? <FacultyPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/topic-management" element={userData && userData.isFaculty() ? <FacultyTopicManagementPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/exam-management" element={userData && userData.isFaculty() ? <FacultyExamManagementPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/exam-lobby/:sessionId" element={userData && userData.isFaculty() ? <FacultyExamLobbyPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/exam-live/:sessionId" element={userData && userData.isFaculty() ? <FacultyExamLiveSessionPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/exam-results/:examId" element={userData && userData.isFaculty() ? <FacultyExamResultsListPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        <Route path="/faculty/student-exam-result/:examId/:userId" element={userData && userData.isFaculty() ? <FacultyStudentExamResultPage user={user} userData={userData} onSignOut={handleSignOut} /> : user ? <Navigate to="/student" replace /> : <Navigate to="/login" replace />} />
        
        {/* Student routes */}
        <Route path="/student" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/topic-management" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/topic-management/:topicId" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId/exam-management" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/:classId" element={user && (!userData || !userData.isFaculty()) ? <StudentDashboardPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/exam-lobby/:examId" element={user && (!userData || !userData.isFaculty()) ? <StudentExamLobbyPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/exam/:sessionId" element={user && (!userData || !userData.isFaculty()) ? <StudentExamPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/exam-result/:sessionId" element={user && (!userData || !userData.isFaculty()) ? <StudentExamResultPage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        <Route path="/student/practice/:examId" element={user && (!userData || !userData.isFaculty()) ? <StudentPracticePage user={user} onSignOut={handleSignOut} /> : user && userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/login" replace />} />
        
        {/* Default route */}
        <Route path="/" element={user ? (userData && userData.isFaculty() ? <Navigate to="/faculty" replace /> : <Navigate to="/student" replace />) : <Navigate to="/login" replace />} />
        
        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
