import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Search, 
  Package, 
  Users, 
  Activity, 
  FlaskConical, 
  Flag, 
  Cpu, 
  FileText, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles,
  Layers,
  BarChart2
} from 'lucide-react';
import intelligenceService from '../../services/intelligenceService';

const AdminMarketplaceIntelligence = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [demandData, setDemandData] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [catalogGaps, setCatalogGaps] = useState([]);
  const [searchData, setSearchData] = useState(null);
  const [funnelData, setFunnelData] = useState(null);
  const [buyerData, setBuyerData] = useState(null);
  const [sellerData, setSellerData] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [featureFlags, setFeatureFlags] = useState([]);
  const [healthStatus, setHealthStatus] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const loadAllIntelligence = async () => {
    setLoading(true);
    try {
      const [
        demandRes, 
        catRes, 
        gapsRes, 
        searchRes, 
        funnelRes, 
        buyersRes, 
        sellersRes, 
        expRes, 
        flagsRes, 
        healthRes
      ] = await Promise.all([
        intelligenceService.getDemandForecast(),
        intelligenceService.getCategoryIntelligence(),
        intelligenceService.getCatalogGaps(),
        intelligenceService.getSearchIntelligence(),
        intelligenceService.getConversionFunnel(),
        intelligenceService.getBuyerLifecycle(),
        intelligenceService.getSellerLifecycle(),
        intelligenceService.getExperiments(),
        intelligenceService.getFeatureFlags(),
        intelligenceService.getMarketplaceHealth()
      ]);

      setDemandData(demandRes);
      setCategoryData(catRes);
      setCatalogGaps(gapsRes);
      setSearchData(searchRes);
      setFunnelData(funnelRes);
      setBuyerData(buyersRes);
      setSellerData(sellersRes);
      setExperiments(expRes);
      setFeatureFlags(flagsRes);
      setHealthStatus(healthRes);
    } catch (e) {
      console.warn('Failed to load intelligence metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllIntelligence();
  }, []);

  const handleToggleFlag = async (flagKey, currentEnabled) => {
    setActionLoading(true);
    try {
      await intelligenceService.updateFeatureFlag(flagKey, { enabled: !currentEnabled });
      setFeatureFlags(prev => prev.map(f => f.flag_key === flagKey ? { ...f, enabled: !currentEnabled } : f));
      setNotification(`Feature flag "${flagKey}" updated successfully.`);
    } catch (e) {
      setNotification('Failed to update flag: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunJob = async (jobKey) => {
    setActionLoading(true);
    try {
      const res = await intelligenceService.runAutomationJob(jobKey);
      setNotification(`Automation Job "${jobKey}" executed successfully.`);
    } catch (e) {
      setNotification('Failed to execute job: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateReport = async (reportType) => {
    setActionLoading(true);
    try {
      const res = await intelligenceService.generateReport(reportType);
      setNotification(`Generated new ${res.title} (ID: #${res.id}).`);
    } catch (e) {
      setNotification('Failed to generate report: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Unified Marketplace Intelligence
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-mono">
                Phase 10 Core
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Orchestrated demand forecasting, catalog gaps, conversion funnels, experiments & automation
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {healthStatus && (
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
              healthStatus.overallStatus === 'HEALTHY' 
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Status: {healthStatus.overallStatus}</span>
            </div>
          )}

          <button
            onClick={loadAllIntelligence}
            disabled={loading || actionLoading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar border-b border-slate-800 pb-2">
        {[
          { id: 'overview', label: 'Overview & Demand', icon: TrendingUp },
          { id: 'catalog', label: 'Catalog Gaps & Search', icon: Package },
          { id: 'funnel', label: 'Conversion Funnel', icon: BarChart2 },
          { id: 'lifecycle', label: 'Buyer & Seller Segments', icon: Users },
          { id: 'experiments', label: 'A/B Experiments', icon: FlaskConical },
          { id: 'flags', label: 'Feature Flags', icon: Flag },
          { id: 'automation', label: 'Automation & Reports', icon: Cpu }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & DEMAND */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Demand Trends Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Rising Demand Categories</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {demandData?.risingCategories?.length > 0 ? (
                  demandData.risingCategories.map((c, i) => (
                    <span key={i} className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold">
                      ↗ {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No rising spikes currently detected</span>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Declining Demand</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {demandData?.decliningCategories?.length > 0 ? (
                  demandData.decliningCategories.map((c, i) => (
                    <span key={i} className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold">
                      ↘ {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">Categories maintaining stable demand</span>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Potential Shortage Alerts</span>
              <div className="text-xs font-bold text-amber-300 pt-1">
                {demandData?.shortageAlerts?.length > 0 
                  ? `${demandData.shortageAlerts.length} category with supply deficit` 
                  : 'Zero critical inventory shortages'}
              </div>
            </div>
          </div>

          {/* Category Deep Dive Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="font-bold text-base text-white">Category Demand Intelligence Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Active Stock</th>
                    <th className="p-3">Total Views</th>
                    <th className="p-3">Avg Price</th>
                    <th className="p-3">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {categoryData.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-white">{cat.category}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cat.status === 'UNDERSERVED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          (cat.status === 'HIGH_CONVERTING' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300')
                        }`}>
                          {cat.status}
                        </span>
                      </td>
                      <td className="p-3">{cat.metrics?.stock}</td>
                      <td className="p-3">{cat.metrics?.views}</td>
                      <td className="p-3 font-semibold">{cat.metrics?.avgPrice}</td>
                      <td className="p-3 text-emerald-400 font-bold">{cat.metrics?.conversionRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATALOG GAPS & SEARCH */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Catalog Gaps */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-white">Identified Catalog Supply & Demand Gaps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catalogGaps.map((gap, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300">{gap.category}</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                      {gap.gapType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{gap.recommendation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Search Intelligence */}
          {searchData && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-bold text-base text-white">Search Intelligence & Coverage</h3>
                <span className="text-[11px] text-slate-400">{searchData.privacyNotice}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-xs text-slate-400 uppercase mb-3">Top Aggregated Searches</h4>
                  <ul className="space-y-2 text-xs">
                    {searchData.topSearches?.map((s, idx) => (
                      <li key={idx} className="flex items-center justify-between p-2 bg-slate-900 rounded-lg">
                        <span className="font-medium text-white">#{s.rank} {s.query}</span>
                        <span className="text-emerald-400 font-bold">{s.conversionRate} conv.</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-xs text-slate-400 uppercase mb-3">Zero-Result Queries (Unmet Demand)</h4>
                  <ul className="space-y-2 text-xs">
                    {searchData.zeroResultSearches?.map((z, idx) => (
                      <li key={idx} className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-amber-500/20">
                        <span className="font-medium text-amber-200">{z.query}</span>
                        <span className="text-slate-400 font-mono">{z.count} searches</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONVERSION FUNNEL */}
      {activeTab === 'funnel' && funnelData && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-base text-white">Multi-Step Conversion Funnel</h3>
              <p className="text-xs text-slate-400">{funnelData.bottleneckObservation}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 block font-bold">End-to-End Conversion</span>
              <span className="text-xl font-extrabold text-emerald-400">{funnelData.overallConversionRate}</span>
            </div>
          </div>

          <div className="space-y-3">
            {funnelData.steps?.map((step, idx) => (
              <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300">
                    {idx + 1}
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs">{step.step}</span>
                    <span className="text-xs text-slate-400 block">{step.count.toLocaleString()} occurrences</span>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className="text-slate-500 block">Step Drop-off</span>
                  <span className="text-rose-400 font-semibold">{step.dropOffRate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BUYER & SELLER LIFECYCLE */}
      {activeTab === 'lifecycle' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Buyer Lifecycle */}
          {buyerData && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="font-bold text-base text-white">Buyer Lifecycle Segmentation</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(buyerData.segments || {}).map(([key, val]) => (
                  <div key={key} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">{key}</span>
                    <span className="text-xl font-extrabold text-white mt-0.5">{val.count}</span>
                    <span className="text-xs text-indigo-400 block font-mono">{val.percentage}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 pt-2 border-t border-slate-800">{buyerData.summary}</p>
            </div>
          )}

          {/* Seller Lifecycle */}
          {sellerData && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="font-bold text-base text-white">Seller Lifecycle Cohorts</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(sellerData.segments || {}).map(([key, count]) => (
                  <div key={key} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">{key.replace('_', ' ')}</span>
                    <span className="text-xl font-extrabold text-white mt-0.5">{count}</span>
                    <span className="text-[10px] text-slate-500 block">Active merchants</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: A/B EXPERIMENTS */}
      {activeTab === 'experiments' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-base text-white">Marketplace A/B Experiment Framework</h3>
              <p className="text-xs text-slate-400">Statistical experiment allocation across homepage and checkout layouts</p>
            </div>
          </div>

          <div className="space-y-3">
            {experiments.map((exp, idx) => (
              <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white flex items-center gap-2">
                    {exp.name}
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-mono">
                      {exp.status}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">{exp.description}</p>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                    <span>Target Metric: <strong>{exp.target_metric}</strong></span>
                    <span>•</span>
                    <span>Variants: {Array.isArray(exp.variants) ? exp.variants.join(', ') : 'CONTROL, VARIANT_A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: FEATURE FLAGS */}
      {activeTab === 'flags' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-base text-white">System Feature Flags & Gradual Rollouts</h3>
          </div>

          <div className="space-y-3">
            {featureFlags.map((flag, idx) => (
              <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white font-mono">{flag.flag_key}</span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                      {flag.rollout_percentage}% Rollout
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{flag.description}</p>
                </div>

                <button
                  onClick={() => handleToggleFlag(flag.flag_key, flag.enabled)}
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    flag.enabled 
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                  }`}
                >
                  {flag.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: AUTOMATION & REPORTS */}
      {activeTab === 'automation' && (
        <div className="space-y-6">
          {/* Automation Jobs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-white">Safe Operational Automation Jobs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: 'EXPIRE_RESERVATIONS', name: 'Expire Stale Cart Reservations', desc: 'Frees up reserved stock after timeout' },
                { key: 'REFRESH_INTELLIGENCE_CACHE', name: 'Refresh Demand & Funnel Cache', desc: 'Precomputes hourly metric snapshots' },
                { key: 'DETECT_STALE_LISTINGS', name: 'Scan Stale Zero-Engagement Listings', desc: 'Identifies stagnant inventory' },
                { key: 'DETECT_CATALOG_GAPS', name: 'Scan Catalog Supply Deficits', desc: 'Identifies high-search zero-supply gaps' },
                { key: 'SCAN_SLA_BREACH_RISKS', name: 'Scan Fulfillment SLA Breach Risks', desc: 'Flags orders approaching SLA cutoff' }
              ].map((job, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-white">{job.name}</h4>
                    <p className="text-[11px] text-slate-400">{job.desc}</p>
                  </div>
                  <button
                    onClick={() => handleRunJob(job.key)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shrink-0"
                  >
                    Run Job
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Scheduled Reports Generator */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-white">Generate Operational Intelligence Reports</h3>
            <div className="flex flex-wrap gap-2">
              {[
                'DAILY_MARKETPLACE',
                'WEEKLY_MARKETPLACE',
                'SELLER_OPERATIONS',
                'CATALOG_HEALTH',
                'SEARCH_TRENDS',
                'FULFILLMENT_HEALTH',
                'PAYMENT_HEALTH'
              ].map((rep, idx) => (
                <button
                  key={idx}
                  onClick={() => handleGenerateReport(rep)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-indigo-950 hover:text-indigo-200 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Generate {rep.replace(/_/g, ' ')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMarketplaceIntelligence;
