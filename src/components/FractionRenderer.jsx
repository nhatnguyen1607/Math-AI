import React from 'react';

/**
 * Component để render phân số và các ký hiệu toán học dúng dạng chuẩn
 * Nhận vào text dạng: "Tính (1)/(2) + (3)/(4) = ?"
 */
const FractionRenderer = ({ text }) => {
  if (!text) return null;

  // Regex để tìm pattern (tử)/(mẫu)
  const fractionPattern = /\(([^)]+)\)\/\(([^)]+)\)/g;
  
  // Split text theo pattern
  let parts = [];
  let lastIndex = 0;
  let match;

  while ((match = fractionPattern.exec(text)) !== null) {
    // Thêm text bình thường trước phân số
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // Thêm phân số
    parts.push({
      type: 'fraction',
      numerator: match[1],
      denominator: match[2]
    });

    lastIndex = match.index + match[0].length;
  }

  // Thêm text còn lại
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  // Nếu không tìm thấy phân số nào, trả về text bình thường
  if (parts.length === 0) {
    return <span>{text}</span>;
  }

  return (
    <span className="inline-flex items-center gap-0.5 flex-wrap">
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          // Thay thế các ký hiệu toán học khác
          return (
            <span key={idx}>
              {part.content
                .replace(/×/g, ' × ')
                .replace(/÷/g, ' ÷ ')
                .replace(/≠/g, ' ≠ ')}
            </span>
          );
        } else if (part.type === 'fraction') {
          return (
            <span key={idx} className="mx-1 inline-flex flex-col items-center justify-center">
              <span className="text-center px-2 font-semibold text-sm leading-none">
                {part.numerator}
              </span>
              <span className="w-full h-0.5 bg-gray-800"></span>
              <span className="text-center px-2 font-semibold text-sm leading-none">
                {part.denominator}
              </span>
            </span>
          );
        }
        return null;
      })}
    </span>
  );
};

export default FractionRenderer;
