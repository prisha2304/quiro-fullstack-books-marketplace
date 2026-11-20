import React from 'react';
import { PiggyBank, ShoppingBag, ArrowRight, CheckCircle2, Sliders } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

const AIBudgetPlanner = ({ plan, onAddPlanToCart, onClose }) => {
  if (!plan) return null;

  const { targetBudget = 0, recommendedSpend = 0, unusedBudget = 0, books = [], coverage = '', reasoning = '' } = plan;

  return (
    <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 border border-emerald-200/90 rounded-2xl p-4 shadow-soft space-y-3.5 animate-in fade-in zoom-in-95 duration-150 text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
            <PiggyBank size={16} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
              Smart Budget Optimizer
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">{coverage || 'Optimized Allocation'}</p>
          </div>
        </div>

        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
          Remaining: {formatCurrency(unusedBudget)}
        </span>
      </div>

      {/* Spending Breakdown */}
      <div className="grid grid-cols-2 gap-2 bg-white border border-slate-200/80 rounded-xl p-3">
        <div>
          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Your Budget</span>
          <span className="text-xs font-bold text-slate-600">{formatCurrency(targetBudget)}</span>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-emerald-600 block uppercase tracking-wider">Optimized Spend</span>
          <span className="text-sm font-black text-emerald-700">{formatCurrency(recommendedSpend)}</span>
        </div>
      </div>

      {/* Selected Books */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
          Allocated Textbooks:
        </span>
        <div className="space-y-1.5">
          {books.map((b) => (
            <div key={b.id} className="bg-white border border-slate-200/70 rounded-xl p-2 flex items-center justify-between shadow-2xs">
              <div className="min-w-0 pr-2">
                <h5 className="text-xs font-bold text-slate-900 truncate">{b.title}</h5>
                <span className="text-[10px] text-slate-500">{b.condition || 'Like New'} · ★ {b.rating || 4.8}</span>
              </div>
              <span className="text-xs font-black text-slate-900 shrink-0">{formatCurrency(b.price)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reasoning */}
      {reasoning && (
        <p className="text-[11px] text-slate-600 font-medium italic bg-emerald-50/40 p-2 rounded-xl border border-emerald-100">
          💡 {reasoning}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <button
          onClick={() => onAddPlanToCart(plan)}
          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <ShoppingBag size={13} />
          <span>Add Plan Books to Cart</span>
        </button>
      </div>
    </div>
  );
};

export default AIBudgetPlanner;
