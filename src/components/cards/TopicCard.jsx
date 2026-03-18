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
      className="flex h-full flex-col overflow-hidden rounded-2xl border-l-4 bg-white p-4 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-5"
      style={{borderLeftColor: topic.color}}
    >
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 text-2xl">{topic.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="line-clamp-2 text-sm font-bold text-gray-800 sm:text-base">{topic.name}</h3>
            <p className="mt-0.5 text-xs text-gray-400">{formatDate(topic.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3 line-clamp-2 text-xs text-gray-600 sm:text-sm">{topic.description || 'Không có mô tả'}</p>

      {/* Stats */}
      <div className="my-1 flex flex-wrap gap-2 border-y border-gray-100 py-2 text-xs sm:gap-3 sm:text-sm">
        <span className="flex items-center gap-1 text-gray-600">📘 <strong>{topic.sampleExams?.length || 0}</strong> đề mẫu</span>
        <span className="flex items-center gap-1 text-gray-600">📚 Lớp {topic.gradeLevel}</span>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          {onCreateExam && (
            <button 
              className="touch-btn flex-1 rounded-xl border-none bg-gradient-to-r from-purple-500 to-blue-500 px-3 text-xs font-semibold text-white transition-all duration-300 hover:shadow-lg sm:text-sm"
              onClick={() => onCreateExam(topic.id)}
            >
              ✏️ Đề thi
            </button>
          )}
          {onEdit && (
            <button 
              className="touch-btn flex-1 rounded-xl border-none bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition-all duration-300 hover:bg-blue-100 sm:text-sm"
              onClick={() => onEdit(topic)}
            >
              ✏️ Sửa
            </button>
          )}
          {onDelete && (
            <button 
              className="touch-btn flex-1 rounded-xl border-none bg-red-100 px-3 text-xs font-semibold text-red-900 transition-all duration-300 hover:bg-red-200 sm:text-sm"
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
