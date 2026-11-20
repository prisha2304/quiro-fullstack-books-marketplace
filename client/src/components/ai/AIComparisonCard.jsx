import React from 'react';
import { 
  Check, 
  Trophy, 
  ExternalLink, 
  ShoppingBag, 
  Star, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';
import { useMarketplace } from '../../context/MarketplaceContext';
import toast from 'react-hot-toast';

const AIComparisonCard = ({ comparisonData, onAddToCart, onClose }) => {
  if (!comparisonData || !comparisonData.books || comparisonData.books.length < 2) return null;

  const { books, comparison, winner, verdict } = comparisonData;
  const winnerBook = books.find(b => b.id === winner?.bookId) || books[0];

  return (
    <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-soft space-y-4 my-2 text-left">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Sparkles size={13} />
          </div>
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            NestAI Side-by-Side Comparison
          </h4>
        </div>
        <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
          Multi-Factor Matrix
        </span>
      </div>

      {/* Books Headers (Scrollable on small screens) */}
      <div className="grid grid-cols-2 gap-3">
        {books.slice(0, 2).map((book, idx) => {
          const isOverallWinner = book.id === winner?.bookId;
          return (
            <div 
              key={book.id} 
              className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                isOverallWinner 
                  ? 'bg-gradient-to-b from-indigo-50/70 to-white border-indigo-300 ring-1 ring-indigo-400/20' 
                  : 'bg-slate-50/80 border-slate-200/80'
              }`}
            >
              <div>
                {isOverallWinner && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md mb-1.5">
                    <Trophy size={10} className="text-amber-500 fill-amber-400" /> RECOMMENDED WINNER
                  </span>
                )}
                <h5 className="text-xs font-bold text-slate-900 line-clamp-2" title={book.title}>
                  {book.title}
                </h5>
                <p className="text-[10px] text-slate-400 truncate">by {book.author || 'Author'}</p>
              </div>

              <div className="pt-2 mt-2 border-t border-slate-200/60 flex items-baseline justify-between">
                <span className="text-xs font-black text-slate-900">
                  {formatCurrency(book.price || 0)}
                </span>
                <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                  <Star size={10} className="fill-amber-400 text-amber-400" /> {book.rating}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dimension Matrix Comparison Rows */}
      <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-200/60 space-y-2 text-[11px]">
        
        {/* Price Dimension */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500 font-medium">Price Advantage</span>
          <span className="font-bold text-slate-900 flex items-center gap-1">
            <Check size={12} className="text-emerald-600" />
            <span className="truncate max-w-[150px]">{comparison.price?.winnerTitle || books[0].title}</span>
          </span>
        </div>

        {/* Rating Dimension */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500 font-medium">Rating & Satisfaction</span>
          <span className="font-bold text-slate-900 flex items-center gap-1">
            <Check size={12} className="text-emerald-600" />
            <span className="truncate max-w-[150px]">{comparison.rating?.winnerTitle || books[0].title}</span>
          </span>
        </div>

        {/* Condition Dimension */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500 font-medium">Physical Condition</span>
          <span className="font-bold text-slate-900 flex items-center gap-1">
            <Check size={12} className="text-emerald-600" />
            <span className="truncate max-w-[150px]">{comparison.condition?.winnerTitle || books[0].title}</span>
          </span>
        </div>

        {/* Seller Trust Dimension */}
        <div className="flex items-center justify-between">
          <span className="text-slate-500 font-medium">Seller Reputation</span>
          <span className="font-bold text-slate-900 flex items-center gap-1">
            <ShieldCheck size={12} className="text-primary-600" />
            <span className="truncate max-w-[150px]">{comparison.seller?.winnerTitle || books[0].title}</span>
          </span>
        </div>
      </div>

      {/* Winner Action CTA */}
      <div className="pt-1 flex items-center gap-2">
        <Link
          to={`/book/${winnerBook.id}`}
          onClick={onClose}
          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5"
        >
          <span>View {winnerBook.title.slice(0, 14)}...</span>
          <ExternalLink size={12} />
        </Link>

        <button
          onClick={(e) => onAddToCart(e, winnerBook)}
          className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <ShoppingBag size={13} />
          <span>Add Winner to Cart</span>
        </button>
      </div>

    </div>
  );
};

export default AIComparisonCard;
