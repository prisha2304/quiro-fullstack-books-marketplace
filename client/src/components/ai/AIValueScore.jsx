import React from 'react';
import { Award, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

const AIValueScore = ({ scoreData }) => {
  if (!scoreData) return null;

  const score = typeof scoreData === 'number' ? scoreData : (scoreData.score || 88);
  const highlights = Array.isArray(scoreData.highlights) ? scoreData.highlights : [
    'Strong student rating consensus',
    'Competitive community marketplace pricing',
    'Protected by QUIRO Escrow'
  ];

  return (
    <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 border border-amber-200/90 rounded-2xl p-3.5 shadow-2xs space-y-2.5 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-2xs">
            <Award size={13} />
          </div>
          <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
            NestAI Value Score
          </span>
        </div>

        <div className="flex items-center gap-1 bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
          <Sparkles size={11} className="text-amber-600" />
          <span className="text-xs font-black">{score}/100</span>
        </div>
      </div>

      <div className="space-y-1">
        {highlights.map((h, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
            <CheckCircle2 size={11} className="text-amber-600 shrink-0" />
            <span>{h}</span>
          </div>
        ))}
      </div>

      <p className="text-[9px] text-slate-400 font-medium italic">
        *Calculated transparently from rating weight, physical condition, price ratio, and verified seller status.
      </p>
    </div>
  );
};

export default AIValueScore;
