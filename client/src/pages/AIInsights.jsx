import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Tag, 
  BookOpen, 
  ShieldCheck, 
  TrendingUp, 
  Loader2, 
  Inbox, 
  ShoppingBag,
  Store,
  ArrowRight
} from 'lucide-react';
import api from '../services/api';
import DashboardSidebar from '../components/DashboardSidebar';
import AIInsightCard from '../components/ai/AIInsightCard';
import AIPriceDropAlert from '../components/ai/AIPriceDropAlert';
import AIRestockAlert from '../components/ai/AIRestockAlert';
import AISellerInsight from '../components/ai/AISellerInsight';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'ALL', label: 'All Opportunities', icon: Sparkles },
  { id: 'DEALS', label: 'Price Drops', icon: Tag },
  { id: 'WISHLIST', label: 'Restock Alerts', icon: BookOpen },
  { id: 'CART', label: 'Cart Guardian', icon: ShieldCheck },
  { id: 'SELLER', label: 'Seller Insights', icon: Store }
];

const AIInsights = () => {
  const [activeTab, setActiveTab] = useState('ALL');
  const [insights, setInsights] = useState([]);
  const [sellerInsights, setSellerInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingsSummary, setSavingsSummary] = useState(0);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const [userRes, sellerRes] = await Promise.all([
        api.get('/ai/insights').catch(() => ({ data: { insights: [], summary: { potentialSavings: 0 } } })),
        api.get('/ai/seller-insights').catch(() => ({ data: { insights: [] } }))
      ]);

      setInsights(userRes.data?.insights || []);
      setSavingsSummary(userRes.data?.summary?.potentialSavings || 0);
      setSellerInsights(sellerRes.data?.insights || []);
    } catch (err) {
      toast.error('Failed to load AI proactive insights');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.post('/ai/alerts/dismiss', { alertId: id });
      setInsights(prev => prev.filter(i => i.id !== id));
      setSellerInsights(prev => prev.filter(i => i.id !== id));
      toast.success('Opportunity dismissed');
    } catch (err) {
      toast.error('Could not dismiss alert');
    }
  };

  const getFilteredItems = () => {
    if (activeTab === 'SELLER') return sellerInsights;
    if (activeTab === 'ALL') return [...insights, ...sellerInsights];
    return insights.filter(i => i.category === activeTab);
  };

  const filteredItems = getFilteredItems();

  return (
    <div className="max-w-7xl mx-auto px-4 py-28 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row gap-8">
        <DashboardSidebar />

        <div className="flex-grow space-y-6 text-left">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1">
                  <Sparkles size={11} /> NestAI Proactive Intelligence
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Marketplace AI Insights & Opportunities
              </h1>
              <p className="text-xs text-slate-300 font-normal">
                Continuous background intelligence matching textbook price drops, restocks, and cart savings.
              </p>
            </div>

            {savingsSummary > 0 && (
              <div className="bg-white/10 border border-white/15 p-3 rounded-2xl shrink-0 text-center sm:text-right">
                <span className="text-[10px] uppercase font-bold text-slate-300 block">Potential Savings</span>
                <span className="text-lg font-black text-emerald-400">₹{savingsSummary}</span>
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-soft'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Stream */}
          {loading ? (
            <div className="flex items-center justify-center py-24 bg-white rounded-3xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => {
                if (item.type === 'SELLER_PRICE_OPTIMIZATION' || item.type?.startsWith('SELLER_')) {
                  return <AISellerInsight key={item.id} insight={item} />;
                }
                if (item.type === 'PRICE_DROP_ALERT') {
                  return <AIPriceDropAlert key={item.id} alert={item} />;
                }
                if (item.type === 'RESTOCK_ALERT') {
                  return <AIRestockAlert key={item.id} alert={item} />;
                }
                return <AIInsightCard key={item.id} insight={item} onDismiss={handleDismiss} />;
              })}
            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 space-y-3">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No active AI alerts right now</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                NestAI will surface proactive deals, wishlist restocks, and budget alerts as they happen in the catalog.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AIInsights;
