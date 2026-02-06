import React, { useState, useEffect } from 'react';
import classService from '../../services/classService';
import facultyService from '../../services/faculty/facultyService';

const ExamCard = ({ exam, onEdit, onDelete, onActivate, onStart, onViewResults, onViewLeaderboard }) => {
  const [className, setClassName] = useState('');
  const [topicName, setTopicName] = useState('');


  useEffect(() => {
    const loadInfo = async () => {
      try {
        if (exam.classId) {
          const cls = await classService.getClassById(exam.classId);
          setClassName(cls?.name || '');
        }
        if (exam.topicId) {
          const topics = await facultyService.getTopics();
          const topic = topics.find(t => t.id === exam.topicId);
          setTopicName(topic?.name || '');
        }
      } catch (error) {
        console.error('Error loading exam info:', error);
      }
    };
    loadInfo();
  }, [exam.classId, exam.topicId]);

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Nháp',
      active: 'Sẵn sàng',
      in_progress: 'Đang diễn ra',
      closed: 'Đã kết thúc'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#9CA3AF',
      active: '#10B981',
      in_progress: '#F59E0B',
      closed: '#EF4444'
    };
    return colors[status] || '#6B7280';
  };

  return (
    <div className="flex flex-col bg-white rounded-lg p-5 shadow-md hover:shadow-lg hover:-translate-y-1.5 h-96 border border-gray-200 overflow-hidden transition-all duration-300">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-800 line-clamp-2 leading-tight overflow-hidden text-ellipsis">{exam.title}</h3>
          <span 
            className="px-2.5 py-1 rounded-md text-xs font-semibold text-white whitespace-nowrap flex-shrink-0"
            style={{backgroundColor: getStatusColor(exam.status)}}
          >
            {getStatusLabel(exam.status)}
          </span>
        </div>
      </div>

      {exam.description && (
        <p className="text-gray-500 text-sm mb-3 line-clamp-2 leading-relaxed overflow-hidden text-ellipsis h-9">{exam.description}</p>
      )}

      <div className="flex flex-col gap-1.5 p-2.5 border-t border-b border-gray-200 my-2 text-xs flex-grow">
        {className && <span className="text-gray-500 flex items-center gap-1.5">📚 {className}</span>}
        {topicName && <span className="text-gray-500 flex items-center gap-1.5">📖 {topicName}</span>}
        <span className="text-gray-500 flex items-center gap-1.5">⏱️ {exam.duration || exam.exercises?.reduce((sum, e) => sum + e.duration, 0) || 0}s</span>
        <span className="text-gray-500 flex items-center gap-1.5">❓ {exam.exercises?.reduce((sum, e) => sum + e.questions.length, 0) || 0} câu</span>
      </div>

      <div className="flex flex-col gap-2 mt-auto pt-3">
        {/* Row 1: Edit and Delete buttons */}
        <div className="flex gap-2 w-full flex-wrap">
          {onEdit && (
            <button className="flex-1 min-h-10 px-3 py-2.5 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30" onClick={() => onEdit(exam)}>
              ✏️ Sửa
            </button>
          )}
          
          {onDelete && (
            <button className="flex-1 min-h-10 px-3 py-2.5 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-red-100 text-red-900 hover:bg-red-200" onClick={() => onDelete(exam.id)}>
              🗑️ Xóa
            </button>
          )}
        </div>

        {/* Row 2: Status-specific buttons */}
        <div className="flex gap-2 w-full flex-wrap">
          {exam.isLocked === true && onViewLeaderboard && (
            <button className="flex-1 min-h-10 px-3 py-2.5 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-yellow-500/30" onClick={() => onViewLeaderboard(exam.id)}>
              🏆 Xem kết quả
            </button>
          )}
          
          {exam.isLocked !== true && exam.status === 'draft' && onActivate && (
            <button className="flex-1 min-h-10 px-3 py-2.5 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-green-500 to-green-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/30" onClick={() => onActivate(exam.id)}>
              ✅ Kích hoạt
            </button>
          )}

          {exam.isLocked !== true && exam.status === 'active' && onStart && (
            <button className="flex-1 min-h-10 px-3 py-2.5 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-green-500 to-green-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/30" onClick={() => onStart(exam.id)}>
              🎮 Tham gia
            </button>
          )}

          {exam.isLocked !== true && exam.status === 'in_progress' && onViewResults && (
            <button className="flex-1 min-h-10 px-3 py-2.5 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-green-500 to-green-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/30" onClick={() => onViewResults(exam.id)}>
              📊 Xem bảng xếp hạng
            </button>
          )}
        </div>

        {/* Join button - only if not locked */}
        {exam.isLocked !== true && onStart && (
          <button className="flex-1 w-full px-3 py-2.5 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/30 mt-1" onClick={() => onStart(exam.id)}>
            🚀 Tham gia
          </button>
        )}
      </div>
    </div>
  );
};

export default ExamCard;
