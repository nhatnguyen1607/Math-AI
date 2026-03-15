import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import studentService from "../../services/student/studentService";
import classService from "../../services/classService";

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
  const [showDevNotice, setShowDevNotice] = useState(false);

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
        console.log("Toàn bộ exams lấy về:", examsData);
        // LỌC BỎ CÁC BÀI THI DRAFT Ở ĐÂY 👇
        const validExams = (examsData || []).filter((exam) => {
          // Log từng bài thi ra để kiểm tra status
          console.log(`Bài thi: ${exam.title} - Trạng thái:`, exam.status);

          // Chuyển status về chữ thường rồi mới so sánh (phòng trường hợp 'Draft' hoặc 'DRAFT')
          // Và kiểm tra xem exam có property status không
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
    navigate(`/student/${selectedClass?.id}/pathways`);
  }, [navigate, selectedClass?.id]);

  const handleWorksheetClick = useCallback(() => {
    setShowDevNotice(true);
    setTimeout(() => setShowDevNotice(false), 3000);
  }, []);

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

        <div className="px-8 py-8 max-w-7xl mx-auto w-full flex flex-col items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-800 mb-4 font-quicksand">
              Chào mừng, {user?.displayName || "Bạn"}! 👋
            </h1>
            <p className="text-xl text-gray-600 mb-12 font-quicksand">
              Vui lòng chọn lớp học của bạn để bắt đầu
            </p>

            <div className="game-card bg-white rounded-max shadow-lg p-12 max-w-md">
              <div className="text-7xl mb-6">🎓</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6 font-quicksand">
                Chọn lớp học
              </h2>
              {studentClasses && studentClasses.length > 0 ? (
                <>
                  <p className="text-gray-600 mb-6 font-quicksand">
                    Bạn đã tham gia {studentClasses.length} lớp
                  </p>
                  <button
                    onClick={handleChangeClass}
                    className="btn-3d w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-4 px-6 rounded-max font-quicksand text-lg"
                  >
                    Chọn lớp →
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-6 font-quicksand">
                    Bạn chưa tham gia lớp nào. Hãy tham gia lớp của bạn bằng mã
                    lớp.
                  </p>
                  <button
                    onClick={handleChangeClass}
                    className="btn-3d w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-4 px-6 rounded-max font-quicksand text-lg"
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
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce-gentle">✨</div>
          <div className="text-2xl font-bold text-gray-700 font-quicksand">
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

        <div className="px-8 py-8 max-w-7xl mx-auto w-full">
          {/* Change Class Button */}
          <div className="mb-8 flex gap-4">
            <button
              onClick={handleChangeClass}
              className="btn-3d bg-blue-500 text-white py-3 px-6 rounded-max font-quicksand hover:shadow-lg transition-all font-bold"
              title="Chọn lớp khác"
            >
              🔄 Chọn lớp khác
            </button>
          </div>

          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-gray-800 mb-2 font-quicksand">
              Chào mừng, {user?.displayName || "Bạn"}! 👋
            </h1>
            <p className="text-xl text-gray-600 font-quicksand">
              Lớp:{" "}
              <span className="font-bold text-gray-800">
                {selectedClass?.name}
              </span>
            </p>
          </div>

          {/* Stats Section - Card Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="game-card bg-gradient-to-br from-blue-300 to-cyan-300 rounded-max p-6 shadow-lg hover:shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="text-5xl">🏆</div>
                <div>
                  <div className="text-4xl font-bold text-gray-800 font-quicksand">
                    {userStats?.completedExams || 0}
                  </div>
                  <div className="text-gray-700 font-quicksand">
                    Đề thi hoàn thành
                  </div>
                </div>
              </div>
            </div>

            <div className="game-card bg-gradient-to-br from-purple-300 to-pink-300 rounded-max p-6 shadow-lg hover:shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="text-5xl">⭐</div>
                <div>
                  <div className="text-4xl font-bold text-gray-800 font-quicksand">
                    {userStats?.averageScore || 0}%
                  </div>
                  <div className="text-gray-700 font-quicksand">
                    Điểm trung bình
                  </div>
                </div>
              </div>
            </div>

            <div className="game-card bg-gradient-to-br from-green-300 to-emerald-300 rounded-max p-6 shadow-lg hover:shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="text-5xl">🗺️</div>
                <div>
                  <div className="text-4xl font-bold text-gray-800 font-quicksand">
                    {topics.length}
                  </div>
                  <div className="text-gray-700 font-quicksand">
                    Chủ đề khả dụng
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Khởi động Card */}
            <div
              className="group game-card bg-gradient-to-br from-yellow-300 to-orange-300 rounded-max shadow-lg p-10 cursor-pointer transition-all duration-300 transform hover:-translate-y-4 hover:shadow-2xl"
            >
              <div className="text-7xl mb-6 text-center animate-bounce-gentle">
                🚀
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3 font-quicksand text-center">
                🗺️ Trò chơi
              </h2>
              <p className="text-gray-700 mb-8 font-quicksand text-center">
                Chọn chủ đề và bắt đầu hành trình học tập của bạn
              </p>
              <button 
                onClick={handleStartupClick}
                type="button"
                className="btn-3d w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-4 px-6 rounded-max font-quicksand text-lg"
              >
                Khám phá Bản đồ →
              </button>
            </div>

            {/* Phiếu bài tập Card */}
            <div
              onClick={handleWorksheetClick}
              className="group game-card bg-gradient-to-br from-pink-300 to-rose-300 rounded-max shadow-lg p-10 cursor-pointer transition-all duration-300 transform hover:-translate-y-4 hover:shadow-2xl"
            >
              <div className="text-7xl mb-6 text-center animate-bounce-gentle">
                📋
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3 font-quicksand text-center">
                📝 Phiếu bài tập
              </h2>
              <p className="text-gray-700 mb-8 font-quicksand text-center">
                Làm các bài thi hoàn chỉnh và kiểm tra kiến thức
              </p>
              <button className="btn-3d w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold py-4 px-6 rounded-max font-quicksand text-lg">
                Tham gia bài thi →
              </button>
            </div>
          </div>
        </div>

        {/* Development Notice Modal */}
        {showDevNotice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl animate-bounce-gentle">
              <div className="text-6xl mb-4">🚧</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2 font-quicksand">
                Nội dung đang phát triển
              </h3>
              <p className="text-gray-600 font-quicksand">
                Tính năng này sẽ sớm được cập nhật. Vui lòng quay lại sau!
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      {/* Nội dung chính */}
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-10">
            <button
              onClick={() => navigate(-1)}
              className="btn-3d bg-white text-gray-800 py-3 px-6 rounded-max font-quicksand hover:shadow-lg transition-all"
            >
              ← Quay lại
            </button>
            <h2 className="text-4xl font-bold text-gray-800 font-quicksand">
              Không tìm thấy trang
            </h2>
          </div>
          <div className="bg-white rounded-max shadow-lg p-16 text-center game-card">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-gray-600 text-lg font-quicksand">
              Trang này không tồn tại.
            </p>
          </div>
        </div>
      </div>

      {/* Development Notice Modal */}
      {showDevNotice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl animate-bounce-gentle">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2 font-quicksand">
              Nội dung đang phát triển
            </h3>
            <p className="text-gray-600 font-quicksand">
              Tính năng này sẽ sớm được cập nhật. Vui lòng quay lại sau!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboardPage;
