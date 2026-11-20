import React from 'react';
import { ArrowDown } from 'lucide-react';

const OrderFunnel = ({ stages = [] }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-soft text-left space-y-4">
      <div>
        <h3 className="text-base font-black text-slate-900 tracking-tight">Order Conversion Funnel</h3>
        <p className="text-xs text-slate-500 font-medium">Tracking user progression from initial book discovery to verified delivery</p>
      </div>

      <div className="space-y-2">
        {stages.map((stage, idx) => {
          const widthPct = Math.max(25, 100 - (idx * 16));
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>{stage.stage}</span>
                <span className="font-black text-slate-900">{stage.count} events</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              {idx < stages.length - 1 && (
                <div className="text-[10px] text-slate-400 font-bold text-right">
                  Drop-off: {stages[idx + 1]?.dropoff}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderFunnel;
