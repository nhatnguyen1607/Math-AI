import React, { useState, useEffect, useRef } from 'react';
import { GeminiService } from '../services/geminiService';
import { saveProblemSession } from '../services/firestoreService';

const STEPS = [
  { id: 1, name: 'Hiểu bài toán', icon: '📚', color: '#4A90E2' },
  { id: 2, name: 'Lập kế hoạch', icon: '💡', color: '#F39C12' },
  { id: 3, name: 'Thực hiện kế hoạch', icon: '✏️', color: '#9B59B6' },
  { id: 4, name: 'Kiểm tra & Mở rộng', icon: '✅', color: '#27AE60' }
];

function ProblemSolverPage({ user, onBack, problem }) {
  // Nếu có prop problem, ưu tiên giải bài toán đã chọn
  const [currentStep, setCurrentStep] = useState(problem ? 1 : 0); // 1: bắt đầu giải luôn nếu có problem
  const [problemText, setProblemText] = useState(problem ? problem.content || problem.title || '' : '');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [geminiService] = useState(() => new GeminiService());
  const [evaluations, setEvaluations] = useState({});
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef(null);
  const [userInput, setUserInput] = useState("");
  const hasInitializedRef = useRef(false);
  const [initError, setInitError] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Bắt đầu bài toán mới
  const handleStartProblem = async () => {
    if (!problemText.trim()) {
      alert('Vui lòng nhập đề bài!');
      return;
    }

    setIsLoading(true);
    try {
      const response = await geminiService.startNewProblem(problemText);
      console.log('Start response:', response);
      setMessages([{
        type: 'ai',
        content: response.message,
        timestamp: new Date()
      }]);
      setCurrentStep(1);
    } catch (error) {
      alert('Có lỗi xảy ra. Vui lòng thử lại!');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Gửi câu trả lời
  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage = userInput.trim();
    setUserInput('');
    
    // Thêm tin nhắn của học sinh
    setMessages(prev => [...prev, {
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    setIsLoading(true);
    try {
      const response = await geminiService.processStudentResponse(userMessage);
      console.log('Response:', response);
      
      // Thêm phản hồi của AI
      setMessages(prev => [...prev, {
        type: 'ai',
        content: response.message,
        timestamp: new Date()
      }]);

      // Cập nhật đánh giá nếu có
      if (response.evaluation) {
        setEvaluations(prev => ({
          ...prev,
          [`step${currentStep}`]: response.evaluation
        }));
      }

      // Chuyển bước nếu hoàn thành
      if (response.nextStep) {
        console.log(`Chuyển từ bước ${currentStep} sang bước ${response.nextStep}`);
        if (response.nextStep > 4) {
          // Hoàn thành tất cả các bước
          setIsComplete(true);
          await saveSession();
        } else {
          setCurrentStep(response.nextStep);
        }
      }
    } catch (error) {
      alert('Có lỗi xảy ra. Vui lòng thử lại!');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Nộp bài để chuyển sang bước tiếp theo
  const handleSubmitStep = async () => {
    if (currentStep < 4) {
      // Chuyển sang bước tiếp theo
      setCurrentStep(currentStep + 1);
      setUserInput('');
    } else if (currentStep === 4) {
      // Hoàn thành bài toán
      setIsComplete(true);
      await saveSession();
    }
  };

  // Thử lại khởi tạo bài toán
  const handleRetryInit = async () => {
    hasInitializedRef.current = false;
    setInitError(null);
    setMessages([]);
    
    if (problem) {
      setIsLoading(true);
      try {
        const response = await geminiService.startNewProblem(problem.content || problem.title || '');
        setMessages([{
          type: 'ai',
          content: response.message,
          timestamp: new Date()
        }]);
        setCurrentStep(1);
      } catch (error) {
        console.error('Retry initialization error:', error);
        setInitError(error.message || 'Có lỗi xảy ra khi khởi tạo bài toán!');
        setMessages([{
          type: 'ai',
          content: `❌ Lỗi: ${error.message || 'Không thể khởi tạo bài toán'}. Vui lòng nhấp nút "Thử lại" để tiếp tục.`,
          timestamp: new Date()
        }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Lưu phiên làm bài
  const saveSession = async () => {
    try {
      await saveProblemSession(user.uid, {
        problemText,
        messages,
        evaluations,
        completedAt: new Date()
      });
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const getEvaluationBadge = (evaluation) => {
    if (!evaluation) return null;
    
    const badges = {
      'need_effort': { text: 'Cần cố gắng', color: '#ff6b6b' },
      'pass': { text: 'Đạt', color: '#ffd93d' },
      'good': { text: 'Tốt', color: '#6bcf7f' }
    };
    
    const badge = badges[evaluation] || badges.need_effort;
    return (
      <span className="px-3 py-1 rounded-full text-white text-xs font-bold" style={{ backgroundColor: badge.color }}>
        {badge.text}
      </span>
    );
  };

  // Khi vào giải bài toán đã chọn, luôn gửi đề bài cho AI để nhận câu hỏi đầu tiên
  useEffect(() => {
    if (problem && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      (async () => {
        setIsLoading(true);
        setInitError(null);
        try {
          const response = await geminiService.startNewProblem(problem.content || problem.title || '');
          setMessages([{
            type: 'ai',
            content: response.message,
            timestamp: new Date()
          }]);
          setCurrentStep(1);
        } catch (error) {
          console.error('Initialization error:', error);
          setInitError(error.message || 'Có lỗi xảy ra khi khởi tạo bài toán!');
          setMessages([{
            type: 'ai',
            content: `❌ Lỗi: ${error.message || 'Không thể khởi tạo bài toán'}. Vui lòng nhấp nút "Thử lại" để tiếp tục.`,
            timestamp: new Date()
          }]);
        } finally {
          setIsLoading(false);
        }
      })();
    }
    // eslint-disable-next-line
  }, [problem]);

  // Màn hình nhập đề bài
  if (currentStep === 0 && !problem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <header className="bg-white shadow-md px-6 py-4 flex justify-between items-center">
          <button onClick={onBack} className="text-purple-600 hover:text-purple-800 font-semibold transition-colors">← Quay lại</button>
          <h2 className="text-2xl font-bold text-gray-800">Bài toán mới</h2>
          <div></div>
        </header>

        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-3xl font-bold text-gray-800 mb-3">📝 Nhập đề bài toán</h3>
            <p className="text-gray-500 mb-6">Hãy nhập đề bài toán mà bạn muốn giải nhé!</p>
            
            <textarea
              className="w-full p-4 border-2 border-gray-200 rounded-xl text-gray-700 mb-6 focus:outline-none focus:border-purple-500 transition-colors resize-none"
              placeholder="Ví dụ: Lớp 5A được giao trang trí gian hàng 'Sắc màu ước mơ'. Cả lớp quyết định mua 16 dây đèn led mini để trang trí..."
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              rows={8}
            />

            <button 
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold py-4 px-6 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleStartProblem}
              disabled={isLoading || !problemText.trim()}
            >
              {isLoading ? 'Đang xử lý...' : 'Bắt đầu giải toán 🚀'}
            </button>

            <div className="mt-8">
              <h4 className="text-lg font-bold text-gray-700 mb-4">💡 Bài toán mẫu:</h4>
              <div 
                className="bg-gradient-to-r from-purple-50 to-blue-50 p-5 rounded-xl border-2 border-purple-200 cursor-pointer hover:border-purple-400 transition-colors"
                onClick={() => setProblemText('Lớp 5A được giao trang trí gian hàng "Sắc màu ước mơ". Cả lớp quyết định mua 16 dây đèn led mini để trang trí. Cửa hàng A bán đèn với giá 11,2 nghìn đồng mỗi dây. Cửa hàng A có chương trình ưu đãi: giảm 0,7 nghìn đồng/dây. Cửa hàng B bán đèn với giá 10,8 nghìn đồng mỗi dây nhưng tặng 1 dây khi mua 15 dây. Vậy mua ở cửa hàng nào sẽ tiết kiệm hơn?')}
              >
                <p className="text-gray-700 leading-relaxed">
                  Lớp 5A được giao trang trí gian hàng "Sắc màu ước mơ". Cả lớp quyết định mua 16 dây đèn led mini để trang trí. Cửa hàng A bán đèn với giá 11,2 nghìn đồng mỗi dây...
                </p>
                <small className="text-purple-600 font-semibold mt-2 block">👆 Click để sử dụng</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Màn hình giải toán
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col">
      <header className="bg-white shadow-md px-6 py-4 flex justify-between items-center">
        <button onClick={onBack} className="text-purple-600 hover:text-purple-800 font-semibold transition-colors">← Quay lại</button>
        <h2 className="text-2xl font-bold text-gray-800">Đang giải toán</h2>
        <div className="flex items-center gap-2">
          <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border-2 border-purple-300" />
        </div>
      </header>

      <div className="bg-white shadow-md px-6 py-4 flex gap-4 overflow-x-auto">
        {STEPS.map((step, index) => (
          <div 
            key={step.id}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
              currentStep === step.id ? 'bg-purple-100 ring-2 ring-purple-400' : 
              currentStep > step.id ? 'bg-green-50' : 'bg-gray-50'
            }`}
          >
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold transition-colors"
              style={{ 
                backgroundColor: currentStep >= step.id ? step.color : '#ddd' 
              }}
            >
              {step.icon}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-gray-700 whitespace-nowrap">{step.name}</span>
              {evaluations[`step${step.id}`] && getEvaluationBadge(evaluations[`step${step.id}`])}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-purple-100 to-blue-100 px-6 py-4 shadow-sm">
        <h4 className="text-sm font-bold text-gray-700 mb-1">📋 Đề bài:</h4>
        <p className="text-gray-800 leading-relaxed">{problemText}</p>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`flex gap-3 ${
                msg.type === 'user' ? 'justify-end' : 'justify-start'
              } ${msg.isHint ? 'opacity-80' : ''}`}
            >
              {msg.type === 'ai' && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-blue-400 flex items-center justify-center text-2xl flex-shrink-0">
                  🤖
                </div>
              )}
              <div className={`max-w-2xl ${
                msg.type === 'user' 
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white' 
                  : msg.isHint 
                  ? 'bg-yellow-100 border-2 border-yellow-300'
                  : 'bg-white border-2 border-gray-200'
              } rounded-2xl px-5 py-3 shadow-md`}>
                <div className={`text-base leading-relaxed ${
                  msg.type === 'user' ? 'text-white' : 'text-gray-800'
                }`}>{msg.content}</div>
                <div className={`text-xs mt-1 ${
                  msg.type === 'user' ? 'text-purple-100' : 'text-gray-400'
                }`}>
                  {msg.timestamp.toLocaleTimeString('vi-VN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
              {msg.type === 'user' && (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-400 flex items-center justify-center text-2xl flex-shrink-0">
                  👦
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-blue-400 flex items-center justify-center text-2xl">🤖</div>
              <div className="bg-white border-2 border-gray-200 rounded-2xl px-5 py-3 shadow-md">
                <div className="flex gap-2">
                  <span className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                  <span className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {!isComplete && (
          <div className="bg-white border-t-2 border-gray-200 px-6 py-4 flex gap-3">
            {initError ? (
              <div className="flex gap-3 w-full">
                <div className="flex-1 text-red-600 py-3 px-4 bg-red-50 rounded-xl border-2 border-red-200">
                  <strong>⚠️ Lỗi khởi tạo:</strong> {initError}
                </div>
                <button 
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex-shrink-0"
                  onClick={handleRetryInit}
                  disabled={isLoading}
                >
                  🔄 Thử lại
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="flex-1 px-5 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 transition-colors disabled:bg-gray-100"
                  placeholder="Nhập câu trả lời của bạn..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isLoading}
                />
                <button 
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  onClick={handleSendMessage}
                  disabled={isLoading || !userInput.trim()}
                  title="Gửi câu trả lời (Enter)"
                >
                  Gửi 📤
                </button>
                <button 
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  onClick={handleSubmitStep}
                  disabled={isLoading}
                  title={currentStep < 4 ? "Nộp bài và chuyển sang bước tiếp theo" : "Hoàn thành bài toán"}
                >
                  {currentStep < 4 ? "Nộp bài →" : "Xong ✓"}
                </button>
              </>
            )}
          </div>
        )}

        {isComplete && (
          <div className="bg-white border-t-2 border-gray-200 px-6 py-6">
            <h3 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mb-6">🎉 Chúc mừng bạn đã hoàn thành!</h3>
            <div className="max-w-2xl mx-auto space-y-4 mb-6">
              {STEPS.map(step => (
                <div key={step.id} className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 px-5 py-3 rounded-xl">
                  <span className="font-semibold text-gray-700">{step.icon} {step.name}:</span>
                  {getEvaluationBadge(evaluations[`step${step.id}`])}
                </div>
              ))}
            </div>
            <button 
              className="mx-auto block px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg transition-all"
              onClick={onBack}
            >
              Làm bài mới 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProblemSolverPage;
