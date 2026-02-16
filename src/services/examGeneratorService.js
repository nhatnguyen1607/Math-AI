import { GoogleGenerativeAI } from '@google/generative-ai';
import apiKeyManager from './apiKeyManager';

class ExamGeneratorService {
  constructor() {
    this.genAI = null;
    this.model = null;
  }

  async initialize() {
    try {
      const apiKey = await apiKeyManager.getValidApiKey();
      if (!apiKey) {
        throw new Error('API key không có');
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } catch (error) {
      throw new Error(`Không thể khởi tạo Gemini: ${error.message}`);
    }
  }

  /**
   * Tạo đề thi mới dựa trên các đề mẫu
   * @param {Object} params
   * @param {string} params.topicName - Tên chủ đề (e.g., "CHỦ ĐỀ: TỈ SỐ VÀ CÁC BÀI TOÁN LIÊN QUAN")
   * @param {string} params.lessonName - Tên bài học (e.g., "Bài 36. Tỉ số. Tỉ số phần trăm")
   * @param {Array} params.sampleExams - Danh sách các đề mẫu (có content)
   * @returns {Promise<Object>} - Đề thi mới sinh ra
   */
  async generateExamFromSamples(params) {
    try {
      if (!this.model) {
        await this.initialize();
      }

      const { topicName, lessonName, sampleExams } = params;

      if (!sampleExams || sampleExams.length === 0) {
        throw new Error('Chưa có đề mẫu nào để tạo đề');
      }

      // Chuẩn bị nội dung từ các đề mẫu để gửi cho AI
      const prompt = `Bạn là chuyên gia soạn đề thi toán lớp 5. Hệ thống quản lý bài tập đã cung cấp cho bạn:

**CHỦ ĐỀ**: ${topicName}
**BÀI HỌC MỚI**: ${lessonName}

**CÁC ĐỀ MẪU THAM KHẢO**:
${sampleExams.map((sample, idx) => `
[ĐỀ MẪU ${idx + 1}]: ${sample.lessonName}
${this._formatSampleContent(sample.content)}
`).join('')}

**NHIỆM VỤ**: 
1. Phân tích FORMAT của các đề mẫu trên
2. Tạo một đề thi MỚI cho bài học "${lessonName}" 
3. Đảm bảo đề mới:
   - Giữ nguyên FORMAT lớn (2 bài: "Bài 1: BT vận dụng, ứng dụng" + "Bài 2: BT GQVĐ")
   - Mỗi bài có nhiều câu hỏi với AI nhận diện (phần lý giải tại sao chọn các đáp án)
   - Nội dung phù hợp với tên bài học mới
   - Sử dụng ngữ cảnh, ví dụ mới (không copy từ mẫu)

**OUTPUT yêu cầu**: Trả về đối tượng JSON có cấu trúc:
{
  "topicName": "${topicName}",
  "lessonName": "${lessonName}",
  "exercises": [
    {
      "name": "Bài 1: BT vận dụng, ứng dụng (2 phút)",
      "duration": 120,
      "questions": [
        {
          "id": "q1",
          "question": "...",
          "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
          "correctAnswer": "A",
          "aiExplanation": "Chọn A → ..., Chọn B → ..., ..."
        },
        ...
      ]
    },
    {
      "name": "Bài 2: BT GQVĐ (3 phút 30 giây)",
      "duration": 210,
      "questions": [
        ...
      ]
    }
  ]
}

**LƯU Ý QUAN TRỌNG**:
- Đề mới phải độc lập, không copy bài mẫu
- Giữ cấu trúc 2 bài (vận dụng + GQVĐ)
- Mỗi bài có từ 3-8 câu hỏi tùy độ phức tạp
- Câu hỏi phải từ cơ bản đến nâng cao
- Phần "aiExplanation" phải chi tiết để hệ thống AI có thể nhận diện lỗi học sinh

**BẮT ĐẦU**:
Hãy tạo một đề thi mới, hoàn toàn chính xác và phù hợp với format trên. Trả về CHỈNH JSON, không có ký tự khác.`;

      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse JSON từ response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Không thể phân tích đáp án từ AI');
      }

      const generatedExam = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        data: generatedExam
      };
    } catch (error) {
      console.error('Lỗi khi tạo đề:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Phân tích format của nội dung đề mẫu
   * @private
   */
  _analyzeFormat(content) {
    if (Array.isArray(content)) {
      return {
        type: 'structured',
        exerciseCount: content.length,
        avg_questions_per_exercise: content.reduce((sum, ex) => sum + (ex.questions?.length || 0), 0) / content.length
      };
    }
    return { type: 'text', format: typeof content };
  }

  /**
   * Định dạng nội dung đề mẫu để gửi tới AI
   * @private
   */
  _formatSampleContent(content) {
    if (Array.isArray(content)) {
      return content.map((exercise, idx) => {
        const questionsText = exercise.questions?.map((q, qIdx) => {
          if (typeof q === 'string') return `${qIdx + 1}. ${q}`;
          return `${qIdx + 1}. ${q.question || q.text}`;
        }).join('\n') || '';
        
        return `Bài: ${exercise.name}
Thời gian: ${exercise.duration}s
Số câu: ${exercise.questions?.length || 0}
${questionsText}`;
      }).join('\n---\n');
    }
    
    if (typeof content === 'string') {
      return content;
    }

    return JSON.stringify(content, null, 2);
  }

  /**
   * Tạo prompt để sinh đề với các tùy chọn cụ thể
   * @param {Object} options
   */
  setupCustomPrompt(options = {}) {
    return {
      difficulty: options.difficulty || 'medium', // 'easy', 'medium', 'hard'
      focusArea: options.focusArea || 'general',
      questionCount: options.questionCount || 10
    };
  }
}

const examGeneratorServiceInstance = new ExamGeneratorService();
export default examGeneratorServiceInstance;
