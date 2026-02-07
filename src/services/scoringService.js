/**
 * Scoring Service
 * Tính điểm dựa trên exercise type và tốc độ trả lời
 * 
 * Bài 1: BT vận dụng, ứng dụng (120s)
 *   - Mỗi ý: Đúng 12 điểm, Sai 2 điểm
 *   - Nhanh < 60s: +4 điểm
 * 
 * Bài 2: BT GQVĐ (300s)
 *   - Mỗi ý: Đúng 12 điểm, Sai 2 điểm
 *   - Nhanh < 240s: +4 điểm
 */

/**
 * Lấy scoring config dựa trên exercise index
 * @param {number} exerciseIndex - Index của exercise (0, 1)
 * @returns {Object} - Scoring configuration
 */
export const getScoringConfig = (exerciseIndex) => {
  const configs = [
    {
      // Bài 1: BT vận dụng, ứng dụng
      type: 'multiple',
      correctPoints: 12,
      incorrectPoints: 2,
      bonusThreshold: 60, // seconds (1 phút)
      bonusPoints: 4,
      name: 'Bài 1 - BT vận dụng, ứng dụng'
    },
    {
      // Bài 2: BT GQVĐ
      type: 'multiple',
      correctPoints: 12,
      incorrectPoints: 2,
      bonusThreshold: 240, // seconds (4 phút)
      bonusPoints: 4,
      name: 'Bài 2 - BT GQVĐ'
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
    // Ước tính: 8-10 câu hỏi
    // Bài 1: 4 câu @ 12 điểm = 48 điểm (có thể +4 bonus)
    // Bài 2: 4-6 câu @ 12 điểm = 48-72 điểm (có thể +4 bonus)
    // Tổng max: ~100-200 điểm (base) + bonuses
    maxScore = 200; // Giá trị ước tính chung
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
