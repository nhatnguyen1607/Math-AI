import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTypewriter Hook
 * Hiển thị text lần lượt từng từ (word-by-word) với tốc độ tùy chỉnh.
 * 
 * @param {string} fullText - Toàn bộ text cần hiển thị
 * @param {object} options - Cấu hình
 * @param {number} options.speed - Delay giữa mỗi từ (ms), mặc định 40ms
 * @param {boolean} options.enabled - Có bật typewriter hay không, mặc định true
 * @param {function} options.onComplete - Callback khi hiển thị xong
 * @returns {{ displayedText: string, isTyping: boolean, skipToEnd: function }}
 */
export function useTypewriter(fullText, options = {}) {
  const { speed = 40, enabled = true, onComplete, paused = false } = options;
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const timerRef = useRef(null);
  const wordsRef = useRef([]);
  const indexRef = useRef(0);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref up to date
  onCompleteRef.current = onComplete;

  // Cleanup timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Skip to end - show full text immediately
  const skipToEnd = useCallback(() => {
    clearTimer();
    setDisplayedText(fullText || '');
    setIsTyping(false);
    if (onCompleteRef.current) onCompleteRef.current();
  }, [fullText, clearTimer]);

  useEffect(() => {
    // If not enabled or no text, show full text immediately
    if (!enabled || !fullText) {
      setDisplayedText(fullText || '');
      setIsTyping(false);
      return;
    }

    // Split text into tokens
    const tokens = [];
    const parts = fullText.split(/(\s+)/);
    for (const part of parts) {
      if (part) tokens.push(part);
    }

    wordsRef.current = tokens;
    // Don't reset index if we are just unpausing
    if (!paused && indexRef.current === 0) {
      setDisplayedText('');
    }
    
    setIsTyping(true);

    if (paused) {
      clearTimer();
      return;
    }

    timerRef.current = setInterval(() => {
      indexRef.current++;
      const currentTokens = wordsRef.current.slice(0, indexRef.current);
      const text = currentTokens.join('');
      setDisplayedText(text);

      if (indexRef.current >= wordsRef.current.length) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setIsTyping(false);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    }, speed);

    return () => {
      clearTimer();
    };
  }, [fullText, speed, enabled, clearTimer, paused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return { displayedText, isTyping, skipToEnd };
}

export default useTypewriter;
