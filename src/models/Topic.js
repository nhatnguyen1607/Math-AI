/**
 * Topic Model
 * Đại diện cho một chủ đề học tập
 */

export class SampleExam {
  constructor(data = {}) {
    this.id = data.id || `sample_${Date.now()}`;
    this.lessonName = data.lessonName || ''; // Tên bài học (e.g., "Bài 38. Tìm hai số khi biết tổng và tỉ số")
    this.content = data.content || {}; // Nội dung đề mẫu (structured or raw)
    this.uploadedAt = data.uploadedAt || new Date();
    this.format = data.format || 'standard'; // 'standard', 'json', etc.
  }

  toJSON() {
    return {
      id: this.id,
      lessonName: this.lessonName,
      content: this.content,
      uploadedAt: this.uploadedAt,
      format: this.format
    };
  }
}

export class Topic {
  constructor(data = {}) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.description = data.description || '';
    this.icon = data.icon || '';
    this.color = data.color || '#8B5CF6';
    this.type = data.type || 'startup'; // 'startup' or 'worksheet'
    this.learningPathway = data.learningPathway || 'algebra'; // 'algebra' or 'geometry'
    this.createdBy = data.createdBy || '';
    this.createdByName = data.createdByName || '';
    this.gradeLevel = data.gradeLevel || '';
    this.sampleExams = data.sampleExams || []; // Array of SampleExam objects
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.examCount = data.examCount || 0;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      color: this.color,
      type: this.type,
      learningPathway: this.learningPathway,
      createdBy: this.createdBy,
      createdByName: this.createdByName,
      gradeLevel: this.gradeLevel,
      sampleExams: this.sampleExams || [],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      examCount: this.examCount,
      isActive: this.isActive
    };
  }

  static fromFirestore(data, id) {
    return new Topic({ ...data, id });
  }
}
