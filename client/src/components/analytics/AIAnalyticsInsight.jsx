import React, { useState } from 'react';
import { Sparkles, Send, Bot, Loader2 } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import toast from 'react-hot-toast';

const AIAnalyticsInsight = () => {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (queryToAsk) => {
    const q = queryToAsk || question;
    if (!q.trim()) return;

    setLoading(true);
    try {
      const res = await analyticsService.aiInterpret(q);
      setResponse(res.data);
    } catch (err) {
      toast.error('AI analysis error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-soft text-left space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center">
          <Sparkles size={16} />
        </div>
        <div>
          <h3 className="text-sm font-black text-white">NestAI Analytics Interpretation Assistant</h3>
          <p className="text-[11px] text-slate-300">Ask natural language business questions about marketplace trends</p>
        </div>
      </div>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-1.5">
        {[
          'Summarize marketplace performance',
          'Which categories are growing fastest?',
          'Where are we losing conversions?'
        ].map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => {
              setQuestion(prompt);
              handleAsk(prompt);
            }}
            className="text-[11px] bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-2xl p-1.5">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask NestAI about revenue, sellers, or inventory..."
          className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-400 px-3 flex-grow"
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
        />
        <button
          onClick={() => handleAsk()}
          disabled={loading}
          className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {/* Response */}
      {response && (
        <div className="bg-white/10 border border-white/15 rounded-2xl p-4 space-y-2 text-xs leading-relaxed animate-in fade-in">
          <div className="font-medium text-slate-200 whitespace-pre-line">
            {response.answer}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalyticsInsight;
