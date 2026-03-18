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

          <div className="mb-8 text-center sm:mb-10 lg:mb-12">
            <div className="mb-3 text-6xl animate-bounce sm:mb-4 sm:text-8xl">📋</div>
            <h1 className="mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-3xl font-bold text-transparent sm:mb-4 sm:text-4xl lg:text-5xl">Phiếu Bài Tập Thú Vị</h1>
            <p className="text-base font-semibold text-gray-700 sm:text-xl lg:text-2xl">Chọn loại phiếu mà bạn muốn làm nhé! 😊</p>
          </div>

          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 md:gap-8">
            {/* Phiếu đầu vào */}
            <div
              onClick={() => handleTypeSelect('input')}
              className="relative cursor-pointer overflow-hidden rounded-3xl border-4 border-blue-400 bg-gradient-to-br from-blue-200 to-blue-300 p-6 shadow-xl transition-all duration-300 hover:-rotate-1 hover:shadow-2xl hover:scale-105 sm:p-8"
            >
              <div className="absolute top-0 right-0 text-6xl opacity-30">🎈</div>
              <div className="mb-3 text-center text-6xl sm:mb-4 sm:text-8xl">📥</div>
              <h2 className="mb-2 text-center text-2xl font-bold text-blue-900 sm:mb-3 sm:text-3xl">Phiếu Đầu Vào</h2>
              <p className="text-center text-base font-semibold text-blue-800 sm:text-lg">Khởi đầu những bài toán mới! 🌟</p>
              <div className="mt-3 text-center text-4xl sm:mt-4 sm:text-5xl">➡️</div>
            </div>

            {/* Phiếu đầu ra */}
            <div
              onClick={() => handleTypeSelect('output')}
              className="relative cursor-pointer overflow-hidden rounded-3xl border-4 border-green-400 bg-gradient-to-br from-green-200 to-green-300 p-6 shadow-xl transition-all duration-300 hover:rotate-1 hover:shadow-2xl hover:scale-105 sm:p-8"
            >
              <div className="absolute top-0 right-0 text-6xl opacity-30">🎆</div>
              <div className="mb-3 text-center text-6xl sm:mb-4 sm:text-8xl">📤</div>
              <h2 className="mb-2 text-center text-2xl font-bold text-green-900 sm:mb-3 sm:text-3xl">Phiếu Đầu Ra</h2>
              <p className="text-center text-base font-semibold text-green-800 sm:text-lg">Hoàn thành bài học! 🎉</p>
              <div className="mt-3 text-center text-4xl sm:mt-4 sm:text-5xl">⭐</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="app-shell section-shell">
        <button
          onClick={() => setWorksheetType(null)}
          className="touch-btn mb-5 rounded-full bg-white px-4 text-sm font-semibold text-gray-700 transition-all shadow-md hover:bg-gray-100 sm:mb-6"
        >
          ← Quay lại
        </button>

        <div className="mb-8 text-center sm:mb-10 lg:mb-12">
          <div className="mb-2 text-5xl animate-bounce sm:mb-3 sm:text-6xl">{worksheetType === 'input' ? '📥' : '📤'}</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800 sm:text-3xl lg:text-4xl">
            {worksheetType === 'input' ? ' Phiếu Đầu Vào' : ' Phiếu Đầu Ra'}
          </h1>
          <p className="text-base font-semibold text-gray-600 sm:text-lg lg:text-xl">Chọn phiếu thú vị để bắt đầu làm bài nhé!</p>
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
                        className="touch-btn w-full rounded-xl bg-gradient-to-r from-green-400 to-green-500 px-4 text-sm font-bold text-white transition-all hover:from-green-500 hover:to-green-600 sm:text-lg"
                      >
                        Xem lại bài làm
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectWorksheet(worksheet)}
                      className="touch-btn w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 text-sm font-bold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-600 hover:shadow-xl sm:text-lg"
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
