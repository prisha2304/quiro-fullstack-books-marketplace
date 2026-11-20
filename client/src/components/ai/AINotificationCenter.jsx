import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import AIInsightCard from './AIInsightCard';

const AINotificationCenter = ({ insights = [], onDismiss }) => {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="space-y-3 text-left">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Sparkles size={12} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
            NestAI Proactive Opportunities
          </h3>
        </div>
        <Link to="/ai-insights" className="text-[11px] font-bold text-primary-600 hover:text-primary-700">
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {insights.slice(0, 3).map((item) => (
          <AIInsightCard key={item.id} insight={item} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
};

export default AINotificationCenter;
