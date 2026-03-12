/**
 * Competency Evaluation Service
 * Đánh giá năng lực giải quyết vấn đề toán học dựa vào khung đánh giá
 * 
 * Khung đánh giá có 3 tiêu chí (TC):
 * - TC1: Nhận biết được vấn đề cần giải quyết
 * - TC2: Nêu được cách thức GQVĐ
 * - TC3: Trình bày được cách thức GQVĐ
 * 
 * Mỗi tiêu chí có 3 mức độ:
 * - "need_effort" (Cần cố gắng): 1 điểm
 * - "achieved" (Đạt): 2 điểm
 * - "good" (Tốt): 3 điểm
 */

// Scoring scale for competency levels (0-2 points per criterion)
export const COMPETENCY_LEVELS = {
  need_effort: {
    label: 'Cần cố gắng',
    score: 0,
    color: '#EF4444' // red
  },
  achieved: {
    label: 'Đạt',
    score: 1,
    color: '#F59E0B' // amber
  },
  good: {
    label: 'Tốt',
    score: 2,
    color: '#10B981' // green
  }
};

// Overall competency classification (0-8 points)
export const OVERALL_COMPETENCY_LEVELS = {
  need_effort: {
    label: 'Cần cố gắng',
    minScore: 0,
    maxScore: 3,
    color: '#EF4444' // red
  },
  achieved: {
    label: 'Đạt',
    minScore: 4,
    maxScore: 6,
    color: '#F59E0B' // amber
  },
  good: {
    label: 'Tốt',
    minScore: 7,
    maxScore: 8,
    color: '#10B981' // green
  }
};

// Competency criteria with descriptions
export const COMPETENCY_CRITERIA = {
  TC1: {
    name: 'Nhận biết được vấn đề cần giải quyết',
    description: 'Xác định đầy đủ dữ kiện, yêu cầu bài toán và mối quan hệ giữa chúng',
    scoreGuide: { need_effort: 0, achieved: 1, good: 2 }
  },
  TC2: {
    name: 'Nêu được cách thức GQVĐ',
    description: 'Nhận dạng dạng toán, đề xuất cách giải phù hợp, lựa chọn phép tính tối ưu',
    scoreGuide: { need_effort: 0, achieved: 1, good: 2 }
  },
  TC3: {
    name: 'Trình bày được cách thức GQVĐ',
    description: 'Thực hiện các bước giải và phép tính đúng, trình bày rõ ràng',
    scoreGuide: { need_effort: 0, achieved: 1, good: 2 }
  },
  TC4: {
    name: 'Kiểm tra được giải pháp đã thực hiện',
    description: 'Kiểm tra lại kết quả và vận dụng vào các bài toán tương tự',
    scoreGuide: { need_effort: 0, achieved: 1, good: 2 }
  }
};
// Note: translateComment function removed - not used in current implementation

/**
 * Parse competency evaluation from Gemini response (now in Vietnamese)
 * @param {string} responseText - Response text from Gemini (JSON format in Vietnamese)
 * @returns {Object} - Parsed competency evaluation with Vietnamese labels
 */
export const parseCompetencyEvaluation = (responseText) => {
  if (!responseText) {
    return {
      TC1: { level: 'achieved', score: 1, nhanXet: '' },
      TC2: { level: 'achieved', score: 1, nhanXet: '' },
      TC3: { level: 'achieved', score: 1, nhanXet: '' },
      TC4: { level: 'achieved', score: 1, nhanXet: '' },
      totalCompetencyScore: 4,
      tongNhanXet: ''
    };
  }

  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const raw = JSON.parse(jsonMatch[0]);

    // Convert Vietnamese response to standard format
    // Comment is already in Vietnamese, no translation needed
    const tc1Score = typeof raw.TC1?.score === 'number' ? raw.TC1.score : 1;
    const tc2Score = typeof raw.TC2?.score === 'number' ? raw.TC2.score : 1;
    const tc3Score = typeof raw.TC3?.score === 'number' ? raw.TC3.score : 1;
    const tc4Score = typeof raw.TC4?.score === 'number' ? raw.TC4.score : 1;

    const evaluation = {
      TC1: {
        level: normalizeLevelName(raw.TC1?.level || 'Đạt'),
        score: tc1Score,
        nhanXet: raw.TC1?.nhanXet || raw.TC1?.comment || ''
      },
      TC2: {
        level: normalizeLevelName(raw.TC2?.level || 'Đạt'),
        score: tc2Score,
        nhanXet: raw.TC2?.nhanXet || raw.TC2?.comment || ''
      },
      TC3: {
        level: normalizeLevelName(raw.TC3?.level || 'Đạt'),
        score: tc3Score,
        nhanXet: raw.TC3?.nhanXet || raw.TC3?.comment || ''
      },
      TC4: {
        level: normalizeLevelName(raw.TC4?.level || 'Đạt'),
        score: tc4Score,
        nhanXet: raw.TC4?.nhanXet || raw.TC4?.comment || ''
      },
      totalCompetencyScore: raw.totalScore || (tc1Score + tc2Score + tc3Score + tc4Score),
      tongNhanXet: raw.tongNhanXet || ''
    };


    return evaluation;
  } catch (error) {
    // Return default if parsing fails
    return {
      TC1: { level: 'achieved', score: 1, nhanXet: 'Không thể phân tích' },
      TC2: { level: 'achieved', score: 1, nhanXet: 'Không thể phân tích' },
      TC3: { level: 'achieved', score: 1, nhanXet: 'Không thể phân tích' },
      TC4: { level: 'achieved', score: 1, nhanXet: 'Không thể phân tích' },
      totalCompetencyScore: 4,
      tongNhanXet: 'Lỗi phân tích'
    };
  }
};

