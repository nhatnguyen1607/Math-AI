import React from 'react';

const TopicCard = ({ topic, onEdit, onDelete, onCreateExam, showActions = true }) => {
  const formatDate = (date) => {
    if (!date) return '';
    let dateObj = date;
    if (date.toDate) {
      dateObj = date.toDate();
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    }
    return dateObj.toLocaleDateString('vi-VN');
  };

  return (
    <div 
      className="flex flex-col bg-white rounded-lg p-4 border-l-4 shadow-md hover:shadow-lg hover:-translate-y-1 overflow-hidden transition-all duration-300"
      style={{borderLeftColor: topic.color}}
    >
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-start gap-2">
          <span className="text-2xl flex-shrink-0 flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg">{topic.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-800 line-clamp-2">{topic.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(topic.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-600 text-xs mb-2 line-clamp-2">{topic.description || 'Không có mô tả'}</p>

      {/* Stats */}
      <div className="flex gap-4 py-2 border-t border-b border-gray-100 text-xs">
        <span className="text-gray-600 flex items-center gap-1">� <strong>{topic.examCount || 0}</strong> đề</span>
        <span className="text-gray-600 flex items-center gap-1">�📚 Lớp {topic.gradeLevel}</span>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex gap-2 mt-auto pt-3 flex-wrap">
          {onCreateExam && (
            <button 
              className="flex-1 px-2 py-2 text-xs font-semibold border-none rounded-lg cursor-pointer transition-all duration-300 bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:scale-105 hover:shadow-lg"
              onClick={() => onCreateExam(topic.id)}
            >
              ✏️ Đề thi
            </button>
          )}
          {onEdit && (
            <button 
              className="flex-1 px-2 py-2 text-xs font-semibold border-none rounded-lg cursor-pointer transition-all duration-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              onClick={() => onEdit(topic)}
            >
              ✏️ Sửa
            </button>
          )}
          {onDelete && (
            <button 
              className="flex-1 px-2 py-2 text-xs font-semibold border-none rounded-lg cursor-pointer transition-all duration-300 bg-red-100 text-red-900 hover:bg-red-200"
              onClick={() => onDelete(topic.id)}
            >
              🗑️ Xóa
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TopicCard;
