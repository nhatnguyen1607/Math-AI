import React, { useState } from 'react';
import RobotCompanion from '../components/common/RobotCompanion';

const TestRobotPage = () => {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('Xin chào! Tôi là robot hỗ trợ.');

  const updateState = (newStatus, msg) => {
    setStatus(newStatus);
    setMessage(msg);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Robot Companion Test Page</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-shrink-0">
          <div className="relative">
            <RobotCompanion status={status} message={message} />
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <button
            onClick={() => updateState('idle', 'Tôi đang sẵn sàng!')}
            className="w-full lg:w-auto px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Set Idle
          </button>
          <button
            onClick={() => updateState('thinking', 'Đang suy nghĩ...')}
            className="w-full lg:w-auto px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
          >
            Set Thinking
          </button>
          <button
            onClick={() => updateState('correct', 'Chính xác!')}
            className="w-full lg:w-auto px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
          >
            Set Correct
          </button>
          <button
            onClick={() => updateState('wrong', 'Sai rồi, thử lại nhé!')}
            className="w-full lg:w-auto px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            Set Wrong
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestRobotPage;