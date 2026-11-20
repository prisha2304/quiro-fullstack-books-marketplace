import React from 'react';
import { formatCurrency } from '../../utils/format';
import { CheckCircle2, AlertCircle, TrendingDown, Tag } from 'lucide-react';

const InventoryHealth = ({ items = [] }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-soft text-left space-y-4">
      <div>
        <h3 className="text-base font-black text-slate-900 tracking-tight">Inventory Health & Recommendations</h3>
        <p className="text-xs text-slate-500 font-medium">Automated health checks for active listings</p>
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item, idx) => (
          <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
              <p className="text-[11px] text-slate-500">{item.recommendation}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-xs font-black text-slate-900">{formatCurrency(item.price)}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                item.status === 'HIGH_DEMAND' ? 'bg-emerald-50 text-emerald-700' :
                item.status === 'OVERPRICED' ? 'bg-rose-50 text-rose-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InventoryHealth;
