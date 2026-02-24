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
  onRobotStateChange,
  onCompleted,
  isCompleted = false,
  evaluation = null,
  // parent may provide the scroll container ref (left column of page)
  scrollContainerRef = null
}) => {
  const [messages, setMessages] = useState(chatHistory);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Track initialization state
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

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

  // Khởi tạo geminiService khi bài mới (LUÔN khởi tạo để đảm bảo chat session sẵn sàng)
  useEffect(() => {
    const initializeProblem = async () => {
      try {
        // nếu đã có lịch sử chat thì không gọi lại API Gemini
        if (chatHistory && chatHistory.length > 0) {
          geminiService.currentProblem = deBai;
          setIsInitializing(false);
          return;
        }

        setIsInitializing(true);
        setError(null);
        const response = await geminiService.startNewProblem(deBai);
        
        const aiMsg = {
          role: 'model',
          parts: [{ text: response.message }]
        };
        
        // Chỉ thêm tin nhắn AI nếu chưa có lịch sử (check chatHistory instead of messages)
        if (!chatHistory || chatHistory.length === 0) {
          setMessages([aiMsg]);
          
          // Lưu AI message từ startNewProblem vào Firestore
          await saveChatMessage(aiMsg);
          
          if (onChatUpdate) {
            onChatUpdate([aiMsg]);
          }
        }
      } catch (err) {
        setError('Lỗi khi khởi tạo bài toán: ' + err.message);
      } finally {
        setIsInitializing(false);
      }
    };

    // Khởi tạo geminiService khi bài toán hoặc bài số thay đổi
    if (deBai && !isCompleted) {
      initializeProblem();
    }
  }, [deBai, baiNumber, isCompleted, saveChatMessage, onChatUpdate]);

  // Auto scroll to bottom using parent-provided scroll container if available
  const scrollToBottom = () => {
    const sc = (scrollContainerRef && scrollContainerRef.current) ? scrollContainerRef.current : null;
    if (sc) {
      sc.scrollTop = sc.scrollHeight;
    } else if (messagesEndRef.current && messagesEndRef.current.parentElement) {
      // fallback: try to scroll the immediate messages wrapper
      try { messagesEndRef.current.parentElement.scrollTop = messagesEndRef.current.parentElement.scrollHeight; } catch(e){}
    }
  };

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Immediate feedback: show robot thinking state
      try {
        if (onRobotStateChange) onRobotStateChange('thinking', 'AI đang xử lý...');
      } catch (err) {
        // swallow any errors from parent callback
        console.warn('onRobotStateChange handler error:', err);
      }

      // Save user message to Firestore
      await saveChatMessage(userMsg);

      // 🎯 Kiểm tra xem học sinh yêu cầu gợi ý hay không
      const hintKeywords = ['gợi ý', 'hint', 'giúp', 'help', 'không biết', 'không hiểu', 'khó', 'chỉ', 'dạy', 'hướng dẫn'];
      const isAskingForHint = hintKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

      let aiMsg;
      let response = null; 
      
      if (isAskingForHint) {
        // 🎯 NẾU HỌC SINH YÊU CẦU GỢI Ý -> Chỉ CẤP GỢI Ý THUẦN TÚY
        try {
          const hintResponse = await geminiService.getHint();
          aiMsg = {
            role: 'model',
            parts: [{ text: hintResponse }]
          };
        } catch (hintError) {
          // Fallback nếu getHint thất bại
          response = await geminiService.processStudentResponse(userMessage);
          aiMsg = {
            role: 'model',
            parts: [{ text: response.message }]
          };
        }
      } else {
        // ✅ BÌNH THƯỜNG: Xử lý câu trả lời của học sinh
        response = await geminiService.processStudentResponse(userMessage);
        
        aiMsg = {
          role: 'model',
          parts: [{ text: response.message }]
        };

        // 🎯 Nếu hoàn thành bước 4 (nextStep === 5), tự động gọi callback
        if (response.nextStep === 5) {
          setTimeout(() => {
            if (onCompleted) {
              onCompleted();
            }
          }, 1500); // Chờ 1.5s để hiển thị kết quả hoàn thành
        }
      }

          setMessages(prev => [...prev, aiMsg]);

      // Save AI response to Firestore
      await saveChatMessage(aiMsg);

      // Callback to notify parent about updates
      if (onChatUpdate) {
        onChatUpdate(prev => [...prev, userMsg, aiMsg]);
      }

      // Use service-driven sentiment for robot state
      try {
        const status = response.robotStatus || 'idle';
        if (onRobotStateChange) onRobotStateChange(status, response.message || '');

        // Auto-reset to idle after 3s if final emotive state
        if (status === 'correct' || status === 'wrong') {
          setTimeout(() => {
            try { if (onRobotStateChange) onRobotStateChange('idle', ''); } catch(e){}
          }, 3000);
        }
      } catch (err) {
        console.warn('Error applying robot state from response:', err);
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
    <div className="practice-chat flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header (sticky within the left column scroll container) */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-t-lg">
        <h3 className="text-lg font-bold font-quicksand">💬 Chat</h3>
      </div>

      {/* Chat Messages (body flows inside page left-column scroll container) */}
      <div className="p-6 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
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
                className={`w-fit max-w-[85%] px-4 py-3 rounded-lg font-quicksand ${
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

      {/* Input Area (sticky at bottom of left column) */}
      {!isCompleted && (
        <form onSubmit={handleSendMessage} className="sticky bottom-0 z-20 bg-white border-t p-4">
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