/**
 * Generate prompt for Gemini to evaluate competency in Vietnamese
 * @param {Array} studentResponses - Array of student responses/answers to questions
 * @param {string} problemStatement - The problem statement
 * @returns {string} - Formatted prompt for Gemini
 */
export const generateCompetencyEvaluationPrompt = (studentResponses, problemStatement) => {
  // Calculate total correct ratio for reference
  const totalResponses = studentResponses.length;
  const totalCorrect = studentResponses.filter(r => r && r.toLowerCase().includes('đúng')).length;
  const correctRatio = totalResponses > 0 ? ((totalCorrect / totalResponses) * 100).toFixed(1) : 0;
  
  return `Bạn là một giáo viên toán học giỏi đang đánh giá kỹ năng giải quyết vấn đề của một học sinh lớp 5 theo khung đánh giá chi tiết sau:

KHUNG ĐÁNH GIÁ NĂN LỰC - ĐIỂM SỐ CHI TIẾT:

TC1. Nhận biết được vấn đề cần giải quyết (tối đa 2 điểm):
  • Cần cố gắng (0 điểm): Không xác định được đầy đủ dữ kiện, yêu cầu bài toán (làm sai > 50% câu)
  • Đạt (1 điểm): Xác định đầy đủ dữ kiện và yêu cầu bài toán (làm đúng 50-80% câu)
  • Tốt (2 điểm): Xác định chính xác dữ kiện, yêu cầu và mối quan hệ giữa chúng (làm đúng > 80% câu)

TC2. Nêu được cách thức GQVĐ (tối đa 2 điểm):
  • Cần cố gắng (0 điểm): Không nhận dạng dạng toán hoặc đề xuất cách giải sai (làm sai > 50% câu)
  • Đạt (1 điểm): Nhận dạng được dạng toán, đề xuất cách giải phù hợp, lựa chọn phép toán cơ bản (làm đúng 50-80% câu)
  • Tốt (2 điểm): Nhận dạng chính xác, đề xuất nhiều cách giải, lựa chọn chiến lược tối ưu (làm đúng > 80% câu)

TC3. Trình bày được cách thức GQVĐ (tối đa 2 điểm):
  • Cần cố gắng (0 điểm): Thực hiện sai toàn bộ phép tính hoặc bước giải (làm sai > 50% câu)
  • Đạt (1 điểm): Thực hiện đúng các bước giải và phép tính cơ bản (làm đúng 50-80% câu)
  • Tốt (2 điểm): Thực hiện đúng và đầy đủ các phép tính, trình bày rõ ràng (làm đúng > 80% câu)

TC4. Kiểm tra được giải pháp đã thực hiện (tối đa 2 điểm):
  • Cần cố gắng (0 điểm): Không kiểm tra hoặc kiểm tra sai (làm sai > 50% câu)
  • Đạt (1 điểm): Kiểm tra lại kết quả, vận dụng được vào bài toán tương tự (làm đúng 50-80% câu)
  • Tốt (2 điểm): Kiểm tra bằng nhiều cách, vận dụng vào bài toán nâng cao (làm đúng > 80% câu)

---

BÀI TOÁN: ${problemStatement}

THỐNG KÊ HỌC SINH: ${totalCorrect}/${totalResponses} câu đúng (${correctRatio}%)

CÁC PHẢN HỒI CỦA HỌC SINH - PHÂN TÍCH TỪ TỪNG CÂU:
${studentResponses.map((response, index) => 
  `Câu ${index + 1}: ${response}`
).join('\n')}

---

HƯỚNG DẪN ĐÁNH GIÁ (BẮT BUỘC TUÂN THỦ):

**BƯỚC 1: PHÂN TÍCH TỪNG PHẢN HỒI RIÊNG BIỆT**
- Phải xem xét ĐẦY ĐỦ TẤT CẢ ${totalResponses} câu trả lời
- Không được chỉ nhìn bài 1 mà bỏ sót bài 2, 3, ...
- Mô tả chi tiết từng câu: đúng hay sai, lý do là gì

**BƯỚC 2: TÍNH TỈ LỆ ĐỀU**
- Đã làm đúng ${correctRatio}% câu
- Nếu >= 80%: CÓ THỂ xem xét điểm 2 cho tiêu chí tương ứng
- Nếu 50-80%: XEM XÉT điểm 1 cho tiêu chí tương ứng
- Nếu < 50%: PHẢI là điểm 0 cho tiêu chí tương ứng (không có ngoại lệ)
- NGUYÊN TẮC: Tỉ lệ < 50% KHÔNG THỂ bao giờ đạt mức "Đạt" hoặc "Tốt"

**BƯỚC 3: VIẾT NHẬN XÉT CHI TIẾT**
- Phải nhắc đến CHI TIẾT từng câu (Câu 1 ntn, Câu 2 ntn, ...)
- Không được tổng quát hóa mà bỏ sót câu nào
- Đưa cụ thể ví dụ: "Câu 1 học sinh làm đúng vì..., Câu 2 làm sai vì..."
- Viết 150-200 từ cho mỗi tiêu chí

**BƯỚC 4: TÍNH TỔNG ĐIỂM**
- totalScore = TC1 + TC2 + TC3 + TC4
- Phải nằm trong khoảng 0-8

**RÀNG BUỘC LOGIC (BẮT BUỘC):**
- Nếu học sinh làm sai > 50% (< 50% đúng): KHÔNG THỂ là mức "Đạt" hay "Tốt"
- Nếu học sinh làm đúng 50-80%: KHÔNG THỂ là mức "Tốt", tối đa là "Đạt"
- Nếu học sinh làm đúng >= 80%: CÓ THỂ là "Tốt"
- Không tiền lệ, không ngoại lệ - áp dụng chế độ này cho TẤT CẢ tiêu chí

ĐỊNH DẠNG JSON PHẢN HỒI:
{
  "TC1": {
    "level": "Cần cố gắng|Đạt|Tốt",
    "score": 0hoặc1hoặc2,
    "nhanXet": "Phân tích chi tiết từng câu (Câu 1: ..., Câu 2: ..., Câu 3: ..., v.v.) - 150-200 từ"
  },
  "TC2": {
    "level": "Cần cố gắng|Đạt|Tốt",
    "score": 0hoặc1hoặc2,
    "nhanXet": "Phân tích chi tiết từng câu (Câu 1: ..., Câu 2: ..., Câu 3: ..., v.v.) - 150-200 từ"
  },
  "TC3": {
    "level": "Cần cố gắng|Đạt|Tốt",
    "score": 0hoặc1hoặc2,
    "nhanXet": "Phân tích chi tiết từng câu (Câu 1: ..., Câu 2: ..., Câu 3: ..., v.v.) - 150-200 từ"
  },
  "TC4": {
    "level": "Cần cố gắng|Đạt|Tốt",
    "score": 0hoặc1hoặc2,
    "nhanXet": "Phân tích chi tiết từng câu (Câu 1: ..., Câu 2: ..., Câu 3: ..., v.v.) - 150-200 từ"
  },
  "totalScore": 0đến8,
  "tongNhanXet": "Nhận xét tổng thể (3-4 câu)"
}

QUAN TRỌNG:
- Trả lời JSON hợp lệ, không có ký tự đặc biệt trong nhanXet
- PHẢI nhắc đến từng câu cụ thể trong nhận xét
- KHÔNG được bỏ sót bài nào
- PHẢI tuân thủ ràng buộc logic về tỉ lệ đúng/sai
- Viết toàn bộ bằng tiếng Việt`;
};


