import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Award, Star, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const SellerTrustBadge = ({ trustScore = 85, grade = 'A', isSuspended = false, breakdown = [] }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let icon = <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />;

  if (isSuspended) {
    badgeColor = 'bg-red-50 text-red-700 border-red-200';
    icon = <ShieldAlert className="w-3.5 h-3.5 text-red-600" />;
  } else if (trustScore < 60) {
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    icon = <AlertCircle className="w-3.5 h-3.5 text-amber-600" />;
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-black tracking-wide cursor-pointer transition-all hover:shadow-xs active:scale-95 ${badgeColor}`}
      >
        {icon}
        <span>Trust Score: {trustScore}/100 ({grade})</span>
        <Info className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {/* Popover Breakdown */}
      {showTooltip && (
        <div className="absolute z-50 left-0 mt-2 w-72 p-3.5 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="font-black text-slate-100 uppercase tracking-wider text-[10px]">Merchant Trust Analysis</span>
            </div>
            <span className="font-bold text-emerald-400 text-xs">{trustScore}/100</span>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {breakdown && breakdown.length > 0 ? (
              breakdown.map((b, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] text-slate-300">
                  <span className="truncate pr-2">{b.factor}</span>
                  <span className={`font-bold shrink-0 ${b.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {b.impact}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-400">
                Score based on successful fulfillment, campus email verification, rating averages, and zero active disputes.
              </p>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400">
            QUIRO Buyer Protection Escrow Active
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerTrustBadge;
