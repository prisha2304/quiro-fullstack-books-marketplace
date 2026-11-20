import React from 'react';
import { Search, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const SearchEmptyState = ({ query, didYouMean, onReset, onSuggestionClick }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-12 text-center max-w-xl mx-auto shadow-soft space-y-6 animate-in fade-in">
      <div className="w-16 h-16 bg-slate-50 text-slate-400 border border-slate-200 rounded-3xl flex items-center justify-center mx-auto">
        <Search size={28} />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-black text-slate-900 tracking-tight">
          No books found for "{query || 'these filters'}"
        </h3>

        {didYouMean && (
          <p className="text-xs text-slate-600">
            Did you mean:{' '}
            <button
              onClick={() => onSuggestionClick && onSuggestionClick(didYouMean)}
              className="font-bold text-primary-600 hover:underline cursor-pointer"
            >
              "{didYouMean}"
            </button>
            ?
          </p>
        )}

        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Try checking for spelling errors, loosening price bounds, or clearing subject filters.
        </p>
      </div>

      {/* Suggested Subjects */}
      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
          Popular Subjects to Explore
        </span>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {['Programming', 'Algorithms', 'UPSC', 'Engineering', 'Mathematics', 'Fiction'].map((sub, idx) => (
            <Link
              key={idx}
              to={`/browse?genre=${encodeURIComponent(sub)}`}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              {sub}
            </Link>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
        {onReset && (
          <button
            onClick={onReset}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} /> Clear Filters
          </button>
        )}

        <Link
          to="/browse"
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-soft flex items-center gap-1.5"
        >
          <span>Browse All Catalog</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
};

export default SearchEmptyState;