/**
 * Normalize level name to standard format (handles both English and Vietnamese)
 * @param {string} levelName - Level name (English or Vietnamese)
 * @returns {string} - Normalized level ('need_effort', 'achieved', 'good')
 */
export const normalizeLevelName = (levelName) => {
  if (!levelName) return 'achieved';
  
  const normalized = levelName.toLowerCase().trim();
  
  // English levels
  if (normalized.includes('good') || normalized.includes('excellent')) {
    return 'good';
  } else if (normalized.includes('achieved') || normalized.includes('pass') || normalized.includes('basic')) {
    return 'achieved';
  } else if (normalized.includes('need_effort') || normalized.includes('needs effort') || normalized.includes('limited')) {
    return 'need_effort';
  }
  
  // Vietnamese levels
  if (normalized.includes('tốt') || normalized.includes('xuất sắc') || normalized.includes('rất tốt')) {
    return 'good';
  } else if (normalized.includes('đạt') || normalized.includes('khá')) {
    return 'achieved';
  } else if (normalized.includes('cần cố gắng') || normalized.includes('chưa') || normalized.includes('sai')) {
    return 'need_effort';
  }
  
  return 'achieved'; // Default
};

/**
 * Convert normalized level to score
 * @param {string} level - Normalized level ('need_effort', 'achieved', 'good')
 * @returns {number} - Score (0, 1, or 2)
 */
