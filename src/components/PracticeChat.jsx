import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import resultService from '../services/faculty/resultService';
import geminiChatServiceSoThapPhan from '../services/gemini/geminiChatServiceSoThapPhan';
// import geminiChatServiceTimeVelocity from '../services/geminiChatServiceTimeVelocity';
import { chatServiceRouter } from '../services/serviceRouter';
import TypewriterMessage from './TypewriterMessage';
import ttsService from '../services/ttsService';

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
  topicName = '',
  examContextId = '',
  ttsGender: propsTtsGender, // 🆕 Nhận từ prop
  onTTSStateChange // 🆕 Callback thông báo đang phát âm thanh
}) => {
  // Select the appropriate chat service based on topic using router
  const chatService = useMemo(() => {
    
    // 🆕 Use serviceRouter instead of hardcoded logic
    const routerService = chatServiceRouter.getService(topicName);
    
    if (routerService) {
      return routerService;
    }
    
    // Fallback to default if router returns null
    return geminiChatServiceSoThapPhan;
  }, [topicName]);
  const [messages, setMessages] = useState(chatHistory);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Track initialization state
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false); // 🎤 Voice recording state
  const [streamingMsgIdx, setStreamingMsgIdx] = useState(-1); // 🆕 Index of message currently being typed
  const [isTypewriterPaused, setIsTypewriterPaused] = useState(false); // 🆕 Trạng thái tạm dừng của typewriter
  const [ttsPlayingIdx, setTtsPlayingIdx] = useState(-1); // 🔊 Index of message currently being spoken
  const [ttsLoadingIdx, setTtsLoadingIdx] = useState(-1); // 🔊 Index of message loading TTS
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null); // 🎤 Web Speech API instance
  const continueRecordingRef = useRef(false); // 🎤 Track if user wants to continue recording
  const recognitionStartedRef = useRef(false); // 🎤 Track if recognition is actually started
  const voiceBaseTextRef = useRef(''); // 🎤 Original input before starting voice
  const voiceConfirmedTextRef = useRef(''); // 🎤 Confirmed voice text
  const voiceInterimRef = useRef(''); // 🎤 Interim (temporary) voice text

  // � Khởi tạo Web Speech API Recognition
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) {
      setError('⚠️ Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Chrome, Edge hoặc trình duyệt tương thích.');
      return null;
    }
    
    if (recognitionRef.current) return recognitionRef.current;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Tiếp tục nhận diện nhiều nhịp
    recognition.interimResults = true; // Hiển thị kết quả tạm thời
    recognition.lang = 'vi-VN'; // Tiếng Việt
    
    const newlineCommandPatterns = [
      /\bxu[oố]ng\s+d[oò]ng\b/gi,
      /\bxuong\s+dong\b/gi,
      /\bxu[oố]ng\s+h[aà]ng\b/gi,
      /\bxuong\s+hang\b/gi,
      /\bd[oò]ng\s+m[oớ]i\b/gi,
      /\bdong\s+moi\b/gi,
      /\bh[aà]ng\s+m[oớ]i\b/gi,
      /\bhang\s+moi\b/gi,
      /\benter\b/gi,
      /\bnew\s+line\b/gi
    ];

    const normalizeVoiceText = (text = '', preserveTrailingNewline = false) => {
      let processed = text;

      newlineCommandPatterns.forEach((pattern) => {
        processed = processed.replace(pattern, '\n');
      });

      processed = processed
        .replace(/\r\n/g, '\n')
        .replace(/\s*\n\s*/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/^\s+/g, '');

      if (preserveTrailingNewline) {
        return processed.replace(/[ \t]+$/g, '');
      }

      return processed.trim();
    };

    const mergeVoiceParts = (base = '', confirmed = '', interim = '') => {
      const parts = [base, confirmed, interim].filter(Boolean);
      let output = '';

      parts.forEach((part) => {
        if (!output) {
          output = part;
          return;
        }

        output += output.endsWith('\n') || part.startsWith('\n') ? part : ` ${part}`;
      });

      return output;
    };
    
    recognition.onstart = () => {
      recognitionStartedRef.current = true;
      voiceConfirmedTextRef.current = '';
      voiceInterimRef.current = '';
      setIsRecording(true);
      setError(null);
    };
    
    recognition.onresult = (event) => {
      let interimText = '';
      let finalText = '';
      
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        
        if (event.results[i].isFinal) {
          // Final result
          finalText += transcript + ' ';
        } else {
          // Interim result
          interimText += transcript + ' ';
        }
      }

      voiceConfirmedTextRef.current = normalizeVoiceText(finalText, true);
      voiceInterimRef.current = normalizeVoiceText(interimText, true);

      // Re-render full text on each result so newline commands apply immediately, even mid-sentence.
      setInputValue(
        mergeVoiceParts(
          voiceBaseTextRef.current,
          voiceConfirmedTextRef.current,
          voiceInterimRef.current
        )
      );
    };
    
    recognition.onerror = (event) => {
      recognitionStartedRef.current = false;
      voiceInterimRef.current = ''; // 🎤 Clear interim on error
      setInputValue(mergeVoiceParts(voiceBaseTextRef.current, voiceConfirmedTextRef.current, ''));
      
      // Skip 'no-speech' error khi continuous recording (user dừng nói tạm thời)
      if (event.error === 'no-speech' && continueRecordingRef.current) {
        try {
          recognitionRef.current?.start();
          recognitionStartedRef.current = true;
        } catch (e) {
        }
        return;
      }
      
      setIsRecording(false);
      continueRecordingRef.current = false;
      
      const errorMessages = {
        'no-speech': '⚠️ Không phát hiện giọng nói. Vui lòng nói to hơn.',
        'network': '❌ Lỗi kết nối mạng. Vui lòng kiểm tra internet.',
        'not-allowed': '❌ Quyền truy cập mic bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.',
        'bad-grammar': '❌ Lỗi phát hiện giọng nói. Vui lòng thử lại.',
      };
      
      setError(errorMessages[event.error] || `❌ Lỗi: ${event.error}`);
    };
    
    recognition.onend = () => {
      recognitionStartedRef.current = false;
      voiceInterimRef.current = ''; // 🎤 Clear interim
      setInputValue(mergeVoiceParts(voiceBaseTextRef.current, voiceConfirmedTextRef.current, ''));
      // Auto-restart nếu user vẫn muốn ghi âm
      if (continueRecordingRef.current) {
        try {
          recognitionRef.current?.start();
          recognitionStartedRef.current = true;
        } catch (e) {
          setIsRecording(false);
          continueRecordingRef.current = false;
        }
      } else {
        setIsRecording(false);
      }
    };
    
    recognitionRef.current = recognition;
    return recognition;
  }, []);

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
      hasInitializedRef.current = false; // 🔴 RESET để khởi tạo lại khi đổi bài hoặc tạo lại đề
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baiNumber, deBai, chatHistory]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!deBai || isCompleted) return;

    // Nếu đã có chatHistory thì không khởi tạo lại, chỉ tiếp tục chat
    if (chatHistory && chatHistory.length > 0) {
      chatService.restoreSession(deBai, chatHistory, examContextId);
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
        const response = await chatService.startNewProblem(deBai, isApplicationProblem, examContextId);
        const aiMsg = {
          role: 'model',
          parts: [{ text: response.message }]
        };

        setMessages([aiMsg]);
        // 🆕 Tự động phát TTS cho tin nhắn đầu tiên
        handleTTS(0, response.message, true);
        
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
  }, [deBai, examContextId, isCompleted, saveChatMessage, onChatUpdate]);

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

  // 🔊 Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      ttsService.stop();
    };
  }, []);

  // 🔊 Toggle TTS: phát hoặc dừng giọng nói cho tin nhắn AI
  const handleTTS = useCallback((idx, text, autoStartTypewriter = false) => {
    if (ttsPlayingIdx === idx) {
      // Đang phát tin nhắn này → dừng
      ttsService.stop();
      setTtsPlayingIdx(-1);
      return;
    }

    // Dừng audio cũ nếu có
    ttsService.stop();
    setTtsPlayingIdx(-1);
    setTtsLoadingIdx(idx);

    // Fallback: Nếu TTS quá lâu (>2s) mà chưa load xong, vẫn cho chạy chữ
    let typewriterStarted = false;
    const startTypewriterFallback = () => {
      if (autoStartTypewriter && !typewriterStarted) {
        typewriterStarted = true;
        setStreamingMsgIdx(idx);
        setIsTypewriterPaused(false);
      }
    };

    if (autoStartTypewriter) {
      setStreamingMsgIdx(idx);
      setIsTypewriterPaused(true);
    }
    
    const timeoutId = setTimeout(startTypewriterFallback, 2000);

    ttsService.speak(text, {
      voiceGender: propsTtsGender || 'FEMALE', // 🆕 Sử dụng giọng từ props
      onStart: () => {
        clearTimeout(timeoutId);
        setTtsLoadingIdx(-1);
        setTtsPlayingIdx(idx);
        if (autoStartTypewriter) {
          typewriterStarted = true;
          setStreamingMsgIdx(idx);
          setIsTypewriterPaused(false);
        }
      },
      onEnd: () => {
        setTtsPlayingIdx(-1);
      },
      onError: (err) => {
        clearTimeout(timeoutId);
        setTtsLoadingIdx(-1);
        setTtsPlayingIdx(-1);
        console.error('TTS error:', err.message);
        startTypewriterFallback(); // Vẫn chạy chữ nếu lỗi âm thanh
      }
    });
  }, [ttsPlayingIdx, propsTtsGender]); // 🆕 Cập nhật dependency

  // 🔊 Đổi giọng đọc (Đã chuyển lên component cha)
  /* const toggleTTSGender = useCallback(() => { ... }); */

