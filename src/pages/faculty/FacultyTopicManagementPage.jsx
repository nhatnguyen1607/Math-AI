import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import topicService from '../../services/topicService';
import authService from '../../services/authService';
import TopicCard from '../../components/cards/TopicCard';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyTopicManagementPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedClassId] = useState(() => {
    const fromState = location.state?.classId;
    const fromSession = sessionStorage.getItem('selectedClassId');
    return fromState || fromSession || null;
  });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gradeLevel: '5'
  });

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      if (!selectedClassId) {
        setTopics([]);
        return;
      }
      const data = await topicService.getTopicsByClass(selectedClassId);
      setTopics(data);
    } catch (error) {
      alert('Lỗi khi tải danh sách chủ đề');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'faculty') {
          navigate('/login');
        } else {
          setUser(currentUser);
        }
      } catch (error) {
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (selectedClassId) {
      sessionStorage.setItem('selectedClassId', selectedClassId);
      loadTopics();
    }
  }, [selectedClassId, loadTopics]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Vui lòng nhập tên chủ đề');
      return;
    }

    if (!user || !user.id) {
      alert('Lỗi: Không thể xác định người tạo chủ đề');
      return;
    }

    setLoading(true);
    try {
      const topicData = {
        ...formData,
        classId: selectedClassId || '',
        type: location.state?.type || 'startup',
        createdBy: user.id,
        createdByName: user.displayName || 'Unknown'
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
    setFormData({
      name: topic.name,
      description: topic.description,
      gradeLevel: topic.gradeLevel
    });
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

  const handleCreateExam = (topicId) => {
    navigate(`/faculty/exam-management?classId=${selectedClassId}&topicId=${topicId}`, { 
      state: { 
        topicId,
        classId: selectedClassId
      }
    });
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', gradeLevel: '5' });
    setEditingTopic(null);
    setShowForm(false);
  };

  if (loading && topics.length === 0) {
    return <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 flex items-center justify-center"><span className="text-white text-xl">Đang tải...</span></div>;
  }

  const navItems = [
    { icon: '📚', label: 'Quản lí Chủ Đề' }
  ];

  return (
    <div className="faculty-topic-management min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600">
      <FacultyHeader user={user} onLogout={() => navigate('/login')} onBack={() => navigate('/faculty/class-management')} navItems={navItems} />

      <div className="topic-header-actions px-12 pt-8 mb-8 flex justify-between items-center max-w-6xl mx-auto w-full">
        <button className="add-topic-btn px-6 py-3 bg-gradient-to-r from-green-500 to-green-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border-none cursor-pointer text-lg" onClick={() => {
          resetForm();
          setShowForm(true);
        }}>
          + Tạo chủ đề mới
        </button>
      </div>

      {showForm && (
        <div className="form-container fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="form-card bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{editingTopic ? 'Chỉnh sửa chủ đề' : 'Tạo chủ đề mới'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tên chủ đề *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Phép nhân số thập phân"
                  className="input-field w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="form-group mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả chủ đề..."
                  rows="4"
                  className="form-textarea w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              <div className="form-group mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Khối lớp</label>
                <select
                  value={formData.gradeLevel}
                  onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                  className="input-field w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="3">Lớp 3</option>
                  <option value="4">Lớp 4</option>
                  <option value="5">Lớp 5</option>
                </select>
              </div>

              <div className="form-actions flex gap-3">
                <button type="submit" className="submit-btn flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white font-bold rounded-lg hover:shadow-lg transition-all duration-300 border-none cursor-pointer">
                  {editingTopic ? 'Cập nhật' : 'Tạo'}
                </button>
                <button type="button" className="cancel-btn flex-1 px-4 py-3 bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400 transition-all duration-300 border-none cursor-pointer" onClick={resetForm}>
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="topics-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-12 pb-8 max-w-6xl mx-auto w-full">
        {topics.length === 0 ? (
          <div className="empty-state col-span-full text-center py-12 text-white text-xl font-semibold">
            <p>Chưa có chủ đề nào. Hãy tạo chủ đề đầu tiên!</p>
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
              onCreateExam={handleCreateExam}
              showActions={true}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FacultyTopicManagementPage;
