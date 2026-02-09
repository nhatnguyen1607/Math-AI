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
    <div className={`flex flex-col bg-white rounded-3xl p-5 lg:p-6 shadow-soft hover:shadow-soft-lg hover:-translate-y-2 h-full lg:h-96 border-2 border-gray-100 overflow-hidden transition-all duration-300 hover:border-indigo-300 ${statusInfo.animation || ''}`}>
      {/* Status Badge */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base lg:text-lg font-bold text-gray-800 line-clamp-2 leading-tight overflow-hidden text-ellipsis flex-1">{exam.title}</h3>
        <span 
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${statusInfo.bgColor} ${statusInfo.textColor}`}
        >
          {statusInfo.icon} {statusInfo.label}
        </span>
      </div>

      {/* Description */}
      {exam.description && (
        <p className="text-gray-500 text-xs lg:text-sm mb-3 line-clamp-2 leading-relaxed overflow-hidden text-ellipsis h-auto max-h-9">{exam.description}</p>
      )}

      {/* Info Cards */}
      <div className="flex flex-col gap-1.5 p-3 border-t border-b border-gray-200 my-2 text-xs flex-grow">
        {className && <span className="text-gray-600 flex items-center gap-2 font-medium">📚 <span className="truncate">{className}</span></span>}
        {topicName && <span className="text-gray-600 flex items-center gap-2 font-medium">📖 <span className="truncate">{topicName}</span></span>}
        <span className="text-gray-600 flex items-center gap-2">⏱️ {exam.duration || exam.exercises?.reduce((sum, e) => sum + e.duration, 0) || 0}s</span>
        <span className="text-gray-600 flex items-center gap-2">❓ {exam.exercises?.reduce((sum, e) => sum + e.questions.length, 0) || 0} câu</span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 mt-auto pt-3">
        {/* Row 1: Edit and Delete buttons */}
        <div className="flex gap-2 w-full flex-wrap">
          {onEdit && (
            <button 
              className="flex-1 min-h-10 px-2 lg:px-3 py-2.5 border-none rounded-xl text-xs lg:text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:-translate-y-1 hover:shadow-soft-lg shadow-soft" 
              onClick={() => onEdit(exam)}
            >
              ✏️ <span className="hidden sm:inline ml-1">Sửa</span>
            </button>
          )}
          
          {onDelete && (
            <button 
              className="flex-1 min-h-10 px-2 lg:px-3 py-2.5 border-none rounded-xl text-xs lg:text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-red-100 text-red-900 hover:bg-red-200 shadow-soft" 
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
              className="flex-1 min-h-10 px-2 lg:px-3 py-2.5 border-none rounded-xl text-xs lg:text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:-translate-y-1 hover:shadow-soft-lg shadow-soft" 
              onClick={() => onViewLeaderboard(exam.id)}
            >
              🏆 <span className="hidden sm:inline ml-1">Kết quả</span>
            </button>
          )}
          
          {exam.isLocked !== true && exam.status === 'draft' && onActivate && (
            <button 
              className="flex-1 min-h-10 px-2 lg:px-3 py-2.5 border-none rounded-xl text-xs lg:text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-green-500 to-green-600 text-white hover:-translate-y-1 hover:shadow-soft-lg shadow-soft" 
              onClick={() => onActivate(exam.id)}
            >
              ✅ <span className="hidden sm:inline ml-1">Kích hoạt</span>
            </button>
          )}

          {exam.isLocked !== true && exam.status === 'active' && onStart && (
            <button 
              className="flex-1 min-h-10 px-2 lg:px-3 py-2.5 border-none rounded-xl text-xs lg:text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center flex items-center justify-center bg-gradient-to-r from-green-500 to-green-600 text-white hover:-translate-y-1 hover:shadow-soft-lg shadow-soft" 
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
            className="w-full px-2 lg:px-3 py-2.5 border-none rounded-xl text-xs lg:text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap text-center bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:-translate-y-1 hover:shadow-soft-lg shadow-soft mt-1" 
            onClick={() => onStart(exam.id)}
          >
            🚀 <span className="hidden sm:inline ml-1">Tạo phiên thi</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ExamCard;
