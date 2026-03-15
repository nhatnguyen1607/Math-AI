import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import authService from '../../services/authService';
import facultyService from '../../services/faculty/facultyService';
import examSessionService from '../../services/faculty/examSessionService';
import classService from '../../services/faculty/classService';
import topicService from '../../services/faculty/topicService';
// import geminiService from '../../services/geminiService';
import examGeneratorService from '../../services/faculty/examGeneratorService';
import { parseExamFile } from '../../services/faculty/fileParserService';
import ExamCard from '../../components/cards/ExamCard';
import FacultyHeader from '../../components/faculty/FacultyHeader';

const FacultyExamManagementPage = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [topics, setTopics] = useState([]);
  const [classes, setClasses] = useState([]);
  const [user, setUser] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  
  // Selection state - initialize as null
  const [selectedClassId, setSelectedClassId] = useState(() => {
    // Priority: URL params > location.state > sessionStorage > null
    const urlClassId = searchParams.get('classId');
    const stateClassId = location.state?.classId;
    const sessionClassId = sessionStorage.getItem('selectedClassId');
    return urlClassId || stateClassId || sessionClassId || null;
  });
  const [selectedTopicId, setSelectedTopicId] = useState(() => {
    // Priority: URL params > location.state > sessionStorage > null
    const urlTopicId = searchParams.get('topicId');
    const stateTopicId = location.state?.topicId;
    const sessionTopicId = sessionStorage.getItem('selectedTopicId');
    return urlTopicId || stateTopicId || sessionTopicId || null;
  });
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedTopicName, setSelectedTopicName] = useState('');
  
  // Effect to load initial values from location.state or URL params
  useEffect(() => {
    // Priority: URL params > location.state > sessionStorage > null
    const classIdFromUrl = searchParams.get('classId');
    const topicIdFromUrl = searchParams.get('topicId');
    const classIdFromState = location.state?.classId;
    const topicIdFromState = location.state?.topicId;
    const classIdFromSession = sessionStorage.getItem('selectedClassId');
    const topicIdFromSession = sessionStorage.getItem('selectedTopicId');
    
    const finalClassId = classIdFromUrl || classIdFromState || classIdFromSession;
    const finalTopicId = topicIdFromUrl || topicIdFromState || topicIdFromSession;
        
    if (finalClassId) {
      setSelectedClassId(finalClassId);
      sessionStorage.setItem('selectedClassId', finalClassId);
    }
    if (finalTopicId) {
      setSelectedTopicId(finalTopicId);
      sessionStorage.setItem('selectedTopicId', finalTopicId);
    }
  }, [location.state, searchParams]);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const [editingExam, setEditingExam] = useState(null);

  // Exercises state
  const [exercises, setExercises] = useState([
    { name: 'Bài tập 1 - BT vận dụng, ứng dụng', duration: 120, context: '', questions: [], scoring: { correct: 12, incorrect: 2, bonus: 4, bonusTimeThreshold: 60 } },
    { name: 'Bài tập 2 - BT GQVĐ', duration: 300, context: '', questions: [], scoring: { correct: 12, incorrect: 2, bonus: 4, bonusTimeThreshold: 240 } }
  ]);
  
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState(null);
  
  // File upload and preview states
  const [parsedExercises, setParsedExercises] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // AI exam generation states
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiExercises, setAiExercises] = useState(null);
  
  const navigate = useNavigate();
  const authCheckedRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (authCheckedRef.current) return;
    authCheckedRef.current = true;

    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (!currentUser || currentUser.role !== 'faculty') {
          navigate('/login');
        } else {
          setUser(currentUser);
          // Load everything once user is authenticated
          await loadAllData(currentUser.id, selectedClassId, selectedTopicId);
        }
      } catch (error) {
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate, selectedClassId, selectedTopicId]);

  // Load all data: classes, topics, and exams
  const loadAllData = async (userId, classId, topicId) => {
    try {
      
      // Load classes in parallel, topics with classId filter when available
      const classesData = await classService.getAllClasses();
      setClasses(classesData || []);
      
      // 🔧 Lọc topics theo classId nếu có
      let topicsData = [];
      if (classId) {
        topicsData = await facultyService.getTopics(classId);
      } else {
        topicsData = await facultyService.getTopics();
      }
      setTopics(topicsData || []);
      
      // Update names
      if (classId && classesData) {
        const className = classesData.find(c => c.id === classId)?.name;
        if (className) {
          setSelectedClassName(className);
        }
      }
      
      if (topicId && topicsData) {
        const topicName = topicsData.find(t => t.id === topicId)?.name;
        if (topicName) {
          setSelectedTopicName(topicName);
        }
      }
      
      // Load exams if we have both classId and topicId
      if (classId && topicId) {
        const examsData = await facultyService.getExamsByFaculty(userId, classId, topicId);
        setExams(examsData || []);
      }
    } catch (error) {
      // Error loading data
    }
  };

  useEffect(() => {
    if (selectedClassId && selectedTopicId) {
      setSearchParams({ classId: selectedClassId, topicId: selectedTopicId });
    }
  }, [selectedClassId, selectedTopicId, setSearchParams]);

  // 🔧 Effect để reload topics khi selectedClassId thay đổi
  useEffect(() => {
    const loadTopicsForClass = async () => {
      try {
        if (selectedClassId) {
          // Load topics - if classId exists, filter by it; otherwise load all
          const topicsData = await facultyService.getTopics(selectedClassId);
          setTopics(topicsData || []);
          
          // Chỉ reset selectedTopicId nếu không phải lần đầu load
          // Lần đầu load, giữ topicId từ URL
          if (!isInitialLoadRef.current) {
            setSelectedTopicId(null);
          } else {
            isInitialLoadRef.current = false;
          }
        }
      } catch (error) {
      }
    };

    if (selectedClassId) {
      loadTopicsForClass();
    }
  }, [selectedClassId]);

  const handleAddQuestion = () => {
    const updatedExercises = [...exercises];
    updatedExercises[currentExerciseIndex].questions.push({
      id: Date.now(),
      question: '',
      type: 'single',
      options: ['', '', '', ''],
      correctAnswers: [0],
      explanation: ''
    });
    setExercises(updatedExercises);
  };

  const handleUpdateQuestion = (index, field, value) => {
    const updatedExercises = [...exercises];
    const updated = [...updatedExercises[currentExerciseIndex].questions];
    if (field === 'options') {
      updated[index].options = value;
    } else {
      updated[index][field] = value;
    }
    updatedExercises[currentExerciseIndex].questions = updated;
    setExercises(updatedExercises);
  };

  const handleRemoveQuestion = (index) => {
    const updatedExercises = [...exercises];
    updatedExercises[currentExerciseIndex].questions = updatedExercises[currentExerciseIndex].questions.filter((_, i) => i !== index);
    setExercises(updatedExercises);
    if (currentQuestionIndex >= updatedExercises[currentExerciseIndex].questions.length) {
      setCurrentQuestionIndex(Math.max(0, updatedExercises[currentExerciseIndex].questions.length - 1));
    }
  };

  // Drag and drop handlers for reordering questions
  const handleDragStart = (e, index) => {
    setDraggedQuestionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedQuestionIndex === null || draggedQuestionIndex === targetIndex) {
      setDraggedQuestionIndex(null);
      return;
    }

    const updatedExercises = [...exercises];
    const questions = [...updatedExercises[currentExerciseIndex].questions];
    
    // Swap questions
    [questions[draggedQuestionIndex], questions[targetIndex]] = [questions[targetIndex], questions[draggedQuestionIndex]];
    
    updatedExercises[currentExerciseIndex].questions = questions;
    setExercises(updatedExercises);
    
    // Update current question index if needed
    if (currentQuestionIndex === draggedQuestionIndex) {
      setCurrentQuestionIndex(targetIndex);
    }

    setDraggedQuestionIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedQuestionIndex(null);
  };

  // Handle file upload and parsing
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setParseError(null);
    setParsedExercises(null);

    try {
      // Parse file using JavaScript libraries (no server needed!)
      const result = await parseExamFile(file);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      setParsedExercises(result.exercises);
      setParseError(null);
    } catch (error) {
      setParseError(`❌ Lỗi: ${error.message}`);
      setParsedExercises(null);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Apply parsed exercises to form
  const handleApplyParsedExercises = () => {
    if (!parsedExercises) return;
    
    // Replace current exercises with parsed ones
    setExercises(parsedExercises);
    setParsedExercises(null);
    setCurrentExerciseIndex(0);
    setCurrentQuestionIndex(0);
  };

  // Discard parsed exercises
  const handleDiscardParsedExercises = () => {
    setParsedExercises(null);
    setParseError(null);
  };

  // Handle AI exam generation
  const handleGenerateExamWithAI = async () => {
    // Validate title first
    if (!formData.title.trim()) {
      alert('Vui lòng nhập tiêu đề bài ôn trước');
      return;
    }

    // Validate topic selection
    if (!selectedTopicId) {
      alert('Vui lòng chọn chủ đề trước');
      return;
    }

    setAiGenerating(true);
    setAiError(null);
    setAiExercises(null);

    try {
      // Load topic data to get sampleExams
      const topic = await topicService.getTopicById(selectedTopicId);
      
      if (!topic.sampleExams || topic.sampleExams.length === 0) {
        throw new Error('Chủ đề này chưa có đề mẫu. Vui lòng bổ sung đề mẫu cho chủ đề trước.');
      }

      // Call AI to generate exam based on sampleExams - use form title as lesson name
      const generatedExercises = await examGeneratorService.generateExamFromSamples({
        topicName: topic.name,
        lessonName: formData.title,
        sampleExams: topic.sampleExams
      });

      setAiExercises(generatedExercises?.data?.exercises || []);
      setAiError(null);
    } catch (error) {
      setAiError(`❌ Lỗi: ${error.message}`);
      setAiExercises(null);
    } finally {
      setAiGenerating(false);
    }
  };

  // Apply AI-generated exercises
  const handleApplyAIExercises = () => {
    if (!aiExercises) return;

    // Add default scoring if missing
    const exercisesWithScoring = aiExercises.map(ex => ({
      ...ex,
      scoring: ex.scoring || { correct: 12, incorrect: 2, bonus: 4, bonusTimeThreshold: 60 }
    }));

    setExercises(exercisesWithScoring);
    setAiExercises(null);
    setCurrentExerciseIndex(0);
    setCurrentQuestionIndex(0);
    setFormData({
      ...formData,
      title: ` ${formData.title || 'Bài ôn (tạo bởi AI)'}` 
    });
  };

  // Discard AI-generated exercises
  const handleDiscardAIExercises = () => {
    setAiExercises(null);
    setAiError(null);
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Vui lòng nhập tiêu đề bài ôn');
      return;
    }

    // Validate exercises
    for (let i = 0; i < exercises.length; i++) {
      // Bài tập 1 phải có context (bối cảnh/đoạn văn)
      if (i === 0 && !exercises[i].context.trim()) {
        alert(`${exercises[i].name}: Vui lòng nhập đoạn văn bối cảnh`);
        return;
      }

      if (exercises[i].questions.length === 0) {
        alert(`Vui lòng thêm ít nhất 1 câu hỏi cho ${exercises[i].name}`);
        return;
      }

      for (let j = 0; j < exercises[i].questions.length; j++) {
        const q = exercises[i].questions[j];
        if (!q.question.trim()) {
          alert(`${exercises[i].name}: Vui lòng nhập nội dung câu hỏi ${j + 1}`);
          return;
        }
        if (q.options.some(opt => !opt.trim())) {
          alert(`${exercises[i].name}: Vui lòng nhập đầy đủ các đáp án cho câu ${j + 1}`);
          return;
        }
        if (q.correctAnswers.length === 0) {
          alert(`${exercises[i].name}: Vui lòng chọn đáp án đúng cho câu ${j + 1}`);
          return;
        }
      }
    }

    // Validate user and selection
    if (!user?.id) {
      alert('Lỗi: Không tìm thấy thông tin người dùng');
      return;
    }
    if (!selectedClassId || !selectedTopicId) {
      alert('Vui lòng chọn lớp học và chủ đề trước');
      return;
    }

    setLoading(true);
    try {
      // Sanitize exercises data - loại bỏ các field không cần thiết
      const sanitizedExercises = exercises.map(ex => ({
        name: String(ex.name || ''),
        duration: Number(ex.duration) || 0,
        context: String(ex.context || '').trim(),
        scoring: {
          correct: Number(ex.scoring?.correct) || 12,
          incorrect: Number(ex.scoring?.incorrect) || 2,
          bonus: Number(ex.scoring?.bonus) || 4,
          bonusTimeThreshold: Number(ex.scoring?.bonusTimeThreshold) || 60
        },
        questions: (ex.questions || []).map(q => ({
          question: String(q.question || '').trim(),
          type: String(q.type || 'single'),
          options: (q.options || []).map(o => String(o || '').trim()),
          correctAnswers: Array.isArray(q.correctAnswers) ? q.correctAnswers.map(Number) : [],
          explanation: String(q.explanation || '').trim()
        }))
      }));

      const examData = {
        title: String(formData.title || '').trim(),
        description: String(formData.description || '').trim(),
        classId: String(selectedClassId || ''),
        topicId: String(selectedTopicId || ''),
        exercises: sanitizedExercises,
        status: editingExam?.status || 'draft',
        ...(editingExam?.createdBy && { createdBy: editingExam.createdBy }),
        ...(editingExam?.createdByName && { createdByName: editingExam.createdByName }),
        ...((!editingExam) && { createdBy: user?.id, createdByName: user?.displayName }),
      };
      
      if (editingExam) {
        // Update existing exam
        await facultyService.updateExam(editingExam.id, examData);
        alert('Cập nhật bài ôn thành công!');
      } else {
        // Create new exam
        await facultyService.createExam(examData, user?.id);
        alert('Tạo bài ôn thành công!');
      }
      
      resetForm();
      // Reload exams
      if (user?.id && selectedClassId && selectedTopicId) {
        const examsData = await facultyService.getExamsByFaculty(user.id, selectedClassId, selectedTopicId);
        setExams(examsData || []);
      }
    } catch (error) {
      const errorMsg = error.message || 'Lỗi không xác định khi lưu bài ôn';
      alert(`Lỗi khi lưu bài ôn:\n${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  const handleActivateExam = async (examId) => {
    try {
      await facultyService.activateExam(examId);
      alert('Kích hoạt bài ôn thành công!');
      // Reload exams
      if (user?.id && selectedClassId && selectedTopicId) {
        const examsData = await facultyService.getExamsByFaculty(user.id, selectedClassId, selectedTopicId);
        setExams(examsData || []);
      }
    } catch (error) {
      alert('Lỗi khi kích hoạt bài ôn');
    }
  };

  const handleStartExam = async (examId) => {
    try {
      // startExam now returns sessionId
      const sessionId = await facultyService.startExam(examId, user?.id, selectedClassId);
      
      // 🔧 Kiểm tra trạng thái phiên thi
      const session = await examSessionService.getExamSession(sessionId);
      
      if (session.status === 'ongoing' || session.status === 'starting') {
        // Phiên đã bắt đầu, chuyến tới trang exam-live
        navigate(`/faculty/exam-live/${sessionId}`);
      } else {
        // Phiên vừa tạo (waiting), chuyến tới trang lobby
        navigate(`/faculty/exam-lobby/${sessionId}`);
      }
    } catch (error) {
      alert('Lỗi khi bắt đầu bài ôn: ' + error.message);
    }
  };

  const handleViewLeaderboard = (examId) => {
    // Navigate to exam results list page
    navigate(`/faculty/exam-results/${examId}`);
  };

  const handleEditExam = (exam) => {
    setEditingExam(exam);
    setFormData({
      title: exam.title || '',
      description: exam.description || ''
    });
    setExercises(exam.exercises || [
      { name: 'Bài tập 1 - BT vận dụng, ứng dụng', duration: 120, context: '', questions: [], scoring: { correct: 12, incorrect: 2, bonus: 4, bonusTimeThreshold: 60 } },
      { name: 'Bài tập 2 - BT GQVĐ', duration: 300, context: '', questions: [], scoring: { correct: 12, incorrect: 2, bonus: 4, bonusTimeThreshold: 240 } }
    ]);
    setCurrentExerciseIndex(0);
    setCurrentQuestionIndex(0);
    setShowForm(true);
  };

  const handleDeleteExam = async (examId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bài ôn này?')) {
      try {
        await facultyService.deleteExam(examId);
        alert('Xóa bài ôn thành công!');
        // Reload exams
        if (user?.id && selectedClassId && selectedTopicId) {
          const examsData = await facultyService.getExamsByFaculty(user.id, selectedClassId, selectedTopicId);
          setExams(examsData || []);
        }
      } catch (error) {
        alert('Lỗi khi xóa bài ôn');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
    });
    setExercises([
      { name: 'Bài tập 1 - BT vận dụng, ứng dụng', duration: 120, context: '', questions: [], scoring: { correct: 12, incorrect: 2, bonus: 4, bonusTimeThreshold: 60 } },
      { name: 'Bài tập 2 - BT GQVĐ', duration: 300, context: '', questions: [], scoring: { correct: 12, incorrect: 2, bonus: 4, bonusTimeThreshold: 240 } }
    ]);
    setCurrentExerciseIndex(0);
    setCurrentQuestionIndex(0);
    setShowForm(false);
    setEditingExam(null);
  };

  if (loading && exams.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Đang tải...</p>
        </div>
      </div>
    );
  }

  // const navItems = [
  //   { icon: '📝', label: 'Quản lí bài ôn' }
  // ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <FacultyHeader user={user} onLogout={() => navigate('/login')} />

      {/* Header Section with Background */}
      <div className="bg-gradient-to-r from-purple-100 to-blue-100 border-b-2 border-purple-200 px-8 lg:px-12 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">📝 Quản lí Bài Ôn</h1>
            <button
              onClick={() => navigate('/faculty/learning-pathway/exam')}
              className="px-4 py-2 hover:bg-purple-200 hover:text-purple-700 rounded-lg transition-all duration-300 text-gray-700 flex items-center gap-2 font-semibold"
            >
              <span className="text-lg">←</span> Quay lại
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 lg:px-12 py-8">

       {/* Class & Topic Selection */}
        {!selectedClassId || !selectedTopicId ? (
          <div className="bg-blue-900/40 rounded-xl backdrop-blur-md border border-blue-300/30 text-blue-50 p-6 lg:p-8 mb-8 shadow-lg">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
              <span>🎯</span>
              Chọn Lớp Học và Chủ Đề
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Class Selection */}
              <div>
                <label className="block text-lg font-semibold text-blue-100 mb-3">📚 Lớp Học</label>
                <select
                  value={selectedClassId || ''}
                  onChange={(e) => {
                    const classId = e.target.value;
                    setSelectedClassId(classId);
                    sessionStorage.setItem('selectedClassId', classId);
                    sessionStorage.removeItem('selectedTopicId');
                    setSearchParams({ classId: classId, topicId: '' });
                  }}
                  className="w-full px-4 py-3 bg-white text-blue-900 border-2 border-blue-300 rounded-lg font-semibold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-sm"
                >
                  <option value="">-- Chọn lớp học --</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                {classes.length === 0 && (
                  <p className="text-amber-300 mt-2 text-sm font-medium">⚠️ Chưa có lớp học nào</p>
                )}
              </div>

              {/* Topic Selection */}
              <div>
                <label className="block text-lg font-semibold text-blue-100 mb-3">📖 Chủ Đề</label>
                <select
                  value={selectedTopicId || ''}
                  onChange={(e) => {
                    const topicId = e.target.value;
                    setSelectedTopicId(topicId);
                    sessionStorage.setItem('selectedTopicId', topicId);
                    setSearchParams({ classId: selectedClassId, topicId: topicId });
                  }}
                  disabled={!selectedClassId}
                  className="w-full px-4 py-3 bg-white text-blue-900 border-2 border-blue-300 rounded-lg font-semibold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-60 disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm"
                >
                  <option value="">-- Chọn chủ đề --</option>
                  {topics.map(topic => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
                {!selectedClassId && (
                  <p className="text-amber-300 mt-2 text-sm font-medium">⚠️ Vui lòng chọn lớp học trước</p>
                )}
              </div>
            </div>

            {selectedClassId && selectedTopicId && (
              <div className="mt-6 p-4 bg-blue-800/50 border-2 border-blue-400/50 rounded-lg shadow-inner">
                <p className="text-blue-50 font-medium">
                  ✅ Đã chọn: <span className="font-bold text-white">{classes.find(c => c.id === selectedClassId)?.name}</span> - <span className="font-bold text-white">{topics.find(t => t.id === selectedTopicId)?.name}</span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-8 p-4 bg-blue-900/40 backdrop-blur-md border-l-4 border-blue-400 text-blue-50 rounded-r-lg shadow-md transition-all hover:bg-blue-900/50">
            <p className="font-semibold flex items-center gap-2">
              <span className="text-xl">📚</span> {selectedClassName} 
              <span className="text-blue-300 mx-2">•</span> 
              <span className="text-xl">📖</span> {selectedTopicName}
            </p>
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 lg:p-8 mb-8 border border-purple-200">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <span>{editingExam ? '📝' : '✨'}</span>
              {editingExam ? `Sửa bài ôn: ${editingExam.title}` : 'Tạo bài ôn mới (7 phút)'}
            </h3>
            <form onSubmit={handleCreateExam}>
              {/* Basic Info */}
              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-700 mb-4">📋 Thông tin cơ bản</h4>
                
                <div className="mb-5 p-4 bg-purple-50 border-l-4 border-purple-500 rounded-lg">
                  <p className="text-purple-800 font-semibold mb-2">📚 Lớp học: {selectedClassName}</p>
                  <p className="text-purple-800 font-semibold">📖 Chủ đề: {selectedTopicName}</p>
                </div>
                
                <div className="mb-5">
                  <label className="block mb-2 text-gray-700 font-semibold">Tiêu đề bài ôn *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ví dụ: Kiểm tra chương 3"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="mb-5">
                  <label className="block mb-2 text-gray-700 font-semibold">Mô tả</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mô tả bài ôn..."
                    rows="3"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Exercises Section */}
              <div className="mb-8 pb-8 border-t border-gray-200 pt-8">
                <h4 className="text-lg font-semibold text-gray-700 flex items-center gap-2 mb-6">
                  <span>🎓</span>
                  Tạo 2 Bài Tập (120s + 300s = 420s = 7 phút)
                </h4>

                {/* Exercise Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  {exercises.map((exercise, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`px-4 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                        currentExerciseIndex === idx 
                          ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white shadow-md' 
                          : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-400'
                      }`}
                      onClick={() => {
                        setCurrentExerciseIndex(idx);
                        setCurrentQuestionIndex(0);
                      }}
                    >
                      <div className="text-sm">{exercise.name}</div>
                      <div className="text-xs mt-1">⏱️ {exercise.duration}s · {exercise.questions.length} câu</div>
                    </button>
                  ))}
                </div>

                {/* Upload File Section */}
                <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">📄</span>
                    <h5 className="font-semibold text-gray-800">Tải nhanh từ File Word (.docx)</h5>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Tải file Word (.docx) để tự động trích xuất câu hỏi và đáp án. Hỗ trợ định dạng: 1. Câu hỏi | A. Đáp án | B. Đáp án | ...
                  </p>
                  
                  <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".docx"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full px-4 py-3 bg-white border-2 border-blue-300 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        <span>{uploading ? '⏳ Đang xử lí...' : '📁 Chọn File Word (.docx)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Error message */}
                  {parseError && (
                    <div className="mt-3 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
                      {parseError}
                    </div>
                  )}

                  {/* Preview parsed data */}
                  {parsedExercises && (
                    <div className="mt-4 p-4 bg-white border-2 border-green-200 rounded-lg">
                      <h6 className="font-semibold text-green-700 mb-3">✅ Dữ liệu được trích xuất:</h6>
                      
                      {parsedExercises.map((exercise, exIdx) => (
                        <div key={exIdx} className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
                          <div className="font-semibold text-gray-700 mb-2">{exercise.name}</div>
                          <div className="text-sm text-gray-600 mb-2">
                            📝 {exercise.questions.length} câu | ⏱️ {exercise.duration}s
                          </div>
                          
                          {exercise.questions.slice(0, 3).map((q, qIdx) => (
                            <div key={qIdx} className="pl-4 py-2 border-l-2 border-blue-300 text-sm text-gray-700 mb-2">
                              <div className="font-semibold truncate">{qIdx + 1}. {q.question}</div>
                              <div className="text-xs text-gray-500 ml-2">
                                {q.options.length} đáp án
                              </div>
                            </div>
                          ))}
                          
                          {exercise.questions.length > 3 && (
                            <div className="text-xs text-gray-500 italic ml-4">
                              ... và {exercise.questions.length - 3} câu hỏi khác
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="flex gap-2 mt-4 justify-end">
                        <button
                          type="button"
                          onClick={handleDiscardParsedExercises}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                        >
                          ❌ Hủy
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyParsedExercises}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
                        >
                          ✅ Áp dụng dữ liệu này
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Exam Generation Section */}
                <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">✨</span>
                    <h5 className="font-semibold text-gray-800">Tạo đề tương đương với AI</h5>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Tạo bài ôn tương đương dựa trên đề mẫu của chủ đề. AI sẽ tạo câu hỏi mới phù hợp với cùng mức độ khó.
                  </p>
                  
                  <button
                    type="button"
                    onClick={handleGenerateExamWithAI}
                    disabled={aiGenerating || !selectedTopicId || !formData.title.trim()}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    <span>{aiGenerating ? '⏳ Đang tạo đề...' : '🤖 Tạo đề với AI'}</span>
                  </button>

                  {!formData.title.trim() && (
                    <p className="text-xs text-gray-500 mt-2">⚠️ Vui lòng nhập tiêu đề bài ôn trước</p>
                  )}

                  {!selectedTopicId && (
                    <p className="text-xs text-gray-500 mt-2">⚠️ Vui lòng chọn chủ đề trước</p>
                  )}

                  {/* AI Error message */}
                  {aiError && (
                    <div className="mt-3 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
                      {aiError}
                    </div>
                  )}

                  {/* AI Preview data */}
                  {aiExercises && (
                    <div className="mt-4 p-4 bg-white border-2 border-purple-200 rounded-lg">
                      <h6 className="font-semibold text-purple-700 mb-3">✅ Đề được tạo bởi AI:</h6>
                      
                      {aiExercises.map((exercise, exIdx) => (
                        <div key={exIdx} className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
                          <div className="font-semibold text-gray-700 mb-2">{exercise.name}</div>
                          <div className="text-sm text-gray-600 mb-2">
                            📝 {exercise.questions?.length || 0} câu | ⏱️ {exercise.duration}s
                          </div>
                          
                          {exercise.context && (
                            <div className="text-xs text-gray-600 mb-2 italic p-2 bg-yellow-50 rounded border-l-2 border-yellow-300">
                              <strong>Bối cảnh:</strong> {exercise.context.substring(0, 100)}...
                            </div>
                          )}
                          
                          {exercise.questions?.slice(0, 2).map((q, qIdx) => (
                            <div key={qIdx} className="pl-4 py-2 border-l-2 border-purple-300 text-sm text-gray-700 mb-2">
                              <div className="font-semibold truncate">{qIdx + 1}. {q.question}</div>
                              <div className="text-xs text-gray-500 ml-2">
                                {q.options?.length || 0} đáp án
                              </div>
                            </div>
                          ))}
                          
                          {exercise.questions && exercise.questions.length > 2 && (
                            <div className="text-xs text-gray-500 italic ml-4">
                              ... và {exercise.questions.length - 2} câu hỏi khác
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="flex gap-2 mt-4 justify-end">
                        <button
                          type="button"
                          onClick={handleDiscardAIExercises}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                        >
                          ❌ Hủy
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyAIExercises}
                          className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors"
                        >
                          ✅ Áp dụng đề này
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Exercise Content */}
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <div className="bg-white rounded-lg p-4 mb-4 border-2 border-purple-200">
                    <h5 className="font-semibold text-gray-800 mb-3">{exercises[currentExerciseIndex].name}</h5>
                    <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                      <div className="bg-purple-50 p-3 rounded">
                        <div className="text-gray-600">Thời gian</div>
                        <div className="font-bold text-purple-600">{exercises[currentExerciseIndex].duration}s</div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded">
                        <div className="text-gray-600">Số câu</div>
                        <div className="font-bold text-blue-600">{exercises[currentExerciseIndex].questions.length}</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <div className="text-gray-600">Điểm đúng</div>
                        <div className="font-bold text-green-600">{exercises[currentExerciseIndex].scoring.correct}</div>
                      </div>
                    </div>

                    {/* Context for all exercises */}
                    <div>
                      <label className="block mb-2 text-gray-700 font-semibold text-sm">
                        Đoạn văn/Bối cảnh {currentExerciseIndex === 0 && <span className="text-red-500">*</span>} 
                      </label>
                      <textarea
                        value={exercises[currentExerciseIndex].context}
                        onChange={(e) => {
                          const updatedExercises = [...exercises];
                          updatedExercises[currentExerciseIndex].context = e.target.value;
                          setExercises(updatedExercises);
                        }}
                        placeholder={currentExerciseIndex === 0 ? "Nhập bài toán/đoạn văn bối cảnh (bắt buộc)" : "Nhập đoạn văn bản chung cho các câu hỏi dưới đây (tuỳ chọn)..."}
                        rows="4"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="flex items-center justify-between mb-6">
                    <h5 className="font-semibold text-gray-700">❓ Câu hỏi ({exercises[currentExerciseIndex].questions.length})</h5>
                    <button type="button" className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors" onClick={handleAddQuestion}>
                      + Thêm câu hỏi
                    </button>
                  </div>

                  {exercises[currentExerciseIndex].questions.length > 0 && (
                    <div>
                      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 flex-wrap">
                        {exercises[currentExerciseIndex].questions.map((_, index) => (
                          <button
                            key={index}
                            type="button"
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all cursor-move ${
                              draggedQuestionIndex === index
                                ? 'opacity-50 bg-purple-300 border-2 border-purple-500'
                                : currentQuestionIndex === index 
                                ? 'bg-purple-500 text-white shadow-md' 
                                : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                            }`}
                            onClick={() => setCurrentQuestionIndex(index)}
                          >
                            Câu {index + 1}
                          </button>
                        ))}
                      </div>

                      {currentQuestionIndex < exercises[currentExerciseIndex].questions.length && (
                        <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                          <div className="mb-4">
                            <label className="block mb-2 text-gray-700 font-semibold">Nội dung câu hỏi *</label>
                            <input
                              type="text"
                              value={exercises[currentExerciseIndex].questions[currentQuestionIndex].question}
                              onChange={(e) => handleUpdateQuestion(currentQuestionIndex, 'question', e.target.value)}
                              placeholder="Nhập nội dung câu hỏi..."
                              required
                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                            />
                          </div>

                          <div className="mb-4">
                            <label className="block mb-2 text-gray-700 font-semibold">Loại câu hỏi *</label>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`type-${currentExerciseIndex}-${currentQuestionIndex}`}
                                  value="single"
                                  checked={exercises[currentExerciseIndex].questions[currentQuestionIndex].type === 'single'}
                                  onChange={() => handleUpdateQuestion(currentQuestionIndex, 'type', 'single')}
                                  className="w-4 h-4"
                                />
                                <span className="text-gray-700">Một đáp án đúng</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`type-${currentExerciseIndex}-${currentQuestionIndex}`}
                                  value="multiple"
                                  checked={exercises[currentExerciseIndex].questions[currentQuestionIndex].type === 'multiple'}
                                  onChange={() => handleUpdateQuestion(currentQuestionIndex, 'type', 'multiple')}
                                  className="w-4 h-4"
                                />
                                <span className="text-gray-700">Nhiều đáp án đúng</span>
                              </label>
                            </div>
                          </div>

                          <div className="mb-4">
                            {exercises[currentExerciseIndex].questions[currentQuestionIndex].type === 'single' ? (
                              exercises[currentExerciseIndex].questions[currentQuestionIndex].options.map((option, optIndex) => (
                                <div key={optIndex} className="flex items-center gap-3 mb-3">
                                  <input
                                    type="radio"
                                    name={`correct-${currentExerciseIndex}-${currentQuestionIndex}`}
                                    checked={exercises[currentExerciseIndex].questions[currentQuestionIndex].correctAnswers[0] === optIndex}
                                    onChange={() => handleUpdateQuestion(currentQuestionIndex, 'correctAnswers', [optIndex])}
                                    className="w-4 h-4"
                                  />
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => {
                                      const newOptions = [...exercises[currentExerciseIndex].questions[currentQuestionIndex].options];
                                      newOptions[optIndex] = e.target.value;
                                      handleUpdateQuestion(currentQuestionIndex, 'options', newOptions);
                                    }}
                                    placeholder={`Đáp án ${String.fromCharCode(65 + optIndex)}`}
                                    required
                                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                                  />
                                </div>
                              ))
                            ) : (
                              exercises[currentExerciseIndex].questions[currentQuestionIndex].options.map((option, optIndex) => (
                                <div key={optIndex} className="flex items-center gap-3 mb-3">
                                  <input
                                    type="checkbox"
                                    checked={exercises[currentExerciseIndex].questions[currentQuestionIndex].correctAnswers.includes(optIndex)}
                                    onChange={(e) => {
                                      const currentAnswers = exercises[currentExerciseIndex].questions[currentQuestionIndex].correctAnswers;
                                      const newAnswers = e.target.checked
                                        ? [...currentAnswers, optIndex].sort()
                                        : currentAnswers.filter(a => a !== optIndex);
                                      handleUpdateQuestion(currentQuestionIndex, 'correctAnswers', newAnswers);
                                    }}
                                    className="w-4 h-4"
                                  />
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => {
                                      const newOptions = [...exercises[currentExerciseIndex].questions[currentQuestionIndex].options];
                                      newOptions[optIndex] = e.target.value;
                                      handleUpdateQuestion(currentQuestionIndex, 'options', newOptions);
                                    }}
                                    placeholder={`Đáp án ${String.fromCharCode(65 + optIndex)}`}
                                    required
                                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                                  />
                                </div>
                              ))
                            )}
                          </div>

                          <div className="mb-4">
                            <label className="block mb-2 text-gray-700 font-semibold">Giải thích đáp án</label>
                            <textarea
                              value={exercises[currentExerciseIndex].questions[currentQuestionIndex].explanation}
                              onChange={(e) => handleUpdateQuestion(currentQuestionIndex, 'explanation', e.target.value)}
                              placeholder="Giải thích đáp án..."
                              rows="2"
                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition-colors"
                            />
                          </div>

                          <button
                            type="button"
                            className="w-full px-4 py-2 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                            onClick={() => handleRemoveQuestion(currentQuestionIndex)}
                          >
                            Xóa câu hỏi này
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end mt-8 pt-6 border-t border-gray-200">
                <button 
                  type="button" 
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors" 
                  onClick={resetForm}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none" 
                  disabled={loading}
                >
                  {loading ? 'Đang lưu...' : (editingExam ? 'Lưu bài ôn' : 'Tạo bài ôn')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Show Form Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mb-8 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            ➕ Tạo bài ôn mới
          </button>
        )}

        {/* Exams List */}
        {exams.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-md">
            <span className="text-6xl mb-4 block">📝</span>
            <p className="text-xl text-gray-500 mb-4">Chưa có bài ôn nào</p>
            <p className="text-gray-400 mb-6">Hãy tạo bài ôn đầu tiên để bắt đầu!</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              📝 Tạo bài ôn mới
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onEdit={handleEditExam}
                onDelete={handleDeleteExam}
                onActivate={handleActivateExam}
                onStart={handleStartExam}
                onViewResults={(examId) => navigate(`/faculty/exam-live/${examId}`)}
                onViewLeaderboard={handleViewLeaderboard}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyExamManagementPage;
