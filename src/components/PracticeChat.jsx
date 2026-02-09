import React, { useState, useEffect, useRef, useCallback } from 'react';
import resultService from '../services/resultService';
import geminiService from '../services/geminiService';

/**
 * PracticeChat Component
 * Hiển thị chat giữa AI và học sinh trong phiên luyện tập Polya
 */
const PracticeChat = ({ 
  userId, 
  examId, 
  baiNumber,
  deBai, 
  chatHistory = [], 
  onChatUpdate,
  onCompleted,
  isCompleted = false,
  evaluation = null
}) => {
  const [messages, setMessages] = useState(chatHistory);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Track initialization state
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const geminiServiceRef = useRef(new geminiService.constructor());

  // Helper function để lưu chat history vào đúng service
  const saveChatMessage = useCallback(async (message) => {
    try {
      if (baiNumber === 'vanDung') {
        // Lưu vào Vận dụng
        await resultService.updateVanDungChatHistory(userId, examId, message);
      } else {
        // Lưu vào Luyện tập (bai1 hoặc bai2)
        await resultService.updatePracticeChatHistory(userId, examId, baiNumber, message);
      }
    } catch (err) {
      console.error('Error saving chat message:', err);
    }
  }, [baiNumber, userId, examId]);

  // Reset state khi baiNumber thay đổi (chuyển từ bài 1 → bài 2)
  // VÀ sync messages từ chatHistory nếu có
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      // Có dữ liệu lịch sử → load lại
      setMessages(chatHistory);
      setIsInitializing(false);
    } else {
      // Không có dữ liệu lịch sử → reset và chuẩn bị khởi tạo
      setMessages([]);
      setError(null);
    }
  }, [baiNumber, chatHistory]);

  // Khởi tạo geminiService khi bài mới (chỉ nếu chatHistory rỗng)
  useEffect(() => {
    const initializeProblem = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        geminiServiceRef.current = new geminiService.constructor();
        const response = await geminiServiceRef.current.startNewProblem(deBai);
        
        const aiMsg = {
          role: 'model',
          parts: [{ text: response.message }]
        };
        setMessages([aiMsg]);
        
        // Lưu AI message từ startNewProblem vào Firestore (QUAN TRỌNG!)
        await saveChatMessage(aiMsg);
        
        if (onChatUpdate) {
          onChatUpdate([aiMsg]);
        }
      } catch (err) {
        setError('Lỗi khi khởi tạo bài toán: ' + err.message);
      } finally {
        setIsInitializing(false);
      }
    };

    // Chỉ khởi tạo nếu: có bài toán, messages rỗng, và chưa hoàn thành
    // Không cần check chatHistory vì đã được sync ở useEffect trước
    if (deBai && messages.length === 0 && !isCompleted) {
      initializeProblem();
    }
  }, [deBai, isCompleted, userId, examId, baiNumber, onChatUpdate, saveChatMessage, messages]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Auto scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || isCompleted || isInitializing) return;

    try {
      setError(null);
      const userMessage = inputValue.trim();

      // Add user message to UI
      const userMsg = {
        role: 'user',
        parts: [{ text: userMessage }]
      };
      setMessages(prev => [...prev, userMsg]);
      setInputValue('');
      setIsLoading(true);

      // Save user message to Firestore
      await saveChatMessage(userMsg);

      // Get AI response using geminiService
      const response = await geminiServiceRef.current.processStudentResponse(userMessage);
      
      const aiMsg = {
        role: 'model',
        parts: [{ text: response.message }]
      };

      setMessages(prev => [...prev, aiMsg]);

      // Save AI response to Firestore
      await saveChatMessage(aiMsg);

      // Callback to notify parent about updates
      if (onChatUpdate) {
        onChatUpdate(prev => [...prev, userMsg, aiMsg]);
      }

      // 🎯 Nếu hoàn thành bước 4 (nextStep === 5), tự động gọi callback
      if (response.nextStep === 5) {
        setTimeout(() => {
          if (onCompleted) {
            onCompleted();
          }
        }, 1500); // Chờ 1.5s để hiển thị kết quả hoàn thành
      }

    } catch (err) {
      console.error('❌ Chi tiết lỗi khi gửi tin nhắn:', {
        message: err.message,
        status: err.status,
        errorCode: err.code,
        fullError: err
      });
      
      // Kiểm tra nguyên nhân lỗi cụ thể
      if (!process.env.REACT_APP_GEMINI_API_KEY_1) {
        setError('⚠️ Chưa cấu hình API Key Gemini. Vui lòng thêm REACT_APP_GEMINI_API_KEY_1 vào file .env');
      } else if (err.status === 401 || err.message?.includes('401')) {
        setError('❌ API Key không hợp lệ. Vui lòng kiểm tra lại Gemini API Key');
      } else if (err.message?.includes('429') || err.message?.includes('quota')) {
        setError('⏳ Đã vượt quota API. Vui lòng thử lại sau hoặc sử dụng API Key khác');
      } else if (err.message?.includes('INVALID_ARGUMENT')) {
        setError('❌ Tham số không hợp lệ. Kiểm tra cấu hình API');
      } else {
        setError(`Lỗi khi gửi tin nhắn: ${err.message || 'Không rõ nguyên nhân'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="practice-chat flex flex-col max-h-[700px] overflow-hidden bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-t-lg">
        <h3 className="text-lg font-bold font-quicksand">📝 {baiNumber.toUpperCase()}</h3>
        <div className="mt-2 bg-white bg-opacity-20 p-4 rounded-lg">
          <p className="text-base font-quicksand leading-relaxed">{deBai}</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p className="text-center font-quicksand">
              👋 Xin chào! Hãy nêu cách hiểu của em về bài toán này để bắt đầu.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-3 rounded-lg font-quicksand ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.parts[0].text}</p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 px-4 py-3 rounded-lg rounded-bl-none">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 font-quicksand text-sm">
          {error}
        </div>
      )}

      {/* Input Area */}
      {!isCompleted && (
        <form onSubmit={handleSendMessage} className="border-t border-gray-300 p-4 bg-white rounded-b-lg">
          {isInitializing && (
            <div className="text-center text-gray-500 py-2 text-sm font-quicksand">
              ⏳ Đang khởi tạo bài toán...
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Nhập câu trả lời của em..."
              disabled={isLoading || isInitializing}
              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 font-quicksand disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={isLoading || isInitializing || !inputValue.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-quicksand"
            >
              {isLoading ? '⏳' : '➤'}
            </button>
          </div>
        </form>
      )}

      {/* Evaluation Display - Hiển thị kết quả khi hoàn thành */}
      {isCompleted && (
        <div className="border-t border-gray-300 bg-white rounded-b-lg p-4">
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-bold text-green-600 font-quicksand mb-3">
                ✅ Bài tập đã hoàn thành!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeChat;
