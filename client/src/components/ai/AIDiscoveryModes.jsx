import React from 'react';
import { Sparkles, GitCompare, Tag, PackageCheck, GraduationCap, PiggyBank } from 'lucide-react';

const MODES = [
  { id: 'recommend', label: 'Recommend', icon: Sparkles, prompt: 'Recommend textbooks for me' },
  { id: 'compare', label: 'Compare', icon: GitCompare, prompt: 'Compare CLRS and Grokking Algorithms' },
  { id: 'deals', label: 'Find Deals', icon: Tag, prompt: 'Find the best value books under ₹400' },
  { id: 'bundle', label: 'Build Bundle', icon: PackageCheck, prompt: 'Build a DSA study bundle under ₹1500' },
  { id: 'study', label: 'Study Books', icon: GraduationCap, prompt: 'I need books for first year CSE' },
  { id: 'budget', label: 'Budget Planner', icon: PiggyBank, prompt: 'I have ₹1000 for programming books' }
];

const AIDiscoveryModes = ({ onSelectMode, disabled = false }) => {
  return (
    <div className="bg-slate-50 border-b border-slate-200/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider shrink-0 mr-1">
        Modes:
      </span>
      {MODES.map((mode) => {
        const Icon = mode.icon;
        return (
          <button
            key={mode.id}
            onClick={() => onSelectMode(mode.prompt)}
            disabled={disabled}
            className="text-[10px] font-bold text-slate-700 bg-white hover:bg-primary-50 hover:text-primary-600 px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs shrink-0 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Icon size={11} className="text-primary-600" />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default AIDiscoveryModes;
