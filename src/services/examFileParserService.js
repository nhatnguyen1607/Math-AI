/**
 * Service to handle exam file parsing
 * Calls Python script to parse Word/PDF files and returns JSON structure
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Parse exam file (Word or PDF) and return exercises/questions structure
 * @param {string} filePath - Path to the uploaded file
 * @returns {Promise<Object>} - Parsed exercises structure or error
 */
export async function parseExamFile(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // Determine path to Python script
      const scriptPath = path.join(process.cwd(), 'scripts', 'parse_exam_file.py');
      
      // Check if Python script exists
      if (!fs.existsSync(scriptPath)) {
        return reject(new Error(`Python script not found at ${scriptPath}`));
      }

      // Spawn Python process
      const pythonProcess = spawn('python', [scriptPath, filePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000 // 30 second timeout
      });

      let output = '';
      let errorOutput = '';

      // Collect stdout
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Collect stderr
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Python script failed: ${errorOutput || 'Unknown error'}`));
        }

        try {
          const result = JSON.parse(output);
          if (result.error) {
            return reject(new Error(result.error));
          }
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse Python output: ${parseError.message}`));
        }
      });

      // Handle process errors
      pythonProcess.on('error', (err) => {
        reject(new Error(`Failed to spawn Python process: ${err.message}`));
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validate and clean parsed exercises data
 * @param {Object} exercises - Raw parsed exercises
 * @returns {Object} - Cleaned exercises with proper structure
 */
export function validateExercises(exercises) {
  if (!Array.isArray(exercises)) {
    throw new Error('Exercises must be an array');
  }

  return exercises.map((exercise, idx) => ({
    name: exercise.name || `Bài tập ${idx + 1}`,
    duration: exercise.duration || (idx === 0 ? 120 : 300),
    context: exercise.context || '',
    questions: Array.isArray(exercise.questions)
      ? exercise.questions.map((q, qIdx) => ({
          id: q.id || `q_${qIdx}`,
          question: q.question || '',
          type: q.type || 'single',
          options: Array.isArray(q.options) ? q.options : [],
          correctAnswers: Array.isArray(q.correctAnswers) ? q.correctAnswers : [0],
          explanation: q.explanation || ''
        }))
      : [],
    scoring: exercise.scoring || {
      correct: 12,
      incorrect: 2,
      bonus: 4,
      bonusTimeThreshold: idx === 0 ? 60 : 240
    }
  }));
}

/**
 * Clean up temporary uploaded file
 * @param {string} filePath - Path to file to delete
 */
export function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
  }
}