export const getLevelScore = (level) => {
  return COMPETENCY_LEVELS[level]?.score || COMPETENCY_LEVELS.achieved.score;
};

/**
 * Get overall competency level based on total score
 * @param {number} totalScore - Total competency score (0-8)
 * @returns {string} - Competency level ('need_effort', 'achieved', 'good')
 */
export const getOverallCompetencyLevel = (totalScore) => {
  if (totalScore <= 3) return 'need_effort';
  if (totalScore <= 6) return 'achieved';
  return 'good';
};

/**
 * Validate competency score logic to ensure consistency
 * @param {Object} evaluation - Parsed competency evaluation
 * @param {number} correctCount - Number of correct responses
 * @param {number} totalCount - Total number of responses
 * @returns {Object} - Validation result with warnings if any
 */
export const validateCompetencyScore = (evaluation, correctCount, totalCount) => {
  const correctRatio = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
  const warnings = [];

  // Check each criterion
  const criteria = ['TC1', 'TC2', 'TC3', 'TC4'];
  
  criteria.forEach(tc => {
    const criterion = evaluation[tc];
    if (!criterion) return;

    // Logic checks based on correct ratio
    if (correctRatio < 50) {
      // < 50% correct: Cannot be "achieved" or "good"
      if (criterion.level !== 'need_effort' || criterion.score !== 0) {
        warnings.push(`${tc}: Với tỉ lệ ${correctRatio.toFixed(1)}% (< 50%), ${tc} phải là "Cần cố gắng" (0 điểm), nhưng hiện là "${criterion.level}" (${criterion.score} điểm)`);
      }
    } else if (correctRatio < 80) {
      // 50-80% correct: Can be "achieved" (1) but NOT "good" (2)
      if (criterion.level === 'good' || criterion.score === 2) {
        warnings.push(`${tc}: Với tỉ lệ ${correctRatio.toFixed(1)}% (50-80%), ${tc} tối đa là "Đạt" (1 điểm), không thể là "Tốt" (2 điểm)`);
      }
    }
    // >= 80% can be any level (0, 1, or 2)
  });

  return {
    isValid: warnings.length === 0,
    correctRatio: correctRatio.toFixed(1),
    warnings: warnings,
    summary: warnings.length === 0 
      ? `✓ Đánh giá hợp lý với tỉ lệ ${correctRatio.toFixed(1)}% bài làm đúng`
      : `⚠ Có ${warnings.length} điểm cần kiểm tra lại`
  };
};

export const createEmptyEvaluation = () => {
  return {
    TC1: {
      level: null,
      score: 0,
      comment: ''
    },
    TC2: {
      level: null,
      score: 0,
      comment: ''
    },
    TC3: {
      level: null,
      score: 0,
      comment: ''
    },
    TC4: {
      level: null,
      score: 0,
      comment: ''
    },
    totalCompetencyScore: 0
};
}
const competencyEvaluationService = {
  parseCompetencyEvaluation,
  generateCompetencyEvaluationPrompt,
  normalizeLevelName,
  getLevelScore,
  getOverallCompetencyLevel,
  validateCompetencyScore,
  createEmptyEvaluation,
  COMPETENCY_LEVELS,
  OVERALL_COMPETENCY_LEVELS,
  COMPETENCY_CRITERIA
};

export default competencyEvaluationService;
