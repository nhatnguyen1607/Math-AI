import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as worksheetService from '../../services/faculty/worksheetService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyWorksheetEditorPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const classId = location.state?.classId;
  const worksheetType = location.state?.worksheetType; // 'input' or 'output'
  const selectedClass = location.state?.selectedClass;
  const worksheetId = location.state?.worksheetId; // ID nếu edit
  
  const [worksheetName, setWorksheetName] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedWorksheet, setSavedWorksheet] = useState(null);

  // Bài 1
  const [bai1Questions, setBai1Questions] = useState([]);
  const [bai1Input, setBai1Input] = useState('');
  const [bai1Explanation, setBai1Explanation] = useState('');

  // Bài 2
  const [bai2Questions, setBai2Questions] = useState([]);
  const [bai2Input, setBai2Input] = useState('');
  const [bai2Solutions, setBai2Solutions] = useState('');
  const [bai2Explanation, setBai2Explanation] = useState('');

  // Bài 3
  const [bai3Explanation, setBai3Explanation] = useState('');

  // Bài 4
  const [bai4Questions, setBai4Questions] = useState([]);
  const [, setExpandedBai4] = useState(null);
  const [bai4Explanation, setBai4Explanation] = useState('');

  // Load worksheet data
  const loadWorksheetData = useCallback(async () => {
    if (!worksheetId) {
      console.log('No worksheetId provided, skipping load');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Loading worksheet with ID:', worksheetId);
      const worksheet = await worksheetService.getWorksheetById(worksheetId);
      console.log('Worksheet loaded:', worksheet);
      
      // Populate tất cả states
      setWorksheetName(worksheet.name || '');
      setContext(worksheet.context || '');
      setSavedWorksheet(worksheet);
      
      // Bài 1
      if (worksheet.bai_1) {
        setBai1Questions(worksheet.bai_1.questions || []);
        setBai1Explanation(worksheet.bai_1.explanation || '');
      }
      
      // Bài 2
      if (worksheet.bai_2) {
        setBai2Questions(worksheet.bai_2.questions || []);
        setBai2Solutions(worksheet.bai_2.so_cach_giai || '');
        setBai2Explanation(worksheet.bai_2.explanation || '');
      }
      
      // Bài 3
      if (worksheet.bai_3) {
        setBai3Explanation(worksheet.bai_3.explanation || '');
      }
      
      // Bài 4
      if (worksheet.bai_4) {
        setBai4Questions(worksheet.bai_4.questions || []);
        setBai4Explanation(worksheet.bai_4.explanation || '');
      }
    } catch (error) {
      console.error('Error loading worksheet:', error);
      // Không show alert, chỉ log error - có thể user muốn tạo mới thay vì edit
      console.warn('Failed to load worksheet - may be creating new one');
    } finally {
      setLoading(false);
    }
  }, [worksheetId]);

  // Validate inputs
  useEffect(() => {
    if (!classId || !worksheetType) {
      navigate('/faculty', { replace: true });
      return;
    }

    // Load dữ liệu nếu edit
    if (worksheetId) {
      loadWorksheetData();
    }
  }, [classId, worksheetType, navigate, worksheetId, loadWorksheetData]);

  // Save worksheet automatically
  const handleSaveWorksheet = async () => {
    if (!worksheetName.trim()) {
      alert('Vui lòng nhập tên phiếu bài tập');
      return;
    }

    try {
      setLoading(true);
      
      const worksheetData = {
        type: worksheetType,
        name: worksheetName,
        context: context,
        bai_1: {
          text: 'Hãy đánh dấu (✔) vào tất cả các phát biểu đúng về thông tin của bài toán',
          questions: bai1Questions,
          explanation: bai1Explanation
        },
        bai_2: {
          text: 'Hãy chọn và sắp xếp các bước tính sau theo thứ tự đúng để giải bài toán:',
          so_cach_giai: bai2Solutions,
          questions: bai2Questions,
          explanation: bai2Explanation
        },
        bai_3: {
          text: 'Hãy trình bày bài giải của bài toán trên theo 1 cách mà em chọn và giải thích vì sao em thực hiện các bước tính đó: ',
          explanation: bai3Explanation
        },
        bai_4: {
          questions: bai4Questions,
          explanation: bai4Explanation
        }
      };

      let savedData;
      if (savedWorksheet && savedWorksheet.id) {
        // Update existing
        try {
          await worksheetService.updateWorksheet(savedWorksheet.id, worksheetData);
          savedData = { id: savedWorksheet.id, ...worksheetData };
        } catch (error) {
          // Nếu update fail vì document không tồn tại, tạo mới
          if (error.message?.includes('No document to update')) {
            const newWorksheet = await worksheetService.createWorksheet(
              classId,
              user.uid,
              worksheetData
            );
            savedData = newWorksheet;
          } else {
            throw error;
          }
        }
      } else {
        // Create new
        const newWorksheet = await worksheetService.createWorksheet(
          classId,
          user.uid,
          worksheetData
        );
        savedData = newWorksheet;
      }

      setSavedWorksheet(savedData);
      console.log('Worksheet saved successfully with ID:', savedData.id);
      alert('Phiếu bài tập đã lưu thành công!');
    } catch (error) {
      console.error('Error saving worksheet:', error);
      alert('Lỗi khi lưu phiếu bài tập: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Bài 1 functions
  const addBai1Question = () => {
    if (!bai1Input.trim()) return;
    
    const newQuestion = {
      id: `q_${Date.now()}_${Math.random()}`,
      text: bai1Input
    };
    
    setBai1Questions([...bai1Questions, newQuestion]);
    setBai1Input('');
  };

  const removeBai1Question = (id) => {
    setBai1Questions(bai1Questions.filter(q => q.id !== id));
  };

  // Bài 2 functions
  const addBai2Question = () => {
    if (!bai2Input.trim()) return;
    
    const newQuestion = {
      id: `q_${Date.now()}_${Math.random()}`,
      text: bai2Input
    };
    
    setBai2Questions([...bai2Questions, newQuestion]);
    setBai2Input('');
  };

  const removeBai2Question = (id) => {
    setBai2Questions(bai2Questions.filter(q => q.id !== id));
  };

  // Bài 4 functions
  const addBai4Question = () => {
    const questionIndex = bai4Questions.length;
    const label = String.fromCharCode(97 + questionIndex); // a, b, c, ...
    
    const newQuestion = {
      id: `q_${Date.now()}_${Math.random()}`,
      text: '',
      label: label,
      type: null,
      content: null,
      subQuestions: []
    };
    
    setBai4Questions([...bai4Questions, newQuestion]);
  };

  const removeBai4Question = (id) => {
    setBai4Questions(bai4Questions.filter(q => q.id !== id));
  };

  const updateBai4Question = (id, field, value) => {
    setBai4Questions(bai4Questions.map(q =>
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const addBai4SubQuestion = (questionId) => {
    setBai4Questions(bai4Questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          subQuestions: [
            ...(q.subQuestions || []),
            { id: `sub_${Date.now()}_${Math.random()}`, text: '' }
          ]
        };
      }
      return q;
    }));
  };

  const removeBai4SubQuestion = (questionId, subQuestionId) => {
    setBai4Questions(bai4Questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          subQuestions: (q.subQuestions || []).filter(sq => sq.id !== subQuestionId)
        };
      }
      return q;
    }));
  };

  const updateBai4SubQuestion = (questionId, subQuestionId, text) => {
    setBai4Questions(bai4Questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          subQuestions: (q.subQuestions || []).map(sq =>
            sq.id === subQuestionId ? { ...sq, text: text } : sq
          )
        };
      }
      return q;
    }));
  };

  const updateBai4SolutionNumber = (id, soSolutions) => {
    setBai4Questions(bai4Questions.map(q =>
      q.id === id ? { ...q, content: soSolutions } : q
    ));
  };

  const handleFinish = async () => {
    if (!worksheetName.trim()) {
      alert('Vui lòng nhập tên phiếu bài tập');
      return;
    }

    try {
      setLoading(true);
      
      const worksheetData = {
        type: worksheetType,
        name: worksheetName,
        context: context,
        bai_1: {
          text: 'Hãy đánh dấu (✔) vào tất cả các phát biểu đúng về thông tin của bài toán',
          questions: bai1Questions,
          explanation: bai1Explanation
        },
        bai_2: {
          text: 'Hãy chọn và sắp xếp các bước tính sau theo thứ tự đúng để giải bài toán:',
          so_cach_giai: bai2Solutions,
          questions: bai2Questions,
          explanation: bai2Explanation
        },
        bai_3: {
          text: 'Hãy trình bày bài giải của bài toán trên theo 1 cách mà em chọn và giải thích vì sao em thực hiện các bước tính đó: ',
          explanation: bai3Explanation
        },
        bai_4: {
          questions: bai4Questions,
          explanation: bai4Explanation
        }
      };

      let finalWorksheet = savedWorksheet;

      if (!savedWorksheet) {
        finalWorksheet = await worksheetService.createWorksheet(
          classId,
          user.uid,
          worksheetData
        );
      } else {
        try {
          await worksheetService.updateWorksheet(savedWorksheet.id, worksheetData);
        } catch (error) {
          if (error.message?.includes('No document to update')) {
            finalWorksheet = await worksheetService.createWorksheet(
              classId,
              user.uid,
              worksheetData
            );
          } else {
            throw error;
          }
        }
      }

      if (finalWorksheet?.id) {
        navigate('/faculty/worksheet/management', {
          state: {
            classId,
            selectedClass,
            worksheetType
          }
        });
      }
    } catch (error) {
      console.error('Error finishing worksheet:', error);
      alert('Lỗi khi hoàn thành: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <FacultyHeader user={user} onLogout={onSignOut} />

      {loading && !worksheetName && worksheetId ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-xl text-gray-600">Đang tải phiếu bài tập...</p>
          </div>
        </div>
      ) : (
        <div className="px-8 lg:px-12 py-8">
          <div className="max-w-6xl mx-auto w-full">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  Tạo phiếu bài tập
                </h1>
                <p className="text-gray-600">
                  Loại: <span className="font-bold text-blue-600">
                    {worksheetType === 'input' ? 'Phiếu đầu vào' : 'Phiếu đầu ra'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => navigate('/faculty', { state: { selectedClass } })}
                className="px-4 py-2 hover:bg-purple-100 hover:text-purple-700 rounded-lg transition-all duration-300 text-gray-700 flex items-center gap-2 font-semibold"
              >
                <span className="text-lg">←</span> Quay lại
              </button>
            </div>

            {/* Main Form */}
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            {/* Tên phiếu bài tập */}
            <div className="mb-8">
              <label className="block text-lg font-bold text-gray-800 mb-3">
                Tên phiếu bài tập <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={worksheetName}
                onChange={(e) => setWorksheetName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all duration-300"
                placeholder="Nhập tên phiếu bài tập"
              />
            </div>

            {/* Context */}
            <div className="mb-8">
              <label className="block text-lg font-bold text-gray-800 mb-3">
                Câu hỏi chung (Context)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all duration-300 resize-none"
                rows="4"
                placeholder="Nhập câu hỏi chung cho phiếu bài tập"
              />
            </div>

            {/* Bài 1 */}
            <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
              <h3 className="text-2xl font-bold text-gray-800 mb-3">📋 Bài 1</h3>
              <p className="text-gray-700 mb-4 p-3 bg-white rounded-lg border-l-4 border-purple-500">
                Hãy đánh dấu (✔) vào tất cả các phát biểu đúng về thông tin của bài toán
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nhập câu hỏi:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bai1Input}
                    onChange={(e) => setBai1Input(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addBai1Question()}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                    placeholder="Nhập câu hỏi"
                  />
                  <button
                    onClick={addBai1Question}
                    className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all duration-300"
                  >
                    ➕ Thêm
                  </button>
                </div>
              </div>

              {/* Danh sách câu hỏi Bài 1 */}
              <div className="space-y-2 mb-4">
                {bai1Questions.map((q, idx) => (
                  <div key={q.id} className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm">
                    <span className="font-bold text-purple-600 min-w-fit">{idx + 1}.</span>
                    <span className="flex-1 text-gray-700">{q.text}</span>
                    <button
                      onClick={() => removeBai1Question(q.id)}
                      className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded transition-all duration-300 text-sm font-semibold"
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                ))}
              </div>

              {/* Explanation cho Bài 1 */}
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border-l-4 border-purple-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Hướng dẫn cho AI nhận xét:
                </label>
                <textarea
                  value={bai1Explanation}
                  onChange={(e) => setBai1Explanation(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 resize-none"
                  rows="3"
                  placeholder="VD: Mức cần cố gắng: Thiếu bất kỳ câu nào → 0 điểm&#10;Mức đạt: Chọn đúng 1,2,3 → 1 điểm&#10;Mức tốt: Chọn đúng 1,2,3,4 → 2 điểm"
                />
              </div>
            </div>

            {/* Bài 2 */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
              <h3 className="text-2xl font-bold text-gray-800 mb-3">📋 Bài 2</h3>
              <p className="text-gray-700 mb-4 p-3 bg-white rounded-lg border-l-4 border-blue-500">
                Hãy chọn và sắp xếp các bước tính sau theo thứ tự đúng để giải bài toán:
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Số cách giải:
                </label>
                <input
                  type="number"
                  min="1"
                  value={bai2Solutions}
                  onChange={(e) => setBai2Solutions(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Nhập số cách giải"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nhập câu hỏi:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bai2Input}
                    onChange={(e) => setBai2Input(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addBai2Question()}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Nhập câu hỏi"
                  />
                  <button
                    onClick={addBai2Question}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all duration-300"
                  >
                    ➕ Thêm
                  </button>
                </div>
              </div>

              {/* Danh sách câu hỏi Bài 2 */}
              <div className="space-y-2 mb-4">
                {bai2Questions.map((q, idx) => (
                  <div key={q.id} className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm">
                    <span className="font-bold text-blue-600 min-w-fit">{idx + 1}.</span>
                    <span className="flex-1 text-gray-700">{q.text}</span>
                    <button
                      onClick={() => removeBai2Question(q.id)}
                      className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded transition-all duration-300 text-sm font-semibold"
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                ))}
              </div>

              {/* Explanation cho Bài 2 */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Hướng dẫn cho AI nhận xét:
                </label>
                <textarea
                  value={bai2Explanation}
                  onChange={(e) => setBai2Explanation(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                  rows="3"
                  placeholder="VD: Mức cần cố gắng: Sắp xếp sai thứ tự → 0 điểm&#10;Mức đạt: Sắp xếp đúng 1 cách giải → 1 điểm&#10;Mức tốt: Sắp xếp đúng 2+ cách giải → 2 điểm"
                />
              </div>
            </div>

            {/* Bài 3 */}
            <div className="mb-8 p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border-2 border-green-200">
              <h3 className="text-2xl font-bold text-gray-800 mb-3">📋 Bài 3</h3>
              <p className="text-gray-700 p-3 bg-white rounded-lg border-l-4 border-green-500 mb-4">
                Hãy trình bày bài giải của bài toán trên theo 1 cách mà em chọn và giải thích vì sao em thực hiện các bước tính đó:
              </p>
              <p className="text-sm text-gray-600 italic mb-4">
                (Học sinh sẽ tự do trình bày bài giải của mình)
              </p>

              {/* Explanation cho Bài 3 */}
              <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Hướng dẫn cho AI nhận xét:
                </label>
                <textarea
                  value={bai3Explanation}
                  onChange={(e) => setBai3Explanation(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500 resize-none"
                  rows="3"
                  placeholder="VD: Mức cần cố gắng: Không trình bày hoặc trình bày không rõ → 0 điểm&#10;Mức đạt: Trình bày đúng nhưng giải thích chưa đầy đủ → 1 điểm&#10;Mức tốt: Trình bày đúng và giải thích đầy đủ các bước → 2 điểm"
                />
              </div>
            </div>

            {/* Bài 4 */}
            <div className="mb-8 p-6 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200">
              <h3 className="text-2xl font-bold text-gray-800 mb-3">📋 Bài 4</h3>

              <button
                onClick={addBai4Question}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all duration-300 mb-4"
              >
                ➕ Thêm câu hỏi (a, b, c, ...)
              </button>

              {/* Danh sách câu hỏi Bài 4 */}
              <div className="space-y-4">
                {bai4Questions.map((q) => (
                  <div key={q.id} className="p-4 bg-white rounded-lg shadow-md border-l-4 border-orange-400">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl font-bold text-orange-600">{q.label})</span>
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateBai4Question(q.id, 'text', e.target.value)}
                        className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500"
                        placeholder="Nhập text câu hỏi"
                      />
                      <button
                        onClick={() => removeBai4Question(q.id)}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded transition-all duration-300 text-sm font-semibold"
                      >
                        🗑️ Xóa
                      </button>
                    </div>

                    {/* Type selector */}
                    {!q.type && (
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => {
                            updateBai4Question(q.id, 'type', 'so_cach_giai');
                            setExpandedBai4(q.id);
                          }}
                          className="flex-1 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold rounded-lg transition-all duration-300"
                        >
                          ➕ Thêm cách giải
                        </button>
                        <button
                          onClick={() => {
                            updateBai4Question(q.id, 'type', 'cau_hoi_nho');
                            setExpandedBai4(q.id);
                          }}
                          className="flex-1 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 font-semibold rounded-lg transition-all duration-300"
                        >
                          ➕ Thêm câu hỏi nhỏ
                        </button>
                      </div>
                    )}

                    {/* Type content */}
                    {q.type === 'so_cach_giai' && (
                      <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500 mb-3">
                        <label className="block text-sm font-semibold text-blue-700 mb-2">
                          Số cách giải:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={q.content || ''}
                          onChange={(e) => updateBai4SolutionNumber(q.id, e.target.value)}
                          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500"
                          placeholder="Nhập số cách giải"
                        />
                        <button
                          onClick={() => updateBai4Question(q.id, 'type', null)}
                          className="mt-2 px-4 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-semibold"
                        >
                          Thay đổi loại
                        </button>
                      </div>
                    )}

                    {q.type === 'cau_hoi_nho' && (
                      <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-sm font-semibold text-green-700">
                            Câu hỏi nhỏ:
                          </label>
                          <button
                            onClick={() => addBai4SubQuestion(q.id)}
                            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-semibold transition-all"
                          >
                            ➕ Thêm
                          </button>
                        </div>

                        {/* Danh sách câu hỏi nhỏ */}
                        <div className="space-y-2 mb-3">
                          {(q.subQuestions || []).map((sq, idx) => (
                            <div key={sq.id} className="flex items-center gap-2 p-2 bg-white rounded border border-green-300">
                              <span className="text-green-600 font-bold min-w-fit">-</span>
                              <input
                                type="text"
                                value={sq.text}
                                onChange={(e) => updateBai4SubQuestion(q.id, sq.id, e.target.value)}
                                className="flex-1 px-2 py-1 border border-green-200 rounded focus:outline-none focus:border-green-400"
                                placeholder="Nhập câu hỏi nhỏ"
                              />
                              <button
                                onClick={() => removeBai4SubQuestion(q.id, sq.id)}
                                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs font-semibold"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => updateBai4Question(q.id, 'type', null)}
                          className="w-full px-4 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-semibold"
                        >
                          Thay đổi loại
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Explanation cho Bài 4 */}
              <div className="mt-4 p-4 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Hướng dẫn cho AI nhận xét:
                </label>
                <textarea
                  value={bai4Explanation}
                  onChange={(e) => setBai4Explanation(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 resize-none"
                  rows="3"
                  placeholder="VD: Mức cần cố gắng: Trả lời làm sai câu hỏi → 0 điểm&#10;Mức đạt: Trả lời đúng 50% câu hỏi → 1 điểm&#10;Mức tốt: Trả lời đúng 100% câu hỏi và đầy đủ → 2 điểm"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => navigate('/faculty', { state: { selectedClass } })}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-all duration-300"
              >
                ❌ Hủy
              </button>
              <button
                onClick={handleSaveWorksheet}
                disabled={loading}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-all duration-300 disabled:opacity-50"
              >
                💾 Lưu
              </button>
              <button
                onClick={handleFinish}
                disabled={loading || !worksheetName.trim()}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all duration-300 disabled:opacity-50"
              >
                ✅ Hoàn thành
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default FacultyWorksheetEditorPage;
