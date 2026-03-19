import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import studentService from "../../services/student/studentService";
import classService from "../../services/faculty/classService";

import StudentClassSelectionPage from "./StudentClassSelectionPage";
import StudentHeader from "../../components/student/StudentHeader";
import StudentTopicSelectionPage from "./StudentTopicSelectionPage";
import StudentExamSelectionPage from "./StudentExamSelectionPage";
import StudentLearningPathwayPage from "./StudentLearningPathwayPage";

const StudentDashboardPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { classId, topicId } = useParams();
  const location = window.location.pathname;
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [studentClasses, setStudentClasses] = useState([]);

  // Determine current view from URL path
  const currentView = location.includes("/pathways")
    ? "pathway-selection"
    : location.includes("/pathway/") && location.includes("/exams")
    ? "exam-selection"
    : location.includes("/pathway/")
    ? "topic-selection"
    : null;

  // Load student's joined classes when user is available
  useEffect(() => {
    const loadStudentClasses = async () => {
      if (!user?.uid) {
        return;
      }

      try {
        const classes = await classService.getClassesByStudent(user.uid);
        setStudentClasses(classes || []);
      } catch (error) {}
    };

    loadStudentClasses();
  }, [user?.uid]);

  const loadClassData = useCallback(
    async (userId) => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const [topicsData, statsData, examsData] = await Promise.all([
          studentService.getAvailableTopics(selectedClass?.id, "startup"),
          studentService.getStudentStats(userId),
          studentService.getAvailableExams(selectedClass?.id, "startup"),
        ]);
        setTopics(topicsData || []);
        const validExams = (examsData || []).filter((exam) => {
          return exam?.status?.toLowerCase() !== "draft";
        });
        setExams(validExams);

        setUserStats(statsData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [selectedClass],
  );

  useEffect(() => {
    if (selectedClass && user?.uid) {
      setLoading(true);
      loadClassData(user.uid);
    } else {
      setLoading(false);
    }
  }, [selectedClass, user, loadClassData]);

  // Load class data when classId URL param changes
  useEffect(() => {
    if (classId && studentClasses.length > 0) {
      // Load class from studentClasses list
      const cls = studentClasses.find((c) => c.id === classId);
      if (cls) {
        setSelectedClass(cls);
      }
    }
  }, [classId, studentClasses]);

  // Set first class as default if no classId in URL and no class selected yet
  useEffect(() => {
    if (!classId && !selectedClass && studentClasses.length > 0) {
      setSelectedClass(studentClasses[0]);
    }
  }, [classId, selectedClass, studentClasses]);

  // Load selected topic when topicId URL param changes
  useEffect(() => {
    if (topicId && topics.length > 0) {
      const topic = topics.find((t) => t.id === topicId);
      if (topic) {
        setSelectedTopic(topic);
      }
    } else if (!topicId) {
      setSelectedTopic(null);
    }
  }, [topicId, topics]);

  const handleSelectClass = useCallback(
    (cls) => {
      setSelectedClass(cls);
      setSelectedTopic(null);
      setShowClassSelector(false);
      // Save classId to sessionStorage for use in other pages like LearningPathwayPage
      sessionStorage.setItem("selectedClassId", cls.id);
      navigate(`/student/${cls.id}`);
    },
    [navigate],
  );

  const handleChangeClass = () => {
    setShowClassSelector(true);
  };

  const handleStartupClick = useCallback(() => {
    if (!selectedClass?.id) {
      alert('Vui lòng chọn lớp trước!');
      setShowClassSelector(true);
      return;
    }
    if (!selectedClass?.id) {
      alert('Vui lòng chọn lớp trước!');
      setShowClassSelector(true);
      return;
    }
    navigate(`/student/${selectedClass?.id}/pathways`);
  }, [navigate, selectedClass?.id]);

  const handleWorksheetClick = useCallback(() => {
    if (!selectedClass?.id) {
      alert('Vui lòng chọn lớp trước!');
      setShowClassSelector(true);
      return;
    }
    if (!selectedClass?.id) {
      alert('Vui lòng chọn lớp trước!');
      setShowClassSelector(true);
      return;
    }
    navigate(`/student/${selectedClass?.id}/worksheets`);
  }, [navigate, selectedClass?.id]);

  // Removed unused handleJoinExam function

  // Redirect if user logs out
  if (!user) {
    return null;
  }

  // Show class selector if in that mode
  if (showClassSelector) {
    return (
      <StudentClassSelectionPage
        user={user}
        onSelectClass={handleSelectClass}
        onSignOut={onSignOut}
      />
    );
  }

  // If no selected class and URL has no classId, show class selector
  if (!selectedClass && !classId) {
    // Show limited dashboard with "Select Class" button
    const navItems = [{ icon: "📚", label: "Chọn lớp học" }];

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={navItems} />

        <div className="app-shell section-shell flex min-h-[75vh] w-full flex-col items-center justify-center">
          <div className="text-center">
            <h1 className="mb-3 text-3xl font-bold text-gray-800 font-quicksand sm:text-4xl lg:text-5xl">
              Chào mừng, {user?.displayName || "Bạn"}! 👋
            </h1>
            <p className="mb-8 text-base text-gray-600 font-quicksand sm:mb-10 sm:text-lg lg:mb-12 lg:text-xl">
              Vui lòng chọn lớp học của bạn để bắt đầu
            </p>

            <div className="game-card mx-auto w-full max-w-md rounded-[2rem] bg-white p-6 shadow-lg sm:p-8 lg:p-10">
              <div className="mb-4 text-5xl sm:text-6xl lg:text-7xl">🎓</div>
              <h2 className="mb-4 text-2xl font-bold text-gray-800 font-quicksand sm:text-3xl">
                Chọn lớp học
              </h2>
              {studentClasses && studentClasses.length > 0 ? (
                <>
                  <p className="mb-5 text-sm text-gray-600 font-quicksand sm:text-base">
                    Bạn đã tham gia {studentClasses.length} lớp
                  </p>
                  <button
                    onClick={handleChangeClass}
                    className="touch-btn btn-3d w-full rounded-[2rem] bg-gradient-to-r from-blue-500 to-blue-600 text-base font-bold text-white font-quicksand sm:text-lg"
                  >
                    Chọn lớp →
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-5 text-sm text-gray-600 font-quicksand sm:text-base">
                    Bạn chưa tham gia lớp nào. Hãy tham gia lớp của bạn bằng mã
                    lớp.
                  </p>
                  <button
                    onClick={handleChangeClass}
                    className="touch-btn btn-3d w-full rounded-[2rem] bg-gradient-to-r from-green-500 to-green-600 text-base font-bold text-white font-quicksand sm:text-lg"
                  >
                    Tham gia lớp →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

// Handle pathway selection view
  if (currentView === "pathway-selection") {
    return (
      <StudentLearningPathwayPage
        user={user}
        onSignOut={onSignOut}
        selectedClass={selectedClass}
      />
    );
  }

  // Handle topic selection view
  if (currentView === "topic-selection") {
    return (
      <StudentTopicSelectionPage
        user={user}
        onSignOut={onSignOut}
        selectedClass={selectedClass}
        topics={topics}
        exams={exams}
        selectedTopic={selectedTopic}
        setSelectedTopic={setSelectedTopic}
        topicId={topicId}
      />
    );
  }

  // Handle exam selection view (exams for a specific topic)
  if (currentView === "exam-selection") {
    return (
      <StudentExamSelectionPage
        user={user}
        onSignOut={onSignOut}
        selectedClass={selectedClass}
        topics={topics}
        exams={exams}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 px-4">
        <div className="text-center">
          <div className="mb-4 text-5xl animate-bounce-gentle sm:text-6xl">✨</div>
          <div className="text-xl font-bold text-gray-700 font-quicksand sm:text-2xl">
            Đang tải dữ liệu...
          </div>
        </div>
      </div>
    );
  }

  // Show options view when no specific view is selected
  if (!currentView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

        <div className="app-shell section-shell w-full">
          {/* Change Class Button */}
          <div className="mb-6 flex gap-3 sm:mb-8">
            <button
              onClick={handleChangeClass}
              className="touch-btn btn-3d rounded-[2rem] bg-blue-500 px-4 text-sm font-bold text-white font-quicksand transition-all hover:shadow-lg sm:px-6 sm:text-base"
              title="Chọn lớp khác"
            >
              🔄 Chọn lớp khác
            </button>
          </div>

          {/* Welcome Section */}
          <div className="mb-8 sm:mb-10 lg:mb-12">
            <h1 className="mb-2 text-3xl font-bold text-gray-800 font-quicksand sm:text-4xl lg:text-5xl">
              Chào mừng, {user?.displayName || "Bạn"}! 👋
            </h1>
            <p className="text-base text-gray-600 font-quicksand sm:text-lg lg:text-xl">
              Lớp:{" "}
              <span className="font-bold text-gray-800">
                {selectedClass?.name}
              </span>
            </p>
          </div>

          {/* Stats Section - Card Style */}
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mb-12 lg:grid-cols-3 lg:gap-6">
            <div className="game-card rounded-[2rem] bg-gradient-to-br from-blue-300 to-cyan-300 p-5 shadow-lg transition-all hover:shadow-2xl sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-4xl sm:text-5xl">🏆</div>
                <div>
                  <div className="text-3xl font-bold text-gray-800 font-quicksand sm:text-4xl">
                    {userStats?.completedExams || 0}
                  </div>
                  <div className="text-sm text-gray-700 font-quicksand sm:text-base">
                    Đề thi hoàn thành
                  </div>
                </div>
              </div>
            </div>

            <div className="game-card rounded-[2rem] bg-gradient-to-br from-purple-300 to-pink-300 p-5 shadow-lg transition-all hover:shadow-2xl sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-4xl sm:text-5xl">⭐</div>
                <div>
                  <div className="text-3xl font-bold text-gray-800 font-quicksand sm:text-4xl">
                    {userStats?.averageScore || 0}%
                  </div>
                  <div className="text-sm text-gray-700 font-quicksand sm:text-base">
                    Điểm trung bình
                  </div>
                </div>
              </div>
            </div>

            <div className="game-card rounded-[2rem] bg-gradient-to-br from-green-300 to-emerald-300 p-5 shadow-lg transition-all hover:shadow-2xl sm:p-6 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-4xl sm:text-5xl">🗺️</div>
                <div>
                  <div className="text-3xl font-bold text-gray-800 font-quicksand sm:text-4xl">
                    {topics.length}
                  </div>
                  <div className="text-sm text-gray-700 font-quicksand sm:text-base">
                    Chủ đề khả dụng
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:gap-8">
            {/* Khởi động Card */}
            <div
              className="group game-card rounded-[2rem] bg-gradient-to-br from-yellow-300 to-orange-300 p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl sm:p-8 lg:p-10"
            >
              <div className="mb-4 text-center text-5xl animate-bounce-gentle sm:mb-5 sm:text-6xl lg:mb-6 lg:text-7xl">
                🚀
              </div>
              <h2 className="mb-3 text-center text-2xl font-bold text-gray-800 font-quicksand sm:text-3xl">
                🗺️ Trò chơi
              </h2>
              <p className="mb-6 text-center text-sm text-gray-700 font-quicksand sm:mb-8 sm:text-base">
                Chọn chủ đề và bắt đầu hành trình học tập của bạn
              </p>
              <button 
                onClick={handleStartupClick}
                type="button"
                className="touch-btn btn-3d w-full rounded-[2rem] bg-gradient-to-r from-blue-500 to-blue-600 text-base font-bold text-white font-quicksand sm:text-lg"
              >
                Khám phá Bản đồ →
              </button>
            </div>

            {/* Phiếu bài tập Card */}
            <div
              onClick={handleWorksheetClick}
              className="group game-card cursor-pointer rounded-[2rem] bg-gradient-to-br from-pink-300 to-rose-300 p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl sm:p-8 lg:p-10"
            >
              <div className="mb-4 text-center text-5xl animate-bounce-gentle sm:mb-5 sm:text-6xl lg:mb-6 lg:text-7xl">
                📋
              </div>
              <h2 className="mb-3 text-center text-2xl font-bold text-gray-800 font-quicksand sm:text-3xl">
                📝 Phiếu bài tập
              </h2>
              <p className="mb-6 text-center text-sm text-gray-700 font-quicksand sm:mb-8 sm:text-base">
                Làm các bài thi hoàn chỉnh và kiểm tra kiến thức
              </p>
              <button className="touch-btn btn-3d w-full rounded-[2rem] bg-gradient-to-r from-purple-500 to-purple-600 text-base font-bold text-white font-quicksand sm:text-lg">
                Tham gia bài thi →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      {/* Nội dung chính */}
      <div className="app-shell section-shell">
        <div>
          <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:gap-4 lg:mb-10">
            <button
              onClick={() => navigate(-1)}
              className="touch-btn btn-3d w-full rounded-[2rem] bg-white px-5 text-sm text-gray-800 font-quicksand transition-all hover:shadow-lg sm:w-auto sm:text-base"
            >
              ← Quay lại
            </button>
            <h2 className="text-2xl font-bold text-gray-800 font-quicksand sm:text-3xl lg:text-4xl">
              Không tìm thấy trang
            </h2>
          </div>
          <div className="game-card rounded-[2rem] bg-white p-8 text-center shadow-lg sm:p-12 lg:p-16">
            <p className="mb-3 text-4xl sm:mb-4 sm:text-5xl">🔍</p>
            <p className="text-base text-gray-600 font-quicksand sm:text-lg">
              Trang này không tồn tại.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboardPage;
