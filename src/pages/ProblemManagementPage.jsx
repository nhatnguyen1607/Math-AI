import React, { useState, useEffect } from 'react';
import problemService from '../services/problemService';
import topicService from '../services/topicService';
import problemGeneratorService from '../services/problemGeneratorService';

const ProblemManagementPage = () => {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    difficulty: 'medium',
    hints: ['']
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);

  useEffect(() => {
    loadTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTopic) {
      loadProblems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopic]);

  const loadTopics = async () => {
    try {
      const data = await topicService.getAllTopics();
      setTopics(data);
    } catch (error) {
      console.error('Error loading topics:', error);
    }
  };

  const loadProblems = async () => {
    if (!selectedTopic) return;
    
    setLoading(true);
    try {
      const data = await problemService.getProblemsByTopic(selectedTopic);
      setProblems(data);
    } catch (error) {
      console.error('Error loading problems:', error);
      alert('Lỗi khi tải danh sách bài toán');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      alert('Vui lòng nhập yêu cầu cho AI');
      return;
    }

    setGeneratingAI(true);
    try {
      const topicName = topics.find(t => t.id === selectedTopic)?.name || '';
      const generatedProblems = await problemGeneratorService.generateProblem(
        topicName,
        aiPrompt
      );
      const generatedProblem = Array.isArray(generatedProblems) ? generatedProblems[0] : generatedProblems;

      if (!generatedProblem) {
        alert('AI không tạo được bài toán phù hợp!');
        setGeneratingAI(false);
        return;
      }

      setFormData({
        title: generatedProblem.title,
        content: generatedProblem.content,
        difficulty: generatedProblem.difficulty || 'medium',
        hints: generatedProblem.hints || ['']
      });
      
      setUseAI(false);
      alert('Đã tạo bài toán thành công! Hãy kiểm tra và chỉnh sửa nếu cần.');
    } catch (error) {
      console.error('Error generating problem:', error);
      alert('Lỗi khi tạo bài toán bằng AI. Vui lòng thử lại.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTopic) {
      alert('Vui lòng chọn chủ đề');
      return;
    }

    setLoading(true);
    try {
      const problemData = {
        ...formData,
        topicId: selectedTopic,
        hints: formData.hints.filter(h => h.trim())
      };

      if (editingProblem) {
        await problemService.updateProblem(editingProblem.id, problemData);
        alert('Cập nhật bài toán thành công!');
      } else {
        await problemService.createProblem(problemData);
        alert('Tạo bài toán mới thành công!');
      }
      
      resetForm();
      loadProblems();
    } catch (error) {
      console.error('Error saving problem:', error);
      alert('Lỗi khi lưu bài toán');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (problem) => {
    setEditingProblem(problem);
    setFormData({
      title: problem.title,
      content: problem.content,
      difficulty: problem.difficulty,
      hints: problem.hints && problem.hints.length > 0 ? problem.hints : ['']
    });
    setShowForm(true);
    setUseAI(false);
  };

  const handleDelete = async (problemId) => {
    if (!window.confirm('Bạn có chắc muốn xóa bài toán này?')) return;
    
    setLoading(true);
    try {
      await problemService.deleteProblem(problemId);
      alert('Xóa bài toán thành công!');
      loadProblems();
    } catch (error) {
      console.error('Error deleting problem:', error);
      alert('Lỗi khi xóa bài toán');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      difficulty: 'medium',
      hints: ['']
    });
    setEditingProblem(null);
    setShowForm(false);
    setUseAI(false);
    setAiPrompt('');
  };

  const addHint = () => {
    setFormData({
      ...formData,
      hints: [...formData.hints, '']
    });
  };

  const updateHint = (index, value) => {
    const newHints = [...formData.hints];
    newHints[index] = value;
    setFormData({...formData, hints: newHints});
  };

  const removeHint = (index) => {
    setFormData({
      ...formData,
      hints: formData.hints.filter((_, i) => i !== index)
    });
  };

  const getDifficultyLabel = (diff) => {
    const labels = {
      easy: '🟢 Dễ',
      medium: '🟡 Trung bình',
      hard: '🔴 Khó'
    };
    return labels[diff] || diff;
  };

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <div className="flex justify-between items-center gap-5 mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Quản lý Bài toán</h2>
        <div className="flex gap-3 items-center">
          <select 
            value={selectedTopic} 
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="px-5 py-3 border-2 border-gray-200 rounded-lg text-base bg-white cursor-pointer min-w-[250px] focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="">Chọn chủ đề...</option>
            {topics.map(topic => (
              <option key={topic.id} value={topic.id}>
                {topic.icon} {topic.name}
              </option>
            ))}
          </select>
          
          {selectedTopic && (
            <button 
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold whitespace-nowrap hover:shadow-lg hover:-translate-y-0.5 transition-all"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? '✖ Đóng' : '➕ Thêm bài toán'}
            </button>
          )}
        </div>
      </div>

      {showForm && selectedTopic && (
        <div className="bg-white p-8 rounded-xl shadow-md mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-5">{editingProblem ? 'Chỉnh sửa bài toán' : 'Tạo bài toán mới'}</h3>
          
          {!editingProblem && (
            <div className="flex gap-0 mb-6 border-2 border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                className={`flex-1 px-6 py-3 border-none text-base font-semibold transition-all ${
                  !useAI ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white' : 'bg-white text-gray-600'
                }`}
                onClick={() => setUseAI(false)}
              >
                ✍️ Nhập thủ công
              </button>
              <button
                type="button"
                className={`flex-1 px-6 py-3 border-none text-base font-semibold transition-all ${
                  useAI ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white' : 'bg-white text-gray-600'
                }`}
                onClick={() => setUseAI(true)}
              >
                🤖 Tạo bằng AI
              </button>
            </div>
          )}

          {useAI && !editingProblem ? (
            <div className="p-5 bg-purple-50 rounded-lg border-2 border-dashed border-purple-500">
              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-semibold">Yêu cầu cho AI</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ví dụ: Tạo bài toán về phép cộng hai số có 3 chữ số, độ khó trung bình"
                  rows="4"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
              <button 
                type="button"
                onClick={handleGenerateAI}
                disabled={generatingAI}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg text-base font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {generatingAI ? '⏳ Đang tạo...' : '✨ Tạo bài toán'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-semibold">Tiêu đề *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  placeholder="Ví dụ: Phép cộng hai số có 3 chữ số"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-semibold">Nội dung bài toán *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  required
                  placeholder="Nhập đề bài toán..."
                  rows="6"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-semibold">Độ khó</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({...formData, difficulty: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none transition-colors"
                >
                  <option value="easy">🟢 Dễ</option>
                  <option value="medium">🟡 Trung bình</option>
                  <option value="hard">🔴 Khó</option>
                </select>
              </div>

              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-semibold">Gợi ý (tùy chọn)</label>
                {formData.hints.map((hint, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={hint}
                      onChange={(e) => updateHint(index, e.target.value)}
                      placeholder={`Gợi ý ${index + 1}`}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none transition-colors"
                    />
                    {formData.hints.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeHint(index)}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-md font-semibold hover:bg-red-100 transition-colors"
                      >
                        ✖
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={addHint}
                  className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-md font-semibold hover:bg-blue-100 transition-colors"
                >
                  ➕ Thêm gợi ý
                </button>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? 'Đang lưu...' : (editingProblem ? 'Cập nhật' : 'Tạo mới')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {selectedTopic && (
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-5">Danh sách bài toán</h3>
          {loading && problems.length === 0 ? (
            <div className="text-center py-16 text-gray-400">Đang tải...</div>
          ) : problems.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg text-gray-400">Chưa có bài toán nào. Hãy tạo bài toán đầu tiên!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {problems.map(problem => (
                <div key={problem.id} className="bg-white p-6 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-xl transition-all">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <h4 className="text-lg font-bold text-gray-800 flex-1">{problem.title}</h4>
                    <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-gray-100 whitespace-nowrap">
                      {getDifficultyLabel(problem.difficulty)}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4 leading-relaxed line-clamp-3">{problem.content}</p>
                  <div className="flex gap-4 py-3 border-t border-b border-gray-200 mb-4 text-gray-700 text-sm">
                    <span>👥 {problem.attemptCount || 0} lượt làm</span>
                    <span>✅ {problem.completionCount || 0} hoàn thành</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      className="flex-1 py-2 px-4 bg-blue-50 text-blue-600 rounded-md font-semibold hover:bg-blue-100 transition-colors"
                      onClick={() => handleEdit(problem)}
                    >
                      ✏️ Sửa
                    </button>
                    <button 
                      className="flex-1 py-2 px-4 bg-red-50 text-red-600 rounded-md font-semibold hover:bg-red-100 transition-colors"
                      onClick={() => handleDelete(problem.id)}
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedTopic && (
        <div className="text-center py-16">
          <p className="text-lg text-gray-400">Vui lòng chọn một chủ đề để quản lý bài toán</p>
        </div>
      )}
    </div>
  );
};

export default ProblemManagementPage;
