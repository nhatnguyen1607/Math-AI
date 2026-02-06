/**
 * Scoring Service
 * Tính điểm dựa trên exercise type và tốc độ trả lời
 * 
 * Bài 1: Single choice (90s)
 *   - Đúng: 30 điểm
 *   - Sai: 5 điểm
 *   - Nhanh < 30s: +10 điểm
 * 
 * Bài 2: Multiple choice (120s)
 *   - Mỗi ý: Đúng 12 điểm, Sai 2 điểm
 *   - Nhanh < 60s: +4 điểm
 * 
 * Bài 3: Multiple choice (150s)
 *   - Mỗi ý: Đúng 12 điểm, Sai 2 điểm
 *   - Nhanh < 90s: +4 điểm
 */

/**
 * Lấy scoring config dựa trên exercise index
 * @param {number} exerciseIndex - Index của exercise (0, 1, 2)
 * @returns {Object} - Scoring configuration
 */
export const getScoringConfig = (exerciseIndex) => {
  const configs = [
    {
      // Bài 1: Single choice
      type: 'single',
      correctPoints: 30,
      incorrectPoints: 5,
      bonusThreshold: 30, // seconds
      bonusPoints: 10,
      name: 'Bài 1 - Cơ bản'
    },
    {
      // Bài 2: Multiple choice
      type: 'multiple',
      correctPoints: 12,
      incorrectPoints: 2,
      bonusThreshold: 60, // seconds
      bonusPoints: 4,
      name: 'Bài 2 - Vận dụng'
    },
    {
      // Bài 3: Multiple choice
      type: 'multiple',
      correctPoints: 12,
      incorrectPoints: 2,
      bonusThreshold: 90, // seconds
      bonusPoints: 4,
      name: 'Bài 3 - GQVĐ'
    }
  ];

  return configs[exerciseIndex] || configs[0];
};

/**
 * Tính điểm cho một câu hỏi
 * @param {number} exerciseIndex - Index của exercise
 * @param {boolean} isCorrect - Câu trả lời có đúng không
 * @param {number} timeUsed - Thời gian trả lời (seconds)
 * @returns {Object} - { basePoints, bonusPoints, totalPoints }
 */
export const calculateQuestionScore = (exerciseIndex, isCorrect, timeUsed = 0) => {
  const config = getScoringConfig(exerciseIndex);

  let basePoints = isCorrect ? config.correctPoints : config.incorrectPoints;
  let bonusPoints = 0;

  // Kiểm tra bonus (nhanh)
  if (isCorrect && timeUsed > 0 && timeUsed < config.bonusThreshold) {
    bonusPoints = config.bonusPoints;
  }

  const totalPoints = basePoints + bonusPoints;

  return {
    basePoints,
    bonusPoints,
    totalPoints,
    config
  };
};

/**
 * Tính tổng điểm cho một exam session
 * @param {Array} answers - Mảng các câu trả lời của học sinh
 * @param {Array} questions - Mảng các câu hỏi (để biết exercise index)
 * @returns {Object} - { totalScore, breakdown: Array }
 */
export const calculateTotalScore = (answers, questions) => {
  if (!answers || !questions) {
    return { totalScore: 0, breakdown: [] };
  }

  const breakdown = [];
  let totalScore = 0;

  questions.forEach((question, index) => {
    const answerData = answers[index];
    if (answerData) {
      const exerciseIndex = question.exerciseIndex || 0;
      const score = calculateQuestionScore(
        exerciseIndex,
        answerData.isCorrect,
        answerData.timeUsed
      );

      breakdown.push({
        questionIndex: index,
        exerciseIndex,
        isCorrect: answerData.isCorrect,
        timeUsed: answerData.timeUsed,
        ...score
      });

      totalScore += score.totalPoints;
    }
  });

  return {
    totalScore: Math.max(0, totalScore),
    breakdown
  };
};

/**
 * Tính điểm phần trăm
 * @param {number} totalScore - Tổng điểm thô
 * @param {number} maxScore - Điểm tối đa có thể
 * @returns {number} - Điểm phần trăm (0-100)
 */
export const calculatePercentageScore = (totalScore, maxScore = 0) => {
  if (maxScore === 0) {
    // Ước tính: 11 câu hỏi
    // Bài 1: 1 câu = 40 điểm (30 base + 10 bonus)
    // Bài 2: 5 câu = 70 điểm/câu = 350 điểm (60 base + 20 bonus)
    // Bài 3: 5 câu = 70 điểm/câu = 350 điểm (60 base + 20 bonus)
    // Tổng max: 40 + 350 + 350 = 740 điểm
    maxScore = 740;
  }

  if (maxScore === 0) return 0;
  return Math.min(100, Math.round((totalScore / maxScore) * 100));
};

const scoringService = {
  getScoringConfig,
  calculateQuestionScore,
  calculateTotalScore,
  calculatePercentageScore
};

export default scoringService;
