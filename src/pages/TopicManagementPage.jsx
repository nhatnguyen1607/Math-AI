import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import topicService from '../services/topicService';
import TopicCard from '../components/cards/TopicCard';

const TopicManagementPage = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📚',
    color: '#4CAF50'
  });

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const data = await topicService.getAllTopics();
      setTopics(data);
    } catch (error) {
      console.error('Error loading topics:', error);
      alert('Lỗi khi tải danh sách chủ đề');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingTopic) {
        await topicService.updateTopic(editingTopic.id, formData);
        alert('Cập nhật chủ đề thành công!');
      } else {
        await topicService.createTopic(formData);
        alert('Tạo chủ đề mới thành công!');
      }
      
      resetForm();
      loadTopics();
    } catch (error) {
      console.error('Error saving topic:', error);
      alert('Lỗi khi lưu chủ đề');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (topic) => {
    setEditingTopic(topic);
    setFormData({
      name: topic.name,
      description: topic.description,
      icon: topic.icon,
      color: topic.color
    });
    setShowForm(true);
  };

  const handleDelete = async (topicId) => {
    if (!window.confirm('Bạn có chắc muốn xóa chủ đề này?')) return;
    
    setLoading(true);
    try {
      await topicService.deleteTopic(topicId);
      alert('Xóa chủ đề thành công!');
      loadTopics();
    } catch (error) {
      console.error('Error deleting topic:', error);
      alert('Lỗi khi xóa chủ đề');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: '📚',
      color: '#4CAF50'
    });
    setEditingTopic(null);
    setShowForm(false);
  };

  const iconOptions = ['📚', '🔢', '📐', '🎯', '🧮', '📊', '🎲', '💡', '🌟', '🏆'];
  const colorOptions = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-5 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-white/20 rounded-lg transition-all"
                title="Quay lại"
              >
                <span className="text-2xl">←</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold">📚 Quản lý Chủ đề</h1>
                <p className="text-purple-100 text-sm mt-1">Tạo và quản lý các chủ đề học tập</p>
              </div>
            </div>
            <button 
              className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:shadow-lg hover:-translate-y-1 transition-all flex items-center gap-2"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <span>➕</span>
              <span>Thêm chủ đề mới</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-8">
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border-2 border-purple-100">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <span>{editingTopic ? '✏️' : '✨'}</span>
              {editingTopic ? 'Chỉnh sửa chủ đề' : 'Tạo chủ đề mới'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-semibold">Tên chủ đề *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="Ví dụ: Phép cộng cơ bản"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-semibold">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Mô tả ngắn về chủ đề này..."
                  rows="3"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="mb-5">
                  <label className="block mb-3 text-gray-700 font-semibold">Biểu tượng</label>
                  <div className="flex flex-wrap gap-2 bg-gray-50 p-4 rounded-lg">
                    {iconOptions.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        className={`w-12 h-12 border-2 rounded-lg text-2xl hover:border-purple-500 hover:scale-110 transition-all ${
                          formData.icon === icon ? 'border-purple-500 bg-purple-50 shadow-md' : 'border-gray-200 bg-white'
                        }`}
                        onClick={() => setFormData({...formData, icon})}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-5">
                  <label className="block mb-3 text-gray-700 font-semibold">Màu sắc</label>
                  <div className="flex flex-wrap gap-3 bg-gray-50 p-4 rounded-lg">
                    {colorOptions.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`w-12 h-12 rounded-full border-3 hover:scale-110 transition-all ${
                          formData.color === color ? 'border-gray-800 shadow-lg ring-2 ring-offset-2' : 'border-transparent'
                        }`}
                        style={{backgroundColor: color, ringColor: color}}
                        onClick={() => setFormData({...formData, color})}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-8 pt-6 border-t border-gray-200">
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
                  {loading ? 'Đang lưu...' : (editingTopic ? 'Cập nhật' : 'Tạo mới')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Topics Grid */}
        <div>
          {loading && topics.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mb-4"></div>
                <p className="text-gray-500 text-lg">Đang tải chủ đề...</p>
              </div>
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl shadow-md">
              <span className="text-6xl mb-4 block">📚</span>
              <p className="text-xl text-gray-500 mb-4">Chưa có chủ đề nào</p>
              <p className="text-gray-400 mb-6">Hãy tạo chủ đề đầu tiên để bắt đầu!</p>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                ➕ Tạo chủ đề mới
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topics.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  showActions={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopicManagementPage;
