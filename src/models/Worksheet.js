/**
 * Worksheet Model
 * Đại diện cho một phiếu bài tập
 */

export class Worksheet {
  constructor(data = {}) {
    this.id = data.id || ''; // ID will be set by Firestore when creating
    this.type = data.type || 'input'; // 'input' or 'output'
    this.classId = data.classId || '';
    this.name = data.name || '';
    this.context = data.context || ''; // Câu hỏi chung cho phiếu
    this.createdBy = data.createdBy || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    
    // Bài 1: Đánh dấu các phát biểu đúng
    this.bai_1 = {
      text: 'Hãy đánh dấu (✔) vào tất cả các phát biểu đúng về thông tin của bài toán',
      questions: data.bai_1?.questions || [], // Array of { id, text }
      explanation: data.bai_1?.explanation || '' // Hướng dẫn cho AI nhận xét
    };
    
    // Bài 2: Sắp xếp các bước tính
    this.bai_2 = {
      text: 'Hãy chọn và sắp xếp các bước tính sau theo thứ tự đúng để giải bài toán:',
      so_cach_giai: data.bai_2?.so_cach_giai || '', // Số cách giải
      questions: data.bai_2?.questions || [], // Array of { id, text }
      explanation: data.bai_2?.explanation || '' // Hướng dẫn cho AI nhận xét
    };
    
    // Bài 3: Trình bày bài giải
    this.bai_3 = {
      text: 'Hãy trình bày bài giải của bài toán trên theo 1 cách mà em chọn và giải thích vì sao em thực hiện các bước tính đó: ',
      explanation: data.bai_3?.explanation || '' // Hướng dẫn cho AI nhận xét
    };
    
    // Bài 4: Câu hỏi phụ với các phần a, b, c, ...
    this.bai_4 = {
      questions: data.bai_4?.questions || [], // Array of { id, text, label, type, content, subQuestions }
      explanation: data.bai_4?.explanation || '' // Hướng dẫn cho AI nhận xét
      // type: 'so_cach_giai' hoặc 'cau_hoi_nho'
      // content: string (số cách giải) hoặc null (nếu cau_hoi_nho)
      // subQuestions: Array nếu type === 'cau_hoi_nho', mỗi item là { id, text }
    };
  }

  addBai1Question(text) {
    const question = {
      id: `q_${Date.now()}_${Math.random()}`,
      text: text
    };
    this.bai_1.questions.push(question);
    return question;
  }

  removeBai1Question(questionId) {
    this.bai_1.questions = this.bai_1.questions.filter(q => q.id !== questionId);
  }

  addBai2Question(text) {
    const question = {
      id: `q_${Date.now()}_${Math.random()}`,
      text: text
    };
    this.bai_2.questions.push(question);
    return question;
  }

  removeBai2Question(questionId) {
    this.bai_2.questions = this.bai_2.questions.filter(q => q.id !== questionId);
  }

  addBai4Question(text) {
    const questionIndex = this.bai_4.questions.length;
    const label = String.fromCharCode(97 + questionIndex); // a, b, c, ...
    const question = {
      id: `q_${Date.now()}_${Math.random()}`,
      text: text,
      label: label,
      type: null, // Will be set when adding so_cach_giai or cau_hoi_nho
      content: null,
      subQuestions: [] // Mảng câu hỏi nhỏ (nếu type === 'cau_hoi_nho')
    };
    this.bai_4.questions.push(question);
    return question;
  }

  removeBai4Question(questionId) {
    this.bai_4.questions = this.bai_4.questions.filter(q => q.id !== questionId);
  }

  setBai4QuestionType(questionId, type, content) {
    const question = this.bai_4.questions.find(q => q.id === questionId);
    if (question) {
      question.type = type; // 'so_cach_giai' or 'cau_hoi_nho'
      question.content = content;
    }
  }

  toJSON() {
    const data = {
      type: this.type,
      classId: this.classId,
      name: this.name,
      context: this.context,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      bai_1: this.bai_1,
      bai_2: this.bai_2,
      bai_3: this.bai_3,
      bai_4: this.bai_4
    };
    
    // Only include id if it's not empty
    if (this.id) {
      data.id = this.id;
    }
    
    return data;
  }

  static fromJSON(data) {
    return new Worksheet(data);
  }
}
