import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import resultService from '../services/faculty/resultService';
import geminiChatServiceSoThapPhan from '../services/gemini/geminiChatServiceSoThapPhan';
// import geminiChatServiceTimeVelocity from '../services/geminiChatServiceTimeVelocity';
import { chatServiceRouter } from '../services/serviceRouter';

// Helper: check if topicName matches the Time/Velocity/Motion topic
// Covers: "Số đo thời gian", "Vận tốc", "Chuyển động", "Quãng đường", "Tốc độ", etc.
// const isTimeVelocityTopic = (topicName) => {
//   if (!topicName) return false;
//   const lower = topicName.toLowerCase();
//   // Check if ANY keyword matches (OR logic, not AND)
//   return (
//     lower.includes('thời gian') || 
//     lower.includes('vận tốc') || 
//     lower.includes('chuyển động') || 
//     lower.includes('quãng đường') || 
//     lower.includes('tốc độ') ||
//     lower.includes('tốc độ chuyển động') ||
//     (lower.includes('số đo') && lower.includes('thời gian'))
//   );
// };

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
  scrollContainerRef = null,
  topicName = ''
}) => {
  // Select the appropriate chat service based on topic using router
  const chatService = useMemo(() => {
    console.log('🔵 [PracticeChat.useMemo] Creating chat service for topicName:', topicName);
    
    // 🆕 Use serviceRouter instead of hardcoded logic
    const routerService = chatServiceRouter.getService(topicName);
    console.log('🔵 [PracticeChat.useMemo] routerService received:', routerService?.constructor?.name || 'null');
    
    if (routerService) {
      console.log('✅ [PracticeChat.useMemo] Using router service:', routerService.constructor.name);
      return routerService;
    }
    
    // Fallback to default if router returns null
    console.log('⚠️ [PracticeChat.useMemo] Router returned null, using fallback:', geminiChatServiceSoThapPhan.constructor.name);
    return geminiChatServiceSoThapPhan;
  }, [topicName]);
  const [messages, setMessages] = useState(chatHistory);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Track initialization state
  const [error, setError] = useState(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false); // 🆕 Text-to-Speech toggle
  const messagesEndRef = useRef(null);

  // 🆕 Hàm phát âm thanh AI response - with voice debugging
  const speakMessage = useCallback((text) => {
    if (!isTTSEnabled) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN'; // Vietnamese
    
    // 🆕 Chọn giọng nói tiếng Việt - try multiple strategies
    const voices = window.speechSynthesis.getVoices();
    
    // Strategy 1: tìm voice tiếng Việt exact
    let vietnameseVoice = voices.find(v => 
      v.lang && (v.lang === 'vi' || v.lang === 'vi-VN' || v.lang.startsWith('vi-'))
    );
    
    // Strategy 2: tìm voice Google Tiếng Việt
    if (!vietnameseVoice) {
      vietnameseVoice = voices.find(v => v.name && (
        v.name.toLowerCase().includes('vietnamese') || 
        v.name.toLowerCase().includes('tiếng việt')
      ));
    }
    
    // Strategy 3: tìm voice có lang chứa 'vi'
    if (!vietnameseVoice) {
      vietnameseVoice = voices.find(v => v.lang && v.lang.toLowerCase().includes('vi'));
    }
    
    // Debug: log available voices (once)
    if (!window._voicesLogged && voices.length > 0) {
      window._voicesLogged = true;
    }
    
    if (vietnameseVoice) {
      utterance.voice = vietnameseVoice;
    } else {
      console.warn('⚠️ No Vietnamese voice found. Available:', voices.length);
    }
    
    utterance.rate = 0.85; // Slower for better comprehension
    utterance.pitch = 0.95;
    utterance.volume = 1;
    
    window.speechSynthesis.speak(utterance);
  }, [isTTSEnabled]);

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

  // Sync messages từ chatHistory khi chatHistory thay đổi
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      setMessages(chatHistory);
      setIsInitializing(false);
    }
  }, [chatHistory]);

  // Chỉ khởi tạo bài toán 1 lần duy nhất cho mỗi session
  const hasInitializedRef = useRef(false);

  // Reset state khi baiNumber thay đổi (chuyển từ bài 1 → bài 2)
  useEffect(() => {
    if (!chatHistory || chatHistory.length === 0) {
      setMessages([]);
      setError(null);
      hasInitializedRef.current = false; // 🔴 RESET hasInitializedRef để khởi tạo bài mới
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baiNumber]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!deBai || isCompleted) return;

    // Nếu đã có chatHistory thì không khởi tạo lại, chỉ tiếp tục chat
    if (chatHistory && chatHistory.length > 0) {
      chatService.restoreSession(deBai, chatHistory);
      setIsInitializing(false);
      hasInitializedRef.current = true;
      return;
    }

    // Nếu chưa có chatHistory thì khởi tạo bài toán
    const initializeProblem = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        // Truyền flag isApplicationProblem nếu đây là bài vận dụng
        const isApplicationProblem = baiNumber === 'vanDung';
        const response = await chatService.startNewProblem(deBai, isApplicationProblem);
        const aiMsg = {
          role: 'model',
          parts: [{ text: response.message }]
        };

        setMessages([aiMsg]);
        await saveChatMessage(aiMsg);
        if (onChatUpdate) {
          onChatUpdate([aiMsg]);
        }
        hasInitializedRef.current = true;
      } catch (err) {
        setError('Lỗi khi khởi tạo bài toán: ' + err.message);
        hasInitializedRef.current = false;
      } finally {
        setIsInitializing(false);
      }
    };

    initializeProblem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deBai, isCompleted, saveChatMessage, onChatUpdate]);

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

