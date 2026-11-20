import React from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';

const SellerRiskSignals = ({ risk }) => {
  if (!risk) return null;

  const getRiskBadge = () => {
    switch (risk.riskLevel) {
      case 'HIGH':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          icon: <AlertOctagon className="w-5 h-5 text-rose-400" />,
          label: 'High Operational Attention Needed'
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          label: 'Moderate Operational Signals'
        };
      default:
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          label: 'Healthy Operational Health'
        };
    }
  };

  const badge = getRiskBadge();

  return (
    <div className={`p-4 rounded-2xl border ${badge.bg} backdrop-blur-md`}>
      <div className="flex items-center gap-2.5 mb-2">
        {badge.icon}
        <h4 className="text-sm font-bold tracking-wide">{badge.label}</h4>
      </div>

      {risk.signals && risk.signals.length > 0 ? (
        <div className="mt-2 space-y-1">
          {risk.signals.map((sig, idx) => (
            <p key={idx} className="text-xs text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              {sig}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-300">
          Your orders, dispatch timelines, and dispute records are in excellent standing.
        </p>
      )}
    </div>
  );
};

export default SellerRiskSignals;
