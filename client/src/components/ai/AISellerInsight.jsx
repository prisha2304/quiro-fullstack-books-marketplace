import React from 'react';
import { TrendingUp, Package, ArrowRightLeft, DollarSign, Edit3, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const AISellerInsight = ({ insight }) => {
  if (!insight) return null;
  const { title, message, priority, action } = insight;

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-soft text-left space-y-3 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
          priority === 'HIGH' 
            ? 'text-rose-800 bg-rose-50 border-rose-200' 
            : 'text-amber-800 bg-amber-50 border-amber-200'
        }`}>
          {insight.category || 'Seller Insight'}
        </span>
      </div>

      <div>
        <h4 className="text-sm font-black text-slate-900">{title}</h4>
        <p className="text-xs text-slate-600 font-medium leading-relaxed mt-0.5">{message}</p>
      </div>

      {action?.url && (
        <Link
          to={action.url}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
        >
          <span>{action.label || 'Take Action'}</span>
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
};

export default AISellerInsight;
