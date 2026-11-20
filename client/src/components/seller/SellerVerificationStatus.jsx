import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Shield } from 'lucide-react';

const SellerVerificationStatus = ({ status, reviewedAt, rejectionReason }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'VERIFIED':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          label: 'Verified Campus Seller',
          desc: 'Your student seller identity is fully verified. Listings receive priority trust ranking.'
        };
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: <Clock className="w-4 h-4 text-amber-400 animate-spin" />,
          label: 'Verification Under Review',
          desc: 'Your application is in the fast-track campus moderation queue.'
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: <XCircle className="w-4 h-4 text-rose-400" />,
          label: 'Verification Rejected',
          desc: rejectionReason || 'Information provided did not meet campus seller criteria.'
        };
      case 'SUSPENDED':
        return {
          bg: 'bg-red-500/10 text-red-400 border-red-500/30',
          icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
          label: 'Seller Suspended',
          desc: 'Account requires administrative compliance review.'
        };
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          icon: <Shield className="w-4 h-4 text-slate-400" />,
          label: 'Unverified Seller',
          desc: 'Submit quick verification to unlock instant buyer trust badges and higher discoverability.'
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div className={`p-4 rounded-xl border ${config.bg} flex items-start gap-3 transition-all`}>
      <div className="mt-0.5">{config.icon}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold tracking-wide">{config.label}</h4>
          {reviewedAt && (
            <span className="text-[11px] text-slate-400">
              {new Date(reviewedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-300 mt-1">{config.desc}</p>
      </div>
    </div>
  );
};

export default SellerVerificationStatus;
