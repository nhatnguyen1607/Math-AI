/**
 * TTS Service - Google Cloud Text-to-Speech
 * Gọi backend /api/tts để chuyển text thành giọng nói tiếng Việt WaveNet
 */

class TTSService {
  constructor() {
    this._audioElement = null;
    this._isPlaying = false;
    this._currentUrl = null;
    this._cache = new Map(); // Cache audio theo text hash
    this._maxCacheSize = 20;
  }

  /**
   * Tạo hash đơn giản từ text để dùng làm cache key
   */
  _hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `tts_${hash}_${text.length}`;
  }

  /**
   * Dọn cache nếu vượt quá maxCacheSize
   */
  _trimCache() {
    if (this._cache.size > this._maxCacheSize) {
      const firstKey = this._cache.keys().next().value;
      const oldUrl = this._cache.get(firstKey);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      this._cache.delete(firstKey);
    }
  }

  /**
   * Dừng audio đang phát (nếu có)
   */
  stop() {
    if (this._audioElement) {
      this._audioElement.pause();
      this._audioElement.currentTime = 0;
      this._audioElement = null;
    }
    this._isPlaying = false;
  }

  /**
   * Kiểm tra xem đang phát hay không
   */
  get isPlaying() {
    return this._isPlaying;
  }

  /**
   * Chuyển text sang giọng nói và phát
   * @param {string} text - Nội dung cần đọc
   * @param {object} options - Tùy chọn
   * @param {string} options.voiceGender - 'FEMALE' hoặc 'MALE'
   * @param {function} options.onStart - Callback khi bắt đầu phát
   * @param {function} options.onEnd - Callback khi phát xong
   * @param {function} options.onError - Callback khi lỗi
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    const { voiceGender = 'FEMALE', onStart, onEnd, onError } = options;

    // Dừng audio đang phát
    this.stop();

    if (!text || typeof text !== 'string' || !text.trim()) {
      if (onError) onError(new Error('Text rỗng'));
      return;
    }

    const cleanText = text.trim();
    const cacheKey = this._hashText(cleanText + voiceGender);

    try {
      let audioUrl;

      // Kiểm tra cache
      if (this._cache.has(cacheKey)) {
        audioUrl = this._cache.get(cacheKey);
      } else {
        // Gọi backend TTS API
        const apiEndpoint = process.env.REACT_APP_BACKEND_API_URL || 'http://localhost:8080';

        const response = await fetch(`${apiEndpoint}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText, voiceGender })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `TTS API Error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.audioContent) {
          throw new Error(data.error || 'Dữ liệu âm thanh không hợp lệ');
        }

        // Chuyển base64 sang Blob URL một cách an toàn
        const byteCharacters = atob(data.audioContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const audioBlob = new Blob([byteArray], { type: 'audio/mpeg' });
        audioUrl = URL.createObjectURL(audioBlob);

        console.log(`🔊 Audio Blob created, size: ${audioBlob.size} bytes`);

        // Lưu cache
        this._trimCache();
        this._cache.set(cacheKey, audioUrl);
      }

      // Phát audio
      const audio = new Audio();
      audio.src = audioUrl;
      this._audioElement = audio;
      this._isPlaying = true;

      audio.onplay = () => {
        console.log('🔊 Audio playback started');
        if (onStart) onStart();
      };

      audio.onended = () => {
        console.log('🔊 Audio playback ended');
        this._isPlaying = false;
        this._audioElement = null;
        if (onEnd) onEnd();
      };

      audio.onerror = (e) => {
        console.error('❌ Audio element error:', audio.error);
        this._isPlaying = false;
        this._audioElement = null;
        if (onError) onError(new Error(`Lỗi phát âm thanh: ${audio.error?.message || 'Unknown'}`));
      };

      // Gọi play() và xử lý promise (trình duyệt có thể chặn autoplay)
      try {
        await audio.play();
      } catch (playError) {
        console.error('❌ Playback blocked or failed:', playError.message);
        throw new Error('Trình duyệt chặn phát âm thanh. Vui lòng nhấn vào trang web và thử lại.');
      }

    } catch (error) {
      this._isPlaying = false;
      console.error('🔊 TTS Error:', error.message);
      if (onError) onError(error);
    }
  }

  /**
   * Giải phóng tài nguyên
   */
  dispose() {
    this.stop();
    for (const url of this._cache.values()) {
      URL.revokeObjectURL(url);
    }
    this._cache.clear();
  }
}

// Singleton instance
const ttsService = new TTSService();
export default ttsService;
