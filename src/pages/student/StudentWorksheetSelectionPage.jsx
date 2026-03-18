import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as worksheetService from "../../services/faculty/worksheetService";
import * as worksheetResultService from "../../services/student/worksheetResultService";
import StudentHeader from "../../components/student/StudentHeader";
import FractionRenderer from "../../components/FractionRenderer";

const StudentWorksheetSelectionPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { classId } = useParams();
  const [worksheetType, setWorksheetType] = useState(null);
  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submittedWorksheets, setSubmittedWorksheets] = useState({});

  const loadWorksheets = useCallback(async () => {
    try {
      setLoading(true);
      // Load all worksheets by type (không lọc classId)
      const data = await worksheetService.getWorksheetsByType(worksheetType);
      setWorksheets(data || []);

      // Check which worksheets have been submitted by student
      const submitted = {};
      for (const ws of data || []) {
        const resultId = `${user.uid}_${ws.id}`;
        try {
          const result =
            await worksheetResultService.getWorksheetResult(resultId);
          if (result) {
            submitted[ws.id] = result;
          }
        } catch (error) {
          // No result found, which is fine
        }
      }
      setSubmittedWorksheets(submitted);
    } catch (error) {
      console.error("Error loading worksheets:", error);
      alert("Lỗi khi tải phiếu bài tập");
    } finally {
      setLoading(false);
    }
  }, [worksheetType, user?.uid]);

  useEffect(() => {
    if (worksheetType && classId) {
      loadWorksheets();
    }
  }, [worksheetType, classId, loadWorksheets]);

  const handleSelectWorksheet = (worksheet) => {
    navigate(`/student/${classId}/worksheet/${worksheet.id}`, {
      state: { worksheet },
    });
  };

  const handleTypeSelect = (type) => {
    setWorksheetType(type);
  };

  const handleBack = () => {
    navigate(`/student/${classId}`);
  };

  if (!worksheetType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

        <div className="app-shell section-shell">
          <button
            onClick={handleBack}
            className="touch-btn mb-5 rounded-full bg-white px-4 text-sm font-semibold text-gray-700 transition-all shadow-md hover:bg-gray-100 hover:shadow-lg sm:mb-6"
          >
            ← Quay lại
          </button>

          <div className="text-center mb-12">
            <div className="text-8xl mb-4 animate-bounce">📋</div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">Phiếu Bài Tập Thú Vị</h1>
            <p className="text-2xl text-gray-700 font-semibold">Chọn loại phiếu mà bạn muốn làm nhé! 😊</p>
          </div>

          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 md:gap-8">
            {/* Phiếu đầu vào */}
            <div
              onClick={() => handleTypeSelect('input')}
              className="cursor-pointer bg-gradient-to-br from-blue-200 to-blue-300 rounded-3xl shadow-xl p-8 hover:shadow-2xl hover:scale-110 transition-all duration-300 border-4 border-blue-400 relative overflow-hidden transform hover:-rotate-1"
            >
              <div className="absolute top-0 right-0 text-6xl opacity-30">🎈</div>
              <div className="text-8xl mb-4 text-center">📥</div>
              <h2 className="text-3xl font-bold text-blue-900 mb-3 text-center">Phiếu Đầu Vào</h2>
              <p className="text-blue-800 text-center font-semibold text-lg">Khởi đầu những bài toán mới! 🌟</p>
              <div className="text-5xl text-center mt-4">➡️</div>
            </div>

            {/* Phiếu đầu ra */}
            <div
              onClick={() => handleTypeSelect('output')}
              className="cursor-pointer bg-gradient-to-br from-green-200 to-green-300 rounded-3xl shadow-xl p-8 hover:shadow-2xl hover:scale-110 transition-all duration-300 border-4 border-green-400 relative overflow-hidden transform hover:rotate-1"
            >
              <div className="absolute top-0 right-0 text-6xl opacity-30">🎆</div>
              <div className="text-8xl mb-4 text-center">📤</div>
              <h2 className="text-3xl font-bold text-green-900 mb-3 text-center">Phiếu Đầu Ra</h2>
              <p className="text-green-800 text-center font-semibold text-lg">Hoàn thành bài học! 🎉</p>
              <div className="text-5xl text-center mt-4">⭐</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="px-8 py-8 max-w-7xl mx-auto">
        <button
          onClick={() => setWorksheetType(null)}
          className="touch-btn mb-5 rounded-full bg-white px-4 text-sm font-semibold text-gray-700 transition-all shadow-md hover:bg-gray-100 sm:mb-6"
        >
          ← Quay lại
        </button>

        <div className="mb-12 text-center">
          <div className="text-6xl mb-3 animate-bounce">{worksheetType === 'input' ? '📥' : '📤'}</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {worksheetType === 'input' ? ' Phiếu Đầu Vào' : ' Phiếu Đầu Ra'}
          </h1>
          <p className="text-xl text-gray-600 font-semibold">Chọn phiếu thú vị để bắt đầu làm bài nhé!</p>
        </div>

        {loading ? (
          <div className="text-center text-lg text-gray-600 sm:text-2xl">Đang tải...</div>
        ) : worksheets.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-3 text-5xl sm:mb-4 sm:text-6xl">📋</div>
            <p className="text-base text-gray-600 sm:text-xl">Chưa có phiếu bài tập nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {worksheets.map((worksheet) => {
              const isSubmitted = !!submittedWorksheets[worksheet.id];
              const result = submittedWorksheets[worksheet.id];

              return (
                <div
                  key={worksheet.id}
                  className="relative cursor-pointer overflow-hidden rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-white to-blue-50 p-5 shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] sm:p-6"
                >
                  {/* Cute corner decoration */}
                  <div className="absolute top-0 right-0 text-4xl opacity-20">
                    ✨
                  </div>

                  <h3 className="text-xl font-bold text-gray-800 mb-3 line-clamp-1">
                    {worksheet.name}
                  </h3>

                  <div className="mb-4 text-sm text-gray-600 h-12 overflow-hidden bg-blue-100 rounded-lg p-2 line-clamp-2">
                    {worksheet.context ? (
                      <FractionRenderer
                        text={
                          worksheet.context.substring(0, 100) +
                          (worksheet.context.length > 100 ? "..." : "")
                        }
                      />
                    ) : (
                      "Chưa có nội dung"
                    )}
                  </div>

                  <div className="flex gap-2 text-lg mb-4 flex-wrap">
                    <span title="Bài 1">📝</span>
                    <span title="Bài 2">🎲</span>
                    <span title="Bài 3">✍️</span>
                    <span title="Bài 4">🧩</span>
                  </div>

                  {isSubmitted ? (
                    <div className="space-y-3">
                      <div className="bg-green-100 border-2 border-green-400 rounded-lg p-3 text-center">
                        <div className="text-3xl mb-2">✅</div>
                        <p className="text-sm font-bold text-green-700">
                          Đã hoàn thành!
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/student/${classId}/worksheet/${worksheet.id}/result/${result?.id}`)}
                        className="w-full bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white font-bold py-3 px-4 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
                      >
                        Xem lại bài làm
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectWorksheet(worksheet)}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-4 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 text-lg shadow-lg hover:shadow-xl"
                    >
                      🚀 Bắt đầu →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentWorksheetSelectionPage;
