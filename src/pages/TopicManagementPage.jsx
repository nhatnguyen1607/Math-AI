import React, { useState, useEffect } from 'react';
import topicService from '../services/topicService';

const TopicManagementPage = () => {
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
    <div className="p-5 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Quản lý Chủ đề</h2>
        <button 
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✖ Đóng' : '➕ Thêm chủ đề mới'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-xl shadow-md mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-5">{editingTopic ? 'Chỉnh sửa chủ đề' : 'Tạo chủ đề mới'}</h3>
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

            <div className="grid grid-cols-2 gap-5">
              <div className="mb-5">
                <label className="block mb-2 text-gray-700 font-semibold">Biểu tượng</label>
                <div className="flex flex-wrap gap-2">
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
                <label className="block mb-2 text-gray-700 font-semibold">Màu sắc</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`w-10 h-10 rounded-full border-3 hover:scale-115 transition-all ${
                        formData.color === color ? 'border-gray-800 shadow-lg' : 'border-transparent'
                      }`}
                      style={{backgroundColor: color}}
                      onClick={() => setFormData({...formData, color})}
                    />
                  ))}
                </div>
              </div>
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
                {loading ? 'Đang lưu...' : (editingTopic ? 'Cập nhật' : 'Tạo mới')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div>
        {loading && topics.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Đang tải...</div>
        ) : topics.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg text-gray-400">Chưa có chủ đề nào. Hãy tạo chủ đề đầu tiên!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {topics.map(topic => (
              <div 
                key={topic.id} 
                className="bg-white p-6 rounded-xl shadow-md border-l-4 hover:-translate-y-1 hover:shadow-xl transition-all"
                style={{borderLeftColor: topic.color}}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">{topic.icon}</span>
                  <h3 className="text-xl font-bold text-gray-800">{topic.name}</h3>
                </div>
                <p className="text-gray-600 mb-4 leading-relaxed">{topic.description}</p>
                <div className="text-gray-500 text-sm py-3 border-t border-gray-200">
                  <span>📝 {topic.problemCount || 0} bài toán</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <button 
                    className="flex-1 py-2 px-4 bg-blue-50 text-blue-600 rounded-md font-semibold hover:bg-blue-100 transition-colors"
                    onClick={() => handleEdit(topic)}
                  >
                    ✏️ Sửa
                  </button>
                  <button 
                    className="flex-1 py-2 px-4 bg-red-50 text-red-600 rounded-md font-semibold hover:bg-red-100 transition-colors"
                    onClick={() => handleDelete(topic.id)}
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
  );
};

export default TopicManagementPage;
