/**
 * Service to parse exam files (Word .docx only) in the browser
 * Uses mammoth for DOCX parsing
 * No server or Python needed - everything runs in browser
 */

import * as mammoth from 'mammoth';

/**
 * Parse Word (.docx) file
 * @param {File} file - The uploaded file
 * @returns {Promise<string>} - Extracted text
 */
async function parseDocx(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    throw new Error(`Lỗi khi parse Word file: ${error.message}`);
  }
}

/**
 * Extract exam structure from parsed text
 * Handles context, questions, options, explanations and exercise switching
 */
function extractExamStructure(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  const exercises = [
    {
      name: 'Bài tập 1 - BT vận dụng, ứng dụng',
      duration: 120,
      context: '',
      questions: [],
      scoring: {
        correct: 12,
        incorrect: 2,
        bonus: 4,
        bonusTimeThreshold: 60
      }
    },
    {
      name: 'Bài tập 2 - BT GQVĐ',
      duration: 300,
      context: '',
      questions: [],
      scoring: {
        correct: 12,
        incorrect: 2,
        bonus: 4,
        bonusTimeThreshold: 240
      }
    }
  ];

  let currentExerciseIdx = 0;
  let currentQuestion = null;
  let currentOptions = [];
  let correctAnswerIdx = 0;
  let questionCounter = 0;
  let contextBuffer = []; // Store context lines before first question
  let questionBuffer = ''; // For multi-line questions
  let explanationBuffer = ''; // For explanations
  let collectedOptionsCount = 0;
  let firstQuestionInExercise = false;

  const saveQuestion = () => {
    if (currentQuestion !== null && currentOptions.length > 0) {
      currentQuestion.options = currentOptions;
      currentQuestion.correctAnswers = [correctAnswerIdx];
      currentQuestion.explanation = explanationBuffer.trim();
      exercises[currentExerciseIdx].questions.push(currentQuestion);
      questionCounter++;
    }
  };

  const saveContext = () => {
    // Save context if not done yet and have context buffer
    if (!firstQuestionInExercise && contextBuffer.length > 0) {
      exercises[currentExerciseIdx].context = contextBuffer.join('\n').trim();
      firstQuestionInExercise = true;
      contextBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Check if switching to new exercise (Bài 2 / Bài tập 2)
    const exerciseMatch = line.match(/^\s*(BÀI\s+2|Bài\s+tập\s+2|BÀITẬP\s+2|BT\s+2)\s*:(.*)/i);
    if (exerciseMatch) {
      saveQuestion(); // Save previous question before switching
      saveContext(); // Save previous exercise's context
      currentExerciseIdx = 1;
      currentQuestion = null;
      currentOptions = [];
      collectedOptionsCount = 0;
      firstQuestionInExercise = false;
      contextBuffer = [];
      explanationBuffer = '';
      
      // Add context from exercise marker line (text after colon)
      const contextText = exerciseMatch[2].trim();
      if (contextText) {
        contextBuffer.push(contextText);
      }
      continue;
    }

    // 2. Check if this is a question line (starts with number and period/paren)
    // Allow 0 or more spaces after period/paren
    const questionMatch = line.match(/^\d+[.)]\s*(.*)/);
    
    if (questionMatch) {
      // Save previous question if it has options collected
      if (currentQuestion !== null && collectedOptionsCount > 0) {
        saveQuestion();
      }
      
      // Save context before creating new question (for first question in exercise)
      saveContext();
      
      // Create new question
      questionBuffer = questionMatch[1];
      currentQuestion = {
        id: `q_${questionCounter}`,
        question: questionBuffer,
        type: 'single',
        options: [],
        correctAnswers: [0],
        explanation: ''
      };
      currentOptions = [];
      correctAnswerIdx = 0;
      collectedOptionsCount = 0;
      explanationBuffer = '';
    }
    // 3. Check if this is an option (A., B., C., D., etc.)
    // Allow 0 or more spaces after bracket
    else if (line && /^[A-D][.)]\s*/.test(line) && currentQuestion !== null && collectedOptionsCount < 4) {
      let optionText = line.replace(/^[A-D][.)]\s*/, '');
      
      // Check if marked as correct with **
      const isCorrect = optionText.includes('**');
      optionText = optionText.replace(/\*\*/g, '').trim();

      if (isCorrect) {
        correctAnswerIdx = collectedOptionsCount;
      }

      currentOptions.push(optionText);
      collectedOptionsCount++;
    }
    // 4. Other lines - check for embedded question in explanation
    else if (line) {
      // Check if explanation line contains new question embedded (e.g., "...đề) 3. Question")
      if (currentQuestion !== null && collectedOptionsCount === 4) {
        // Look for pattern ") \d+[.)]" which indicates new question in explanation
        const embeddedQuestionMatch = line.match(/^(.*?)\)\s+(\d+[.)]\s*.*)/);
        if (embeddedQuestionMatch) {
          // Save the explanation part before the question
          const explanationPart = embeddedQuestionMatch[1].trim();
          if (explanationPart) {
            if (explanationBuffer) {
              explanationBuffer += '\n' + explanationPart;
            } else {
              explanationBuffer = explanationPart;
            }
          }
          // Process the question part recursively
          const questionPart = embeddedQuestionMatch[2];
          // Save current and start new question
          saveQuestion();
          
          const newQuestionMatch = questionPart.match(/^(\d+[.)]\s*)(.*)/);
          if (newQuestionMatch) {
            questionBuffer = newQuestionMatch[2];
            currentQuestion = {
              id: `q_${questionCounter}`,
              question: questionBuffer,
              type: 'single',
              options: [],
              correctAnswers: [0],
              explanation: ''
            };
            currentOptions = [];
            correctAnswerIdx = 0;
            collectedOptionsCount = 0;
            explanationBuffer = '';
          }
          continue;
        }
        // Normal explanation line
        if (explanationBuffer) {
          explanationBuffer += '\n' + line;
        } else {
          explanationBuffer = line;
        }
      }
      // If no current question yet → this is context
      else if (currentQuestion === null && !firstQuestionInExercise) {
        contextBuffer.push(line);
      }
      // If question exists but no options yet → multi-line question
      else if (currentQuestion !== null && collectedOptionsCount === 0) {
        // Add to question if not an exercise marker
        if (!line.match(/^\s*(BÀI\s+2|Bài\s+tập\s+2|BÀITẬP\s+2|BT\s+2)/i)) {
          questionBuffer += ' ' + line;
          currentQuestion.question = questionBuffer;
        }
      }
    }
  }

  // Save last question and context
  saveQuestion();
  saveContext();

  return exercises;
}

/**
 * Main function to parse exam file
 * @param {File} file - The uploaded file
 * @returns {Promise<Object>} - Parsed exercises or error
 */
export async function parseExamFile(file) {
  try {
    // Validate file type - Word only
    const validTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Chỉ hỗ trợ file Word (.docx)');
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File quá lớn (tối đa 10MB)');
    }

    // Parse Word file
    const text = await parseDocx(file);

    if (!text) {
      throw new Error('Không thể trích xuất text từ file');
    }

    // Extract exam structure
    const exercises = extractExamStructure(text);

    // Validate that we got some questions
    const totalQuestions = exercises.reduce((sum, ex) => sum + ex.questions.length, 0);
    if (totalQuestions === 0) {
      throw new Error('Không tìm thấy câu hỏi nào. Kiểm tra lại format file Word');
    }

    return {
      success: true,
      exercises: exercises,
      totalQuestions: totalQuestions
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Lỗi không xác định khi parse file'
    };
  }
}

const fileParserService = { parseExamFile };
export default fileParserService;
