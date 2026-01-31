import React, { useState, useEffect, useRef } from 'react';
import { GeminiService } from '../services/geminiService';
import { saveProblemSession } from '../services/firestoreService';
import './ProblemSolver.css';

const STEPS = [
  { id: 1, name: 'Hiểu bài toán', icon: '📚', color: '#4A90E2' },
  { id: 2, name: 'Lập kế hoạch', icon: '💡', color: '#F39C12' },
  { id: 3, name: 'Thực hiện kế hoạch', icon: '✏️', color: '#9B59B6' },
  { id: 4, name: 'Kiểm tra & Mở rộng', icon: '✅', color: '#27AE60' }
];

function ProblemSolver({ user, onBack }) {
  const [currentStep, setCurrentStep] = useState(0); // 0 = nhập đề, 1-4 = các bước
  const [problemText, setProblemText] = useState('');
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [geminiService] = useState(() => new GeminiService());
  const [evaluations, setEvaluations] = useState({});
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef(null);

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
      setMessages([{
        type: 'ai',
        content: response,
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

  // Yêu cầu gợi ý
  const handleHint = async () => {
    setIsLoading(true);
    try {
      const hint = await geminiService.getHint();
      setMessages(prev => [...prev, {
        type: 'ai',
        content: `💡 Gợi ý: ${hint}`,
        timestamp: new Date(),
        isHint: true
      }]);
    } catch (error) {
      alert('Không thể lấy gợi ý. Vui lòng thử lại!');
    } finally {
      setIsLoading(false);
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
      <span className="evaluation-badge" style={{ backgroundColor: badge.color }}>
        {badge.text}
      </span>
    );
  };

  // Màn hình nhập đề bài
  if (currentStep === 0) {
    return (
      <div className="problem-solver-container">
        <header className="solver-header">
          <button onClick={onBack} className="back-btn">← Quay lại</button>
          <h2>Bài toán mới</h2>
          <div></div>
        </header>

        <div className="problem-input-section">
          <h3>📝 Nhập đề bài toán</h3>
          <p className="hint-text">Hãy nhập đề bài toán mà bạn muốn giải nhé!</p>
          
          <textarea
            className="problem-textarea"
            placeholder="Ví dụ: Lớp 5A được giao trang trí gian hàng 'Sắc màu ước mơ'. Cả lớp quyết định mua 16 dây đèn led mini để trang trí..."
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            rows={8}
          />

          <button 
            className="start-btn"
            onClick={handleStartProblem}
            disabled={isLoading || !problemText.trim()}
          >
            {isLoading ? 'Đang xử lý...' : 'Bắt đầu giải toán 🚀'}
          </button>

          <div className="example-section">
            <h4>💡 Bài toán mẫu:</h4>
            <div 
              className="example-problem"
              onClick={() => setProblemText('Lớp 5A được giao trang trí gian hàng "Sắc màu ước mơ". Cả lớp quyết định mua 16 dây đèn led mini để trang trí. Cửa hàng A bán đèn với giá 11,2 nghìn đồng mỗi dây. Cửa hàng A có chương trình ưu đãi: giảm 0,7 nghìn đồng/dây. Cửa hàng B bán đèn với giá 10,8 nghìn đồng mỗi dây nhưng tặng 1 dây khi mua 15 dây. Vậy mua ở cửa hàng nào sẽ tiết kiệm hơn?')}
            >
              Lớp 5A được giao trang trí gian hàng "Sắc màu ước mơ". Cả lớp quyết định mua 16 dây đèn led mini để trang trí. Cửa hàng A bán đèn với giá 11,2 nghìn đồng mỗi dây...
              <br/><small>👆 Click để sử dụng</small>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Màn hình giải toán
  return (
    <div className="problem-solver-container">
      <header className="solver-header">
        <button onClick={onBack} className="back-btn">← Quay lại</button>
        <h2>Đang giải toán</h2>
        <div className="user-info">
          <img src={user.photoURL} alt={user.displayName} className="user-avatar-small" />
        </div>
      </header>

      <div className="steps-progress">
        {STEPS.map((step, index) => (
          <div 
            key={step.id}
            className={`step-item ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
          >
            <div className="step-icon" style={{ 
              backgroundColor: currentStep >= step.id ? step.color : '#ddd' 
            }}>
              {step.icon}
            </div>
            <div className="step-info">
              <span className="step-name">{step.name}</span>
              {evaluations[`step${step.id}`] && getEvaluationBadge(evaluations[`step${step.id}`])}
            </div>
          </div>
        ))}
      </div>

      <div className="problem-display">
        <h4>📋 Đề bài:</h4>
        <p>{problemText}</p>
      </div>

      <div className="chat-container">
        <div className="messages-list">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`message ${msg.type} ${msg.isHint ? 'hint' : ''}`}
            >
              <div className="message-avatar">
                {msg.type === 'ai' ? '🤖' : '👦'}
              </div>
              <div className="message-content">
                <div className="message-text">{msg.content}</div>
                <div className="message-time">
                  {msg.timestamp.toLocaleTimeString('vi-VN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message ai">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {!isComplete && (
          <div className="input-section">
            <button 
              className="hint-btn"
              onClick={handleHint}
              disabled={isLoading}
              title="Nhận gợi ý"
            >
              💡
            </button>
            <input
              type="text"
              className="message-input"
              placeholder="Nhập câu trả lời của bạn..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isLoading}
            />
            <button 
              className="send-btn"
              onClick={handleSendMessage}
              disabled={isLoading || !userInput.trim()}
            >
              Gửi 📤
            </button>
          </div>
        )}

        {isComplete && (
          <div className="completion-section">
            <h3>🎉 Chúc mừng bạn đã hoàn thành!</h3>
            <div className="final-evaluations">
              {STEPS.map(step => (
                <div key={step.id} className="eval-item">
                  <span>{step.icon} {step.name}:</span>
                  {getEvaluationBadge(evaluations[`step${step.id}`])}
                </div>
              ))}
            </div>
            <button className="new-problem-btn" onClick={onBack}>
              Làm bài mới 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProblemSolver;
