import React, { useState, useEffect } from 'react';
import './TopicManager.css';
import topicService from '../../services/topicService';

const TopicManager = ({ onTopicSelect }) => {
  const [topics, setTopics] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTopic, setNewTopic] = useState({
    name: '',
    description: '',
    gradeLevel: '5'
  });
  const [loading, setLoading] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState(null);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      setLoading(true);
      const allTopics = await topicService.getAllTopics();
      setTopics(allTopics);
    } catch (error) {
      console.error('Error loading topics:', error);
      alert('Không thể tải danh sách chủ đề');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTopic = async (e) => {
    e.preventDefault();
    if (!newTopic.name.trim()) {
      alert('Vui lòng nhập tên chủ đề');
      return;
    }

    try {
      setLoading(true);
      await topicService.createTopic(newTopic);
      setNewTopic({ name: '', description: '', gradeLevel: '5' });
      setShowAddForm(false);
      await loadTopics();
      alert('Thêm chủ đề thành công!');
    } catch (error) {
      console.error('Error adding topic:', error);
      alert('Không thể thêm chủ đề');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTopic = async (topicId) => {
    if (!window.confirm('Bạn có chắc muốn xóa chủ đề này?')) {
      return;
    }

    try {
      setLoading(true);
      await topicService.deleteTopic(topicId);
      await loadTopics();
      if (selectedTopicId === topicId) {
        setSelectedTopicId(null);
        onTopicSelect(null);
      }
      alert('Xóa chủ đề thành công!');
    } catch (error) {
      console.error('Error deleting topic:', error);
      alert('Không thể xóa chủ đề');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTopic = (topic) => {
    setSelectedTopicId(topic.id);
    onTopicSelect(topic);
  };

  return (
    <div className="topic-manager">
      <div className="topic-header">
        <h2>📚 Quản lý Chủ đề</h2>
        <button 
          className="btn-add-topic"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={loading}
        >
          {showAddForm ? '✖ Hủy' : '➕ Thêm chủ đề'}
        </button>
      </div>

      {showAddForm && (
        <form className="add-topic-form" onSubmit={handleAddTopic}>
          <div className="form-group">
            <label>Tên chủ đề:</label>
            <input
              type="text"
              value={newTopic.name}
              onChange={(e) => setNewTopic({...newTopic, name: e.target.value})}
              placeholder="VD: Phép nhân và chia"
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label>Mô tả:</label>
            <textarea
              value={newTopic.description}
              onChange={(e) => setNewTopic({...newTopic, description: e.target.value})}
              placeholder="Mô tả về chủ đề này..."
              disabled={loading}
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Lớp:</label>
            <select
              value={newTopic.gradeLevel}
              onChange={(e) => setNewTopic({...newTopic, gradeLevel: e.target.value})}
              disabled={loading}
            >
              <option value="3">Lớp 3</option>
              <option value="4">Lớp 4</option>
              <option value="5">Lớp 5</option>
            </select>
          </div>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? '⏳ Đang thêm...' : '✓ Thêm chủ đề'}
          </button>
        </form>
      )}

      <div className="topics-list">
        {loading && topics.length === 0 ? (
          <div className="loading">Đang tải...</div>
        ) : topics.length === 0 ? (
          <div className="empty-state">
            <p>Chưa có chủ đề nào. Hãy thêm chủ đề đầu tiên!</p>
          </div>
        ) : (
          topics.map(topic => (
            <div 
              key={topic.id} 
              className={`topic-card ${selectedTopicId === topic.id ? 'selected' : ''}`}
              onClick={() => handleSelectTopic(topic)}
            >
              <div className="topic-info">
                <h3>{topic.name}</h3>
                <p className="topic-description">{topic.description}</p>
                <div className="topic-meta">
                  <span className="grade-badge">Lớp {topic.gradeLevel}</span>
                  <span className="problem-count">
                    {topic.problemCount || 0} bài toán
                  </span>
                </div>
              </div>
              <button 
                className="btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTopic(topic.id);
                }}
                disabled={loading}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TopicManager;
