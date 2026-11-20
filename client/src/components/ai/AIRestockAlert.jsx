import React from 'react';
import { BookOpen, Sparkles, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const AIRestockAlert = ({ alert }) => {
  if (!alert) return null;
  const { title, message, book, action } = alert;

  return (
    <div className="bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/40 border border-indigo-200/90 rounded-3xl p-5 shadow-soft text-left space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-300 flex items-center gap-1">
          <BookOpen size={11} /> Restock Alert
        </span>
      </div>

      <div>
        <h4 className="text-sm font-black text-slate-900">{title}</h4>
        <p className="text-xs text-slate-600 font-medium leading-relaxed mt-0.5">{message}</p>
      </div>

      {action?.url && (
        <Link
          to={action.url}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <span>{action.label || 'View Listing'}</span>
          <ExternalLink size={12} />
        </Link>
      )}
    </div>
  );
};

export default AIRestockAlert;
