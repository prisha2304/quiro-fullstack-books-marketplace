import React from 'react';
import { Sparkles, CheckCircle2, ShoppingBag, ExternalLink, ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const AIBookMatchResults = ({ resultData, onAddToCart, onSelectFollowUp, onClose }) => {
  if (!resultData) return null;

  const { identified, confidenceLabel, matches = [], followUps = [] } = resultData;
  const confidence = identified?.confidence || 75;

  return (
    <div className="bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/50 border border-indigo-200/90 rounded-2xl p-4 shadow-soft space-y-3.5 animate-in fade-in zoom-in-95 duration-150 text-left">
      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
            <Sparkles size={14} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
              Visual Book Identification
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">Cover OCR & Catalog Search</p>
          </div>
        </div>

        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
          confidence >= 85 ? 'text-emerald-700 bg-emerald-100 border-emerald-300' : 'text-indigo-700 bg-indigo-100 border-indigo-300'
        }`}>
          {confidence}% {confidenceLabel}
        </span>
      </div>

      {/* Identified Summary */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Identified Title</span>
        <h3 className="text-xs font-black text-slate-900">{identified?.title}</h3>
        {identified?.author && (
          <p className="text-[11px] text-slate-500 font-medium">Author: {identified.author}</p>
        )}
      </div>

      {/* Matched Marketplace Listings */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
          QUIRO Matches ({matches.length}):
        </span>

        <div className="grid grid-cols-1 gap-2">
          {matches.map((b, idx) => (
            <div
              key={b.id}
              className={`bg-white border rounded-2xl p-3 shadow-2xs hover:border-primary-300 transition-all flex flex-col gap-2 ${
                idx === 0 ? 'border-indigo-300 bg-indigo-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <img
                  src={b.cover_image || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100'}
                  alt=""
                  className="w-10 h-14 object-cover rounded-lg border border-slate-100 shrink-0 bg-slate-100 shadow-2xs"
                />
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {idx === 0 && (
                      <span className="text-[9px] font-black bg-indigo-600 text-white px-1.5 py-0.2 rounded">
                        Best Match
                      </span>
                    )}
                    <h4 className="text-xs font-bold text-slate-900 truncate">{b.title}</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">by {b.author || 'Author'}</p>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-black text-slate-900">{formatCurrency(b.price)}</span>
                    {b.condition && (
                      <span className="text-[9px] font-bold px-1.5 bg-slate-100 text-slate-600 rounded">{b.condition}</span>
                    )}
                    {b.rating > 0 && (
                      <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                        <Star size={10} className="fill-amber-400 text-amber-400" /> {b.rating}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                <Link
                  to={`/book/${b.id}`}
                  onClick={onClose}
                  className="flex-1 py-1.5 bg-slate-50 hover:bg-primary-50 text-slate-700 hover:text-primary-600 rounded-lg text-[11px] font-bold text-center border border-slate-200 transition-colors flex items-center justify-center gap-1"
                >
                  <span>View Details</span>
                  <ExternalLink size={11} />
                </Link>

                <button
                  onClick={(e) => onAddToCart(e, b)}
                  className="py-1.5 px-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <ShoppingBag size={12} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Follow-Ups */}
      {followUps.length > 0 && (
        <div className="pt-1 space-y-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
            Ask About This Book:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {followUps.map((chip, ci) => (
              <button
                key={ci}
                onClick={() => onSelectFollowUp(chip)}
                className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-all cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIBookMatchResults;
