import React from 'react';
import { Tag, ArrowDownRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const AIPriceDropAlert = ({ alert }) => {
  if (!alert) return null;
  const { title, message, book, savings, action } = alert;

  return (
    <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border border-emerald-200/90 rounded-3xl p-5 shadow-soft text-left space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
          <Tag size={11} /> Price Drop Alert
        </span>
        {savings > 0 && (
          <span className="text-xs font-black text-emerald-700">
            Save {formatCurrency(savings)}
          </span>
        )}
      </div>

      <div>
        <h4 className="text-sm font-black text-slate-900">{title}</h4>
        <p className="text-xs text-slate-600 font-medium leading-relaxed mt-0.5">{message}</p>
      </div>

      {action?.url && (
        <Link
          to={action.url}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <span>{action.label || 'Grab Deal'}</span>
          <ExternalLink size={12} />
        </Link>
      )}
    </div>
  );
};

export default AIPriceDropAlert;
