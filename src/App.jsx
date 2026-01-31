import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { signOutUser } from './services/authService';
import adminAuthService from './services/adminAuthService';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProblemSolverPage from './pages/ProblemSolverPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminPage from './pages/AdminPage';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard', 'solver', 'admin'
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Kiểm tra admin session
    setIsAdminAuthenticated(adminAuthService.isAuthenticated());

    return () => unsubscribe();
  }, []);

  // Kiểm tra nếu URL là /admin
  useEffect(() => {
    if (window.location.pathname === '/admin') {
      setCurrentPage('admin');
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentPage('dashboard');
      setSelectedProblem(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleAdminLogout = () => {
    adminAuthService.logout();
    setIsAdminAuthenticated(false);
    setCurrentPage('dashboard');
    window.history.pushState({}, '', '/');
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
  };

  const handleStartProblem = (problem) => {
    setSelectedProblem(problem);
    setCurrentPage('solver');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
    setSelectedProblem(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
        <p className="mt-4 text-gray-600 text-lg">Đang tải...</p>
      </div>
    );
  }

  // Admin route
  if (currentPage === 'admin') {
    if (!isAdminAuthenticated) {
      return <AdminLoginPage onLoginSuccess={handleAdminLoginSuccess} />;
    }
    return <AdminPage onLogout={handleAdminLogout} />;
  }

  // User routes
  if (!user) {
    return <LoginPage />;
  }

  if (currentPage === 'solver') {
    return (
      <ProblemSolverPage 
        user={user}
        problem={selectedProblem}
        onBack={handleBackToDashboard}
      />
    );
  }

  return (
    <DashboardPage 
      user={user}
      onStartProblem={handleStartProblem}
      onSignOut={handleSignOut}
    />
  );
}

export default App;
