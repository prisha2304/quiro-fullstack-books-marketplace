import React from 'react';
import { TrendingUp, Check, ArrowRight } from 'lucide-react';

const SellerProfileCompletion = ({ score = 0, suggestions = [], onActionClick }) => {
  const getProgressColor = () => {
    if (score >= 80) return 'from-emerald-500 to-teal-400';
    if (score >= 50) return 'from-amber-500 to-yellow-400';
    return 'from-rose-500 to-orange-400';
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Seller Profile Completeness</h3>
            <p className="text-xs text-slate-400">Higher completeness drives 40% more campus orders</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            {score}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden mb-4">
        <div 
          className={`h-full bg-gradient-to-r ${getProgressColor()} transition-all duration-500 rounded-full`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>

      {/* Actionable Suggestions */}
      {suggestions.length > 0 ? (
        <div className="space-y-2 mt-3 pt-3 border-t border-slate-800/80">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Quick Improvements:</p>
          <ul className="space-y-1.5">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-center justify-between text-xs text-slate-300 bg-slate-800/40 px-3 py-1.5 rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {suggestion}
                </span>
                {onActionClick && (
                  <button 
                    onClick={() => onActionClick(suggestion)}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                  >
                    Fix <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg mt-2">
          <Check className="w-4 h-4" />
          <span>Your seller profile is 100% complete and optimized for student buyers!</span>
        </div>
      )}
    </div>
  );
};

export default SellerProfileCompletion;
