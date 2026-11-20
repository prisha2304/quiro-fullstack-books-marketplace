import React from 'react';
import { Activity } from 'lucide-react';

const InventoryHealthCard = ({ summary, recommendations = [] }) => {
  const cards = [
    { label: 'Healthy Listings', count: summary?.healthyCount || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'High Demand', count: summary?.highDemandCount || 0, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Low Stock', count: summary?.lowStockCount || 0, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Slow Moving', count: summary?.slowMovingCount || 0, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Out of Stock', count: summary?.outOfStockCount || 0, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Inventory Intelligence & Velocity</h3>
          <p className="text-xs text-slate-400">Real-time textbook demand & velocity signals</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {cards.map((c, i) => (
          <div key={i} className={`p-3 rounded-xl border border-slate-800/80 ${c.bg}`}>
            <p className="text-[11px] font-medium text-slate-400">{c.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${c.color}`}>{c.count}</p>
          </div>
        ))}
      </div>

      {/* Dynamic Growth Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2.5 pt-3 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Operational Growth Recommendations
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-indigo-300">{rec.title}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      {rec.impact} Impact
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryHealthCard;
