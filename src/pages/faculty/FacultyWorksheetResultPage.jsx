import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import * as worksheetResultService from '../../services/student/worksheetResultService';
import * as worksheetService from '../../services/faculty/worksheetService';
import { evaluateBai1, evaluateBai2, evaluateBai3, evaluateBai4, generateOverallComment } from '../../services/student/InputWorksheetEvaluationService';
import FacultyHeader from '../../components/faculty/FacultyHeader';
import FractionRenderer from '../../components/FractionRenderer';

const FacultyWorksheetResultPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { worksheetId, studentId } = useParams();
  const location = useLocation();
  const classId = location.state?.classId;
  
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [worksheet, setWorksheet] = useState(null);
  const [evaluatingBai1, setEvaluatingBai1] = useState(false);
  const [evaluatingBai2, setEvaluatingBai2] = useState(false);
  const [evaluatingBai3, setEvaluatingBai3] = useState(false);
  const [evaluatingBai4, setEvaluatingBai4] = useState(false);
  const [evaluatingOverall, setEvaluatingOverall] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load all results for this worksheet
        const resultsData = await worksheetResultService.getWorksheetResultsByWorksheet(worksheetId, classId);
        
        // Filter for this specific student
        let studentResult = resultsData?.find(r => r.studentId === studentId);
        if (!studentResult) {
          throw new Error('Result not found');
        }

        // Convert object arrangements/answers back to arrays if needed
        // Fix Bài 1 selections - convert object to array if needed
        if (studentResult.bai_1?.selections && typeof studentResult.bai_1.selections === 'object' && !Array.isArray(studentResult.bai_1.selections)) {
          // Convert object to array: {0: id1, 1: id2} => [id1, id2]
          studentResult.bai_1.selections = Object.values(studentResult.bai_1.selections);
        }

        // Fix Bài 2 arrangements - convert object values to arrays
        if (studentResult.bai_2?.arrangements && typeof studentResult.bai_2.arrangements === 'object') {
          const fixedArrangements = {};
          for (const [key, value] of Object.entries(studentResult.bai_2.arrangements)) {
            if (typeof value === 'object' && !Array.isArray(value)) {
              // Convert object to array: {0: q1, 1: q2} => [q1, q2]
              fixedArrangements[key] = Object.values(value);
            } else {
              fixedArrangements[key] = value || [];
            }
          }
          studentResult.bai_2.arrangements = fixedArrangements;
        }

        // Fix Bài 4 answers - convert object values to arrays
        if (studentResult.bai_4?.answers && typeof studentResult.bai_4.answers === 'object') {
          const fixedAnswers = {};
          for (const [key, value] of Object.entries(studentResult.bai_4.answers)) {
            if (typeof value === 'object' && !Array.isArray(value)) {
              // Convert object to array: {0: ans1, 1: ans2} => [ans1, ans2]
              fixedAnswers[key] = Object.values(value);
            } else {
              fixedAnswers[key] = value || [];
            }
          }
          studentResult.bai_4.answers = fixedAnswers;
        }

        setResult(studentResult);

        // Load worksheet to get detailed questions
        const worksheetData = await worksheetService.getWorksheetById(worksheetId);
        setWorksheet(worksheetData);
      } catch (error) {
        console.error('Error loading data:', error);
        alert('Lỗi khi tải kết quả');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [worksheetId, studentId, classId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">⏳</div>
          <p className="text-2xl font-bold text-gray-700">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  if (!result || !worksheet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <FacultyHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-2xl font-bold text-gray-700 mb-6">Không tìm thấy kết quả</p>
            <button
              onClick={() => navigate(-1)}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg"
            >
              ← Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getNormalizedLevel = (level) => {
    if (!level) return 'cần cố gắng';
    const normalized = level.toLowerCase().trim();
    
    if (normalized.includes('tốt')) return 'tốt';
    if (normalized.includes('đạt') && !normalized.includes('chưa') && !normalized.includes('cần')) return 'đạt';
    if (normalized.includes('cần') || normalized.includes('chưa')) return 'cần cố gắng';
    
    return 'cần cố gắng';
  };

  const getCompetencyColor = (level) => {
    const normalized = getNormalizedLevel(level);
    switch(normalized) {
      case 'tốt': return 'from-green-400 to-green-500';
      case 'đạt': return 'from-blue-400 to-blue-500';
      case 'cần cố gắng': return 'from-red-400 to-red-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const getCompetencyBgColor = (level) => {
    const normalized = getNormalizedLevel(level);
    switch(normalized) {
      case 'tốt': return 'bg-green-50 border-green-300';
      case 'đạt': return 'bg-blue-50 border-blue-300';
      case 'cần cố gắng': return 'bg-red-50 border-red-300';
      default: return 'bg-gray-50 border-gray-300';
    }
  };

  // Helper: Convert arrays to objects for Firestore (no nested arrays allowed)
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

  // Tính toán mức năng lực chung từ điểm
  const calculateOverallLevel = (score) => {
    if (score >= 7) {
      return 'tốt';
    } else if (score >= 4) {
      return 'đạt';
    } else {
      return 'cần cố gắng';
    }
  };

  // Re-evaluate Bài 1
  const handleReEvaluateBai1 = async () => {
    try {
      setEvaluatingBai1(true);
      const evaluation = await evaluateBai1(result, worksheet);
      
      // Update result
      const updatedResult = { ...result };
      updatedResult.bai_1 = {
        ...result.bai_1,
        evaluation: evaluation.evaluation || {}
      };

      // Recalculate overall score
      const newTongDiem = 
        (updatedResult.bai_1.evaluation.diem || 0) +
        (result.bai_2?.evaluation?.diem || 0) +
        (result.bai_3?.evaluation?.diem || 0) +
        (result.bai_4?.evaluation?.diem || 0);
      
      updatedResult.tongDiem = newTongDiem;
      updatedResult.mucNangLucChung = calculateOverallLevel(newTongDiem);

      // Save to database
      const resultId = result.id;
      await worksheetResultService.updateWorksheetResult(resultId, {
        bai_1: convertArraysToObjects(updatedResult.bai_1),
        tongDiem: updatedResult.tongDiem,
        mucNangLucChung: updatedResult.mucNangLucChung
      });

      setResult(updatedResult);
      alert('✅ Đánh giá lại Bài 1 thành công và đã lưu!');
    } catch (error) {
      console.error('Error re-evaluating Bài 1:', error);
      alert('❌ Lỗi khi đánh giá lại Bài 1');
    } finally {
      setEvaluatingBai1(false);
    }
  };

  // Re-evaluate Bài 2
  const handleReEvaluateBai2 = async () => {
    try {
      setEvaluatingBai2(true);
      const evaluation = await evaluateBai2(result, worksheet);
      
      const updatedResult = { ...result };
      updatedResult.bai_2 = {
        ...result.bai_2,
        evaluation: evaluation.evaluation || {}
      };

      const newTongDiem = 
        (result.bai_1?.evaluation?.diem || 0) +
        (updatedResult.bai_2.evaluation.diem || 0) +
        (result.bai_3?.evaluation?.diem || 0) +
        (result.bai_4?.evaluation?.diem || 0);
      
      updatedResult.tongDiem = newTongDiem;
      updatedResult.mucNangLucChung = calculateOverallLevel(newTongDiem);

      // Save to database
      const resultId = result.id;
      await worksheetResultService.updateWorksheetResult(resultId, {
        bai_2: convertArraysToObjects(updatedResult.bai_2),
        tongDiem: updatedResult.tongDiem,
        mucNangLucChung: updatedResult.mucNangLucChung
      });

      setResult(updatedResult);
      alert('✅ Đánh giá lại Bài 2 thành công và đã lưu!');
    } catch (error) {
      console.error('Error re-evaluating Bài 2:', error);
      alert('❌ Lỗi khi đánh giá lại Bài 2');
    } finally {
      setEvaluatingBai2(false);
    }
  };

  // Re-evaluate Bài 3
  const handleReEvaluateBai3 = async () => {
    try {
      setEvaluatingBai3(true);
      const evaluation = await evaluateBai3(result, worksheet);
      
      const updatedResult = { ...result };
      updatedResult.bai_3 = {
        ...result.bai_3,
        evaluation: evaluation.evaluation || {}
      };

      const newTongDiem = 
        (result.bai_1?.evaluation?.diem || 0) +
        (result.bai_2?.evaluation?.diem || 0) +
        (updatedResult.bai_3.evaluation.diem || 0) +
        (result.bai_4?.evaluation?.diem || 0);
      
      updatedResult.tongDiem = newTongDiem;
      updatedResult.mucNangLucChung = calculateOverallLevel(newTongDiem);

      // Save to database
      const resultId = result.id;
      await worksheetResultService.updateWorksheetResult(resultId, {
        bai_3: convertArraysToObjects(updatedResult.bai_3),
        tongDiem: updatedResult.tongDiem,
        mucNangLucChung: updatedResult.mucNangLucChung
      });

      setResult(updatedResult);
      alert('✅ Đánh giá lại Bài 3 thành công và đã lưu!');
    } catch (error) {
      console.error('Error re-evaluating Bài 3:', error);
      alert('❌ Lỗi khi đánh giá lại Bài 3');
    } finally {
      setEvaluatingBai3(false);
    }
  };

  // Re-evaluate Bài 4
  const handleReEvaluateBai4 = async () => {
    try {
      setEvaluatingBai4(true);
      const evaluation = await evaluateBai4(result, worksheet);
      
      const updatedResult = { ...result };
      updatedResult.bai_4 = {
        ...result.bai_4,
        evaluation: evaluation.evaluation || {}
      };

      const newTongDiem = 
        (result.bai_1?.evaluation?.diem || 0) +
        (result.bai_2?.evaluation?.diem || 0) +
        (result.bai_3?.evaluation?.diem || 0) +
        (updatedResult.bai_4.evaluation.diem || 0);
      
      updatedResult.tongDiem = newTongDiem;
      updatedResult.mucNangLucChung = calculateOverallLevel(newTongDiem);

      // Save to database
      const resultId = result.id;
      await worksheetResultService.updateWorksheetResult(resultId, {
        bai_4: convertArraysToObjects(updatedResult.bai_4),
        tongDiem: updatedResult.tongDiem,
        mucNangLucChung: updatedResult.mucNangLucChung
      });

      setResult(updatedResult);
      alert('✅ Đánh giá lại Bài 4 thành công và đã lưu!');
    } catch (error) {
      console.error('Error re-evaluating Bài 4:', error);
      alert('❌ Lỗi khi đánh giá lại Bài 4');
    } finally {
      setEvaluatingBai4(false);
    }
  };

  // Re-evaluate Overall Comment
  const handleReEvaluateOverall = async () => {
    try {
      setEvaluatingOverall(true);
      const nhanXetChung = await generateOverallComment(
        {
          bai_1: result.bai_1,
          bai_2: result.bai_2,
          bai_3: result.bai_3,
          bai_4: result.bai_4
        },
        result.tongDiem,
        result.mucNangLucChung
      );
      
      // Save to database
      const resultId = result.id;
      await worksheetResultService.updateWorksheetResult(resultId, {
        nhanXetChung: nhanXetChung
      });

      setResult(prev => ({
        ...prev,
        nhanXetChung: nhanXetChung
      }));
      alert('✅ Đánh giá lại nhận xét chung thành công và đã lưu!');
    } catch (error) {
      console.error('Error re-evaluating overall comment:', error);
      alert('❌ Lỗi khi đánh giá lại nhận xét chung');
    } finally {
      setEvaluatingOverall(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <FacultyHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="px-8 py-8 max-w-7xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 px-4 py-2 bg-white hover:bg-gray-100 rounded-full font-semibold text-gray-700 transition-all shadow-md hover:shadow-lg"
        >
          ← Quay lại
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">👨‍🎓</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{result.studentName}</h1>
          <p className="text-xl text-gray-600">{worksheet.name}</p>
        </div>

        {/* Overall Score and Competency */}
        <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-3xl shadow-lg p-8 border-4 border-orange-300 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score */}
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700 mb-3">Tổng điểm</p>
              <p className="text-5xl font-bold text-orange-600">
                {result.tongDiem || 0}
                <span className="text-3xl text-gray-600">/8</span>
              </p>
            </div>

            {/* Competency Level */}
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700 mb-3">Mức năng lực</p>
              <span className={`inline-block px-6 py-3 rounded-full font-bold text-white text-2xl bg-gradient-to-r ${getCompetencyColor(result.mucNangLucChung)}`}>
                {result.mucNangLucChung ? (result.mucNangLucChung.charAt(0).toUpperCase() + result.mucNangLucChung.slice(1)) : 'Chưa đánh giá'}
              </span>
            </div>

            {/* Percentage */}
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700 mb-3">Hoàn thành</p>
              <p className="text-5xl font-bold text-blue-600">
                {((result.tongDiem / 8) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        {/* Bài 1 */}
        {worksheet.bai_1 && result.bai_1 && (
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-purple-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-5xl">💜</div>
              <h2 className="text-3xl font-bold text-purple-700">Bài 1: Chọn đáp án đúng</h2>
            </div>

            <div className="bg-purple-200 p-4 rounded-2xl mb-6">
              <p className="text-lg font-semibold text-purple-900">{worksheet.bai_1.text}</p>
            </div>

            <div className="space-y-4 mb-6">
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
                        <FractionRenderer text={question.text} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bài 1 Evaluation - Tiêu chí 1 */}
            {result.bai_1?.evaluation && Object.keys(result.bai_1.evaluation).length > 0 && (
              <div className={`p-4 rounded-2xl border-2 ${getCompetencyBgColor(result.bai_1.evaluation.muc_nang_luc)}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-purple-700 text-sm">📌 Tiêu chí 1: Nhận biết được vấn đề</p>
                  <button
                    onClick={handleReEvaluateBai1}
                    disabled={evaluatingBai1}
                    className="px-3 py-1 bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1"
                    title="Đánh giá lại bài 1 nếu API bị lỗi"
                  >
                    {evaluatingBai1 ? '⏳' : '🔄'} {evaluatingBai1 ? 'Đánh giá...' : 'Đánh giá lại'}
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Điểm</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {result.bai_1.evaluation.diem || 0}/2
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Mức năng lực</p>
                    <span className={`inline-block px-4 py-1 rounded-full font-bold text-white text-sm bg-gradient-to-r ${getCompetencyColor(result.bai_1.evaluation.muc_nang_luc)}`}>
                      {result.bai_1.evaluation.muc_nang_luc ? (result.bai_1.evaluation.muc_nang_luc.charAt(0).toUpperCase() + result.bai_1.evaluation.muc_nang_luc.slice(1)) : 'N/A'}
                    </span>
                  </div>
                </div>
                {result.bai_1.evaluation.nhan_xet && (
                  <p className="text-sm font-semibold text-gray-700 p-3 bg-white rounded border-l-4 border-purple-500">
                    💭 <strong>Đánh giá:</strong> {result.bai_1.evaluation.nhan_xet}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bài 2 */}
        {worksheet.bai_2 && result.bai_2 && (
          <div className="bg-gradient-to-br from-blue-50 to-cyan-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-blue-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-5xl">💙</div>
              <h2 className="text-3xl font-bold text-blue-700">Bài 2: Sắp xếp các bước</h2>
            </div>

            <div className="bg-blue-200 p-4 rounded-2xl mb-6">
              <p className="text-lg font-semibold text-blue-900">{worksheet.bai_2.text}</p>
            </div>

            <div className="space-y-6 mb-6">
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
                              <span><FractionRenderer text={question?.text || ''} /></span>
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

            {/* Bài 2 Evaluation - Tiêu chí 2 */}
            {result.bai_2?.evaluation && Object.keys(result.bai_2.evaluation).length > 0 && (
              <div className={`p-4 rounded-2xl border-2 ${getCompetencyBgColor(result.bai_2.evaluation.muc_nang_luc)}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-blue-700 text-sm">📌 Tiêu chí 2: Nêu được cách thức giải quyết vấn đề</p>
                  <button
                    onClick={handleReEvaluateBai2}
                    disabled={evaluatingBai2}
                    className="px-3 py-1 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1"
                    title="Đánh giá lại bài 2 nếu API bị lỗi"
                  >
                    {evaluatingBai2 ? '⏳' : '🔄'} {evaluatingBai2 ? 'Đánh giá...' : 'Đánh giá lại'}
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Điểm</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {result.bai_2.evaluation.diem || 0}/2
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Mức năng lực</p>
                    <span className={`inline-block px-4 py-1 rounded-full font-bold text-white text-sm bg-gradient-to-r ${getCompetencyColor(result.bai_2.evaluation.muc_nang_luc)}`}>
                      {result.bai_2.evaluation.muc_nang_luc ? (result.bai_2.evaluation.muc_nang_luc.charAt(0).toUpperCase() + result.bai_2.evaluation.muc_nang_luc.slice(1)) : 'N/A'}
                    </span>
                  </div>
                </div>
                {result.bai_2.evaluation.nhan_xet && (
                  <p className="text-sm font-semibold text-gray-700 p-3 bg-white rounded border-l-4 border-blue-500">
                    💭 <strong>Đánh giá:</strong> {result.bai_2.evaluation.nhan_xet}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bài 3 */}
        {worksheet.bai_3 && result.bai_3 && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-3xl shadow-lg p-8 mb-8 border-4 border-green-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-5xl">✍️</div>
              <h2 className="text-3xl font-bold text-green-700">Bài 3: Tự luận</h2>
            </div>

            <div className="bg-green-200 p-4 rounded-2xl mb-6">
              <p className="text-lg font-semibold text-green-900">{worksheet.bai_3.text}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="p-4 bg-white rounded-2xl border-3 border-green-300">
                <p className="font-bold text-green-700 mb-3 text-lg flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  Bài làm:
                </p>
                <div className="bg-green-50 p-4 rounded-xl max-h-40 overflow-y-auto border-l-4 border-green-500 text-gray-700 whitespace-pre-wrap">
                  {result.bai_3.bai_lam ? <FractionRenderer text={result.bai_3.bai_lam} /> : '(không có)'}
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border-3 border-green-300">
                <p className="font-bold text-green-700 mb-3 text-lg flex items-center gap-2">
                  <span className="text-2xl">💭</span>
                  Giải thích:
                </p>
                <div className="bg-green-50 p-4 rounded-xl max-h-40 overflow-y-auto border-l-4 border-green-500 text-gray-700 whitespace-pre-wrap">
                  {result.bai_3.giai_thich ? <FractionRenderer text={result.bai_3.giai_thich} /> : '(không có)'}
                </div>
              </div>
            </div>

            {/* Bài 3 Evaluation - Tiêu chí 3 */}
            {result.bai_3?.evaluation && Object.keys(result.bai_3.evaluation).length > 0 && (
              <div className={`p-4 rounded-2xl border-2 ${getCompetencyBgColor(result.bai_3.evaluation.muc_nang_luc)}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-green-700 text-sm">📌 Tiêu chí 3: Trình bày được cách thức giải quyết vấn đề</p>
                  <button
                    onClick={handleReEvaluateBai3}
                    disabled={evaluatingBai3}
                    className="px-3 py-1 bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1"
                    title="Đánh giá lại bài 3 nếu API bị lỗi"
                  >
                    {evaluatingBai3 ? '⏳' : '🔄'} {evaluatingBai3 ? 'Đánh giá...' : 'Đánh giá lại'}
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Điểm</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {result.bai_3.evaluation.diem || 0}/2
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Mức năng lực</p>
                    <span className={`inline-block px-4 py-1 rounded-full font-bold text-white text-sm bg-gradient-to-r ${getCompetencyColor(result.bai_3.evaluation.muc_nang_luc)}`}>
                      {result.bai_3.evaluation.muc_nang_luc ? (result.bai_3.evaluation.muc_nang_luc.charAt(0).toUpperCase() + result.bai_3.evaluation.muc_nang_luc.slice(1)) : 'N/A'}
                    </span>
                  </div>
                </div>
                {result.bai_3.evaluation.nhan_xet && (
                  <p className="text-sm font-semibold text-gray-700 p-3 bg-white rounded border-l-4 border-green-500">
                    💭 <strong>Đánh giá:</strong> {result.bai_3.evaluation.nhan_xet}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bài 4 */}
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
                          {question.label}. <FractionRenderer text={question.text} />
                        </p>
                        <p className="text-base text-gray-600 mt-1"><FractionRenderer text={question.content} /></p>
                      </div>
                    </div>

                    {/* Display answers */}
                    {question.type === 'cau_hoi_nho' && (
                      <div className="space-y-3 mt-4 mb-4">
                        {(question.subQuestions || []).map((subQ, subIdx) => (
                          <div
                            key={subQ.id}
                            className="p-3 bg-orange-50 rounded-xl border-2 border-orange-200"
                          >
                            <p className="font-semibold text-orange-700 text-sm mb-2">
                              Câu {subIdx + 1}: <FractionRenderer text={subQ.text} />
                            </p>
                            <p className="text-gray-700 bg-white p-2 rounded border-l-4 border-orange-500">
                              {studentAnswer?.[subIdx] ? <FractionRenderer text={studentAnswer[subIdx]} /> : '(không có đáp án)'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === 'so_cach_giai' && (
                      <div className="space-y-3 mt-4 mb-4">
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
                                {studentAnswer?.[cacheIdx] ? <FractionRenderer text={studentAnswer[cacheIdx]} /> : '(không có đáp án)'}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {!question.type && (
                      <div className="mt-4 mb-4 p-3 bg-orange-50 rounded-xl border-2 border-orange-200">
                        <p className="text-gray-700 bg-white p-2 rounded border-l-4 border-orange-500">
                          {studentAnswer ? <FractionRenderer text={studentAnswer} /> : '(không có đáp án)'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bài 4 Evaluation - Tiêu chí 4 */}
            {result.bai_4?.evaluation && Object.keys(result.bai_4.evaluation).length > 0 && (
              <div className={`p-4 rounded-2xl border-2 mt-8 ${getCompetencyBgColor(result.bai_4.evaluation.muc_nang_luc)}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-orange-700 text-sm">📌 Tiêu chí 4: Kiểm tra và vận dụng giải pháp</p>
                  <button
                    onClick={handleReEvaluateBai4}
                    disabled={evaluatingBai4}
                    className="px-3 py-1 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1"
                    title="Đánh giá lại bài 4 nếu API bị lỗi"
                  >
                    {evaluatingBai4 ? '⏳' : '🔄'} {evaluatingBai4 ? 'Đánh giá...' : 'Đánh giá lại'}
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Điểm</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {result.bai_4.evaluation.diem || 0}/2
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Mức năng lực</p>
                    <span className={`inline-block px-4 py-1 rounded-full font-bold text-white text-sm bg-gradient-to-r ${getCompetencyColor(result.bai_4.evaluation.muc_nang_luc)}`}>
                      {result.bai_4.evaluation.muc_nang_luc ? (result.bai_4.evaluation.muc_nang_luc.charAt(0).toUpperCase() + result.bai_4.evaluation.muc_nang_luc.slice(1)) : 'N/A'}
                    </span>
                  </div>
                </div>
                {result.bai_4.evaluation.nhan_xet && (
                  <p className="text-sm font-semibold text-gray-700 p-3 bg-white rounded border-l-4 border-orange-500">
                    💭 <strong>Đánh giá:</strong> {result.bai_4.evaluation.nhan_xet}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* General Comment */}
        {result.nhanXetChung && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl shadow-lg p-8 border-4 border-indigo-300 mb-8">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="text-5xl flex-shrink-0">📝</div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-indigo-700 mb-4">Nhận xét chung</p>
                  <p className="text-lg text-gray-700 leading-relaxed">{result.nhanXetChung}</p>
                </div>
              </div>
              <button
                onClick={handleReEvaluateOverall}
                disabled={evaluatingOverall}
                className="px-3 py-1 bg-gradient-to-r from-indigo-400 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1 flex-shrink-0"
                title="Đánh giá lại nhận xét chung nếu API bị lỗi"
              >
                {evaluatingOverall ? '⏳' : '🔄'} {evaluatingOverall ? 'Đánh giá...' : 'Đánh giá'}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4 justify-center mt-12 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
          >
            <span className="text-lg">🔙</span> Quay lại danh sách
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyWorksheetResultPage;
