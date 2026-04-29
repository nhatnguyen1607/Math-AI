import React, { memo } from 'react';
import { useTypewriter } from '../hooks/useTypewriter';

/**
 * TypewriterMessage Component
 * Hiển thị tin nhắn AI với hiệu ứng gõ chữ từng từ.
 * Chỉ dùng cho tin nhắn model mới nhất (đang streaming).
 * 
 * @param {string} text - Nội dung tin nhắn
 * @param {number} speed - Tốc độ hiển thị (ms/từ), mặc định 40ms
 * @param {function} onComplete - Callback khi typewriter hoàn thành
 * @param {function} onTextUpdate - Callback mỗi khi text thay đổi (dùng để scroll)
 * @param {boolean} paused - Trạng thái tạm dừng (đợi TTS)
 */
const TypewriterMessage = memo(({ text, speed = 40, onComplete, onTextUpdate, paused = false }) => {
  const { displayedText, isTyping, skipToEnd } = useTypewriter(text, {
    speed,
    enabled: true,
    onComplete,
    paused
  });

  // Notify parent on text change for scroll-to-bottom
  React.useEffect(() => {
    if (onTextUpdate) onTextUpdate();
  }, [displayedText, onTextUpdate]);

  return (
    <div className="relative">
      <p className="whitespace-pre-wrap text-[clamp(0.9rem,2.8vw,1rem)] leading-relaxed [overflow-wrap:anywhere] break-words">
        {displayedText}
        {isTyping && (
          <span className="inline-block w-[2px] h-[1em] bg-white ml-[2px] animate-pulse align-text-bottom" />
        )}
      </p>
      {isTyping && (
        <button
          type="button"
          onClick={skipToEnd}
          className="absolute -bottom-1 right-0 text-[0.65rem] text-white/60 hover:text-white/90 transition-colors font-quicksand"
          title="Hiện toàn bộ"
        >
          Bỏ qua ▸
        </button>
      )}
    </div>
  );
});

TypewriterMessage.displayName = 'TypewriterMessage';

export default TypewriterMessage;
