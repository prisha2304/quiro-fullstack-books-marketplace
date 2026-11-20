import React from 'react';
import { 
  Trophy, 
  Tag, 
  Star, 
  BookOpen, 
  CheckCircle2, 
  ShoppingBag, 
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const getBadgeConfig = (badge = '') => {
  const upper = badge.toUpperCase();
  if (upper.includes('BEST OVERALL')) {
    return {
      label: 'BEST OVERALL CHOICE',
      icon: <Trophy size={12} className="text-amber-500 fill-amber-400" />,
      bg: 'bg-amber-50 text-amber-800 border-amber-200'
    };
  } else if (upper.includes('VALUE') || upper.includes('BUDGET')) {
    return {
      label: 'BEST VALUE PICK',
      icon: <Tag size={12} className="text-emerald-600" />,
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    };
  } else if (upper.includes('RATED')) {
    return {
      label: 'HIGHEST RATED',
      icon: <Star size={12} className="text-amber-500 fill-amber-400" />,
      bg: 'bg-indigo-50 text-indigo-800 border-indigo-200'
    };
  } else if (upper.includes('BEGINNER')) {
    return {
      label: 'BEST FOR BEGINNERS',
      icon: <BookOpen size={12} className="text-blue-600" />,
      bg: 'bg-blue-50 text-blue-800 border-blue-200'
    };
  }
  return {
    label: 'NESTAI RECOMMENDATION',
    icon: <Sparkles size={12} className="text-primary-600" />,
    bg: 'bg-slate-50 text-slate-800 border-slate-200'
  };
};

const AIBuyingVerdict = ({ verdictData, onAddToCart, onClose }) => {
  if (!verdictData || !verdictData.book) return null;

  const { badge, book, score, highlights = [] } = verdictData;
  const config = getBadgeConfig(badge);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-soft space-y-3.5 my-2 text-left">
      
      {/* Badge Banner */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${config.bg}`}>
          {config.icon}
          <span>{config.label}</span>
        </span>
        
        {score && (
          <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
            Match Score: {score}/10
          </span>
        )}
      </div>

      {/* Book Snapshot */}
      <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3 border border-white/10">
        <img
          src={book.cover_image || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100'}
          alt=""
          className="w-11 h-15 object-cover rounded-lg border border-white/20 shrink-0 bg-slate-800"
        />
        <div className="min-w-0 flex-grow">
          <h4 className="text-xs font-bold text-white line-clamp-1">
            {book.title}
          </h4>
          <p className="text-[10px] text-slate-300 truncate">by {book.author || 'Author'}</p>
          
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="text-xs font-black text-amber-300">
              {formatCurrency(book.price || 0)}
            </span>
            {book.rating > 0 && (
              <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                <Star size={10} className="fill-amber-400" /> {book.rating}
              </span>
            )}
            {book.condition && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-white/10 text-slate-200 rounded">
                {book.condition}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Why This is Recommended (Key Highlights) */}
      {highlights.length > 0 && (
        <div className="space-y-1.5 pt-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Why NestAI Recommends This:
          </span>
          <div className="space-y-1 text-[11px] text-slate-200">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          to={`/book/${book.id}`}
          onClick={onClose}
          className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5"
        >
          <span>View Details</span>
          <ExternalLink size={12} />
        </Link>

        <button
          onClick={(e) => onAddToCart(e, book)}
          className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <ShoppingBag size={13} />
          <span>Add to Cart</span>
        </button>
      </div>

    </div>
  );
};

export default AIBuyingVerdict;
