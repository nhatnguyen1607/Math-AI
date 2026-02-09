import geminiModelManager from "./geminiModelManager";

class ProblemGeneratorService {
  // Tạo bài toán dựa trên chủ đề và yêu cầu
  async generateProblem(topicName, requirements = {}) {
    try {
      const {
        difficulty = 'medium', // easy, medium, hard
        count = 1,
        gradeLevel = 5,
        specificRequirements = ''
      } = requirements;

      const prompt = `Hãy tạo ${count} bài toán lớp ${gradeLevel} về chủ đề "${topicName}".

Yêu cầu QUAN TRỌNG:
- Bài toán PHẢI trực tiếp sử dụng hoặc áp dụng kiến thức của chủ đề "${topicName}"
- KHÔNG tạo bài toán generic hoặc sơ cấp không liên quan tới topic
- Độ khó: ${difficulty === 'easy' ? 'Dễ' : difficulty === 'medium' ? 'Trung bình' : 'Khó'}
- Phù hợp với học sinh lớp ${gradeLevel}
- Đề bài rõ ràng, có dữ kiện đầy đủ
- Có thể giải bằng 4 bước Polya
${specificRequirements ? `- Yêu cầu thêm: ${specificRequirements}` : ''}

Trả về JSON format sau (nếu tạo nhiều bài thì dùng array):
{
  "problems": [
    {
      "title": "Tiêu đề ngắn gọn",
      "content": "Nội dung đề bài đầy đủ",
      "difficulty": "easy|medium|hard",
      "hints": ["Gợi ý 1", "Gợi ý 2"],
      "expectedSteps": ["Bước 1 mô tả", "Bước 2 mô tả", "Bước 3 mô tả", "Bước 4 mô tả"],
      "solution": "Lời giải mẫu chi tiết"
    }
  ]
}

CHỈ trả về JSON, không thêm text khác.`;

      const result = await geminiModelManager.generateContent(prompt);
      const response = result.response.text();
      
      let jsonStr = response.trim();
        // Loại bỏ hoàn toàn markdown code block nếu có
        if (jsonStr.startsWith('```')) {
          // Xóa tất cả các dòng bắt đầu và kết thúc bằng ``` hoặc ```json
          jsonStr = jsonStr.replace(/```json[\r\n]?/gi, '').replace(/```[\r\n]?/g, '');
        }
      // Loại bỏ ký tự điều khiển không hợp lệ (trừ \\n, \\r, \\t)
      // eslint-disable-next-line no-control-regex
      jsonStr = jsonStr.replace(/[\u0000-\u0019]+/g, ' ');

      const data = JSON.parse(jsonStr);
      return data.problems || [];
      
    } catch (error) {
      console.error("Error generating problem:", error);
      throw error;
    }
  }

  // Tạo nhiều bài toán cùng lúc
  async generateMultipleProblems(topicName, count = 5, difficulty = 'medium') {
    try {
      return await this.generateProblem(topicName, { 
        count, 
        difficulty,
        gradeLevel: 5
      });
    } catch (error) {
      console.error("Error generating multiple problems:", error);
      throw error;
    }
  }

  // Tạo bài toán với yêu cầu cụ thể
  async generateCustomProblem(topicName, customPrompt) {
    try {
      return await this.generateProblem(topicName, {
        specificRequirements: customPrompt,
        count: 1,
        gradeLevel: 5
      });
    } catch (error) {
      console.error("Error generating custom problem:", error);
      throw error;
    }
  }

  // Tạo gợi ý cho bài toán có sẵn
  async generateHints(problemContent) {
    try {
      const prompt = `Cho bài toán sau:
"${problemContent}"

Hãy tạo 3 gợi ý theo trình tự từ nhẹ đến chi tiết hơn để giúp học sinh lớp 5 tự giải quyết (KHÔNG đưa đáp án).

Trả về JSON:
{
  "hints": [
    "Gợi ý 1 - nhẹ nhất",
    "Gợi ý 2 - cụ thể hơn",
    "Gợi ý 3 - gần như hướng dẫn từng bước"
  ]
}

CHỈ trả về JSON.`;

      const result = await geminiModelManager.generateContent(prompt);
      const response = result.response.text();
      
      let jsonStr = response.trim();
      // Loại bỏ markdown code blocks nếu có
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\\n?/g, '').replace(/```\\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\\n?/g, '');
      }
      // Loại bỏ ký tự điều khiển không hợp lệ (trừ \\n, \\r, \\t)
      // eslint-disable-next-line no-control-regex
      jsonStr = jsonStr.replace(/[\u0000-\u0019]+/g, ' ');

      const data = JSON.parse(jsonStr);
      return data.hints || [];
      
    } catch (error) {
      console.error("Error generating hints:", error);
      throw error;
    }
  }

  // Tạo lời giải mẫu cho bài toán
  async generateSolution(problemContent) {
    try {
      const prompt = `Cho bài toán:
"${problemContent}"

Hãy tạo lời giải chi tiết theo 4 bước Polya cho học sinh lớp 5:
1. Hiểu bài toán
2. Lập kế hoạch
3. Thực hiện kế hoạch
4. Kiểm tra & mở rộng

Trả về JSON:
{
  "solution": "Lời giải đầy đủ với 4 bước",
  "answer": "Đáp số cuối cùng"
}

CHỈ trả về JSON.`;

      const result = await geminiModelManager.generateContent(prompt);
      const response = result.response.text();
      
      let jsonStr = response.trim();
      // Loại bỏ markdown code blocks nếu có
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\\n?/g, '').replace(/```\\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\\n?/g, '');
      }
      // Loại bỏ ký tự điều khiển không hợp lệ (trừ \\n, \\r, \\t)
      // eslint-disable-next-line no-control-regex
      jsonStr = jsonStr.replace(/[\u0000-\u0019]+/g, ' ');

      const data = JSON.parse(jsonStr);
      return data;
      
    } catch (error) {
      console.error("Error generating solution:", error);
      throw error;
    }
  }
}

const problemGeneratorServiceInstance = new ProblemGeneratorService();
export default problemGeneratorServiceInstance;
