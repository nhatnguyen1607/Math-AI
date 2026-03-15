/**
 * Ví dụ sử dụng Service Router trong React Component
 * Educational Architect 2026
 */

import React, { useState, useCallback } from 'react';
import { practiceServiceRouter, chatServiceRouter } from '../services/serviceRouter';

/**
 * Component ví dụ: Sinh đề toán tự động dựa trên chủ đề
 */
export function ProblemGeneratorExample({ topicName = "Tỉ số" }) {
  const [problem, setProblem] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detectedTopic, setDetectedTopic] = useState("");

  const generateProblem = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Lấy service phù hợp với chủ đề
      const practiceService = practiceServiceRouter.getService(topicName);
      const topic = practiceServiceRouter._detectTopic(topicName);
      setDetectedTopic(topic);

      // Sinh bài toán
      const generatedProblem = await practiceService.generateSimilarProblem(
        topicName,
        "Đạt", // competency level
        75     // startup percentage
      );

      setProblem(generatedProblem);
    } catch (err) {
      setError("Lỗi khi sinh bài toán: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [topicName]);

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3>🎲 Sinh đề toán: {topicName}</h3>
      
      {detectedTopic && (
        <p style={{ color: '#666', fontSize: '12px' }}>
          🔍 Phát hiện: <strong>{detectedTopic}</strong>
        </p>
      )}

      <button onClick={generateProblem} disabled={loading}>
        {loading ? "Đang sinh..." : "Sinh bài toán mới"}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {problem && (
        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          backgroundColor: '#f9f9f9',
          borderLeft: '4px solid #2196F3',
          borderRadius: '4px'
        }}>
          <h4>📝 Bài toán được sinh:</h4>
          <p>{problem}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Component ví dụ: Hỗ trợ giải bài toán với chat
 */
export function ProblemChatExample({ topicName = "Tỉ số", problemText = "" }) {
  const [chatHistory, setChatHistory] = useState([]);
  const [studentInput, setStudentInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isComplete, setIsComplete] = useState(false);

  const initializeChat = useCallback(async () => {
    try {
      const chatService = chatServiceRouter.getService(topicName);
      if (!chatService) {
        console.error("Chat service not found for topic:", topicName);
        return;
      }

      const startMsg = await chatService.startNewProblem(problemText);
      setChatHistory([
        { role: 'assistant', message: startMsg.message, step: startMsg.step }
      ]);
      setCurrentStep(startMsg.step);
    } catch (err) {
      console.error("Error initializing chat:", err);
    }
  }, [topicName, problemText]);

  const handleStudentSubmit = useCallback(async () => {
    if (!studentInput.trim()) return;

    setLoading(true);
    try {
      const chatService = chatServiceRouter.getService(topicName);
      if (!chatService) return;

      // Thêm câu trả lời của học sinh vào history
      const newHistory = [
        ...chatHistory,
        { role: 'user', message: studentInput, step: currentStep }
      ];

      // Xử lý câu trả lời
      const response = await chatService.processStudentResponse(
        studentInput,
        newHistory
      );

      // Thêm phản hồi của trợ lý
      newHistory.push({
        role: 'assistant',
        message: response.message,
        step: response.step,
        status: response.robotStatus
      });

      setChatHistory(newHistory);
      setStudentInput("");
      setCurrentStep(response.step);
      if (response.isSessionComplete) {
        setIsComplete(true);
      }
    } catch (err) {
      console.error("Error processing response:", err);
    } finally {
      setLoading(false);
    }
  }, [topicName, studentInput, chatHistory, currentStep]);

  // Khởi tạo chat khi component mount
  React.useEffect(() => {
    if (problemText) {
      initializeChat();
    }
  }, [problemText, initializeChat]);

  return (
    <div style={{ padding: '20px', border: '1px solid #4CAF50', borderRadius: '8px' }}>
      <h3>💬 Hỗ trợ giải toán: {topicName}</h3>

      <div style={{
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        padding: '15px',
        height: '400px',
        overflowY: 'auto',
        marginBottom: '15px'
      }}>
        {chatHistory.length === 0 ? (
          <p style={{ color: '#999' }}>Đừng ngại, bắt đầu cuộc hội thoại..me</p>
        ) : (
          chatHistory.map((msg, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '10px',
                padding: '10px',
                backgroundColor: msg.role === 'user' ? '#E3F2FD' : '#F0F4C3',
                borderRadius: '6px',
                borderLeft: `4px solid ${msg.role === 'user' ? '#2196F3' : '#FBC02D'}`
              }}
            >
              <strong>{msg.role === 'user' ? '👤 Bạn' : '🤖 Trợ lý'}:</strong>
              <p style={{ margin: '8px 0 0 0' }}>{msg.message}</p>
              {msg.status && (
                <small style={{ color: msg.status === 'correct' ? 'green' : 'red' }}>
                  {msg.status === 'correct' ? '✅ Chính xác' : '❌ Cần kiểm tra lại'}
                </small>
              )}
            </div>
          ))
        )}
      </div>

      {!isComplete && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={studentInput}
            onChange={(e) => setStudentInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleStudentSubmit()}
            placeholder="Nhập câu trả lời của bạn..."
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            disabled={loading}
          />
          <button
            onClick={handleStudentSubmit}
            disabled={loading || !studentInput.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {loading ? "..." : "Gửi"}
          </button>
        </div>
      )}

      {isComplete && (
        <div style={{
          padding: '15px',
          backgroundColor: '#C8E6C9',
          borderRadius: '4px',
          color: '#2E7D32'
        }}>
          ✅ Hoàn thành! Bạn giải rất tốt!
        </div>
      )}
    </div>
  );
}

/**
 * Component demo tổng hợp
 */
export default function ServiceRouterDemo() {
  const [selectedTopic, setSelectedTopic] = useState("Tỉ số đơn giản");
  const [generatedProblem, setGeneratedProblem] = useState("");

  const topicOptions = [
    // Tỉ số
    "Tỉ số đơn giản",
    "Chia theo tỉ số",
    "Tỉ số phần trăm",
    "So sánh tỉ số",
    "Tỉ lệ thuận",
    // Chuyển động đều
    "Vận tốc",
    "Quãng đường",
    "Thời gian",
    "Chuyển động đều"
  ];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h2>🎓 Service Router Demo</h2>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          Chọn chủ đề:
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            style={{ marginLeft: '10px', padding: '5px' }}
          >
            {topicOptions.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <ProblemGeneratorExample
          topicName={selectedTopic}
        />
      </div>

      {generatedProblem && (
        <div style={{ marginBottom: '30px' }}>
          <ProblemChatExample
            topicName={selectedTopic}
            problemText={generatedProblem}
          />
        </div>
      )}
    </div>
  );
}
