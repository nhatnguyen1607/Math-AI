import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as worksheetService from '../../services/faculty/worksheetService';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyWorksheetManagementPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const classId = location.state?.classId;
  const selectedClass = location.state?.selectedClass;
  const worksheetType = location.state?.worksheetType; // 'input' or 'output'

  const [worksheets, setWorksheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTypeSelector, setShowTypeSelector] = useState(!worksheetType);

  const loadWorksheets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await worksheetService.getWorksheetsByClassAndType(classId, worksheetType);
      setWorksheets(data);
    } catch (error) {
      console.error('Error loading worksheets:', error);
      alert('Lỗi khi tải danh sách phiếu bài tập');
    } finally {
      setLoading(false);
    }
  }, [classId, worksheetType]);

  useEffect(() => {
    if (!classId) {
      navigate('/faculty', { replace: true });
      return;
    }

    if (worksheetType) {
      loadWorksheets();
    }
  }, [classId, worksheetType, loadWorksheets, navigate]);

  const handleSelectType = (type) => {
    setShowTypeSelector(false);
    navigate('/faculty/worksheet/management', {
      state: {
        classId,
        selectedClass,
        worksheetType: type
      }
    });
  };

  const handleCreateNew = () => {
    navigate('/faculty/worksheet/editor', {
      state: {
        classId,
        selectedClass,
        worksheetType: worksheetType
      }
    });
  };

  const handleEdit = (worksheetId) => {
    navigate('/faculty/worksheet/editor', {
      state: {
        classId,
        selectedClass,
        worksheetType: worksheetType,
        worksheetId: worksheetId
      }
    });
  };

  const handleDelete = async (worksheetId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phiếu bài tập này?')) {
      return;
    }

    try {
      await worksheetService.deleteWorksheet(worksheetId);
      setWorksheets(worksheets.filter(w => w.id !== worksheetId));
      alert('Phiếu bài tập đã được xóa');
    } catch (error) {
      console.error('Error deleting worksheet:', error);
      alert('Lỗi khi xóa phiếu bài tập');
    }
  };

  const handleViewResults = (worksheetId) => {
    // TODO: Navigate to results page
    alert('Chức năng xem kết quả sẽ phát triển sau');
  };

  if (showTypeSelector) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <FacultyHeader user={user} onLogout={onSignOut} />

        <div className="px-8 lg:px-12 py-8">
          <div className="max-w-4xl mx-auto w-full">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">Phiếu bài tập</h1>
                <p className="text-gray-600">
                  Lớp: <span className="font-bold text-xl text-blue-600">{selectedClass?.name}</span>
                </p>
              </div>
              <button
                onClick={() => navigate('/faculty', { state: { selectedClass } })}
                className="px-4 py-2 hover:bg-purple-100 hover:text-purple-700 rounded-lg transition-all duration-300 text-gray-700 flex items-center gap-2 font-semibold"
              >
                <span className="text-lg">←</span> Quay lại
              </button>
            </div>

            {/* Type Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div
                onClick={() => handleSelectType('input')}
                className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer p-8 border-4 border-transparent hover:border-blue-500"
              >
                <div className="text-6xl mb-4">📥</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Phiếu đầu vào</h3>
                <p className="text-gray-600 mb-6">
                  Phiếu cho học sinh làm bài từ đầu, với các bước hướng dẫn
                </p>
                <button className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  Chọn →
                </button>
              </div>

              <div
                onClick={() => handleSelectType('output')}
                className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer p-8 border-4 border-transparent hover:border-green-500"
              >
                <div className="text-6xl mb-4">📤</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Phiếu đầu ra</h3>
                <p className="text-gray-600 mb-6">
                  Phiếu để kiểm tra kết quả và quá trình giải bài của học sinh
                </p>
                <button className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  Chọn →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <FacultyHeader user={user} onLogout={onSignOut} />

      <div className="px-8 lg:px-12 py-8">
        <div className="max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">
                {worksheetType === 'input' ? '📥 Phiếu đầu vào' : '📤 Phiếu đầu ra'}
              </h1>
              <p className="text-gray-600">
                Lớp: <span className="font-bold text-xl text-blue-600">{selectedClass?.name}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTypeSelector(true)}
                className="px-4 py-2 hover:bg-purple-100 hover:text-purple-700 rounded-lg transition-all duration-300 text-gray-700 flex items-center gap-2 font-semibold"
              >
                <span className="text-lg">🔄</span> Đổi loại
              </button>
              <button
                onClick={() => navigate('/faculty', { state: { selectedClass } })}
                className="px-4 py-2 hover:bg-purple-100 hover:text-purple-700 rounded-lg transition-all duration-300 text-gray-700 flex items-center gap-2 font-semibold"
              >
                <span className="text-lg">←</span> Quay lại
              </button>
            </div>
          </div>

          {/* Create New Button */}
          <div className="mb-8">
            <button
              onClick={handleCreateNew}
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              ➕ Tạo phiếu bài tập mới
            </button>
          </div>

          {/* Worksheets Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⏳</div>
              <p className="text-xl text-gray-600">Đang tải dữ liệu...</p>
            </div>
          ) : worksheets.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Chưa có phiếu bài tập</h3>
              <p className="text-gray-600 mb-6">
                Hãy tạo phiếu bài tập đầu tiên để bắt đầu
              </p>
              <button
                onClick={handleCreateNew}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                ➕ Tạo phiếu bài tập mới
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {worksheets.map((worksheet) => (
                <div
                  key={worksheet.id}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden border-t-4 border-blue-500"
                >
                  {/* Card Header */}
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2">
                      {worksheet.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Tạo ngày: {worksheet.createdAt?.toDate?.() ? new Date(worksheet.createdAt.toDate()).toLocaleDateString('vi-VN') : new Date(worksheet.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  {/* Card Content */}
                  <div className="p-6">
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 font-semibold mb-2">Context:</p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {worksheet.context || 'Chưa nhập context'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                      <div className="p-2 bg-purple-50 rounded">
                        <p className="text-gray-600">Bài 1</p>
                        <p className="font-bold text-purple-600">
                          {worksheet.bai_1?.questions?.length || 0} câu
                        </p>
                      </div>
                      <div className="p-2 bg-blue-50 rounded">
                        <p className="text-gray-600">Bài 2</p>
                        <p className="font-bold text-blue-600">
                          {worksheet.bai_2?.questions?.length || 0} câu
                        </p>
                      </div>
                      <div className="p-2 bg-green-50 rounded">
                        <p className="text-gray-600">Bài 3</p>
                        <p className="font-bold text-green-600">Tự do</p>
                      </div>
                      <div className="p-2 bg-orange-50 rounded">
                        <p className="text-gray-600">Bài 4</p>
                        <p className="font-bold text-orange-600">
                          {worksheet.bai_4?.questions?.length || 0} câu
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-2">
                    <button
                      onClick={() => handleEdit(worksheet.id)}
                      className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      ✏️ Điều chỉnh
                    </button>
                    <button
                      onClick={() => handleViewResults(worksheet.id)}
                      className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      📊 Kết quả
                    </button>
                    <button
                      onClick={() => handleDelete(worksheet.id)}
                      className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyWorksheetManagementPage;
