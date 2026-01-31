import React, { useState, useEffect } from 'react';
import './ProblemManager.css';
import problemService from '../../services/problemService';
import aiProblemGenerator from '../../services/aiProblemGenerator';

const ProblemManager = ({ topic, onProblemSelect }) => {
  const [problems, setProblems] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [newProblem, setNewProblem] = useState({
    text: '',
    difficulty: 'easy',
    hints: [''],
    solution: ''
  });

  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    if (topic) {
      loadProblems();
    }
  }, [topic]);

  const loadProblems = async () => {
    try {
      setLoading(true);
      const topicProblems = await problemService.getProblemsByTopic(topic.id);
      setProblems(topicProblems);
    } catch (error) {
      console.error('Error loading problems:', error);
      alert('Không thể tải danh sách bài toán');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAIProblem = async () => {
    if (!aiPrompt.trim()) {
      alert('Vui lòng nhập yêu cầu cho AI');
      return;
    }

    try {
      setGenerating(true);
      const generatedProblem = await aiProblemGenerator.generateProblem(
        topic.name,
        aiPrompt,
        'easy'
      );
      
      setNewProblem({
        text: generatedProblem.problemText,
        difficulty: 'easy',
        hints: generatedProblem.hints || [''],
        solution: generatedProblem.solution || ''
      });
      
      alert('✨ Đã tạo bài toán bằng AI! Bạn có thể chỉnh sửa trước khi lưu.');
    } catch (error) {
      console.error('Error generating problem:', error);
      alert('Không thể tạo bài toán. Vui lòng thử lại.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddProblem = async (e) => {
    e.preventDefault();
    if (!newProblem.text.trim()) {
      alert('Vui lòng nhập đề bài');
      return;
    }

    try {
      setLoading(true);
      await problemService.createProblem({
        ...newProblem,
        topicId: topic.id,
        hints: newProblem.hints.filter(h => h.trim() !== '')
      });
      
      setNewProblem({
        text: '',
        difficulty: 'easy',
        hints: [''],
        solution: ''
      });
      setAiPrompt('');
      setShowAddForm(false);
      setUseAI(false);
      await loadProblems();
      alert('Thêm bài toán thành công!');
    } catch (error) {
      console.error('Error adding problem:', error);
      alert('Không thể thêm bài toán');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProblem = async (problemId) => {
    if (!window.confirm('Bạn có chắc muốn xóa bài toán này?')) {
      return;
    }

    try {
      setLoading(true);
      await problemService.deleteProblem(problemId);
      await loadProblems();
      alert('Xóa bài toán thành công!');
    } catch (error) {
      console.error('Error deleting problem:', error);
      alert('Không thể xóa bài toán');
    } finally {
      setLoading(false);
    }
  };

  const handleHintChange = (index, value) => {
    const newHints = [...newProblem.hints];
    newHints[index] = value;
    setNewProblem({...newProblem, hints: newHints});
  };

  const addHintField = () => {
    setNewProblem({...newProblem, hints: [...newProblem.hints, '']});
  };

  const removeHintField = (index) => {
    const newHints = newProblem.hints.filter((_, i) => i !== index);
    setNewProblem({...newProblem, hints: newHints.length > 0 ? newHints : ['']});
  };

  if (!topic) {
    return (
      <div className="problem-manager no-topic">
        <p>👈 Vui lòng chọn một chủ đề để quản lý bài toán</p>
      </div>
    );
  }

  return (
    <div className="problem-manager">
      <div className="problem-header">
        <h2>📝 Bài toán - {topic.name}</h2>
        <button 
          className="btn-add-problem"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={loading}
        >
          {showAddForm ? '✖ Hủy' : '➕ Thêm bài toán'}
        </button>
      </div>

      {showAddForm && (
        <form className="add-problem-form" onSubmit={handleAddProblem}>
          <div className="form-tabs">
            <button
              type="button"
              className={`tab-btn ${!useAI ? 'active' : ''}`}
              onClick={() => setUseAI(false)}
            >
              ✍️ Nhập thủ công
            </button>
            <button
              type="button"
              className={`tab-btn ${useAI ? 'active' : ''}`}
              onClick={() => setUseAI(true)}
            >
              🤖 Tạo bằng AI
            </button>
          </div>

          {useAI && (
            <div className="ai-generator">
              <div className="form-group">
                <label>Yêu cầu cho AI:</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="VD: Tạo bài toán về nhân số có 2 chữ số với số có 1 chữ số"
                  rows="3"
                  disabled={generating}
                />
              </div>
              <button 
                type="button"
                className="btn-generate"
                onClick={handleGenerateAIProblem}
                disabled={generating || !aiPrompt.trim()}
              >
                {generating ? '⏳ Đang tạo...' : '✨ Tạo bài toán'}
              </button>
            </div>
          )}

          <div className="form-group">
            <label>Đề bài:</label>
            <textarea
              value={newProblem.text}
              onChange={(e) => setNewProblem({...newProblem, text: e.target.value})}
              placeholder="Nhập đề bài toán..."
              rows="4"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label>Độ khó:</label>
            <select
              value={newProblem.difficulty}
              onChange={(e) => setNewProblem({...newProblem, difficulty: e.target.value})}
              disabled={loading}
            >
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>

          <div className="form-group">
            <label>Gợi ý:</label>
            {newProblem.hints.map((hint, index) => (
              <div key={index} className="hint-input-group">
                <input
                  type="text"
                  value={hint}
                  onChange={(e) => handleHintChange(index, e.target.value)}
                  placeholder={`Gợi ý ${index + 1}...`}
                  disabled={loading}
                />
                {newProblem.hints.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove-hint"
                    onClick={() => removeHintField(index)}
                    disabled={loading}
                  >
                    ✖
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn-add-hint"
              onClick={addHintField}
              disabled={loading}
            >
              + Thêm gợi ý
            </button>
          </div>

          <div className="form-group">
            <label>Lời giải (tùy chọn):</label>
            <textarea
              value={newProblem.solution}
              onChange={(e) => setNewProblem({...newProblem, solution: e.target.value})}
              placeholder="Nhập lời giải chi tiết..."
              rows="4"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? '⏳ Đang thêm...' : '✓ Lưu bài toán'}
          </button>
        </form>
      )}

      <div className="problems-list">
        {loading && problems.length === 0 ? (
          <div className="loading">Đang tải...</div>
        ) : problems.length === 0 ? (
          <div className="empty-state">
            <p>Chưa có bài toán nào. Hãy thêm bài toán đầu tiên!</p>
          </div>
        ) : (
          problems.map((problem, index) => (
            <div key={problem.id} className="problem-card">
              <div className="problem-info">
                <div className="problem-number">Bài {index + 1}</div>
                <div className="problem-text">{problem.text}</div>
                <div className="problem-meta">
                  <span className={`difficulty-badge ${problem.difficulty}`}>
                    {problem.difficulty === 'easy' ? 'Dễ' : 
                     problem.difficulty === 'medium' ? 'Trung bình' : 'Khó'}
                  </span>
                  <span className="stats">
                    👥 {problem.attemptCount || 0} lượt làm • 
                    ✓ {problem.completionCount || 0} hoàn thành
                  </span>
                </div>
              </div>
              <div className="problem-actions">
                <button
                  className="btn-view-leaderboard"
                  onClick={() => onProblemSelect(problem)}
                >
                  🏆 Xếp hạng
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteProblem(problem.id)}
                  disabled={loading}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProblemManager;
