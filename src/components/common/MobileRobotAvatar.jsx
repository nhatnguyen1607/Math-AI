import React from 'react';

/**
 * MobileRobotAvatar Component
 * 
 * (Deprecated) Lightweight alternative to full 3D Spline for mobile devices
 * Historically used an emoji indicator on phones but no longer required.
 * This component remains in case legacy pages import it; new pages should
 * render RobotCompanion directly for identical desktop/mobile behaviour.
 * - Shows simple emoji-based status indicator
 * - Fixed position on screen (bottom-right)
 * - Can be made interactive (tap to show messages)
 * - ~99% reduction in data compared to full 3D component

 */
const MobileRobotAvatar = ({ 
  status = 'idle',
  onTap = null,
  showMessage = null 
}) => {
  // deprecated component warning
  if (process.env.NODE_ENV !== 'production') {
    console.warn('MobileRobotAvatar is deprecated; use RobotCompanion directly.');
  }

  // simple mobile avatar mapping and styling
  const emojiMap = {
    idle: '🤖',
    thinking: '🤔',
    correct: '😎',
    wrong: '😅'
  };

  const avatarEmoji = emojiMap[status] || emojiMap.idle;

  return (
    <div className="lg:hidden fixed bottom-6 right-6 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-2xl">
      {avatarEmoji}
    </div>
  );
};

export default MobileRobotAvatar;
