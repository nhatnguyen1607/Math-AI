import React, { useState, useCallback } from 'react';
import RobotCompanion from '../../components/common/RobotCompanion';

const StudentPracticePageExample = () => {
  // Robot state management
  const [robotStatus, setRobotStatus] = useState('idle');
  const [robotMessage, setRobotMessage] = useState('👋 Hello! I\'m your practice companion. Let\'s solve some problems!');

  // Practice state
  const [currentProblem] = useState({
    id: 1,
    question: 'Solve: 2x + 5 = 15',
    correctAnswer: 5,
  });
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  // Helper function to update robot with timeout
  const updateRobotWithReset = useCallback((status, message, resetAfterMs = 3000) => {
    setRobotStatus(status);
    setRobotMessage(message);

    if (resetAfterMs > 0) {
      setTimeout(() => {
        setRobotStatus('idle');
        setRobotMessage('Ready for the next problem?');
      }, resetAfterMs);
    }
  }, []);

  // Handle answer submission
  const handleSubmitAnswer = useCallback(async () => {
    if (!userAnswer.trim()) {
      updateRobotWithReset(
        'wrong',
        '❌ Please enter an answer first!',
        2000
      );
      return;
    }

    // Show thinking state
    setRobotStatus('thinking');
    setRobotMessage('Analyzing your answer...');

    // Simulate API call
    setTimeout(() => {
      // Logic kiểm tra đơn giản (demo)
      const isCorrect = parseInt(userAnswer) === currentProblem.correctAnswer;

      if (isCorrect) {
        // Correct answer
        updateRobotWithReset(
          'correct',
          '🎉 Brilliant! You solved it correctly! x = 5 ✓',
          4000
        );
        setShowFeedback(true);
      } else {
        // Wrong answer
        updateRobotWithReset(
          'wrong',
          `❌ Not quite right. The correct answer is ${currentProblem.correctAnswer}. Try breaking it down step by step!`,
          4000
        );
        setShowFeedback(true);
      }
    }, 1500);
  }, [userAnswer, currentProblem, updateRobotWithReset]);

  // Handle hint request
  const handleHint = useCallback(() => {
    updateRobotWithReset(
      'thinking',
      '💡 Hint: First, subtract 5 from both sides of the equation!',
      3000
    );
  }, [updateRobotWithReset]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* DESKTOP: Split screen layout */}
        <div className="hidden lg:flex gap-6">
          
          {/* Main Content Area - 72% */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-8">Practice Problems</h1>

              {/* Problem Section */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">📊</div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Problem 1</h2>
                    <p className="text-lg text-gray-700 font-mono bg-white p-4 rounded border-2 border-gray-200">
                      {currentProblem.question}
                    </p>
                  </div>
                </div>
              </div>

              {/* Input Section */}
              <div className="space-y-4 mb-8">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-700 mb-2 block">Your Answer:</span>
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                    placeholder="Type your answer..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mb-8">
                <button
                  onClick={handleSubmitAnswer}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Submit Answer
                </button>
                <button
                  onClick={handleHint}
                  className="px-6 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
                >
                  💡 Get Hint
                </button>
              </div>

              {/* Feedback Section */}
              {showFeedback && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-blue-800 font-semibold">Solution Explanation:</p>
                  <p className="text-blue-700 mt-2">
                    2x + 5 = 15<br/>
                    2x = 15 - 5<br/>
                    2x = 10<br/>
                    x = 5
                  </p>
                </div>
              )}

              {/* Problem List */}
              <div className="mt-12 pt-8 border-t-2 border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4">More Practice Problems:</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      className="p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-left"
                    >
                      <div className="font-semibold text-gray-800">Problem {num}</div>
                      <div className="text-sm text-gray-600">Algebra Level 1</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Robot Sidebar - 28%, sticky */}
          <div className="w-1/4">
            <div className="sticky top-8">
              <RobotCompanion
                status={robotStatus}
                message={robotMessage}
              />

              {/* Robot Tips Panel */}
              <div className="mt-4 bg-white rounded-lg shadow-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-xl">💡</span> Problem-Solving Tips
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="text-purple-500 font-bold">1.</span>
                    <span>Read the problem carefully</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-500 font-bold">2.</span>
                    <span>Identify what you know</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-500 font-bold">3.</span>
                    <span>Choose a strategy</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-500 font-bold">4.</span>
                    <span>Solve step by step</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-500 font-bold">5.</span>
                    <span>Check your answer</span>
                  </li>
                </ul>
              </div>

              {/* Progress Stats */}
              <div className="mt-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3">Your Progress</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Correct: <span className="font-bold text-green-600">7/10</span></span>
                  </div>
                  <div className="bg-gray-300 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '70%'}}></div>
                  </div>
                  <div className="text-xs text-gray-600 mt-2">70% accuracy • Keep it up! 🚀</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TABLET/MOBILE: Stacked layout */}
        <div className="lg:hidden">
          {/* On phones, RobotCompanion itself shows an emoji avatar overlay */}

          {/* Full-width content with padding for avatar */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-24">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Practice Problems</h1>

            {/* Problem Card */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Problem 1</h2>
              <p className="text-base text-gray-700 font-mono bg-white p-3 rounded border-2 border-gray-200">
                {currentProblem.question}
              </p>
            </div>

            {/* Mobile Input */}
            <div className="mb-4">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                placeholder="Your answer..."
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            {/* Mobile Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSubmitAnswer}
                className="flex-1 bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg text-sm hover:bg-blue-600"
              >
                Submit
              </button>
              <button
                onClick={handleHint}
                className="px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg text-sm hover:bg-amber-600"
              >
                Hint
              </button>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default StudentPracticePageExample;