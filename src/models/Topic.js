/**
 * Topic Model
 * Đại diện cho một chủ đề học tập
 */

export class Topic {
  constructor(data = {}) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.description = data.description || '';
    this.icon = data.icon || '';
    this.color = data.color || '#8B5CF6';
    this.classId = data.classId || ''; // Class that this topic belongs to
    this.type = data.type || 'startup'; // 'startup' or 'worksheet'
    this.createdBy = data.createdBy || '';
    this.createdByName = data.createdByName || '';
    this.gradeLevel = data.gradeLevel || '';
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
      classId: this.classId,
      type: this.type,
      createdBy: this.createdBy,
      createdByName: this.createdByName,
      gradeLevel: this.gradeLevel,
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
