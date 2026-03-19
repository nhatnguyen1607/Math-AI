import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import * as worksheetService from "../../services/faculty/worksheetService";
import * as worksheetResultService from "../../services/student/worksheetResultService";
import StudentHeader from "../../components/student/StudentHeader";
import FractionRenderer from "../../components/FractionRenderer";

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
  const [isBai2BottomSheetOpen, setIsBai2BottomSheetOpen] = useState(false);
  const [activeBai2Cach, setActiveBai2Cach] = useState(null);
  const [bai2StepToRemove, setBai2StepToRemove] = useState(null);

  // Bài 3: Free text
  const [bai3BaiLam, setBai3BaiLam] = useState("");
  const [bai3GiaiThich, setBai3GiaiThich] = useState("");

  // Bài 4: Various types
  const [bai4Answers, setBai4Answers] = useState({});

  // Fraction input state for Bài 3
  const [showBai3BaiLamFractionDialog, setShowBai3BaiLamFractionDialog] = useState(false);
  const [showBai3GiaiThichFractionDialog, setShowBai3GiaiThichFractionDialog] = useState(false);
  const [bai3BaiLamFractionNum, setBai3BaiLamFractionNum] = useState("");
  const [bai3BaiLamFractionDen, setBai3BaiLamFractionDen] = useState("");
  const [bai3GiaiThichFractionNum, setBai3GiaiThichFractionNum] = useState("");
  const [bai3GiaiThichFractionDen, setBai3GiaiThichFractionDen] = useState("");

  // Fraction input state for Bài 4
  const [showBai4FractionDialog, setShowBai4FractionDialog] = useState(false);
  const [currentBai4EditField, setCurrentBai4EditField] = useState(null); // { questionId, fieldType, fieldIndex }
  const [bai4FractionNum, setBai4FractionNum] = useState("");
  const [bai4FractionDen, setBai4FractionDen] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // saved, saving, error
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);

  // Kiểm tra classId - nếu không có hoặc là "undefined" thì redirect sang dashboard
  useEffect(() => {
    if (!classId || classId === 'undefined') {
      navigate("/student", { replace: true });
    }
  }, [classId, navigate]);

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

  useEffect(() => {
    if (!worksheetData?.bai_2?.questions) {
      return;
    }
  }, [worksheetData?.bai_2?.questions, bai2Arrangements]);

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

  const handleOpenBai2BottomSheet = (cach) => {
    setActiveBai2Cach(cach);
    setIsBai2BottomSheetOpen(true);
  };

  const handleCloseBai2BottomSheet = () => {
    setIsBai2BottomSheetOpen(false);
    setActiveBai2Cach(null);
  };

  const handleTapAddBai2Step = (questionId) => {
    if (!activeBai2Cach) return;

    setBai2Arrangements((prev) => ({
      ...prev,
      [activeBai2Cach]: [...(prev[activeBai2Cach] || []), questionId],
    }));

    handleCloseBai2BottomSheet();
  };

  const requestRemoveFromArrangement = (cach, index, questionId) => {
    setBai2StepToRemove({ cach, index, questionId });
  };

  const handleCancelRemoveFromArrangement = () => {
    setBai2StepToRemove(null);
  };

  const handleConfirmRemoveFromArrangement = () => {
    if (!bai2StepToRemove) return;

    const { cach, index } = bai2StepToRemove;
    setBai2Arrangements((prev) => ({
      ...prev,
      [cach]: prev[cach].filter((_, i) => i !== index),
    }));

    setBai2StepToRemove(null);
  };

  // Fraction input handlers for Bài 3
  const insertBai3BaiLamFraction = () => {
    if (bai3BaiLamFractionNum && bai3BaiLamFractionDen) {
      setBai3BaiLam(prev => prev + `(${bai3BaiLamFractionNum})/(${bai3BaiLamFractionDen})`);
      setBai3BaiLamFractionNum("");
      setBai3BaiLamFractionDen("");
      setShowBai3BaiLamFractionDialog(false);
    }
  };

  const insertBai3GiaiThichFraction = () => {
    if (bai3GiaiThichFractionNum && bai3GiaiThichFractionDen) {
      setBai3GiaiThich(prev => prev + `(${bai3GiaiThichFractionNum})/(${bai3GiaiThichFractionDen})`);
      setBai3GiaiThichFractionNum("");
      setBai3GiaiThichFractionDen("");
      setShowBai3GiaiThichFractionDialog(false);
    }
  };

  // Fraction input handlers for Bài 4
  const openBai4FractionDialog = (questionId, fieldType, fieldIndex) => {
    setCurrentBai4EditField({ questionId, fieldType, fieldIndex });
    setShowBai4FractionDialog(true);
  };

  const insertBai4Fraction = () => {
    if (bai4FractionNum && bai4FractionDen && currentBai4EditField) {
      const { questionId, fieldType, fieldIndex } = currentBai4EditField;
      const fraction = `(${bai4FractionNum})/(${bai4FractionDen})`;

      setBai4Answers(prev => {
        const newAnswers = { ...prev };
        if (fieldType === "subquestion") {
          if (!newAnswers[questionId]) newAnswers[questionId] = [];
          newAnswers[questionId][fieldIndex] = (newAnswers[questionId][fieldIndex] || "") + fraction;
        } else if (fieldType === "solution") {
          if (!newAnswers[questionId]) newAnswers[questionId] = [];
          newAnswers[questionId][fieldIndex] = (newAnswers[questionId][fieldIndex] || "") + fraction;
        } else {
          newAnswers[questionId] = (newAnswers[questionId] || "") + fraction;
        }
        return newAnswers;
      });

      setBai4FractionNum("");
      setBai4FractionDen("");
      setShowBai4FractionDialog(false);
      setCurrentBai4EditField(null);
    }
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
                <p className="text-justify text-sm font-semibold leading-relaxed text-gray-800 sm:text-base"><FractionRenderer text={worksheetData.context} /></p>
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
                    <span className="text-purple-900 text-lg"><FractionRenderer text={question.text} /></span>
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
                <p className="text-sm text-yellow-700 mt-2 font-semibold">Máy tính: kéo thả. Điện thoại: nhấn [ ➕ Thêm bước ] để chọn bước. 👆</p>
              </div>

              {/* Available items - Desktop only sticky */}
              <div className="hidden md:block sticky top-[14.5rem] z-30 mb-6 rounded-2xl border-2 border-dashed border-blue-400 bg-white pb-4 pt-4 sm:top-[15.5rem]">
                <p className="font-bold text-blue-800 mb-3 text-lg">🎨 Các bước có sẵn:</p>
                <div className="flex flex-wrap gap-3">
                  {(worksheetData.bai_2.questions || []).map((q) => (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, q.id)}
                      className="px-4 py-2 rounded-full text-sm font-bold transition shadow-lg bg-gradient-to-br from-blue-400 to-blue-500 text-white cursor-move hover:from-blue-500 hover:to-blue-600 active:opacity-50 transform hover:scale-110"
                    >
                      <FractionRenderer text={q.text} />
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
                              <button
                                type="button"
                                key={`${cach}-${index}`}
                                onClick={() => requestRemoveFromArrangement(cach, index, questionId)}
                                className="bg-gradient-to-br from-green-400 to-green-500 text-white px-3 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-md hover:from-green-500 hover:to-green-600 transition text-left"
                              >
                                <span className="bg-white text-green-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                                <span><FractionRenderer text={question?.text || ''} /></span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-lg font-semibold">👇 Kéo các bước vào đây...</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenBai2BottomSheet(cach)}
                      className="mt-3 w-full md:hidden rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 px-4 text-sm font-bold shadow-md active:scale-[0.99]"
                    >
                      [ ➕ Thêm bước ]
                    </button>
                  </div>
                ))}
              </div>

              {/* Mobile bottom sheet */}
              {isBai2BottomSheetOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                  <button
                    type="button"
                    aria-label="Đóng danh sách bước"
                    onClick={handleCloseBai2BottomSheet}
                    className="absolute inset-0 bg-black/40"
                  />
                  <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
                    <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-blue-800">🎨 Các bước có sẵn</h3>
                      <button
                        type="button"
                        onClick={handleCloseBai2BottomSheet}
                        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                      >
                        Đóng
                      </button>
                    </div>
                    <p className="mb-4 text-sm font-semibold text-blue-700">
                      {activeBai2Cach ? `Thêm bước vào ${activeBai2Cach.replace("cach_", "Cách ")}` : "Chọn cách giải trước khi thêm bước"}
                    </p>
                    <div className="space-y-2">
                      {(worksheetData.bai_2.questions || []).map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => handleTapAddBai2Step(q.id)}
                          className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition bg-blue-50 text-blue-800 border border-blue-200 active:scale-[0.99]"
                        >
                          <FractionRenderer text={q.text} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Remove confirmation dialog */}
              {bai2StepToRemove && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                  <div className="w-full max-w-sm rounded-2xl bg-white p-5 dshadow-xl">
                    <h3 className="text-lg font-bold text-gray-800">Xóa bước</h3>
                    <p className="mt-2 text-sm text-gray-600">Bạn có muốn xóa bước này không?</p>
                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={handleCancelRemoveFromArrangement}
                        className="flex-1 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200"
                      >
                        Không
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmRemoveFromArrangement}
                        className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-600"
                      >
                        Có
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                  <div className="flex items-center justify-between mb-3">
                    <label className="block font-bold text-green-700 text-lg flex items-center gap-2">
                      <span className="text-2xl">🎯</span>
                      Bài làm:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowBai3BaiLamFractionDialog(true)}
                      disabled={isAlreadySubmitted}
                      className="text-sm font-bold text-white bg-gradient-to-r from-green-500 to-green-600 px-3 py-1 rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ➗ Phân số
                    </button>
                  </div>
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
                  <div className="flex items-center justify-between mb-3">
                    <label className="block font-bold text-green-700 text-lg flex items-center gap-2">
                      <span className="text-2xl">💭</span>
                      Giải thích:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowBai3GiaiThichFractionDialog(true)}
                      disabled={isAlreadySubmitted}
                      className="text-sm font-bold text-white bg-gradient-to-r from-green-500 to-green-600 px-3 py-1 rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ➗ Phân số
                    </button>
                  </div>
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

              {/* Bài 3 - Bài Làm Fraction Dialog */}
              {showBai3BaiLamFractionDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                    <h3 className="text-xl font-bold text-green-700 mb-4">➗ Nhập phân số</h3>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={bai3BaiLamFractionNum}
                        onChange={(e) => setBai3BaiLamFractionNum(e.target.value)}
                        placeholder="Tử số"
                        className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <input
                        type="text"
                        value={bai3BaiLamFractionDen}
                        onChange={(e) => setBai3BaiLamFractionDen(e.target.value)}
                        placeholder="Mẫu số"
                        className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      {(bai3BaiLamFractionNum || bai3BaiLamFractionDen) && (
                        <div className="p-3 bg-green-50 rounded-lg border-2 border-green-200">
                          <p className="text-sm text-gray-600 mb-1">Preview:</p>
                          <p className="text-lg font-bold text-green-700">
                            ({bai3BaiLamFractionNum || '?'})/({bai3BaiLamFractionDen || '?'})
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBai3BaiLamFractionDialog(false);
                          setBai3BaiLamFractionNum("");
                          setBai3BaiLamFractionDen("");
                        }}
                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-400 transition-all"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={insertBai3BaiLamFraction}
                        disabled={!bai3BaiLamFractionNum || !bai3BaiLamFractionDen}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Chèn
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bài 3 - Giải Thích Fraction Dialog */}
              {showBai3GiaiThichFractionDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                    <h3 className="text-xl font-bold text-green-700 mb-4">➗ Nhập phân số</h3>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={bai3GiaiThichFractionNum}
                        onChange={(e) => setBai3GiaiThichFractionNum(e.target.value)}
                        placeholder="Tử số"
                        className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <input
                        type="text"
                        value={bai3GiaiThichFractionDen}
                        onChange={(e) => setBai3GiaiThichFractionDen(e.target.value)}
                        placeholder="Mẫu số"
                        className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      {(bai3GiaiThichFractionNum || bai3GiaiThichFractionDen) && (
                        <div className="p-3 bg-green-50 rounded-lg border-2 border-green-200">
                          <p className="text-sm text-gray-600 mb-1">Preview:</p>
                          <p className="text-lg font-bold text-green-700">
                            ({bai3GiaiThichFractionNum || '?'})/({bai3GiaiThichFractionDen || '?'})
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBai3GiaiThichFractionDialog(false);
                          setBai3GiaiThichFractionNum("");
                          setBai3GiaiThichFractionDen("");
                        }}
                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-400 transition-all"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={insertBai3GiaiThichFraction}
                        disabled={!bai3GiaiThichFractionNum || !bai3GiaiThichFractionDen}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Chèn
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                      <FractionRenderer text={question.content} />
                    </h3>
                    <p className="text-lg text-orange-800 font-semibold mb-4">
                      {question.label}. <FractionRenderer text={question.text} />
                    </p>

                    {question.type === "cau_hoi_nho" && (
                      <div className="space-y-4">
                        {(question.subQuestions || []).map((subQ, subIdx) => (
                          <div
                            key={subQ.id}
                            className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border-2 border-orange-200 hover:border-orange-400 transition"
                          >
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <label className="block font-bold text-orange-700 flex items-center gap-2 flex-1">
                                <span className="bg-orange-200 text-orange-700 px-2 py-1 rounded-full text-sm font-bold">Câu {subIdx + 1}</span>
                                <FractionRenderer text={subQ.text} />
                              </label>
                              <button
                                type="button"
                                onClick={() => openBai4FractionDialog(question.id, "subquestion", subIdx)}
                                disabled={isAlreadySubmitted}
                                className="text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 px-2 py-1 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                ➗
                              </button>
                            </div>
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
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <label className="block font-bold text-orange-700 flex items-center gap-2">
                                  <span className="bg-orange-200 text-orange-700 px-3 py-1 rounded-full text-sm font-bold">🌟 Cách {cacheIdx + 1}</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => openBai4FractionDialog(question.id, "solution", cacheIdx)}
                                  disabled={isAlreadySubmitted}
                                  className="text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 px-2 py-1 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                  ➗
                                </button>
                              </div>
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
                      <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border-2 border-orange-200 hover:border-orange-400 transition">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <label className="block font-bold text-orange-700">Đáp án:</label>
                          <button
                            type="button"
                            onClick={() => openBai4FractionDialog(question.id, "default", 0)}
                            disabled={isAlreadySubmitted}
                            className="text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 px-2 py-1 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            ➗
                          </button>
                        </div>
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
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bài 4 Fraction Dialog */}
          {showBai4FractionDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                <h3 className="text-xl font-bold text-orange-700 mb-4">➗ Nhập phân số</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={bai4FractionNum}
                    onChange={(e) => setBai4FractionNum(e.target.value)}
                    placeholder="Tử số"
                    className="w-full px-4 py-2 border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <input
                    type="text"
                    value={bai4FractionDen}
                    onChange={(e) => setBai4FractionDen(e.target.value)}
                    placeholder="Mẫu số"
                    className="w-full px-4 py-2 border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  {(bai4FractionNum || bai4FractionDen) && (
                    <div className="p-3 bg-orange-50 rounded-lg border-2 border-orange-200">
                      <p className="text-sm text-gray-600 mb-1">Preview:</p>
                      <p className="text-lg font-bold text-orange-700">
                        ({bai4FractionNum || '?'})/({bai4FractionDen || '?'})
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBai4FractionDialog(false);
                      setBai4FractionNum("");
                      setBai4FractionDen("");
                      setCurrentBai4EditField(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-400 transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={insertBai4Fraction}
                    disabled={!bai4FractionNum || !bai4FractionDen}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Chèn
                  </button>
                </div>
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
