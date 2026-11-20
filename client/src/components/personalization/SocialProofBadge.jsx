import React, { useState, useEffect } from 'react';
import { Eye, Heart, TrendingUp, Clock, Sparkles } from 'lucide-react';
import personalizationService from '../../services/personalizationService';

const ICON_MAP = {
  Eye: <Eye className="w-3 h-3 text-blue-500" />,
  Heart: <Heart className="w-3 h-3 text-rose-500 fill-rose-500/20" />,
  TrendingUp: <TrendingUp className="w-3 h-3 text-emerald-500" />,
  Clock: <Clock className="w-3 h-3 text-amber-500" />
};

const SocialProofBadge = ({ bookId }) => {
  const [proof, setProof] = useState(null);

  useEffect(() => {
    if (bookId) {
      personalizationService.getBookSocialProof(bookId)
        .then(res => setProof(res.data))
        .catch(() => {});
    }
  }, [bookId]);

  if (!proof || !proof.proofSignals || proof.proofSignals.length === 0) {
    return null;
  }

  const primarySignal = proof.proofSignals[0];

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 text-[10px] font-bold text-slate-700 tracking-wide animate-in fade-in duration-200">
      {ICON_MAP[primarySignal.icon] || <Sparkles className="w-3 h-3 text-primary-500" />}
      <span className={primarySignal.highlight}>{primarySignal.text}</span>
    </div>
  );
};

export default SocialProofBadge;
