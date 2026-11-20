import React from 'react';
import { Sparkles, ArrowRight, Tag, ShieldCheck, Heart, Package, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const AIInsightCard = ({ insight, onDismiss }) => {
  if (!insight) return null;

  const { title, message, book, originalBook, savings, confidence, action, type } = insight;

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-soft hover:shadow-md transition-all flex flex-col justify-between gap-4 text-left group">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles size={11} className="text-indigo-600" />
            <span>{insight.category || 'AI Insight'}</span>
          </span>

          {confidence && (
            <span className="text-[10px] font-bold text-slate-400">
              {confidence}% match
            </span>
          )}
        </div>

        <h3 className="text-sm font-black text-slate-900 group-hover:text-primary-600 transition-colors">
          {title}
        </h3>

        <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1">
          {message}
        </p>

        {/* Featured Book Preview */}
        {book && (
          <div className="mt-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
            <img
              src={book.cover_image || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100'}
              alt=""
              className="w-10 h-14 object-cover rounded-lg border border-slate-200 shrink-0 bg-white"
            />
            <div className="min-w-0 flex-grow">
              <h4 className="text-xs font-bold text-slate-900 truncate">{book.title}</h4>
              <p className="text-[11px] text-slate-500 truncate">by {book.author || 'Author'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-black text-slate-900">{formatCurrency(book.price)}</span>
                {savings > 0 && (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    Save {formatCurrency(savings)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
        {action?.url ? (
          <Link
            to={action.url}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors"
          >
            <span>{action.label || 'View details'}</span>
            <ArrowRight size={13} />
          </Link>
        ) : <div />}

        {onDismiss && (
          <button
            onClick={() => onDismiss(insight.id)}
            className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default AIInsightCard;
