import React from 'react';
import { Clock } from 'lucide-react';

const SellerSLAIndicator = ({ slaSummary }) => {
  const onTimeRate = slaSummary?.onTimeRate !== undefined ? slaSummary.onTimeRate : 100;
  const onTimeCount = slaSummary?.onTimeCount || 0;
  const breachedCount = slaSummary?.breachedCount || 0;
  const atRiskCount = slaSummary?.atRiskCount || 0;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Fulfillment SLA Performance</h3>
            <p className="text-xs text-slate-400">Dispatch & delivery target compliance</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-xl font-bold ${onTimeRate >= 90 ? 'text-emerald-400' : onTimeRate >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>
            {onTimeRate}%
          </span>
          <span className="block text-[10px] text-slate-400">On-Time Rate</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[11px] text-slate-400 block">On Time</span>
          <span className="text-lg font-bold text-emerald-400">{onTimeCount}</span>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <span className="text-[11px] text-slate-400 block">At Risk</span>
          <span className="text-lg font-bold text-amber-400">{atRiskCount}</span>
        </div>
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <span className="text-[11px] text-slate-400 block">Breached</span>
          <span className="text-lg font-bold text-rose-400">{breachedCount}</span>
        </div>
      </div>
    </div>
  );
};

export default SellerSLAIndicator;
