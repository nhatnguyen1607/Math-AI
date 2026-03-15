import React, { useState, useEffect, useRef } from 'react';
import topicService from '../../services/faculty/topicService';
import TopicCard from '../../components/cards/TopicCard';
import AdminHeader from '../../components/admin/AdminHeader';
import { parseExamFile } from '../../services/faculty/fileParserService';

const AdminTopicPage = ({ onLogout }) => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [formTab, setFormTab] = useState('basic'); // 'basic' or 'samples'
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gradeLevel: '5',
    learningPathway: 'algebra'
  });
  
  // Sample exams state
  const [sampleExams, setSampleExams] = useState([]);
  const [parsedExercises, setParsedExercises] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newSampleName, setNewSampleName] = useState('');
  const fileInputRef = useRef(null);

  // Edit parsed sample state
  const [showEditSampleDialog, setShowEditSampleDialog] = useState(false);
  const [editingSampleContent, setEditingSampleContent] = useState(null);
  const [editingSampleName, setEditingSampleName] = useState('');
  const [editingSampleId, setEditingSampleId] = useState(null); // Track if editing existing sample
  const [currentEditingExerciseIndex, setCurrentEditingExerciseIndex] = useState(0);
  const [currentEditingQuestionIndex, setCurrentEditingQuestionIndex] = useState(0);

  useEffect(() => {
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Apply parsed exercises as new sample exam
  const handleApplyParsedExercises = () => {
    if (!parsedExercises || !newSampleName.trim()) {
      alert('Vui lòng nhập tên bài học');
      return;
    }

    // Mở dialog chỉnh sửa để xem và chỉnh sửa nội dung trước khi lưu
    setEditingSampleName(newSampleName);
    setEditingSampleContent(parsedExercises);
    setShowEditSampleDialog(true);
  };

  // Save edited sample exam
  const handleSaveEditedSample = () => {
    if (!editingSampleContent || !editingSampleName.trim()) {
      alert('Vui lòng nhập tên bài học');
      return;
    }

    if (editingSampleId) {
      // Update existing sample
      setSampleExams(sampleExams.map(s => 
        s.id === editingSampleId 
          ? {
              ...s,
              lessonName: editingSampleName,
              content: editingSampleContent,
              uploadedAt: new Date()
            }
          : s
      ));
    } else {
      // Create new sample
      const newSample = {
        id: `sample_${Date.now()}`,
        lessonName: editingSampleName,
        content: editingSampleContent,
        format: 'json',
        uploadedAt: new Date()
      };
      setSampleExams([...sampleExams, newSample]);
    }
    
    // Reset states
    setParsedExercises(null);
    setParseError(null);
    setNewSampleName('');
    setShowEditSampleDialog(false);
    setEditingSampleName('');
    setEditingSampleContent(null);
    setEditingSampleId(null);
    setCurrentEditingExerciseIndex(0);
    setCurrentEditingQuestionIndex(0);
  };

  // Close edit dialog without saving
  const handleCloseEditSampleDialog = () => {
    setShowEditSampleDialog(false);
    setEditingSampleName('');
    setEditingSampleContent(null);
    setEditingSampleId(null);
    setCurrentEditingExerciseIndex(0);
    setCurrentEditingQuestionIndex(0);
  };

  // Update question in editing sample
  const handleUpdateEditingQuestion = (questionIndex, field, value) => {
    if (!Array.isArray(editingSampleContent) || currentEditingExerciseIndex >= editingSampleContent.length) return;
    
    const updatedContent = [...editingSampleContent];
    const exercise = { ...updatedContent[currentEditingExerciseIndex] };
    const questions = [...(exercise.questions || [])];
    
    if (field === 'options') {
      questions[questionIndex].options = value;
    } else if (field === 'correctAnswers') {
      questions[questionIndex].correctAnswers = value;
    } else {
      questions[questionIndex][field] = value;
    }
    
    exercise.questions = questions;
    updatedContent[currentEditingExerciseIndex] = exercise;
    setEditingSampleContent(updatedContent);
  };

  // Add new question to current exercise in editing
  const handleAddEditingQuestion = () => {
    if (!Array.isArray(editingSampleContent) || currentEditingExerciseIndex >= editingSampleContent.length) return;
    
    const updatedContent = [...editingSampleContent];
    const exercise = { ...updatedContent[currentEditingExerciseIndex] };
    const questions = [...(exercise.questions || [])];
    
    questions.push({
      question: '',
      type: 'single',
      options: ['', '', '', ''],
      correctAnswers: [0],
      explanation: ''
    });
    
    exercise.questions = questions;
    updatedContent[currentEditingExerciseIndex] = exercise;
    setEditingSampleContent(updatedContent);
  };

  // Remove question from editing
  const handleRemoveEditingQuestion = (questionIndex) => {
    if (!Array.isArray(editingSampleContent) || currentEditingExerciseIndex >= editingSampleContent.length) return;
    
    const updatedContent = [...editingSampleContent];
    const exercise = { ...updatedContent[currentEditingExerciseIndex] };
    const questions = [...(exercise.questions || [])];
    
    questions.splice(questionIndex, 1);
    exercise.questions = questions;
    updatedContent[currentEditingExerciseIndex] = exercise;
    setEditingSampleContent(updatedContent);
    
    if (currentEditingQuestionIndex >= questions.length) {
      setCurrentEditingQuestionIndex(Math.max(0, questions.length - 1));
    }
  };

  // Update exercise context
  const handleUpdateExerciseContext = (newContext) => {
    if (!Array.isArray(editingSampleContent) || currentEditingExerciseIndex >= editingSampleContent.length) return;
    
    const updatedContent = [...editingSampleContent];
    updatedContent[currentEditingExerciseIndex].context = newContext;
    setEditingSampleContent(updatedContent);
  };

  // Add new answer option
  const handleAddOption = () => {
    if (!Array.isArray(editingSampleContent) || currentEditingExerciseIndex >= editingSampleContent.length) return;
    
    const updatedContent = [...editingSampleContent];
    const exercise = { ...updatedContent[currentEditingExerciseIndex] };
    const questions = [...(exercise.questions || [])];
    const question = { ...questions[currentEditingQuestionIndex] };
    
    question.options = [...(question.options || []), ''];
    questions[currentEditingQuestionIndex] = question;
    exercise.questions = questions;
    updatedContent[currentEditingExerciseIndex] = exercise;
    setEditingSampleContent(updatedContent);
  };

  // Remove answer option
  const handleRemoveOption = (optionIndex) => {
    if (!Array.isArray(editingSampleContent) || currentEditingExerciseIndex >= editingSampleContent.length) return;
    
    const updatedContent = [...editingSampleContent];
    const exercise = { ...updatedContent[currentEditingExerciseIndex] };
    const questions = [...(exercise.questions || [])];
    const question = { ...questions[currentEditingQuestionIndex] };
    
    // Remove the option
    const newOptions = question.options.filter((_, idx) => idx !== optionIndex);
    question.options = newOptions;
    
    // Update correct answers - remove indices that are >= optionIndex
    if (Array.isArray(question.correctAnswers)) {
      question.correctAnswers = question.correctAnswers
        .filter(idx => idx !== optionIndex)
        .map(idx => idx > optionIndex ? idx - 1 : idx);
    }
    
    questions[currentEditingQuestionIndex] = question;
    exercise.questions = questions;
    updatedContent[currentEditingExerciseIndex] = exercise;
    setEditingSampleContent(updatedContent);
  };

  // Edit existing sample exam
  const handleEditExistingSample = (sample) => {
    setEditingSampleName(sample.lessonName);
    setEditingSampleContent(sample.content);
    setEditingSampleId(sample.id);
    setCurrentEditingExerciseIndex(0);
    setCurrentEditingQuestionIndex(0);
    setShowEditSampleDialog(true);
  };

  // Remove sample exam
  const handleRemoveSample = (sampleId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đề mẫu này?')) {
      setSampleExams(sampleExams.filter(s => s.id !== sampleId));
    }
  };

  // Discard parsed exercises
  const handleDiscardParsedExercises = () => {
    setParsedExercises(null);
    setParseError(null);
    setNewSampleName('');
    setCurrentEditingExerciseIndex(0);
    setCurrentEditingQuestionIndex(0);
    handleCloseEditSampleDialog();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên chủ đề');
      return;
    }

    // Chỉ yêu cầu đề mẫu khi tạo chủ đề mới
    if (sampleExams.length === 0 && !editingTopic) {
      alert('Vui lòng thêm ít nhất một đề mẫu cho chủ đề mới');
      return;
    }

    setLoading(true);
    try {
      const topicData = {
        ...formData,
        // Nếu đang edit, sử dụng sampleExams mới nếu có thay đổi, nếu không giữ nguyên
        sampleExams: sampleExams.length > 0 ? sampleExams : (editingTopic?.sampleExams || []),
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
      alert('Lỗi khi lưu chủ đề: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (topic) => {
    setEditingTopic(topic);
    setFormData({
      name: topic.name,
      description: topic.description,
      gradeLevel: topic.gradeLevel,
      learningPathway: topic.learningPathway || 'algebra'
    });
    setSampleExams(topic.sampleExams || []);
    setFormTab('basic');
    setShowForm(true);
  };

  const handleDelete = async (topicId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa chủ đề này?')) {
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
      learningPathway: 'algebra'
    });
    setSampleExams([]);
    setEditingTopic(null);
    setShowForm(false);
    setParsedExercises(null);
    setParseError(null);
    setUploading(false);
    setNewSampleName('');
  };

  return (
    <div className="admin-topic-page min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <AdminHeader onLogout={onLogout} />

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
            <div className="form-card bg-white rounded-2xl shadow-2xl p-8 w-full max-w-3xl max-h-screen overflow-y-auto">
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

              {/* Tabs */}
              <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setFormTab('basic')}
                  className={`px-4 py-2 font-semibold transition-colors ${
                    formTab === 'basic'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  📋 Thông tin cơ bản
                </button>
                <button
                  onClick={() => setFormTab('samples')}
                  className={`px-4 py-2 font-semibold transition-colors ${
                    formTab === 'samples'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  📚 Quản lý đề mẫu ({sampleExams.length})
                </button>
              </div>

              {/* Tab Content */}
              {formTab === 'basic' && (
                <form onSubmit={handleSubmit}>
                  <div className="form-group mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tên chủ đề <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ví dụ: CHỦ ĐỀ: TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN"
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

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="form-group">
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

                    <div className="form-group">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Mạch học tập
                      </label>
                      <select
                        value={formData.learningPathway}
                        onChange={(e) => setFormData({ ...formData, learningPathway: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        <option value="algebra">Số và Phép tính (Algebra)</option>
                        <option value="geometry">Hình học và Đo lường (Geometry)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-actions flex gap-3 pt-6 border-t border-gray-200">
                    {editingTopic && (
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-700 text-white font-bold rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? '⏳ Xử lý...' : '✅ Lưu thay đổi'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFormTab('samples')}
                      className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-all duration-300"
                    >
                      ➡️ Tiếp tục với đề mẫu
                    </button>
                  </div>
                </form>
              )}

              {formTab === 'samples' && (
                <div>
                  {/* Sample Exams List */}
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>📚</span> Danh sách đề mẫu ({sampleExams.length})
                  </h3>

                  {sampleExams.length === 0 ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center mb-6">
                      <p className="text-gray-600">
                        Chưa có đề mẫu nào. Hãy thêm đề mẫu để tạo các đề thi mới dựa trên format này.
                      </p>
                    </div>
                  ) : (
                    <div className="mb-6 space-y-2 max-h-40 overflow-y-auto">
                      {sampleExams.map((sample, idx) => (
                        <div key={sample.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-semibold text-gray-800">{sample.lessonName}</div>
                            <div className="text-xs text-gray-500">
                              {sample.content.length || 0} phần đề | Tạo lúc {new Date(sample.uploadedAt).toLocaleString('vi-VN')}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditExistingSample(sample)}
                              className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded font-semibold text-sm transition-colors"
                            >
                              ✏️ Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSample(sample.id)}
                              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded font-semibold text-sm transition-colors"
                            >
                              ❌ Xóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload New Sample */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">📄</span>
                      <h5 className="font-semibold text-gray-800">Thêm đề mẫu từ File Word</h5>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tên bài học (Bài số, Tiêu đề) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newSampleName}
                        onChange={(e) => setNewSampleName(e.target.value)}
                        placeholder="Ví dụ: Bài 38. Tìm hai số khi biết tổng và tỉ số"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <p className="text-sm text-gray-600 mb-3">
                      Tải file Word (.docx) để tự động trích xuất câu hỏi
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
                        className="flex-1 px-4 py-2 bg-white border-2 border-blue-300 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <span>{uploading ? '⏳ Đang xử lí...' : '📁 Chọn File'}</span>
                      </button>
                    </div>

                    {parseError && (
                      <div className="mt-3 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded text-sm">
                        {parseError}
                      </div>
                    )}

                    {parsedExercises && (
                      <div className="mt-4 p-3 bg-white border-2 border-green-200 rounded-lg">
                        <h6 className="font-semibold text-green-700 mb-2 text-sm">✅ Dữ liệu được trích xuất:</h6>
                        
                        {parsedExercises.map((exercise, exIdx) => (
                          <div key={exIdx} className="mb-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                            <div className="font-semibold text-gray-700">{exercise.name}</div>
                            <div className="text-gray-600">
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
                            ✅ Thêm
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="form-actions flex gap-3 pt-6 border-t border-gray-200">
                    <button
                      type="submit"
                      onClick={handleSubmit}
                      disabled={loading || sampleExams.length === 0}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? '⏳ Xử lý...' : editingTopic ? '✅ Cập nhật' : '✅ Tạo chủ đề'}
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-all duration-300"
                      onClick={resetForm}
                    >
                      ❌ Hủy
                    </button>
                  </div>
                </div>
              )}
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

      {/* Edit Sample Exam Dialog - Full Editing Interface */}
      {showEditSampleDialog && Array.isArray(editingSampleContent) && editingSampleContent.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-screen overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">✏️ Chỉnh sửa đề mẫu</h2>
                <p className="text-sm text-gray-600 mt-1">Kiểm tra và chỉnh sửa nội dung trích xuất</p>
              </div>
              <button
                onClick={handleCloseEditSampleDialog}
                className="text-gray-400 hover:text-gray-600 text-3xl font-bold transition-colors"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Lesson Name */}
              <div className="p-6 border-b border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tên bài học
                </label>
                <input
                  type="text"
                  value={editingSampleName}
                  onChange={(e) => setEditingSampleName(e.target.value)}
                  placeholder="Ví dụ: Bài 38. Tìm hai số khi biết tổng và tỉ số"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Exercise Tabs and Editing Area */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Exercise Tabs */}
                <div className="border-b border-gray-200 p-6 pb-3">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">🏃 Bài Tập</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {editingSampleContent.map((exercise, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentEditingExerciseIndex(idx);
                          setCurrentEditingQuestionIndex(0);
                        }}
                        className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                          currentEditingExerciseIndex === idx
                            ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        <div className="text-sm">{exercise.name || `Bài tập ${idx + 1}`}</div>
                        <div className="text-xs mt-1">📝 {exercise.questions?.length || 0} câu · ⏱️ {exercise.duration}s</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current Exercise Editing */}
                {currentEditingExerciseIndex < editingSampleContent.length && (
                  <div className="flex-1 overflow-y-auto p-6">
                    {(() => {
                      const exercise = editingSampleContent[currentEditingExerciseIndex];
                      return (
                        <div className="space-y-6">
                          {/* Exercise Info */}
                          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <div className="text-xs text-gray-600 font-semibold uppercase">Tên bài tập</div>
                                <div className="font-bold text-gray-800 mt-1">{exercise.name || 'Chưa đặt tên'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-600 font-semibold uppercase">Thời gian</div>
                                <div className="font-bold text-blue-600 mt-1">{exercise.duration}s</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-600 font-semibold uppercase">Số câu hỏi</div>
                                <div className="font-bold text-green-600 mt-1">{exercise.questions?.length || 0}</div>
                              </div>
                            </div>
                          </div>

                          {/* Context Editing */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Đoạn văn/Bối cảnh
                            </label>
                            <textarea
                              value={exercise.context || ''}
                              onChange={(e) => handleUpdateExerciseContext(e.target.value)}
                              placeholder="Nhập bài toán/đoạn văn bối cảnh..."
                              rows="4"
                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                            />
                          </div>

                          {/* Questions Section */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-lg font-bold text-gray-800">❓ Câu hỏi ({exercise.questions?.length || 0})</h4>
                              <button
                                type="button"
                                onClick={handleAddEditingQuestion}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors text-sm"
                              >
                                + Thêm câu hỏi
                              </button>
                            </div>

                            {exercise.questions && exercise.questions.length > 0 && (
                              <div>
                                {/* Question Tabs */}
                                <div className="flex gap-2 overflow-x-auto pb-3 mb-4 flex-wrap border-b border-gray-200">
                                  {exercise.questions.map((_, qIdx) => (
                                    <button
                                      key={qIdx}
                                      onClick={() => setCurrentEditingQuestionIndex(qIdx)}
                                      className={`px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-all text-sm ${
                                        currentEditingQuestionIndex === qIdx
                                          ? 'bg-purple-500 text-white shadow-md'
                                          : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                                      }`}
                                    >
                                      Câu {qIdx + 1}
                                    </button>
                                  ))}
                                </div>

                                {/* Question Detail Editor */}
                                {currentEditingQuestionIndex < exercise.questions.length && (
                                  <div className="bg-white border-2 border-gray-200 rounded-lg p-4 space-y-4">
                                    {(() => {
                                      const q = exercise.questions[currentEditingQuestionIndex];
                                      return (
                                        <>
                                          {/* Question Content */}
                                          <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                              Nội dung câu hỏi *
                                            </label>
                                            <input
                                              type="text"
                                              value={q.question || ''}
                                              onChange={(e) => handleUpdateEditingQuestion(currentEditingQuestionIndex, 'question', e.target.value)}
                                              placeholder="Nhập nội dung câu hỏi..."
                                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                                            />
                                          </div>

                                          {/* Question Type */}
                                          <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                              Loại câu hỏi *
                                            </label>
                                            <div className="flex gap-4">
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`type-${currentEditingExerciseIndex}-${currentEditingQuestionIndex}`}
                                                  value="single"
                                                  checked={q.type === 'single'}
                                                  onChange={() => handleUpdateEditingQuestion(currentEditingQuestionIndex, 'type', 'single')}
                                                  className="w-4 h-4"
                                                />
                                                <span className="text-gray-700">Một đáp án đúng</span>
                                              </label>
                                              <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                  type="radio"
                                                  name={`type-${currentEditingExerciseIndex}-${currentEditingQuestionIndex}`}
                                                  value="multiple"
                                                  checked={q.type === 'multiple'}
                                                  onChange={() => handleUpdateEditingQuestion(currentEditingQuestionIndex, 'type', 'multiple')}
                                                  className="w-4 h-4"
                                                />
                                                <span className="text-gray-700">Nhiều đáp án đúng</span>
                                              </label>
                                            </div>
                                          </div>

                                          {/* Answer Options */}
                                          <div>
                                            <div className="flex items-center justify-between mb-3">
                                              <label className="block text-sm font-semibold text-gray-700">
                                                Đáp án *
                                              </label>
                                              <button
                                                type="button"
                                                onClick={handleAddOption}
                                                className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg font-semibold hover:bg-blue-200 transition-colors text-sm"
                                              >
                                                + Thêm đáp án
                                              </button>
                                            </div>
                                            <div className="space-y-2">
                                              {q.type === 'single' ? (
                                                q.options.map((option, optIdx) => (
                                                  <div key={optIdx} className="flex items-center gap-2">
                                                    <input
                                                      type="radio"
                                                      name={`correct-${currentEditingExerciseIndex}-${currentEditingQuestionIndex}`}
                                                      checked={q.correctAnswers?.[0] === optIdx}
                                                      onChange={() => handleUpdateEditingQuestion(currentEditingQuestionIndex, 'correctAnswers', [optIdx])}
                                                      className="w-4 h-4 flex-shrink-0"
                                                    />
                                                    <span className="text-sm text-gray-700 font-semibold w-6">{String.fromCharCode(65 + optIdx)}.</span>
                                                    <input
                                                      type="text"
                                                      value={option}
                                                      onChange={(e) => {
                                                        const newOptions = [...q.options];
                                                        newOptions[optIdx] = e.target.value;
                                                        handleUpdateEditingQuestion(currentEditingQuestionIndex, 'options', newOptions);
                                                      }}
                                                      placeholder={`Đáp án ${String.fromCharCode(65 + optIdx)}`}
                                                      className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-sm"
                                                    />
                                                    {q.options.length > 2 && (
                                                      <button
                                                        type="button"
                                                        onClick={() => handleRemoveOption(optIdx)}
                                                        className="px-2 py-1 text-red-500 hover:bg-red-50 rounded font-semibold text-sm transition-colors"
                                                      >
                                                        ✕
                                                      </button>
                                                    )}
                                                  </div>
                                                ))
                                              ) : (
                                                q.options.map((option, optIdx) => (
                                                  <div key={optIdx} className="flex items-center gap-2">
                                                    <input
                                                      type="checkbox"
                                                      checked={q.correctAnswers?.includes(optIdx) || false}
                                                      onChange={(e) => {
                                                        const newAnswers = e.target.checked
                                                          ? [...(q.correctAnswers || []), optIdx].sort()
                                                          : (q.correctAnswers || []).filter(a => a !== optIdx);
                                                        handleUpdateEditingQuestion(currentEditingQuestionIndex, 'correctAnswers', newAnswers);
                                                      }}
                                                      className="w-4 h-4 flex-shrink-0"
                                                    />
                                                    <span className="text-sm text-gray-700 font-semibold w-6">{String.fromCharCode(65 + optIdx)}.</span>
                                                    <input
                                                      type="text"
                                                      value={option}
                                                      onChange={(e) => {
                                                        const newOptions = [...q.options];
                                                        newOptions[optIdx] = e.target.value;
                                                        handleUpdateEditingQuestion(currentEditingQuestionIndex, 'options', newOptions);
                                                      }}
                                                      placeholder={`Đáp án ${String.fromCharCode(65 + optIdx)}`}
                                                      className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-sm"
                                                    />
                                                    {q.options.length > 2 && (
                                                      <button
                                                        type="button"
                                                        onClick={() => handleRemoveOption(optIdx)}
                                                        className="px-2 py-1 text-red-500 hover:bg-red-50 rounded font-semibold text-sm transition-colors"
                                                      >
                                                        ✕
                                                      </button>
                                                    )}
                                                  </div>
                                                ))
                                              )}
                                            </div>
                                          </div>

                                          {/* Explanation */}
                                          <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                              Giải thích đáp án
                                            </label>
                                            <textarea
                                              value={q.explanation || ''}
                                              onChange={(e) => handleUpdateEditingQuestion(currentEditingQuestionIndex, 'explanation', e.target.value)}
                                              placeholder="Giải thích đáp án..."
                                              rows="2"
                                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-sm"
                                            />
                                          </div>

                                          {/* Delete Question Button */}
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveEditingQuestion(currentEditingQuestionIndex)}
                                            className="w-full px-4 py-2 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200 transition-colors text-sm"
                                          >
                                            ❌ Xóa câu hỏi này
                                          </button>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
              <button
                onClick={handleSaveEditedSample}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-700 text-white font-bold rounded-lg hover:shadow-lg transition-all duration-300"
              >
                {editingSampleId ? '✅ Cập nhật đề mẫu' : '✅ Lưu đề mẫu'}
              </button>
              <button
                onClick={handleCloseEditSampleDialog}
                className="flex-1 px-4 py-3 bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400 transition-all duration-300"
              >
                ❌ Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTopicPage;
