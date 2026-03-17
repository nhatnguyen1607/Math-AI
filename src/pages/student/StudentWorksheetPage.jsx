import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import * as worksheetService from "../../services/faculty/worksheetService";
import * as worksheetResultService from "../../services/student/worksheetResultService";
import StudentHeader from "../../components/student/StudentHeader";

const StudentWorksheetPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { classId, worksheetId } = useParams();
  const location = useLocation();
  const worksheet = location.state?.worksheet;

  const [loading, setLoading] = useState(true);
  const [worksheetData, setWorksheetData] = useState(null);

  // Bài 1: Checkbox selections
  const [bai1Selections, setBai1Selections] = useState([]);

  // Bài 2: Drag-drop arrangements
  const [bai2Arrangements, setBai2Arrangements] = useState({});

  // Bài 3: Free text
  const [bai3BaiLam, setBai3BaiLam] = useState("");
  const [bai3GiaiThich, setBai3GiaiThich] = useState("");

  // Bài 4: Various types
  const [bai4Answers, setBai4Answers] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // saved, saving, error
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);

  // Auto-save to localStorage
  useEffect(() => {
    if (!worksheetData || !user?.uid) return;

    const saveData = async () => {
      try {
        setSaveStatus("saving");
        const cacheKey = `worksheet_${worksheetId}_student_${user.uid}`;
        const dataToSave = {
          bai1Selections,
          bai2Arrangements,
          bai3BaiLam,
          bai3GiaiThich,
          bai4Answers,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(cacheKey, JSON.stringify(dataToSave));
        setSaveStatus("saved");
      } catch (error) {
        console.error("Error saving to localStorage:", error);
        setSaveStatus("error");
      }
    };

    // Debounce: save after 1 second of no changes
    const timer = setTimeout(saveData, 1000);
    return () => clearTimeout(timer);
  }, [bai1Selections, bai2Arrangements, bai3BaiLam, bai3GiaiThich, bai4Answers, worksheetId, user?.uid, worksheetData]);

  // Load from localStorage on mount and initialize state
  useEffect(() => {
    if (!worksheetData || !user?.uid) return;

    const cacheKey = `worksheet_${worksheetId}_student_${user.uid}`;
    const savedData = localStorage.getItem(cacheKey);

    const initializeDefaults = () => {
      // Initialize Bài 2 arrangements
      if (worksheetData.bai_2?.so_cach_giai) {
        const arrangements = {};
        for (let i = 1; i <= parseInt(worksheetData.bai_2.so_cach_giai); i++) {
          arrangements[`cach_${i}`] = [];
        }
        setBai2Arrangements(arrangements);
      }

      // Initialize Bài 4 answers
      if (worksheetData.bai_4?.questions) {
        const answers = {};
        worksheetData.bai_4.questions.forEach((q) => {
          if (q.type === "so_cach_giai") {
            const arrangementsArray = [];
            for (let i = 1; i <= parseInt(q.content); i++) {
              arrangementsArray.push([]);
            }
            answers[q.id] = arrangementsArray;
          } else if (q.type === "cau_hoi_nho") {
            answers[q.id] = (q.subQuestions || []).map(() => "");
          } else {
            answers[q.id] = "";
          }
        });
        setBai4Answers(answers);
      }
    };

    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setBai1Selections(data.bai1Selections || []);
        setBai2Arrangements(data.bai2Arrangements || {});
        setBai3BaiLam(data.bai3BaiLam || "");
        setBai3GiaiThich(data.bai3GiaiThich || "");
        setBai4Answers(data.bai4Answers || {});
      } catch (error) {
        console.error("Error loading from localStorage:", error);
        // If loading fails, initialize with defaults
        initializeDefaults();
      }
    } else {
      // No saved data, initialize with defaults
      initializeDefaults();
    }
  }, [worksheetData, worksheetId, user?.uid]);

  const loadWorksheet = useCallback(async () => {
    try {
      setLoading(true);
      let data = worksheet;
      if (!data) {
        data = await worksheetService.getWorksheetById(worksheetId);
      }
      setWorksheetData(data);

      // Check if already submitted
      if (user?.uid) {
        const resultId = `${user.uid}_${worksheetId}`;
        try {
          const result = await worksheetResultService.getWorksheetResult(resultId);
          if (result) {
            setIsAlreadySubmitted(true);
          }
        } catch (error) {
          // No submission found, which is fine
        }
      }
    } catch (error) {
      console.error("Error loading worksheet:", error);
      alert("Lỗi khi tải phiếu bài tập");
    } finally {
      setLoading(false);
    }
  }, [worksheet, worksheetId, user?.uid]);

  useEffect(() => {
    loadWorksheet();
  }, [loadWorksheet]);

  const handleBai1Change = (questionId) => {
    setBai1Selections((prev) => {
      if (prev.includes(questionId)) {
        return prev.filter((id) => id !== questionId);
      } else {
        return [...prev, questionId];
      }
    });
  };

  // Drag and drop handlers for Bài 2
  const handleDragStart = (e, questionId) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("questionId", questionId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDropOnArrangement = (e, cach) => {
    e.preventDefault();
    const questionId = e.dataTransfer.getData("questionId");

    if (questionId) {
      setBai2Arrangements((prev) => ({
        ...prev,
        [cach]: [...(prev[cach] || []), questionId],
      }));
    }
  };

  const handleRemoveFromArrangement = (cach, index) => {
    setBai2Arrangements((prev) => ({
      ...prev,
      [cach]: prev[cach].filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      // Convert arrays to objects to avoid Firestore nested array error
      const convertArraysToObjects = (obj) => {
        return Object.keys(obj).reduce((acc, key) => {
          const value = obj[key];
          if (Array.isArray(value)) {
            // Convert array to object with index keys
            acc[key] = value.reduce((arrAcc, item, idx) => {
              arrAcc[idx.toString()] = item;
              return arrAcc;
            }, {});
          } else if (typeof value === 'object' && value !== null) {
            // Recursively process nested objects
            acc[key] = convertArraysToObjects(value);
          } else {
            acc[key] = value;
          }
          return acc;
        }, {});
      };

      // Convert flat array to object format (for Firestore compatibility)
      const selectionsObj = bai1Selections.reduce((acc, id, idx) => {
        acc[idx.toString()] = id;
        return acc;
      }, {});

      const result = {
        studentId: user.uid,
        studentName: user.displayName || user.email,
        worksheetId,
        classId,
        bai_1: {
          selections: selectionsObj,
          evaluation: {},
        },
        bai_2: {
          arrangements: convertArraysToObjects(bai2Arrangements),
          evaluation: {},
        },
        bai_3: {
          bai_lam: bai3BaiLam,
          giai_thich: bai3GiaiThich,
          evaluation: {},
        },
        bai_4: {
          answers: convertArraysToObjects(bai4Answers),
          evaluation: {},
        },
        submittedAt: new Date(),
      };

      // Save result
      const resultId = await worksheetResultService.createWorksheetResult(
        result,
        worksheetData,
      );

      // Clear saved data after successful submission
      const cacheKey = `worksheet_${worksheetId}_student_${user.uid}`;
      localStorage.removeItem(cacheKey);

      alert("Nộp bài thành công!");
      navigate(
        `/student/${classId}/worksheet/${worksheetId}/result/${resultId}`,
      );
    } catch (error) {
      console.error("Error submitting worksheet:", error);
      alert("Lỗi khi nộp bài");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">⏳</div>
          <p className="text-2xl font-bold text-gray-700">
            Đang tải phiếu bài tập...
          </p>
        </div>
      </div>
    );
  }

  if (!worksheetData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 px-4">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-700 sm:text-2xl">
            Không tìm thấy phiếu bài tập
          </p>
        </div>
      </div>
    );
  }

  if (isAlreadySubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 px-4">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="text-center py-20">
          <div className="mb-4 text-6xl animate-bounce sm:text-8xl">✅</div>
          <h1 className="mb-4 text-3xl font-bold text-green-700 sm:text-5xl">Tuyệt vời!</h1>
          <p className="mb-6 text-lg font-semibold text-green-600 sm:mb-8 sm:text-2xl">Bạn đã hoàn thành phiếu bài tập này rồi! 🎉</p>
          <p className="mb-6 text-base text-gray-700 sm:mb-8 sm:text-lg">Mỗi phiếu chỉ làm được một lần thôi.</p>
          <div className="space-x-4">
            <button
              onClick={() => navigate(`/student/${classId}`)}
              className="touch-btn rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-6 text-sm font-bold text-white transition-all hover:from-blue-600 hover:to-blue-700 sm:text-base"
            >
              ← Quay lại Trang Chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="app-shell section-shell">
        {/* Two Column Layout: Problem on left, Homework on right */}
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Left Column: Fixed Problem/Context */}
          <div className="lg:col-span-1">
            <div className="sticky top-[7.2rem] z-20 rounded-3xl border-4 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 shadow-lg sm:top-[8.2rem] sm:p-6">
              <div className="text-center mb-4">
                <div className="mb-2 text-4xl sm:text-5xl">🔍</div>
                <h1 className="mb-2 text-xl font-bold text-blue-800 sm:text-2xl">
                  {worksheetData.name}
                </h1>
              </div>
              <div className="bg-blue-100 p-5 rounded-2xl border-2 border-blue-300">
                <p className="text-justify text-sm font-semibold leading-relaxed text-gray-800 sm:text-base">{worksheetData.context}</p>
              </div>
              
              {/* Auto-save Status */}
              <div className="mt-5 pt-5 border-t-3 border-blue-300 text-sm">
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-2 text-green-600 font-bold">
                    <span className="w-3 h-3 bg-green-600 rounded-full animate-pulse"></span>
                    ✅ Đã lưu
                  </span>
                )}
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-2 text-blue-600 animate-pulse font-bold">
                    <span className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></span>
                    ⏳ Đang lưu...
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="flex items-center gap-2 text-red-600 font-bold">
                    <span className="w-3 h-3 bg-red-600 rounded-full"></span>
                    ⚠️ Lỗi khi lưu
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Homework */}
          <div className="lg:col-span-2">
            <div className="space-y-8">
          {/* Bài 1 */}
          {worksheetData.bai_1 && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-purple-300 relative">
              <div className="absolute top-3 right-3 text-4xl">💜</div>
              <h2 className="text-3xl font-bold text-purple-700 mb-4 flex items-center gap-2">
                <span className="text-4xl">📝 Bài 1: Chọn đáp án đúng</span>
              </h2>
              <p className="text-lg text-purple-800 mb-6 p-4 bg-purple-200 rounded-2xl font-semibold">
                {worksheetData.bai_1.text}
              </p>

              <div className="space-y-3 mb-6">
                {(worksheetData.bai_1.questions || []).map((question) => (
                  <label
                    key={question.id}
                    className="flex items-center gap-3 p-4 bg-white hover:bg-purple-50 rounded-xl cursor-pointer transition-all border-2 border-purple-300 hover:border-purple-500 font-semibold shadow-sm hover:shadow-md disabled:opacity-50"
                  >
                    <input
                      type="checkbox"
                      checked={bai1Selections.includes(question.id)}
                      onChange={() => handleBai1Change(question.id)}
                      disabled={isAlreadySubmitted}
                      className="w-6 h-6 flex-shrink-0 text-purple-600 rounded cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="text-purple-900 text-lg">{question.text}</span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-purple-700 font-semibold p-3 bg-purple-100 rounded-xl">
                <span className="text-xl">💡</span>
                <span>Có thể chọn một hoặc nhiều đáp án đúng nhé!</span>
              </div>
            </div>
          )}

          {/* Bài 2 */}
          {worksheetData.bai_2 && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-blue-300 relative">
              <div className="absolute top-3 right-3 text-4xl">💙</div>
              <h2 className="text-3xl font-bold text-blue-700 mb-4 flex items-center gap-2">
                <span className="text-4xl">🎯 Bài 2: Sắp xếp các bước</span>
              </h2>
              <p className="text-lg text-blue-800 mb-6 p-4 bg-blue-200 rounded-2xl font-semibold">
                {worksheetData.bai_2.text}
              </p>

              <div className="bg-yellow-100 p-4 rounded-2xl mb-6 border-2 border-yellow-300">
                <p className="text-sm text-yellow-800 font-bold">
                  <span className="text-xl mr-2">📌</span>
                  <strong>Có {worksheetData.bai_2.so_cach_giai} cách giải</strong>
                </p>
                <p className="text-sm text-yellow-700 mt-2 font-semibold">Kéo các bước và sắp xếp theo thứ tự cho từng cách! 👆</p>
              </div>

              {/* Available items - Sticky */}
              <div className="sticky top-[14.5rem] z-30 mb-6 rounded-2xl border-2 border-dashed border-blue-400 bg-white pb-4 pt-4 sm:top-[15.5rem]">
                <p className="font-bold text-blue-800 mb-3 text-lg">🎨 Các bước có sẵn:</p>
                <div className="flex flex-wrap gap-3">
                  {(worksheetData.bai_2.questions || []).map((q) => (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, q.id)}
                      className="bg-gradient-to-br from-blue-400 to-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold cursor-move hover:from-blue-500 hover:to-blue-600 active:opacity-50 transition shadow-lg transform hover:scale-110"
                    >
                      {q.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Arrangements */}
              <div className="space-y-4">
                {Object.keys(bai2Arrangements)
                  .sort((a, b) => {
                    const numA = parseInt(a.replace('cach_', ''));
                    const numB = parseInt(b.replace('cach_', ''));
                    return numA - numB;
                  })
                  .map((cach) => (
                  <div
                    key={cach}
                    className="p-4 bg-gradient-to-r from-blue-100 to-blue-50 rounded-2xl border-3 border-dashed border-blue-300"
                  >
                    <p className="font-bold text-blue-800 mb-3 text-lg">
                      {cach.replace("cach_", "🌟 Cách ")}:
                    </p>
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnArrangement(e, cach)}
                      className="min-h-24 p-4 bg-white rounded-2xl border-3 border-dashed border-blue-400 hover:bg-blue-50 transition"
                    >
                      {bai2Arrangements[cach] &&
                      bai2Arrangements[cach].length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {bai2Arrangements[cach].map((questionId, index) => {
                            const question = worksheetData.bai_2.questions.find(
                              (q) => q.id === questionId,
                            );
                            return (
                              <div
                                key={`${cach}-${index}`}
                                className="bg-gradient-to-br from-green-400 to-green-500 text-white px-3 py-2 rounded-full text-sm font-bold flex items-center gap-2 group shadow-md"
                              >
                                <span className="bg-white text-green-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                                <span>{question?.text}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveFromArrangement(cach, index)
                                  }
                                  className="ml-auto text-white hover:text-red-200 opacity-0 group-hover:opacity-100 transition text-lg"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-lg font-semibold">👇 Kéo các bước vào đây...</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bài 3 */}
          {worksheetData.bai_3 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-green-300 relative">
              <div className="absolute top-3 right-3 text-4xl">✍️</div>
              <h2 className="text-3xl font-bold text-green-700 mb-4 flex items-center gap-2">
                <span className="text-4xl">📝 Bài 3: Tự luận</span>
              </h2>
              <p className="text-lg text-green-800 mb-6 p-4 bg-green-200 rounded-2xl font-semibold">
                {worksheetData.bai_3.text}
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 bg-white rounded-2xl border-3 border-green-300 shadow-md">
                  <label className="block font-bold text-green-700 mb-3 text-lg flex items-center gap-2">
                    <span className="text-2xl">🎯</span>
                    Bài làm:
                  </label>
                  <textarea
                    value={bai3BaiLam}
                    onChange={(e) => setBai3BaiLam(e.target.value)}
                    disabled={isAlreadySubmitted}
                    placeholder="✏️ Viết bài làm của em..."
                    className="w-full px-4 py-3 border-3 border-green-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-green-500 focus:border-transparent resize-none text-base font-medium disabled:bg-gray-100"
                    rows="8"
                  />
                </div>

                <div className="p-4 bg-white rounded-2xl border-3 border-green-300 shadow-md">
                  <label className="block font-bold text-green-700 mb-3 text-lg flex items-center gap-2">
                    <span className="text-2xl">💭</span>
                    Giải thích:
                  </label>
                  <textarea
                    value={bai3GiaiThich}
                    onChange={(e) => setBai3GiaiThich(e.target.value)}
                    disabled={isAlreadySubmitted}
                    placeholder="💡 Giải thích cách em làm bài..."
                    className="w-full px-4 py-3 border-3 border-green-300 rounded-xl focus:outline-none focus:ring-3 focus:ring-green-500 focus:border-transparent resize-none text-base font-medium disabled:bg-gray-100"
                    rows="8"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-green-700 font-semibold p-3 bg-green-100 rounded-xl">
                <span className="text-xl">⭐</span>
                <span>Hãy viết rõ ràng để thầy/cô hiểu được cách em suy nghĩ nhé!</span>
              </div>
            </div>
          )}

          {/* Bài 4 */}
          {worksheetData.bai_4 && (
            <div className="bg-gradient-to-br from-orange-50 to-yellow-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-orange-300 relative">
              <div className="absolute top-3 right-3 text-4xl">🧩</div>
              <h2 className="text-3xl font-bold text-orange-700 mb-4 flex items-center gap-2">
                <span className="text-4xl">🎨 Bài 4: Bài tập nâng cao</span>
              </h2>

              <div className="space-y-8">
                {(worksheetData.bai_4.questions || []).map((question, idx) => (
                  <div
                    key={question.id}
                    className="p-6 bg-white rounded-2xl border-3 border-orange-300 shadow-md hover:shadow-lg transition"
                  >
                    <h3 className="text-2xl font-bold text-orange-700 mb-4 flex items-center gap-2">
                      <span className="bg-orange-300 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold">{idx + 1}</span>
                      {question.content}
                    </h3>
                    <p className="text-lg text-orange-800 font-semibold mb-4">
                      {question.label}. {question.text}
                    </p>

                    {question.type === "cau_hoi_nho" && (
                      <div className="space-y-4">
                        {(question.subQuestions || []).map((subQ, subIdx) => (
                          <div
                            key={subQ.id}
                            className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border-2 border-orange-200 hover:border-orange-400 transition"
                          >
                            <label className="block font-bold text-orange-700 mb-3 flex items-center gap-2">
                              <span className="bg-orange-200 text-orange-700 px-2 py-1 rounded-full text-sm font-bold">Câu {subIdx + 1}</span>
                              {subQ.text}
                            </label>
                            <input
                              type="text"
                              value={bai4Answers[question.id]?.[subIdx] || ""}
                              onChange={(e) => {
                                const newAnswers = { ...bai4Answers };
                                if (!newAnswers[question.id])
                                  newAnswers[question.id] = [];
                                newAnswers[question.id][subIdx] =
                                  e.target.value;
                                setBai4Answers(newAnswers);
                              }}
                              disabled={isAlreadySubmitted}
                              placeholder="✍️ Nhập đáp án của em..."
                              className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-medium disabled:bg-gray-100"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === "so_cach_giai" && (
                      <div className="space-y-4">
                        {Array.from({ length: parseInt(question.content) }).map(
                          (_, cacheIdx) => (
                            <div
                              key={cacheIdx}
                              className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border-2 border-orange-200 hover:border-orange-400 transition"
                            >
                              <label className="block font-bold text-orange-700 mb-3 flex items-center gap-2">
                                <span className="bg-orange-200 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">🌟 Cách {cacheIdx + 1}</span>
                              </label>
                              <textarea
                                value={
                                  bai4Answers[question.id]?.[cacheIdx] || ""
                                }
                                onChange={(e) => {
                                  const newAnswers = { ...bai4Answers };
                                  if (!newAnswers[question.id])
                                    newAnswers[question.id] = [];
                                  newAnswers[question.id][cacheIdx] =
                                    e.target.value;
                                  setBai4Answers(newAnswers);
                                }}
                                disabled={isAlreadySubmitted}
                                placeholder="✍️ Nhập đáp án cho cách này..."
                                className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none font-medium disabled:bg-gray-100"
                                rows="4"
                              />
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {!question.type && (
                      <input
                        type="text"
                        value={bai4Answers[question.id] || ""}
                        onChange={(e) => {
                          setBai4Answers({
                            ...bai4Answers,
                            [question.id]: e.target.value,
                          });
                        }}
                        disabled={isAlreadySubmitted}
                        placeholder="✍️ Nhập đáp án của em..."
                        className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-medium disabled:bg-gray-100"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="sticky bottom-0 mb-8 flex flex-wrap justify-end gap-3 bg-gradient-to-t from-white via-white to-transparent pb-2 pt-5 sm:gap-4 sm:pt-6">
            <button
              onClick={() => navigate(`/student/${classId}`)}
              className="touch-btn rounded-2xl bg-gray-400 px-6 text-sm font-bold text-white shadow-lg transition-all hover:bg-gray-500 sm:text-base"
            >
              <span className="text-lg">🔙</span> Quay lại
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || isAlreadySubmitted}
              className="touch-btn rounded-2xl bg-gradient-to-r from-green-400 to-green-500 px-6 text-sm font-bold text-white shadow-lg transition-all hover:from-green-500 hover:to-green-600 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
            >
              <span className="text-lg">{submitting ? "⏳" : "✅"}</span> {submitting ? "Đang nộp..." : "Nộp bài"}
            </button>
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentWorksheetPage;
