import React, { useState } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  Package, 
  Clock, 
  Star, 
  Send, 
  Bot, 
  HelpCircle,
  Database,
  Lightbulb,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import aiOperationsService from '../../services/aiOperationsService';

const SUGGESTED_PROMPTS = [
  { label: 'Analyze my sales', prompt: 'Why are my textbook sales down?', icon: TrendingUp },
  { label: 'Inventory advice', prompt: 'Which books are slow-moving and need attention first?', icon: Package },
  { label: 'Fulfillment health', prompt: 'How is my fulfillment and SLA performance?', icon: Clock },
  { label: 'Buyer feedback', prompt: 'What are buyers saying about my books in reviews?', icon: Star },
  { label: 'Improve listings', prompt: 'How can I improve my catalog listings for higher conversion?', icon: Sparkles }
];

const SellerAICopilot = () => {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      topic: 'WELCOME',
      data: null,
      interpretation: 'Welcome to your Seller AI Copilot. I analyze your live sales, fulfillment SLA timings, catalog quality, and customer reviews to provide actionable business intelligence.',
      recommendation: 'Select one of the suggested prompts below or ask any operational question about your store.',
      evidence: []
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (textToSend) => {
    const text = textToSend || inputPrompt;
    if (!text.trim() || loading) return;

    const userMessage = { sender: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setLoading(true);

    try {
      const response = await aiOperationsService.getSellerCopilot(text);
      setMessages(prev => [...prev, { sender: 'bot', ...response }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        sender: 'bot',
        topic: 'ERROR',
        interpretation: 'Unable to process inquiry at this moment. Live seller metrics remain fully accessible via your main dashboard.',
        recommendation: 'Please retry in a few moments or review individual listing statuses directly.',
        evidence: []
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[650px] overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Seller AI Copilot
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono border border-indigo-500/30">
                NestAI Ops
              </span>
            </h3>
            <p className="text-xs text-slate-400">Explainable operational intelligence powered by live marketplace data</p>
          </div>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">Prompts:</span>
        {SUGGESTED_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => handleSend(item.prompt)}
              disabled={loading}
              className="px-3 py-1 bg-slate-800 hover:bg-indigo-950/60 text-slate-300 hover:text-indigo-200 border border-slate-700/60 hover:border-indigo-500/40 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Icon className="w-3.5 h-3.5 text-indigo-400" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/30">
        {messages.map((msg, index) => {
          if (msg.sender === 'user') {
            return (
              <div key={index} className="flex justify-end">
                <div className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-2xl rounded-tr-none max-w-[80%] shadow-md">
                  {msg.text}
                </div>
              </div>
            );
          }

          // Bot structured message
          return (
            <div key={index} className="flex items-start space-x-3 max-w-[95%]">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4 shadow-xl space-y-3 flex-1 text-slate-200">
                {/* 1. DATA BLOCK */}
                {msg.data && Object.keys(msg.data).length > 0 && (
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                      <Database className="w-3.5 h-3.5" />
                      <span>1. Underlying Data</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(msg.data).map(([key, val]) => (
                        <div key={key} className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                          <div className="text-[11px] text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                          <div className="text-sm font-bold text-white mt-0.5">{String(val)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. INTERPRETATION BLOCK */}
                {msg.interpretation && (
                  <div>
                    <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300 mb-1">
                      <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
                      <span>2. Interpretation</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed pl-5">
                      {msg.interpretation}
                    </p>
                  </div>
                )}

                {/* 3. RECOMMENDATION BLOCK */}
                {msg.recommendation && (
                  <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/30">
                    <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>3. Recommendation</span>
                    </div>
                    <p className="text-sm text-indigo-100 font-medium pl-5">
                      {msg.recommendation}
                    </p>
                  </div>
                )}

                {/* EVIDENCE CHIPS */}
                {msg.evidence && msg.evidence.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-500">Evidence:</span>
                    {msg.evidence.map((ev, i) => (
                      <span key={i} className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                        {ev.metric}: <strong className="text-slate-100">{String(ev.value)}</strong> ({ev.source})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center space-x-3 text-slate-400 text-xs">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>Analyzing live seller metrics...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Ask Copilot about sales, slow listings, SLA, or reviews..."
          disabled={loading}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!inputPrompt.trim() || loading}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default SellerAICopilot;
