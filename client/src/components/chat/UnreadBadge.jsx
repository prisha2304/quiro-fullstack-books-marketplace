import React from 'react';

const UnreadBadge = ({ count, className = '' }) => {
  if (!count || count <= 0) return null;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rose-600 text-white font-black text-[10px] rounded-full shadow-2xs ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};

export default UnreadBadge;
