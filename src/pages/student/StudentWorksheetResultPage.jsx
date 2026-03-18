import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as worksheetResultService from '../../services/student/worksheetResultService';
import * as worksheetService from '../../services/faculty/worksheetService';
import StudentHeader from '../../components/student/StudentHeader';
import FractionRenderer from '../../components/FractionRenderer';

const StudentWorksheetResultPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { classId, worksheetId, resultId } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [worksheet, setWorksheet] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load result
        const resultData = await worksheetResultService.getWorksheetResult(resultId);
        
        // Convert object arrangements/answers back to arrays if needed
        if (resultData) {
          // Fix Bài 1 selections - convert object to array if needed
          if (resultData.bai_1?.selections && typeof resultData.bai_1.selections === 'object' && !Array.isArray(resultData.bai_1.selections)) {
            // Convert object to array: {0: id1, 1: id2} => [id1, id2]
            resultData.bai_1.selections = Object.values(resultData.bai_1.selections);
          }

          // Fix Bài 2 arrangements - convert object values to arrays
          if (resultData.bai_2?.arrangements && typeof resultData.bai_2.arrangements === 'object') {
            const fixedArrangements = {};
            for (const [key, value] of Object.entries(resultData.bai_2.arrangements)) {
              if (typeof value === 'object' && !Array.isArray(value)) {
                // Convert object to array: {0: q1, 1: q2} => [q1, q2]
                fixedArrangements[key] = Object.values(value);
              } else {
                fixedArrangements[key] = value || [];
              }
            }
            resultData.bai_2.arrangements = fixedArrangements;
          }

          // Fix Bài 4 answers - convert object values to arrays
          if (resultData.bai_4?.answers && typeof resultData.bai_4.answers === 'object') {
            const fixedAnswers = {};
            for (const [key, value] of Object.entries(resultData.bai_4.answers)) {
              if (typeof value === 'object' && !Array.isArray(value)) {
                // Convert object to array: {0: ans1, 1: ans2} => [ans1, ans2]
                fixedAnswers[key] = Object.values(value);
              } else {
                fixedAnswers[key] = value || [];
              }
            }
            resultData.bai_4.answers = fixedAnswers;
          }
        }
        
        setResult(resultData);

        // Load worksheet to get detailed questions
        const worksheetData = await worksheetService.getWorksheetById(worksheetId);
        setWorksheet(worksheetData);
      } catch (error) {
        console.error('Error loading result:', error);
        alert('Lỗi khi tải kết quả bài làm');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [resultId, worksheetId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">⏳</div>
          <p className="text-2xl font-bold text-gray-700">Đang tải kết quả bài làm...</p>
        </div>
      </div>
    );
  }

  if (!result || !worksheet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="mb-6 text-xl font-bold text-gray-700 sm:text-2xl">Không tìm thấy kết quả</p>
            <button
              onClick={() => navigate(`/student/${classId}`)}
              className="touch-btn rounded-lg bg-blue-500 px-6 text-white font-bold hover:bg-blue-600"
            >
              ← Quay lại trang chủ
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
        <button
          onClick={() => navigate(`/student/${classId}`)}
          className="touch-btn mb-5 rounded-full bg-white px-4 text-sm font-semibold text-gray-700 transition-all shadow-md hover:bg-gray-100 hover:shadow-lg sm:mb-6"
        >
          ← Quay lại
        </button>

        {/* Header */}
        <div className="mb-8 text-center sm:mb-10 lg:mb-12">
          <div className="mb-3 text-6xl animate-bounce sm:mb-4 sm:text-8xl">📋</div>
          <h1 className="text-3xl font-bold text-gray-800 sm:text-4xl lg:text-5xl">{worksheet.name}</h1>
          <p className="mt-2 text-base text-gray-600 sm:text-lg lg:text-xl">Chi tiết bài làm của em</p>
        </div>

        {/* Context - Câu hỏi chung */}
        {worksheet.context && (
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-indigo-300">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-5xl">🎯</div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-indigo-700 mb-4">Đề bài:</h2>
                <div className="text-lg text-indigo-900 font-semibold bg-indigo-50 p-6 rounded-2xl border-l-4 border-indigo-500">
                  <FractionRenderer text={worksheet.context} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bài 1: Chọn đáp án */}
        {worksheet.bai_1 && result.bai_1 && (
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-purple-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-5xl">💜</div>
              <h2 className="text-3xl font-bold text-purple-700">Bài 1: Chọn đáp án đúng</h2>
            </div>

            <div className="bg-purple-200 p-4 rounded-2xl mb-6">
              <p className="text-lg font-semibold text-purple-900">{worksheet.bai_1.text}</p>
            </div>

            <div className="space-y-4">
              {(worksheet.bai_1.questions || []).map((question) => {
                const isSelected = result.bai_1.selections?.includes(question.id);
                return (
                  <div
                    key={question.id}
                    className={`p-4 rounded-xl border-3 transition-all ${
                      isSelected
                        ? 'bg-green-50 border-green-400 shadow-md'
                        : 'bg-white border-purple-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{isSelected ? '✅' : '⭕'}</span>
                      <span className={`text-lg font-semibold ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>
                        {question.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {result.bai_1.evaluation?.feedback && (
              <div className="mt-6 p-4 bg-purple-100 rounded-2xl border-2 border-purple-400">
                <p className="text-sm font-semibold text-purple-700">
                  💭 <strong>Nhận xét:</strong> {result.bai_1.evaluation.feedback}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bài 2: Sắp xếp các bước */}
        {worksheet.bai_2 && result.bai_2 && (
          <div className="bg-gradient-to-br from-blue-50 to-cyan-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-blue-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-5xl">💙</div>
              <h2 className="text-3xl font-bold text-blue-700">Bài 2: Sắp xếp các bước</h2>
            </div>

            <div className="bg-blue-200 p-4 rounded-2xl mb-6">
              <p className="text-lg font-semibold text-blue-900">{worksheet.bai_2.text}</p>
            </div>

            <div className="space-y-6">
              {Object.keys(result.bai_2.arrangements || {})
                .sort((a, b) => {
                  const numA = parseInt(a.replace('cach_', ''));
                  const numB = parseInt(b.replace('cach_', ''));
                  return numA - numB;
                })
                .map((cachKey) => {
                const cachNum = cachKey.replace('cach_', '');
                const arrangements = result.bai_2.arrangements[cachKey] || [];
                
                return (
                  <div key={cachKey} className="p-4 bg-white rounded-2xl border-3 border-blue-300">
                    <p className="font-bold text-blue-800 mb-4 text-lg">🌟 Cách {cachNum}:</p>
                    {arrangements.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {arrangements.map((questionId, idx) => {
                          const question = worksheet.bai_2.questions?.find(
                            (q) => q.id === questionId
                          );
                          return (
                            <div
                              key={`${cachKey}-${idx}`}
                              className="bg-gradient-to-br from-blue-400 to-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-md"
                            >
                              <span className="bg-white text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                                {idx + 1}
                              </span>
                              <span>{question?.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">Không có sắp xếp nào</p>
                    )}
                  </div>
                );
              })}
            </div>

            {result.bai_2.evaluation?.feedback && (
              <div className="mt-6 p-4 bg-blue-100 rounded-2xl border-2 border-blue-400">
                <p className="text-sm font-semibold text-blue-700">
                  💭 <strong>Nhận xét:</strong> {result.bai_2.evaluation.feedback}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bài 3: Tự luận */}
        {worksheet.bai_3 && result.bai_3 && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-green-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-5xl">✍️</div>
              <h2 className="text-3xl font-bold text-green-700">Bài 3: Tự luận</h2>
            </div>

            <div className="bg-green-200 p-4 rounded-2xl mb-6">
              <p className="text-lg font-semibold text-green-900">{worksheet.bai_3.text}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bài làm */}
              <div className="p-4 bg-white rounded-2xl border-3 border-green-300">
                <p className="font-bold text-green-700 mb-3 text-lg flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  Bài làm:
                </p>
                <div className="bg-green-50 p-4 rounded-xl max-h-40 overflow-y-auto border-l-4 border-green-500 text-gray-700 whitespace-pre-wrap">
                  {result.bai_3.bai_lam || '(không có)'}
                </div>
              </div>

              {/* Giải thích */}
              <div className="p-4 bg-white rounded-2xl border-3 border-green-300">
                <p className="font-bold text-green-700 mb-3 text-lg flex items-center gap-2">
                  <span className="text-2xl">💭</span>
                  Giải thích:
                </p>
                <div className="bg-green-50 p-4 rounded-xl max-h-40 overflow-y-auto border-l-4 border-green-500 text-gray-700 whitespace-pre-wrap">
                  {result.bai_3.giai_thich || '(không có)'}
                </div>
              </div>
            </div>

            {result.bai_3.evaluation?.feedback && (
              <div className="mt-6 p-4 bg-green-100 rounded-2xl border-2 border-green-400">
                <p className="text-sm font-semibold text-green-700">
                  💭 <strong>Nhận xét:</strong> {result.bai_3.evaluation.feedback}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bài 4: Bài tập nâng cao */}
        {worksheet.bai_4 && result.bai_4 && (
          <div className="bg-gradient-to-br from-orange-50 to-yellow-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-orange-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-5xl">🧩</div>
              <h2 className="text-3xl font-bold text-orange-700">Bài 4: Bài tập nâng cao</h2>
            </div>

            <div className="space-y-8">
              {(worksheet.bai_4.questions || []).map((question, idx) => {
                const studentAnswer = result.bai_4.answers?.[question.id];
                
                return (
                  <div
                    key={question.id}
                    className="p-6 bg-white rounded-2xl border-3 border-orange-300"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <span className="bg-orange-300 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-lg text-orange-800 font-semibold">
                          {question.label}. {question.text}
                        </p>
                        <p className="text-base text-gray-600 mt-1">{question.content}</p>
                      </div>
                    </div>

                    {/* Hiển thị đáp án theo loại */}
                    {question.type === 'cau_hoi_nho' && (
                      <div className="space-y-3 mt-4">
                        {(question.subQuestions || []).map((subQ, subIdx) => (
                          <div
                            key={subQ.id}
                            className="p-3 bg-orange-50 rounded-xl border-2 border-orange-200"
                          >
                            <p className="font-semibold text-orange-700 text-sm mb-2">
                              Câu {subIdx + 1}: {subQ.text}
                            </p>
                            <p className="text-gray-700 bg-white p-2 rounded border-l-4 border-orange-500">
                              {studentAnswer?.[subIdx] || '(không có đáp án)'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === 'so_cach_giai' && (
                      <div className="space-y-3 mt-4">
                        {Array.from({ length: parseInt(question.content) }).map(
                          (_, cacheIdx) => (
                            <div
                              key={cacheIdx}
                              className="p-3 bg-orange-50 rounded-xl border-2 border-orange-200"
                            >
                              <p className="font-semibold text-orange-700 text-sm mb-2">
                                🌟 Cách {cacheIdx + 1}:
                              </p>
                              <p className="text-gray-700 bg-white p-2 rounded border-l-4 border-orange-500 whitespace-pre-wrap">
                                {studentAnswer?.[cacheIdx] || '(không có đáp án)'}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {!question.type && (
                      <div className="mt-4 p-3 bg-orange-50 rounded-xl border-2 border-orange-200">
                        <p className="text-gray-700 bg-white p-2 rounded border-l-4 border-orange-500">
                          {studentAnswer || '(không có đáp án)'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {result.bai_4.evaluation?.feedback && (
              <div className="mt-6 p-4 bg-orange-100 rounded-2xl border-2 border-orange-400">
                <p className="text-sm font-semibold text-orange-700">
                  💭 <strong>Nhận xét:</strong> {result.bai_4.evaluation.feedback}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mb-8 mt-10 flex justify-center gap-4 sm:mt-12">
          <button
            onClick={() => navigate(`/student/${classId}`)}
            className="touch-btn rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 text-sm font-bold text-white shadow-lg transition-all hover:from-blue-600 hover:to-blue-700 sm:text-base"
          >
            <span className="text-lg">🏠</span> Quay lại trang chủ
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentWorksheetResultPage;
