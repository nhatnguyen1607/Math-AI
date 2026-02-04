/**
 * User Model
 * Đại diện cho tài khoản người dùng trong hệ thống
 */

export class User {
  constructor(data = {}) {
    this.id = data.id || '';
    this.email = data.email || '';
    this.displayName = data.displayName || '';
    this.photoURL = data.photoURL || '';
    this.role = data.role || 'student'; // 'student', 'faculty', 'admin'
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.isLocked = data.isLocked || false;
    this.lockedReason = data.lockedReason || '';
    this.lockedAt = data.lockedAt || null;
  }

  isStudent() {
    return this.role === 'student';
  }

  isFaculty() {
    return this.role === 'faculty';
  }

  isAdmin() {
    return this.role === 'admin';
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive,
      isLocked: this.isLocked,
      lockedReason: this.lockedReason,
      lockedAt: this.lockedAt
    };
  }

  static fromFirestore(data, id) {
    return new User({ ...data, id });
  }
}
