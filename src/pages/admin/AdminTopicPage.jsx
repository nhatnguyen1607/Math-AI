import React, { useState, useEffect, useRef } from 'react';
import topicService from '../../services/topicService';
import TopicCard from '../../components/cards/TopicCard';
import AdminHeader from '../../components/admin/AdminHeader';
import { parseExamFile } from '../../services/fileParserService';

const AdminTopicPage = ({ onLogout }) => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gradeLevel: '5',
    sampleExam: ''
  });
  
  // File upload and preview states
  const [parsedExercises, setParsedExercises] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Load topics on mount
    loadTopics();
  }, []);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const data = await topicService.getAllTopics();
      setTopics(data);
    } catch (error) {
      alert('Lỗi khi tải danh sách chủ đề');
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload and parsing
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setParseError(null);
    setParsedExercises(null);

    try {
      // Parse file using JavaScript libraries
      const result = await parseExamFile(file);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      setParsedExercises(result.exercises);
      setParseError(null);
    } catch (error) {
      setParseError(`❌ Lỗi: ${error.message}`);
      setParsedExercises(null);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Apply parsed exercises to form
  const handleApplyParsedExercises = () => {
    if (!parsedExercises) return;
    
    // Store parsed exercises as JSON string in sampleExam
    const exercisesJson = JSON.stringify(parsedExercises, null, 2);
    setFormData({ ...formData, sampleExam: exercisesJson });
    setParsedExercises(null);
  };

  // Discard parsed exercises
  const handleDiscardParsedExercises = () => {
    setParsedExercises(null);
    setParseError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên chủ đề');
      return;
    }

    setLoading(true);
    try {
      const topicData = {
        ...formData,
        createdBy: editingTopic ? editingTopic.createdBy : 'admin',
        createdByName: editingTopic ? editingTopic.createdByName : 'Admin'
      };

      if (editingTopic) {
        await topicService.updateTopic(editingTopic.id, topicData);
        alert('Cập nhật chủ đề thành công!');
      } else {
        await topicService.createTopic(topicData);
        alert('Tạo chủ đề mới thành công!');
      }

      resetForm();
      loadTopics();
    } catch (error) {
      alert('Lỗi khi lưu chủ đề');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (topic) => {
    setEditingTopic(topic);
    
    // Convert sampleExam to string for textarea if it's an object
    let sampleExamStr = '';
    if (typeof topic.sampleExam === 'string') {
      sampleExamStr = topic.sampleExam;
    } else if (typeof topic.sampleExam === 'object' && topic.sampleExam !== null) {
      sampleExamStr = JSON.stringify(topic.sampleExam, null, 2);
    }
    
    setFormData({
      name: topic.name,
      description: topic.description,
      gradeLevel: topic.gradeLevel,
      sampleExam: sampleExamStr
    });
    setShowForm(true);
  };

  const handleDelete = async (topicId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa chủ đề này? Các đề thi liên quan sẽ không bị xóa.')) {
      try {
        await topicService.deleteTopic(topicId);
        alert('Xóa chủ đề thành công!');
        loadTopics();
      } catch (error) {
        alert('Lỗi khi xóa chủ đề');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      gradeLevel: '5',
      sampleExam: ''
    });
    setEditingTopic(null);
    setShowForm(false);
    setParsedExercises(null);
    setParseError(null);
    setUploading(false);
  };

  return (
    <div className="admin-topic-page min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <AdminHeader onLogout={onLogout} />

      {/* Content */}
      <div className="p-8 max-w-6xl mx-auto">
        {/* Action Button */}
        <div className="mb-8 flex justify-end">
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
          >
            ✨ Tạo chủ đề mới
          </button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="form-card bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-screen overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  {editingTopic ? '✏️ Chỉnh sửa chủ đề' : '➕ Tạo chủ đề mới'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold transition-colors"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tên chủ đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ví dụ: Phép nhân số thập phân"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div className="form-group mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mô tả
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mô tả chủ đề..."
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                  />
                </div>

                <div className="form-group mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Khối lớp
                  </label>
                  <select
                    value={formData.gradeLevel}
                    onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="3">Lớp 3</option>
                    <option value="4">Lớp 4</option>
                    <option value="5">Lớp 5</option>
                  </select>
                </div>

                <div className="form-group mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nội dung đề mẫu (Template Exam)
                  </label>
                  
                  {/* Upload File Section */}
                  <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">📄</span>
                      <h5 className="font-semibold text-gray-800">Tải nhanh từ File Word (.docx)</h5>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Tải file Word (.docx) để tự động trích xuất câu hỏi. Format: 1. Câu hỏi | A. Đáp án | B. Đáp án | ...
                    </p>
                    
                    <div className="flex gap-2 items-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".docx"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex-1 px-4 py-2 bg-white border-2 border-blue-300 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        <span>{uploading ? '⏳ Đang xử lí...' : '📁 Chọn File Word (.docx)'}</span>
                      </button>
                    </div>

                    {/* Error message */}
                    {parseError && (
                      <div className="mt-3 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
                        {parseError}
                      </div>
                    )}

                    {/* Preview parsed data */}
                    {parsedExercises && (
                      <div className="mt-4 p-3 bg-white border-2 border-green-200 rounded-lg">
                        <h6 className="font-semibold text-green-700 mb-2">✅ Dữ liệu được trích xuất:</h6>
                        
                        {parsedExercises.map((exercise, exIdx) => (
                          <div key={exIdx} className="mb-2 p-2 bg-gray-50 rounded border border-gray-200 text-sm">
                            <div className="font-semibold text-gray-700">{exercise.name}</div>
                            <div className="text-xs text-gray-600">
                              📝 {exercise.questions.length} câu | ⏱️ {exercise.duration}s
                            </div>
                          </div>
                        ))}

                        <div className="flex gap-2 mt-3 justify-end">
                          <button
                            type="button"
                            onClick={handleDiscardParsedExercises}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded font-semibold text-sm hover:bg-gray-200 transition-colors"
                          >
                            ❌ Hủy
                          </button>
                          <button
                            type="button"
                            onClick={handleApplyParsedExercises}
                            className="px-3 py-1 bg-green-500 text-white rounded font-semibold text-sm hover:bg-green-600 transition-colors"
                          >
                            ✅ Áp dụng
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manual Text Input */}
                  <textarea
                    value={formData.sampleExam}
                    onChange={(e) => setFormData({ ...formData, sampleExam: e.target.value })}
                    placeholder="Hoặc nhập/chỉnh sửa nội dung đề mẫu (JSON hoặc định dạng tự do)..."
                    rows="6"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Đây là template được dùng làm mẫu cho các đề thi
                  </p>
                </div>

                <div className="form-actions flex gap-3 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                  >
                    {loading ? '⏳ Xử lý...' : editingTopic ? '✅ Cập nhật' : '✅ Tạo'}
                  </button>
                  <button
                    type="button"
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-all duration-300"
                    onClick={resetForm}
                  >
                    ❌ Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Topics Grid */}
        <div className="topics-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && topics.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
              </div>
              <span className="text-gray-600 text-lg font-semibold">Đang tải chủ đề...</span>
            </div>
          ) : topics.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-gray-600 text-lg font-semibold">Chưa có chủ đề nào</p>
              <p className="text-gray-500 text-sm mt-2">Hãy tạo chủ đề đầu tiên để bắt đầu!</p>
            </div>
          ) : (
            topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={{
                  ...topic,
                  icon: topic.icon || '📚',
                  color: topic.color || '#4CAF50'
                }}
                onEdit={handleEdit}
                onDelete={handleDelete}
                showActions={true}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTopicPage;