// Trong hàm handleSendMessage
const handleSendMessage = async (e) => {
  e.preventDefault();
  // Nếu có lỗi khởi tạo, không cho gửi tin nhắn
  if (!inputValue.trim() || isLoading || isCompleted || isInitializing || error?.includes('khởi tạo bài toán')) return;

  try {
    setError(null);
    const userMessage = inputValue.trim();

    const userMsg = { role: 'user', parts: [{ text: userMessage }] };
    setMessages(prev => {
      const next = [...prev, userMsg];
      if (onChatUpdate) {
        onChatUpdate(next);
      }
      return next;
    });
    setInputValue('');
    setIsLoading(true);

    if (onRobotStateChange) onRobotStateChange('thinking', 'AI đang xử lý...');

    await saveChatMessage(userMsg);

    // 🆕 Luôn đi qua processStudentResponse để hệ thống scaffolding 3 mức xử lý
    // (trước đây có tách riêng getHint nhưng nó bypass logic scaffolding)
    let aiMsg;
    let response = null;

    response = await chatService.processStudentResponse(userMessage, messages);
    aiMsg = { role: 'model', parts: [{ text: response.message }] };

    if (response && response.nextStep === 5) {
      setTimeout(() => { if (onCompleted) onCompleted(); }, 1500);
    }

    setMessages(prev => {
      const next = [...prev, aiMsg];
      // 🆕 Tự động phát TTS và đồng bộ Typewriter
      handleTTS(next.length - 1, response.message, true);
      
      if (onChatUpdate) {
        onChatUpdate(next);
      }
      return next;
    });
    await saveChatMessage(aiMsg);

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
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl bg-gradient-to-r from-blue-500 to-purple-500 px-[clamp(0.9rem,2.8vw,1.2rem)] py-[clamp(0.7rem,2vw,1rem)] text-white">
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
          messages.map((msg, idx) => {
            const isAI = msg.role !== 'user';
            const isStreaming = isAI && idx === streamingMsgIdx;
            const isTTSPlaying = ttsPlayingIdx === idx;
            const isTTSLoading = ttsLoadingIdx === idx;
            return (
              <div
                key={idx}
                className={`flex min-w-0 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex flex-col min-w-0 max-w-[min(92%,44rem)]">
                  <div
                    className={`rounded-xl px-[clamp(0.75rem,2.2vw,1rem)] py-[clamp(0.6rem,1.8vw,0.85rem)] font-quicksand shadow-md ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-bl-none border-2 border-purple-400 font-semibold'
                    }`}
                  >
                    {isStreaming ? (
                      <TypewriterMessage
                        text={msg.parts[0].text}
                        speed={120} // 🆕 Chậm lại để khớp với tiếng nói (~150-200ms/token)
                        onComplete={() => setStreamingMsgIdx(-1)}
                        onTextUpdate={scrollToBottom}
                        paused={isTypewriterPaused}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-[clamp(0.9rem,2.8vw,1rem)] leading-relaxed [overflow-wrap:anywhere] break-words">{msg.parts[0].text}</p>
                    )}
                  </div>
                  {/* 🔊 TTS Button - chỉ hiện cho tin nhắn AI, ẩn khi đang streaming */}
                  {isAI && !isStreaming && (
                    <div className="mt-1 ml-1">
                      <button
                        type="button"
                        onClick={() => handleTTS(idx, msg.parts[0].text)}
                        disabled={isTTSLoading}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-quicksand transition-all duration-200 ${
                          isTTSPlaying
                            ? 'bg-purple-100 text-purple-700 shadow-sm ring-1 ring-purple-300'
                            : isTTSLoading
                              ? 'bg-gray-100 text-gray-400 cursor-wait'
                              : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600'
                        }`}
                        title={isTTSPlaying ? 'Dừng đọc' : 'Nghe AI đọc'}
                      >
                        {isTTSLoading ? (
                          <>
                            <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
                            <span>Đang tải...</span>
                          </>
                        ) : isTTSPlaying ? (
                          <>
                            <span className="text-sm">⏹</span>
                            <span>Dừng đọc</span>
                            {/* Sound wave animation */}
                            <span className="flex items-end gap-[2px] h-3 ml-0.5">
                              <span className="w-[2px] bg-purple-500 rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0ms' }} />
                              <span className="w-[2px] bg-purple-500 rounded-full animate-pulse" style={{ height: '70%', animationDelay: '150ms' }} />
                              <span className="w-[2px] bg-purple-500 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '300ms' }} />
                              <span className="w-[2px] bg-purple-500 rounded-full animate-pulse" style={{ height: '55%', animationDelay: '450ms' }} />
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm">🔊</span>
                            <span>Nghe</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-3 rounded-lg rounded-bl-none shadow-md border-2 border-purple-400">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
              className="min-h-24 w-full rounded-xl border-2 border-gray-300 px-4 py-3 font-quicksand leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 resize-none caret-blue-600"
              style={{ minHeight: '120px', maxHeight: '250px', lineHeight: '1.5', caretWidth: '4px' }}
            />
            <div className="flex items-center justify-end gap-2 sm:contents">
              {/* � Mic Button - Voice Chat */}
              <button
                type="button"
                onClick={() => {
                  if (isRecording) {
                    continueRecordingRef.current = false;
                    recognitionStartedRef.current = false;
                    voiceInterimRef.current = ''; // 🎤 Clear interim
                    try {
                      recognitionRef.current?.stop();
                    } catch (e) {
                      console.warn('🎤 [PracticeChat] Error stopping recognition:', e.message);
                    }
                    setIsRecording(false);
                  } else {
                    continueRecordingRef.current = true;
                    voiceInterimRef.current = ''; // 🎤 Clear interim
                    voiceBaseTextRef.current = inputValue; // 🎤 Save current input as base
                    voiceConfirmedTextRef.current = '';
                    const recognition = initSpeechRecognition();
                    if (recognition && !recognitionStartedRef.current) {
                      try {
                        recognition.start();
                        recognitionStartedRef.current = true;
                      } catch (e) {
                        setError('❌ Lỗi khi bắt đầu ghi âm. Vui lòng thử lại.');
                        continueRecordingRef.current = false;
                      }
                    }
                  }
                }}
                disabled={isLoading || isInitializing || error?.includes('khởi tạo bài toán')}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-4 py-2.5 font-quicksand font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:bg-gray-200 disabled:text-gray-400'
                }`}
                title={isRecording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
                aria-label={isRecording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm bằng giọng nói'}
              >
                {isRecording ? '🎤' : '🎙️'}
              </button>
              <button
                type="submit"
                disabled={isLoading || isInitializing || !inputValue.trim() || error?.includes('khởi tạo bài toán') || isRecording}
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
