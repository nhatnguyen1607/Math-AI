import React, { useState } from 'react';
import RobotCompanion from './RobotCompanion';

/**
 * RobotCompanionTest Component
 * Test wrapper for quick testing of the Robot Companion with state buttons
 */
const RobotCompanionTest = () => {
  const [status, setStatus] = useState('idle');

  const messages = {
    idle: '👋 Hello! I\'m your AI Companion. How can I help?',
    thinking: 'Analyzing your answer...',
    correct: '🎉 Excellent! You got it right!',
    wrong: '❌ Oops! Let\'s try again.',
  };

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
  };

  return (
    <div className="robot-test-container p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Robot Companion Test</h1>
        <p className="text-gray-600 mb-8">
          Click buttons below to change the robot's state and see different animations:
        </p>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Robot Component */}
          <div className="flex-shrink-0">
            <div className="sticky top-8">
              <RobotCompanion 
                status={status} 
                message={messages[status]} 
              />
            </div>
          </div>

          {/* Control Panel */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">State Controls</h2>

              {/* Button Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                  onClick={() => handleStatusChange('idle')}
                  className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-200 ${
                    status === 'idle'
                      ? 'bg-blue-500 text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  [Idle]
                </button>

                <button
                  onClick={() => handleStatusChange('thinking')}
                  className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-200 ${
                    status === 'thinking'
                      ? 'bg-amber-500 text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  [Thinking]
                </button>

                <button
                  onClick={() => handleStatusChange('correct')}
                  className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-200 ${
                    status === 'correct'
                      ? 'bg-green-500 text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  [Correct]
                </button>

                <button
                  onClick={() => handleStatusChange('wrong')}
                  className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all duration-200 ${
                    status === 'wrong'
                      ? 'bg-red-500 text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  [Wrong]
                </button>
              </div>

              {/* Status Info */}
              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-2">Current State:</h3>
                <p className="text-2xl font-bold text-purple-600">{status.toUpperCase()}</p>
              </div>

              {/* Description */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-800 mb-2">What's Happening:</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  {status === 'idle' && (
                    <>
                      <li>✓ 3D Spline model is visible on all devices</li>
                      <li>✓ Mood variable set to 0 (neutral)</li>
                      <li>✓ Simple greeting message displayed</li>
                    </>
                  )}
                  {status === 'thinking' && (
                    <>
                      <li>✓ 3D model remains behind the overlay</li>
                      <li>✓ Floating math symbols animation</li>
                      <li>✓ Chat bubble pulses to indicate activity</li>
                    </>
                  )}
                  {status === 'correct' && (
                    <>
                      <li>✓ 3D Spline model continues to render</li>
                      <li>✓ Mood variable set to 1 (happy)</li>
                      <li>✓ Glowing container + scale effect</li>
                      <li>✓ Confetti and rising icons animation</li>
                      <li>✓ Success message displayed</li>
                    </>
                  )}
                  {status === 'wrong' && (
                    <>
                      <li>✓ 3D model remains visible but dimmed</li>
                      <li>✓ Red tint and rain overlay animate</li>
                      <li>✓ Shake animation of the container</li>
                      <li>✓ Encouragement message shown</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            {/* Feature Overview */}
            <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Feature Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-gray-800 mb-1">Always 3D</h4>
                  <p className="text-sm text-gray-600">Spline model renders identically on all devices</p>
                </div>
                <div className="border-l-4 border-amber-500 pl-4">
                  <h4 className="font-semibold text-gray-800 mb-1">Overlay Effects</h4>
                  <p className="text-sm text-gray-600">Status-specific CSS overlays simulate thinking, rain, confetti etc.</p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-gray-800 mb-1">Performance</h4>
                  <p className="text-sm text-gray-600">Keeps WebGL context alive for instant switching</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold text-gray-800 mb-1">Effects</h4>
                  <p className="text-sm text-gray-600">CSS animations, confetti, & typing indicators</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RobotCompanionTest;
