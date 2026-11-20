import React from 'react';
import { PiggyBank, ArrowRight, CheckCircle2, ShoppingCart, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const AICartAnalysisCard = ({ analysis, onClose }) => {
  if (!analysis) return null;

  const { currentTotal = 0, optimizedTotal = 0, potentialSavings = 0, suggestions = [] } = analysis;

  return (
    <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 border border-emerald-200/90 rounded-2xl p-4 shadow-soft space-y-3 animate-in fade-in zoom-in-95 duration-150 text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
            <PiggyBank size={15} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
              NestAI Cart Optimization
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">Smart marketplace savings finder</p>
          </div>
        </div>

        {potentialSavings > 0 && (
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
            Save {formatCurrency(potentialSavings)}
          </span>
        )}
      </div>

      {/* Cost Comparison Grid */}
      <div className="grid grid-cols-2 gap-2 bg-white/90 border border-slate-200/80 rounded-xl p-3">
        <div>
          <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Current Cart</span>
          <span className="text-sm font-bold text-slate-600 line-through">
            {formatCurrency(currentTotal)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-semibold text-emerald-600 block uppercase tracking-wider">Optimized Total</span>
          <span className="text-sm font-black text-emerald-700">
            {formatCurrency(optimizedTotal)}
          </span>
        </div>
      </div>

      {/* Bulleted Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Recommendations:
          </span>
          <div className="space-y-1">
            {suggestions.map((s, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700 font-medium leading-relaxed">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <Link
          to="/cart"
          onClick={onClose}
          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold text-center transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ShoppingCart size={13} />
          <span>View Cart</span>
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
};

export default AICartAnalysisCard;
