import React, { useState } from 'react';
import { CheckCircle, XCircle, Info, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';

const AIActionPreview = ({ 
  title = "AI Recommended Action", 
  recommendation, 
  reason, 
  evidence = [], 
  impact = "High positive impact on discoverability", 
  confidence = 85, 
  onApply, 
  onDismiss, 
  isApplying = false 
}) => {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-slate-900/50 border border-indigo-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-indigo-500/50 my-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-indigo-500/20">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-semibold text-base text-indigo-200">{title}</h4>
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Human-in-the-Loop Confirmation Required</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1.5 bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-500/30 text-xs text-indigo-300 font-medium">
          <span>{confidence}% Confidence</span>
        </div>
      </div>

      {/* Recommendation Body */}
      <div className="mt-4 space-y-3">
        <div>
          <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Recommendation</span>
          <p className="text-sm font-medium text-slate-100 mt-0.5 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
            {recommendation}
          </p>
        </div>

        {reason && (
          <div className="text-xs text-slate-300 flex items-start space-x-2 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Reason: </span>
              {reason}
            </div>
          </div>
        )}

        {impact && (
          <div className="text-xs text-slate-300 flex items-center justify-between px-1">
            <span className="text-slate-400">Potential Impact:</span>
            <span className="text-emerald-400 font-medium">{impact}</span>
          </div>
        )}
      </div>

      {/* Evidence Drawer */}
      {showEvidence && evidence && evidence.length > 0 && (
        <div className="mt-3 p-3 bg-slate-900/80 rounded-xl border border-slate-700/60 text-xs space-y-2">
          <span className="font-semibold text-indigo-300 block">Supporting Marketplace Evidence:</span>
          <div className="grid grid-cols-2 gap-2">
            {evidence.map((ev, idx) => (
              <div key={idx} className="bg-slate-800/60 p-2 rounded border border-slate-700/40">
                <div className="text-slate-400">{ev.metric}</div>
                <div className="text-slate-200 font-semibold mt-0.5">{String(ev.value)}</div>
                {ev.source && <div className="text-[10px] text-slate-500">Source: {ev.source}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-indigo-500/20 flex items-center justify-between">
        {evidence && evidence.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center space-x-1"
          >
            <span>{showEvidence ? 'Hide Evidence' : 'View Evidence'}</span>
          </button>
        ) : <div />}

        <div className="flex items-center space-x-2">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center space-x-1 border border-slate-700"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Dismiss</span>
            </button>
          )}

          {onApply && (
            <button
              type="button"
              onClick={onApply}
              disabled={isApplying}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{isApplying ? 'Applying...' : 'Apply Change'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIActionPreview;
