import React from 'react';
import { PackageCheck, ShoppingBag, ArrowRight, CheckCircle2, Sparkles, SlidersHorizontal } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

const AIBundleCard = ({ bundle, onAddBundleToCart, onClose }) => {
  if (!bundle) return null;

  const { title, subject, budget, totalPrice, savings, bookCount, books = [], reasoning } = bundle;

  return (
    <div className="bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/50 border border-indigo-200/90 rounded-2xl p-4 shadow-soft space-y-3.5 animate-in fade-in zoom-in-95 duration-150 text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-primary-600 text-white flex items-center justify-center shadow-2xs">
            <PackageCheck size={16} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
              {title}
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">Curated academic study bundle</p>
          </div>
        </div>

        {savings > 0 && (
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
            Save {formatCurrency(savings)}
          </span>
        )}
      </div>

      {/* Pricing Summary */}
      <div className="flex items-center justify-between bg-white/90 border border-slate-200/80 rounded-xl p-3">
        <div>
          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Bundle Total</span>
          <span className="text-sm font-black text-slate-900">
            {formatCurrency(totalPrice)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Budget Target</span>
          <span className="text-xs font-bold text-slate-600">
            {formatCurrency(budget)}
          </span>
        </div>
      </div>

      {/* Curated Books List */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
          Included Textbooks ({bookCount}):
        </span>
        <div className="grid grid-cols-1 gap-2">
          {books.map((b) => (
            <div key={b.id} className="bg-white border border-slate-200/70 rounded-xl p-2 flex items-center gap-2.5 shadow-2xs">
              <img
                src={b.cover_image || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100'}
                alt=""
                className="w-8 h-11 object-cover rounded-md border border-slate-100 shrink-0 bg-slate-100"
              />
              <div className="min-w-0 flex-grow">
                <h5 className="text-xs font-bold text-slate-900 truncate">{b.title}</h5>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-primary-700">{formatCurrency(b.price)}</span>
                  {b.condition && (
                    <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 rounded">{b.condition}</span>
                  )}
                  {b.rating > 0 && (
                    <span className="text-[9px] font-bold text-amber-600">★ {b.rating}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reasoning */}
      {reasoning && (
        <p className="text-[11px] text-slate-600 font-medium italic bg-indigo-50/40 p-2 rounded-xl border border-indigo-100">
          💡 {reasoning}
        </p>
      )}

      {/* CTAs */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <button
          onClick={() => onAddBundleToCart(bundle)}
          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <ShoppingBag size={13} />
          <span>Add Bundle to Cart</span>
        </button>
      </div>
    </div>
  );
};

export default AIBundleCard;
