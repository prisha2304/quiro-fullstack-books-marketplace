import React, { useState, useEffect } from 'react';
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  ShieldAlert, 
  Package, 
  Truck, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import aiOperationsService from '../../services/aiOperationsService';

const AIReviewSummary = ({ bookId }) => {
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const data = await aiOperationsService.getReviewSummary(bookId);
        setSummaryData(data);
      } catch (err) {
        console.warn('Failed to load review summary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [bookId]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 my-4 flex items-center justify-center gap-2 text-xs text-slate-400">
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
        <span>Synthesizing customer review themes...</span>
      </div>
    );
  }

  if (!summaryData) return null;

  if (summaryData.status === 'NO_REVIEWS') {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 my-4 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-slate-500" />
          <span>No reviews yet. Be the first verified buyer to review this book.</span>
        </div>
        <span className="text-[11px] bg-slate-800/80 px-2.5 py-0.5 rounded text-slate-400 font-medium">
          0 reviews
        </span>
      </div>
    );
  }

  if (summaryData.status === 'INSUFFICIENT_DATA') {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 my-4 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400/80" />
          <span>{summaryData.message}</span>
        </div>
        <span className="text-[11px] bg-slate-800 px-2.5 py-0.5 rounded text-slate-400 font-medium">
          {summaryData.reviewCount} review{summaryData.reviewCount === 1 ? '' : 's'}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 my-4 text-white shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              AI Review Summary
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                {summaryData.averageRating}
              </span>
            </h4>
            <p className="text-xs text-slate-400">Thematic sentiment aggregation across {summaryData.reviewCount} verified buyer reviews</p>
          </div>
        </div>
      </div>

      {/* Main Summary Sentence */}
      <div className="text-xs font-medium text-slate-200 bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
        {summaryData.summary}
      </div>

      {/* Positive & Negative Themes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Positive Themes */}
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Common Positive Themes</span>
          </div>
          <ul className="space-y-1.5">
            {summaryData.positiveThemes?.map((pt, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start space-x-1.5">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Negative Themes */}
        <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider">
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>Noted Observations / Complaints</span>
          </div>
          <ul className="space-y-1.5">
            {summaryData.negativeThemes?.map((nt, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start space-x-1.5">
                <span className="text-rose-400 font-bold">•</span>
                <span>{nt}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Specific Pillars */}
      {summaryData.themes && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Condition</span>
            <span className="text-xs text-slate-200 mt-0.5 block">{summaryData.themes.condition?.[0] || 'Good'}</span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Packaging</span>
            <span className="text-xs text-slate-200 mt-0.5 block">{summaryData.themes.delivery?.[0] || 'Secure'}</span>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Accuracy</span>
            <span className="text-xs text-slate-200 mt-0.5 block">{summaryData.themes.accuracy?.[0] || 'Matches Listing'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReviewSummary;
