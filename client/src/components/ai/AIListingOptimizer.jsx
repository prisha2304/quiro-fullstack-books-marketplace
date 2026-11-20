import React, { useState } from 'react';
import { 
  Sparkles, 
  Check, 
  AlertCircle, 
  FileText, 
  Tag, 
  BookOpen, 
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import aiOperationsService from '../../services/aiOperationsService';

const AIListingOptimizer = ({ bookData, onApplyTitle, onApplyDescription }) => {
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [appliedTitle, setAppliedTitle] = useState(false);
  const [appliedDesc, setAppliedDesc] = useState(false);
  const [error, setError] = useState(null);

  const handleRunOptimizer = async () => {
    if (!bookData?.title) {
      setError('Please provide at least a title to analyze.');
      return;
    }
    setOptimizing(true);
    setError(null);
    try {
      const result = await aiOperationsService.optimizeListing(bookData);
      setOptimizationResult(result);
      setAppliedTitle(false);
      setAppliedDesc(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to optimize listing.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleApplyTitle = async () => {
    if (!optimizationResult?.suggestions?.suggestedTitle) return;
    if (onApplyTitle) {
      onApplyTitle(optimizationResult.suggestions.suggestedTitle);
      setAppliedTitle(true);
    }
    if (bookData?.id) {
      await aiOperationsService.applyAction('APPLY_OPTIMIZED_TITLE', bookData.id, {
        title: optimizationResult.suggestions.suggestedTitle
      });
    }
  };

  const handleApplyDescription = async () => {
    if (!optimizationResult?.suggestions?.suggestedDescription) return;
    if (onApplyDescription) {
      onApplyDescription(optimizationResult.suggestions.suggestedDescription);
      setAppliedDesc(true);
    }
    if (bookData?.id) {
      await aiOperationsService.applyAction('APPLY_OPTIMIZED_DESCRIPTION', bookData.id, {
        description: optimizationResult.suggestions.suggestedDescription
      });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              AI Listing Optimizer
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                Quality Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400">Generate high-converting title, keywords, and metadata suggestions</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunOptimizer}
          disabled={optimizing}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${optimizing ? 'animate-spin' : ''}`} />
          <span>{optimizing ? 'Analyzing...' : 'Analyze Listing'}</span>
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Container */}
      {optimizationResult && (
        <div className="mt-4 space-y-4">
          {/* Quality Score Bar */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-center px-3 py-1 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current</span>
                <span className="text-base font-extrabold text-amber-400">{optimizationResult.qualityScore.currentScore}/100</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600" />
              <div className="text-center px-3 py-1 bg-indigo-950/60 rounded-lg border border-indigo-500/30">
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">Potential</span>
                <span className="text-base font-extrabold text-emerald-400">{optimizationResult.qualityScore.potentialScore}/100</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-slate-300 block">Quality Status</span>
              <span className="text-xs font-bold text-indigo-300 uppercase">{optimizationResult.qualityScore.qualityStatus}</span>
            </div>
          </div>

          {/* Missing Metadata Badges */}
          {optimizationResult.suggestions.missingMetadata?.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-3.5 h-3.5" />
                Missing Recommended Metadata:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {optimizationResult.suggestions.missingMetadata.map((field, idx) => (
                  <span key={idx} className="text-[11px] bg-amber-500/20 text-amber-200 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                    + {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Title */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Suggested Optimized Title
              </span>
              <button
                type="button"
                onClick={handleApplyTitle}
                disabled={appliedTitle}
                className={`text-xs px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                  appliedTitle 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {appliedTitle ? <Check className="w-3 h-3" /> : null}
                <span>{appliedTitle ? 'Applied' : 'Apply Title'}</span>
              </button>
            </div>
            <p className="text-sm font-medium text-slate-100 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              {optimizationResult.suggestions.suggestedTitle}
            </p>
          </div>

          {/* Suggested Description */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Structured Description Template
              </span>
              <button
                type="button"
                onClick={handleApplyDescription}
                disabled={appliedDesc}
                className={`text-xs px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-all ${
                  appliedDesc 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {appliedDesc ? <Check className="w-3 h-3" /> : null}
                <span>{appliedDesc ? 'Applied' : 'Apply Description'}</span>
              </button>
            </div>
            <pre className="text-xs font-sans text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap leading-relaxed">
              {optimizationResult.suggestions.suggestedDescription}
            </pre>
          </div>

          {/* Search Keywords */}
          {optimizationResult.suggestions.searchKeywords?.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                High-Relevance Search Tags:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {optimizationResult.suggestions.searchKeywords.map((tag, idx) => (
                  <span key={idx} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{optimizationResult.disclaimer}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIListingOptimizer;
