import React, { useState, useEffect } from 'react';
import classService from '../../services/faculty/classService';
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

  const getStatusInfo = (status, isLocked) => {
    if (isLocked) {
      return {
        label: 'Đã khóa',
        icon: '🔒',
        bgColor: 'bg-blue-600',
        textColor: 'text-white',
        borderColor: 'border-blue-600'
      };
    }

    const statusMap = {
      draft: {
        label: 'Bản nháp',
        icon: '📝',
        bgColor: 'bg-gray-500',
        textColor: 'text-white',
        borderColor: 'border-gray-500'
      },
      open: {
        label: 'Sẵn sàng',
        icon: '✅',
        bgColor: 'bg-green-500',
        textColor: 'text-white',
        borderColor: 'border-green-500'
      },
      in_progress: {
        label: 'Đang diễn ra',
        icon: '🟢',
        bgColor: 'bg-green-600',
        textColor: 'text-white',
        borderColor: 'border-green-600',
        animation: 'animate-pulse-glow'
      },
      closed: {
        label: 'Đã kết thúc',
        icon: '⏹️',
        bgColor: 'bg-red-600',
        textColor: 'text-white',
        borderColor: 'border-red-600'
      }
    };

    return statusMap[status] || statusMap.draft;
  };

  const statusInfo = getStatusInfo(exam.status, exam.isLocked);

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-3xl border-2 border-gray-100 bg-white p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-soft-lg sm:p-5 lg:p-6 ${statusInfo.animation || ''}`}>
      {/* Status Badge */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="flex-1 line-clamp-2 overflow-hidden text-ellipsis text-sm font-bold leading-tight text-gray-800 sm:text-base lg:text-lg">{exam.title}</h3>
        <span 
          className={`flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.textColor}`}
        >
          {statusInfo.icon} {statusInfo.label}
        </span>
      </div>

      {/* Description */}
      {exam.description && (
        <p className="mb-3 line-clamp-2 h-auto max-h-10 overflow-hidden text-ellipsis text-xs leading-relaxed text-gray-500 sm:text-sm">{exam.description}</p>
      )}

      {/* Info Cards */}
      <div className="my-2 flex flex-grow flex-col gap-1.5 border-y border-gray-200 p-3 text-xs sm:text-sm">
        {className && <span className="text-gray-600 flex items-center gap-2 font-medium">📚 <span className="truncate">{className}</span></span>}
        {topicName && <span className="text-gray-600 flex items-center gap-2 font-medium">📖 <span className="truncate">{topicName}</span></span>}
        <span className="text-gray-600 flex items-center gap-2">⏱️ 7 phút</span>
        <span className="text-gray-600 flex items-center gap-2">❓ {exam.exercises?.reduce((sum, e) => sum + e.questions.length, 0) || 0} câu</span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 mt-auto pt-3">
        {/* Row 1: Edit and Delete buttons */}
        <div className="flex gap-2 w-full flex-wrap">
          {onEdit && (
            <button 
              className="touch-btn shadow-soft flex-1 whitespace-nowrap rounded-xl border-none bg-gradient-to-r from-blue-500 to-blue-600 px-2 text-xs font-semibold text-center text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:px-3 sm:text-sm" 
              onClick={() => onEdit(exam)}
            >
              ✏️ <span className="hidden sm:inline ml-1">Sửa</span>
            </button>
          )}
          
          {onDelete && (
            <button 
              className="touch-btn shadow-soft flex-1 whitespace-nowrap rounded-xl border-none bg-red-100 px-2 text-xs font-semibold text-center text-red-900 transition-all duration-300 hover:bg-red-200 sm:px-3 sm:text-sm" 
              onClick={() => onDelete(exam.id)}
            >
              🗑️ <span className="hidden sm:inline ml-1">Xóa</span>
            </button>
          )}
        </div>

        {/* Row 2: Status-specific buttons */}
        <div className="flex gap-2 w-full flex-wrap">
          {exam.isLocked === true && onViewLeaderboard && (
            <button 
              className="touch-btn shadow-soft flex-1 whitespace-nowrap rounded-xl border-none bg-gradient-to-r from-yellow-500 to-yellow-600 px-2 text-xs font-semibold text-center text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:px-3 sm:text-sm" 
              onClick={() => onViewLeaderboard(exam.id)}
            >
              🏆 <span className="hidden sm:inline ml-1">Kết quả</span>
            </button>
          )}
          
          {exam.isLocked !== true && exam.status === 'draft' && onActivate && (
            <button 
              className="touch-btn shadow-soft flex-1 whitespace-nowrap rounded-xl border-none bg-gradient-to-r from-green-500 to-green-600 px-2 text-xs font-semibold text-center text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:px-3 sm:text-sm" 
              onClick={() => onActivate(exam.id)}
            >
              ✅ <span className="hidden sm:inline ml-1">Kích hoạt</span>
            </button>
          )}

          {exam.isLocked !== true && exam.status === 'active' && onStart && (
            <button 
              className="touch-btn shadow-soft flex-1 whitespace-nowrap rounded-xl border-none bg-gradient-to-r from-green-500 to-green-600 px-2 text-xs font-semibold text-center text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:px-3 sm:text-sm" 
              onClick={() => onStart(exam.id)}
            >
              🎮 <span className="hidden sm:inline ml-1">Tham gia</span>
            </button>
          )}

          {/* {exam.isLocked !== true && exam.status === 'in_progress' && onViewResults && (
            <button 
              className="flex-1 min-h-10 px-2 lg:px-3 py-2.5 border-none rounded-xl text-xs lg:text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-green-500 to-green-600 text-white hover:-translate-y-1 hover:shadow-soft-lg shadow-soft" 
              onClick={() => onViewResults(exam.id)}
            >
              📊 <span className="hidden sm:inline ml-1">Bảng xếp hạng</span>
            </button>
          )} */}
        </div>

        {/* Join button - Responsive */}
        {exam.isLocked !== true && onStart && (
          <button 
            className="touch-btn shadow-soft mt-1 w-full whitespace-nowrap rounded-xl border-none bg-gradient-to-r from-amber-500 to-amber-600 px-2 text-xs font-semibold text-center text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:px-3 sm:text-sm" 
            onClick={() => onStart(exam.id)}
          >
            🚀 <span className="hidden sm:inline ml-1">Tạo phiên trò chơi</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ExamCard;