// Trong hàm handleSendMessage
const handleSendMessage = async (e) => {
  e.preventDefault();
  // Nếu có lỗi khởi tạo, không cho gửi tin nhắn
  if (!inputValue.trim() || isLoading || isCompleted || isInitializing || error?.includes('khởi tạo bài toán')) return;

  try {
    setError(null);
    const userMessage = inputValue.trim();

    const userMsg = { role: 'user', parts: [{ text: userMessage }] };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    if (onRobotStateChange) onRobotStateChange('thinking', 'AI đang xử lý...');

    await saveChatMessage(userMsg);

    const hintKeywords = ['gợi ý', 'hint', 'giúp', 'help', 'không biết', 'không hiểu', 'khó', 'chỉ', 'dạy', 'hướng dẫn'];
    const isAskingForHint = hintKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

    // CHỈ khai báo let aiMsg một lần ở đây
    let aiMsg;
    let response = null; 
    
    if (isAskingForHint) {
      try {
        const hintResponse = await chatService.getHint();
        aiMsg = { role: 'model', parts: [{ text: hintResponse }] }; // Gán giá trị, không dùng const/let
      } catch (hintError) {
        response = await chatService.processStudentResponse(userMessage, messages);
        aiMsg = { role: 'model', parts: [{ text: response.message }] };
      }
    } else {
      response = await chatService.processStudentResponse(userMessage, messages);
      aiMsg = { role: 'model', parts: [{ text: response.message }] };

      // ✅ CHỈ kiểm tra response.nextStep nếu response tồn tại (không phải gợi ý)
      if (response && response.nextStep === 5) {
        setTimeout(() => { if (onCompleted) onCompleted(); }, 1500);
      }
    }

    setMessages(prev => [...prev, aiMsg]);
    await saveChatMessage(aiMsg);

    // 🆕 Phát âm thanh AI response nếu TTS được bật
    speakMessage(aiMsg.parts[0].text);

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

      }

      // 🎯 Nếu hoàn thành bước 4 (nextStep === 5), tự động gọi callback
      // ✅ CHỈ kiểm tra nếu response tồn tại (không phải gợi ý)
      if (response && response.nextStep === 5) {
        setTimeout(() => {
          if (onCompleted) {
            onCompleted();
          }
        }, 1500); // Chờ 1.5s để hiển thị kết quả hoàn thành
      }

    } catch (err) {

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
    <div className="practice-chat flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header (sticky within the left column scroll container) */}
      <div className="sticky top-0 z-10 rounded-t-xl bg-gradient-to-r from-blue-500 to-purple-500 px-[clamp(0.9rem,2.8vw,1.2rem)] py-[clamp(0.7rem,2vw,1rem)] text-white">
        <h3 className="font-quicksand text-[clamp(1rem,3vw,1.15rem)] font-bold">💬 Chat</h3>
      </div>

      {/* Chat Messages (body flows inside page left-column scroll container) */}
      <div className="space-y-[clamp(0.7rem,2vw,1rem)] bg-gray-50 p-[clamp(0.8rem,2.6vw,1.2rem)]">
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
              className={`flex min-w-0 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`min-w-0 max-w-[min(92%,44rem)] rounded-xl px-[clamp(0.75rem,2.2vw,1rem)] py-[clamp(0.6rem,1.8vw,0.85rem)] font-quicksand shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap text-[clamp(0.9rem,2.8vw,1rem)] leading-relaxed [overflow-wrap:anywhere] break-words">{msg.parts[0].text}</p>
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
        <form onSubmit={handleSendMessage} className="sticky bottom-0 z-20 border-t bg-white p-[clamp(0.75rem,2.6vw,1rem)]">
          {isInitializing && (
            <div className="text-center text-gray-500 py-2 text-sm font-quicksand">
              ⏳ Đang khởi tạo bài toán...
            </div>
          )}
          {error?.includes('khởi tạo bài toán') && (
            <div className="text-center text-red-500 py-2 text-sm font-quicksand">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                // Shift+Enter: xuống dòng | Enter: gửi tin nhắn
                if (e.key === 'Enter') {
                  if (e.shiftKey) {
                    // Shift+Enter: xuống dòng (allow default)
                    return;
                  } else {
                    // Enter: gửi tin nhắn
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }
              }}
              placeholder="Nhập câu trả lời của bạn... (Shift+Enter để xuống dòng, Enter để gửi)"
              disabled={isLoading || isInitializing || error?.includes('khởi tạo bài toán')}
              className="min-h-24 w-full rounded-xl border-2 border-gray-300 px-4 py-3 font-quicksand leading-relaxed focus:border-blue-500 focus:outline-none disabled:bg-gray-100 resize-none"
              style={{ minHeight: '80px', maxHeight: '150px', lineHeight: '1.5' }}
            />
            <div className="flex items-center justify-end gap-2 sm:contents">
              {/* 🆕 Speaker Button - TTS Toggle */}
              <button
                type="button"
                onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-4 py-2.5 font-quicksand font-bold transition-all active:scale-[0.98] ${
                  isTTSEnabled
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
                title={isTTSEnabled ? 'Tắt giọng nói' : 'Bật giọng nói'}
                aria-label={isTTSEnabled ? 'Tắt giọng nói AI' : 'Bật giọng nói AI'}
              >
                {isTTSEnabled ? '🔊' : '🔇'}
              </button>
              <button
                type="submit"
                disabled={isLoading || isInitializing || !inputValue.trim() || error?.includes('khởi tạo bài toán')}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-blue-500 px-6 py-2.5 font-quicksand font-bold text-white transition-all hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-400"
                aria-label="Gửi tin nhắn"
              >
                {isLoading ? '⏳' : '➤'}
              </button>
            </div>
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
