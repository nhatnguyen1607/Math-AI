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
      TC1: { level: 'achieved', score: 1, comment: '' },
      TC2: { level: 'achieved', score: 1, comment: '' },
      TC3: { level: 'achieved', score: 1, comment: '' },
      TC4: { level: 'achieved', score: 1, comment: '' },
      totalCompetencyScore: 4
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
        comment: raw.TC1?.comment || ''
      },
      TC2: {
        level: normalizeLevelName(raw.TC2?.level || 'Đạt'),
        score: tc2Score,
        comment: raw.TC2?.comment || ''
      },
      TC3: {
        level: normalizeLevelName(raw.TC3?.level || 'Đạt'),
        score: tc3Score,
        comment: raw.TC3?.comment || ''
      },
      TC4: {
        level: normalizeLevelName(raw.TC4?.level || 'Đạt'),
        score: tc4Score,
        comment: raw.TC4?.comment || ''
      },
      totalCompetencyScore: raw.totalScore || (tc1Score + tc2Score + tc3Score + tc4Score)
    };

    console.log('✅ Parsed competency evaluation:', {
      TC1: evaluation.TC1.score,
      TC2: evaluation.TC2.score,
      TC3: evaluation.TC3.score,
      TC4: evaluation.TC4.score,
      total: evaluation.totalCompetencyScore
    });

    return evaluation;
  } catch (error) {
    console.error('Error parsing competency evaluation:', error);
    // Return default if parsing fails
    return {
      TC1: { level: 'achieved', score: 1, comment: 'Không thể phân tích' },
      TC2: { level: 'achieved', score: 1, comment: 'Không thể phân tích' },
      TC3: { level: 'achieved', score: 1, comment: 'Không thể phân tích' },
      TC4: { level: 'achieved', score: 1, comment: 'Không thể phân tích' },
      totalCompetencyScore: 4
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
  return `Bạn là một giáo viên toán học giỏi đang đánh giá kỹ năng giải quyết vấn đề của một học sinh lớp 5 theo khung đánh giá chi tiết sau:

KHUNG ĐÁNH GIÁ NĂN LỰC - ĐIỂM SỐ CHI TIẾT:

TC1. Nhận biết được vấn đề cần giải quyết (tối đa 2 điểm):
  • Cần cố gắng (0 điểm): Không xác định được đầy đủ dữ kiện, yêu cầu bài toán
  • Đạt (1 điểm): Xác định đầy đủ dữ kiện và yêu cầu bài toán
  • Tốt (2 điểm): Xác định chính xác dữ kiện, yêu cầu và mối quan hệ giữa chúng

TC2. Nêu được cách thức GQVĐ - ĐỌC CHỈ TIÊU CHI TIẾT HƯỚNG DẪN NÀY:
  Mức "Cần cố gắng" (0 điểm):
    - Không nhận dạng được dạng toán học (0 điểm)
    - Không đề xuất được cách giải (0 điểm)
    - Không lựa chọn được phép toán phù hợp (0 điểm)
  Mức "Đạt" (tính tổng = 1.0 điểm):
    - Nhận dạng được dạng toán đã học (0.3 điểm)
    - Đề xuất được một cách giải phù hợp (0.3 điểm)
    - Lựa chọn phép toán/công thức cơ bản phù hợp (0.4 điểm)
  Mức "Tốt" (tính tổng = 2.0 điểm):
    - Nhận dạng đúng dạng toán, áp dụng vào bài toán tương tự (0.6 điểm)
    - Đề xuất được các cách giải khác nhau (0.7 điểm)
    - Lựa chọn chiến lược giải quyết vấn đề tối ưu (0.7 điểm)

TC3. Trình bày được cách thức GQVĐ (tối đa 2 điểm):
  • Cần cố gắng (0 điểm): Thực hiện sai toàn bộ phép tính hoặc bước giải
  • Đạt (1 điểm): Thực hiện đúng các bước giải và phép tính cơ bản
  • Tốt (2 điểm): Thực hiện đúng và đầy đủ các phép tính với nhiều cách giải khác nhau

TC4. Kiểm tra được giải pháp đã thực hiện - ĐỌC CHỈ TIÊU CHI TIẾT HƯỚNG DẪN NÀY:
  Mức "Cần cố gắng" (0 điểm):
    - Không kiểm tra lại kết quả hoặc kiểm tra sai (0 điểm)
    - Không vận dụng được vào bài toán tương tự (0 điểm)
  Mức "Đạt" (tính tổng = 1.0 điểm):
    - Kiểm tra lại kết quả và điều chỉnh đúng (0.5 điểm)
    - Vận dụng được vào bài toán tương tự (0.5 điểm)
  Mức "Tốt" (tính tổng = 2.0 điểm):
    - Kiểm tra lại kết quả bằng các cách khác nhau (1 điểm)
    - Vận dụng được vào bài toán ở mức độ mở rộng, nâng cao hơn (1 điểm)

---

BÀI TOÁN: ${problemStatement}

CÁC PHẢN HỒI CỦA HỌC SINH:
${studentResponses.map((response, index) => 
  `Câu trả lời ${index + 1}: ${response}`
).join('\n')}

---

HƯỚNG DẪN ĐÁNH GIÁ:
1. Phân tích chi tiết từng tiêu chí (TC1-4) dựa vào phản hồi của học sinh
2. Dùng chi tiết hướng dẫn điểm số ở trên để gán điểm chính xác
3. GHI CHÚ: TC1, TC3 là 0/1/2 đơn giản. Nhưng TC2, TC4 có thành phần nhỏ, cộng lại mới bằng 0/1/2
4. Viết nhận xét CHI TIẾT, CÓ Ý NGHĨA, CHỈ DÙNG TIẾNG VIỆT (không tiếng Anh)
5. Tính totalScore = TC1 + TC2 + TC3 + TC4, tối đa 8 điểm

ĐỊNH DẠNG JSON PHẢN HỒI (CẬP NHẬT VÀ TRẢ LỜI):
{
  "TC1": {
    "level": "Cần cố gắng|Đạt|Tốt",
    "score": 0hoặc1hoặc2,
    "comment": "Nhận xét chi tiết bằng tiếng Việt về nhận biết vấn đề (ghi những chi tiết cụ thể học sinh làm đúng/sai)"
  },
  "TC2": {
    "level": "Cần cố gắng|Đạt|Tốt",
    "score": 0hoặc1hoặc2,
    "comment": "Nhận xét chi tiết bằng tiếng Việt về cách thức giải (ghi nhận dạng, đề xuất, lựa chọn phép toán)"
  },
  "TC3": {
    "level": "Cần cố gắng|Đạt|Tốt",
    "score": 0hoặc1hoặc2,
    "comment": "Nhận xét chi tiết bằng tiếng Việt về trình bày (ghi về các bước, phép tính)"
  },
  "TC4": {
    "level": "Cần cố gắng|Đạt|Tốt",
    "score": 0hoặc1hoặc2,
    "comment": "Nhận xét chi tiết bằng tiếng Việt về kiểm tra (ghi về kiểm tra lại, vận dụng)"
  },
  "totalScore": 0đếnđến8
}

QUAN TRỌNG: Phải trả lời bằng JSON hợp lệ, không có comment dài quá 150 ký tự.`;
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
 * Create initial empty competency evaluation
 * @returns {Object} - Empty competency evaluation structure
 */
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
};

const competencyEvaluationService = {
  parseCompetencyEvaluation,
  generateCompetencyEvaluationPrompt,
  normalizeLevelName,
  getLevelScore,
  getOverallCompetencyLevel,
  createEmptyEvaluation,
  COMPETENCY_LEVELS,
  OVERALL_COMPETENCY_LEVELS,
  COMPETENCY_CRITERIA
};

export default competencyEvaluationService;
