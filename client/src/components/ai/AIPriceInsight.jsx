import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  BarChart2, 
  HelpCircle, 
  AlertCircle, 
  CheckCircle,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import aiOperationsService from '../../services/aiOperationsService';

const AIPriceInsight = ({ bookId, category, condition, currentPrice, title, onApplyPrice }) => {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [applied, setApplied] = useState(false);

  const fetchPriceInsight = async () => {
    if (!currentPrice && !bookId) return;
    setLoading(true);
    try {
      const data = await aiOperationsService.getPriceInsight({
        bookId,
        category,
        condition,
        currentPrice,
        title
      });
      setInsight(data);
      setApplied(false);
    } catch (e) {
      console.warn('Failed to load price insight:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentPrice || bookId) {
      fetchPriceInsight();
    }
  }, [bookId, category, currentPrice]);

  const handleApplyRecommended = async () => {
    if (!insight?.recommendedRange?.minSuggested) return;
    const midPrice = Math.round((insight.recommendedRange.minSuggested + insight.recommendedRange.maxSuggested) / 2);
    if (onApplyPrice) onApplyPrice(midPrice);
    if (bookId) {
      await aiOperationsService.applyAction('APPLY_PRICE_ADJUSTMENT', bookId, { price: midPrice });
    }
    setApplied(true);
  };

  if (!insight && !loading) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl my-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              AI Pricing Intelligence
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Market Benchmark
              </span>
            </h4>
            <p className="text-xs text-slate-400">Competitive pricing analysis based on comparable active listings</p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchPriceInsight}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Computing market pricing benchmarks...</span>
        </div>
      ) : insight?.status === 'INSUFFICIENT_DATA' || !insight?.hasSufficientData ? (
        <div className="mt-3 p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Not enough comparable listings to provide a reliable price recommendation.</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            {insight?.dataLimitations || 'A minimum of 3 comparable items in this title/category is required for evidence-based price guidance.'}
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-[11px] text-slate-400">
            <span>Comparable items found: {insight?.comparableCount || 0}</span>
            <span>Manual seller pricing is active</span>
          </div>
        </div>
      ) : insight ? (
        <div className="mt-4 space-y-3">
          {/* Comparison Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Your Price</span>
              <span className="text-sm font-extrabold text-white mt-0.5">₹{insight.currentPrice}</span>
            </div>

            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Market Benchmark</span>
              <span className="text-sm font-extrabold text-slate-200 mt-0.5">₹{insight.currentMarketRange?.average}</span>
              <span className="text-[9px] text-slate-400 block">
                {insight.soldCount > 0 ? `${insight.soldCount} sales / ${insight.activeCount} active` : `${insight.activeCount} active asking`}
              </span>
            </div>

            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Confidence</span>
              <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                insight.confidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {insight.confidence || 'MEDIUM'}
              </span>
            </div>

            <div className="bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-500/30">
              <span className="text-[10px] uppercase font-bold text-indigo-300 block">Suggested Range</span>
              <span className="text-sm font-extrabold text-indigo-200 mt-0.5">
                ₹{insight.recommendedRange?.minSuggested} – ₹{insight.recommendedRange?.maxSuggested}
              </span>
            </div>
          </div>

          {/* Explanation Text */}
          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 text-xs text-slate-300">
            {insight.explanation}
          </div>

          {/* Evidence Details */}
          {insight.evidence && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
              {insight.evidence.map((ev, i) => (
                <div key={i} className="text-slate-400">
                  <span className="font-semibold text-slate-300 block">{ev.metric}: {ev.value}</span>
                  <span className="text-[10px] text-slate-400">{ev.detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Data Limitations */}
          {insight.dataLimitations && (
            <p className="text-[10px] text-slate-400 italic">
              Note: {insight.dataLimitations}
            </p>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>{insight.disclaimer}</span>
            </div>

            {onApplyPrice && (
              <button
                type="button"
                onClick={handleApplyRecommended}
                disabled={applied}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  applied 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                }`}
              >
                {applied ? 'Price Applied' : 'Apply Midpoint (₹' + Math.round((insight.recommendedRange?.minSuggested + insight.recommendedRange?.maxSuggested)/2) + ')'}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AIPriceInsight;
