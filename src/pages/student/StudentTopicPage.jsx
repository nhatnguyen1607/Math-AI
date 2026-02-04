import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';

const StudentTopicPage = ({ user, onSignOut, selectedClass, topics, exams, selectedTopic, setSelectedTopic, topicId, setTopicExams }) => {
  const navigate = useNavigate();

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    navigate(`/student/${selectedClass.id}/topic-management/${topic.id}`);
    const topicExamsList = exams.filter(exam => exam.topicId === topic.id);
    setTopicExams(topicExamsList);
  };

  const handleJoinExam = (examId) => {
    window.location.href = `/student/exam-lobby/${examId}`;
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Danh sách chủ đề
  if (!topicId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

        <div className="p-8">
          <div className="px-12 py-8 max-w-6xl mx-auto w-full">
            {/* Quay lại button */}
            <div className="mb-8">
              <button 
                onClick={handleBack}
                className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg transition-all duration-300"
              >
                ← Quay lại
              </button>
            </div>

            {topics.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <p className="text-gray-600 text-lg">Chưa có chủ đề nào. Vui lòng quay lại sau!</p>
              </div>
            ) : (
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Chọn chủ đề để bắt đầu</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    onClick={() => handleSelectTopic(topic)}
                    className="bg-white rounded-2xl shadow-lg hover:shadow-2xl p-6 cursor-pointer transition-all duration-300 transform hover:scale-105 border-t-4 border-indigo-500"
                  >
                    <div className="text-4xl mb-3">📖</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{topic.name}</h3>
                    {topic.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{topic.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <span className="text-sm font-semibold text-indigo-600">
                        {exams.filter(exam => exam.topicId === topic.id).length} đề thi
                      </span>
                      <button className="text-indigo-600 hover:text-indigo-700 font-bold">
                        Khám phá →
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chi tiết chủ đề và danh sách đề thi của topic
  if (topicId && selectedTopic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={handleBack}
                className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg transition-all duration-300"
              >
                ← Quay lại
              </button>
              <h2 className="text-3xl font-bold text-gray-800">{selectedTopic.name}</h2>
            </div>

            {selectedTopic.description && (
              <p className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg text-gray-700 mb-8">{selectedTopic.description}</p>
            )}

            <div className="space-y-4">
              {exams.filter(exam => exam.topicId === topicId).length > 0 ? (
                exams.filter(exam => exam.topicId === topicId).map((exam) => (
                  <div key={exam.id} className="bg-white rounded-xl shadow-md hover:shadow-lg p-6 transition-all duration-300 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{exam.title}</h3>
                      <div className="flex gap-4 text-sm text-gray-600 mb-2">
                        <span>❓ {exam.questions?.length || 0} câu</span>
                        <span>⏱️ {exam.duration} phút</span>
                        <span>🎯 {exam.passingScore}% đạt</span>
                      </div>
                      {exam.description && (
                        <p className="text-gray-600 text-sm">{exam.description}</p>
                      )}
                    </div>
                    <button
                      className="ml-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-all duration-300 whitespace-nowrap"
                      onClick={() => handleJoinExam(exam.id)}
                    >
                      Tham gia
                    </button>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                  <p className="text-gray-600 text-lg">Chủ đề này chưa có đề thi nào.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default StudentTopicPage;
