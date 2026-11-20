import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const AnalyticsMetricCard = ({ title, value, change, isPositive = true, icon: Icon, subtitle, color = 'blue' }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-soft hover:shadow-md transition-all text-left flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-bold text-slate-500">{title}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-700">
            <Icon size={16} />
          </div>
        )}
      </div>

      <div>
        <div className="text-2xl font-black text-slate-900 tracking-tight">{value}</div>
        
        <div className="flex items-center gap-2 mt-2">
          {change && (
            <span className={`inline-flex items-center text-xs font-black px-1.5 py-0.5 rounded ${
              isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
            }`}>
              {isPositive ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
              {change}
            </span>
          )}
          {subtitle && <span className="text-[11px] text-slate-400 font-medium">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsMetricCard;
