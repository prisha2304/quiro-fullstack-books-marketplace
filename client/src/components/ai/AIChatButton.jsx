import React from 'react';
import { Sparkles, MessageSquare, X } from 'lucide-react';

const AIChatButton = ({ isOpen, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-6 z-50 p-3.5 rounded-full shadow-premium flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer group ${
        isOpen
          ? 'bg-slate-900 text-white rotate-90 scale-95'
          : 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:shadow-primary-500/25 hover:scale-105'
      }`}
      aria-label="Toggle AI Book Assistant"
      title="Ask NestAI Assistant"
    >
      {isOpen ? (
        <X size={22} className="transition-transform duration-200" />
      ) : (
        <div className="relative flex items-center justify-center">
          <Sparkles size={22} className="animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-primary-600 animate-ping"></span>
        </div>
      )}

      {/* Hover Tooltip on Desktop */}
      {!isOpen && (
        <span className="absolute right-full mr-3 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
          Ask NestAI Assistant ✨
        </span>
      )}
    </button>
  );
};

export default AIChatButton;
