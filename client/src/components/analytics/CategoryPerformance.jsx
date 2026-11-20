import React from 'react';
import { formatCurrency } from '../../utils/format';
import { Sparkles, TrendingUp } from 'lucide-react';

const CategoryPerformance = ({ categories = [] }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-soft text-left space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight">Category Intelligence</h3>
          <p className="text-xs text-slate-500 font-medium">Revenue, unit velocity, and growth by textbook subject</p>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {categories.map((cat, idx) => (
          <div key={idx} className="py-3 flex items-center justify-between gap-4 group">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 group-hover:text-primary-600 transition-colors truncate">
                  {cat.category}
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                  <TrendingUp size={10} /> +{cat.growthRate}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {cat.unitsSold} sold • Avg {formatCurrency(cat.avgPrice)} • ⭐ {cat.avgRating}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-black text-slate-900 block">{formatCurrency(cat.revenue)}</span>
              <span className="text-[10px] text-slate-400">{cat.totalListings} listings</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryPerformance;
