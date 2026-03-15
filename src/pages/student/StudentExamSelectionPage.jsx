import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import resultService from '../../services/resultService';
import StudentHeader from '../../components/student/StudentHeader';

const StudentExamSelectionPage = ({ 
  user, 
  onSignOut, 
  selectedClass, 
  topics,
  exams
}) => {
  const navigate = useNavigate();
  const { topicId, pathway } = useParams();

  // Get exams for this topic
  const selectedTopic = topics.find(t => t.id === topicId);
  const topicExams = exams.filter(e => e.topicId === topicId && e.status !== 'draft');

  const handleJoinExam = async (exam) => {
    try {
      // Check if exam is locked
      if (exam?.isLocked === true) {
        // For locked exams, navigate to result page by examId
        navigate(`/student/exam-result/${exam.id}`, {
          state: { fromExam: false, examId: exam.id }
        });
        return;
      }
      // For unlocked exams, check if student has already completed
      if (user?.uid) {
        const progress = await resultService.getExamProgress(user.uid, exam.id);
        
        // If progress exists and isFirst is false, redirect to result page
        if (progress && progress.isFirst === false) {
          navigate(`/student/exam-result/${progress.sessionId || exam.id}`, {
            state: { fromExam: false, examId: exam.id }
          });
          return;
        }
      }

      // Otherwise, go to exam lobby (first time or in progress)
      window.location.href = `/student/exam-lobby/${exam.id}`;
    } catch (error) {
      // If there's an error, go to exam lobby as fallback
      window.location.href = `/student/exam-lobby/${exam.id}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Back and Title */}
          <div className="flex items-center gap-4 mb-10">
            <button 
              onClick={() => navigate(`/student/${selectedClass?.id}/pathway/${pathway}`)}
              className="btn-3d bg-white text-gray-800 py-3 px-6 rounded-max font-quicksand hover:shadow-lg transition-all"
            >
              ← Quay lại
            </button>
            <div>
              <h2 className="text-4xl font-bold text-gray-800 font-quicksand">
                Các đề thi bài tập
              </h2>
              {selectedTopic && (
                <p className="text-gray-600 font-quicksand mt-1">
                  {selectedTopic.name}
                </p>
              )}
            </div>
          </div>

          {/* Exams List */}
          <div className="space-y-6">
            {topicExams && topicExams.length > 0 ? (
              topicExams.map((exam, idx) => {
                return (
                  <div 
                    key={exam.id} 
                    className="game-card bg-white rounded-max shadow-lg hover:shadow-2xl p-8 transition-all duration-300 transform hover:-translate-y-2 border-l-8 border-blue-500"
                  >
                    {/* Exam Title */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-4xl">📚</span>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-800 font-quicksand">
                          {exam.title}
                        </h3>
                      </div>
                      <span className="text-2xl">{idx + 1}</span>
                    </div>

                    {/* Exam Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b-2 border-gray-200">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 font-quicksand">
                          {exam.questions?.length || 0}
                        </div>
                        <div className="text-sm text-gray-600 font-quicksand">Câu hỏi</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600 font-quicksand">
                          {exam.duration}
                        </div>
                        <div className="text-sm text-gray-600 font-quicksand">phút</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600 font-quicksand">
                          {exam.passingScore}%
                        </div>
                        <div className="text-sm text-gray-600 font-quicksand">điểm đạt</div>
                      </div>
                    </div>

                    {/* Description */}
                    {exam.description && (
                      <p className="text-gray-600 text-base mb-6 font-quicksand">
                        {exam.description}
                      </p>
                    )}

                    {/* Join Button */}
                    <button
                      className={`btn-3d w-full font-bold py-4 px-6 rounded-max transition-all duration-300 font-quicksand text-lg ${
                        exam?.isLocked === true
                          ? 'bg-gradient-to-r from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600'
                          : 'bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600'
                      } text-white`}
                      onClick={() => {
                        handleJoinExam(exam);
                      }}
                    >
                      {exam?.isLocked === true ? '📊 Xem kết quả' : '🚀 Bắt đầu'}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-max shadow-lg p-16 text-center game-card">
                <p className="text-5xl mb-4">📭</p>
                <p className="text-gray-600 text-lg font-quicksand">Chủ đề này chưa có đề nào.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentExamSelectionPage;
