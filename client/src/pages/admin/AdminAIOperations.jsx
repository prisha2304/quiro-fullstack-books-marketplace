import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  Package, 
  DollarSign, 
  ShieldAlert, 
  RefreshCw, 
  CheckCircle, 
  Search, 
  Eye, 
  Send,
  HelpCircle,
  FileText
} from 'lucide-react';
import aiOperationsService from '../../services/aiOperationsService';

const AdminAIOperations = () => {
  const [healthReport, setHealthReport] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingAnomalies, setLoadingAnomalies] = useState(true);
  const [scanningAnomalies, setScanningAnomalies] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantResponse, setAssistantResponse] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('health'); // 'health', 'anomalies', 'copilot'

  const fetchHealthReport = async () => {
    setLoadingHealth(true);
    try {
      const data = await aiOperationsService.getMarketplaceHealth(timeRange);
      setHealthReport(data);
    } catch (e) {
      console.warn('Failed to fetch health report:', e);
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchAnomalies = async () => {
    setLoadingAnomalies(true);
    try {
      const data = await aiOperationsService.getAnomalies();
      setAnomalies(data);
    } catch (e) {
      console.warn('Failed to fetch anomalies:', e);
    } finally {
      setLoadingAnomalies(false);
    }
  };

  const handleScanAnomalies = async () => {
    setScanningAnomalies(true);
    try {
      await aiOperationsService.scanAnomalies();
      await fetchAnomalies();
    } catch (e) {
      console.warn('Failed to scan anomalies:', e);
    } finally {
      setScanningAnomalies(false);
    }
  };

  const handleAssistantQuery = async (e) => {
    e?.preventDefault();
    if (!assistantQuery.trim() || assistantLoading) return;
    setAssistantLoading(true);
    try {
      const res = await aiOperationsService.getAdminOperations(assistantQuery);
      setAssistantResponse(res);
    } catch (e) {
      setAssistantResponse({
        explanation: 'Failed to query operations assistant.',
        recommendation: 'Check database connectivity.'
      });
    } finally {
      setAssistantLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthReport();
    fetchAnomalies();
  }, [timeRange]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Admin AI Operations Command Center
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-mono">
                Phase 9
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Explainable operations summary, real-time anomaly scanning, and human-in-the-loop audit controls
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleScanAnomalies}
            disabled={scanningAnomalies}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanningAnomalies ? 'animate-spin' : ''}`} />
            <span>{scanningAnomalies ? 'Scanning Metrics...' : 'Scan Anomalies Now'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'health'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          Marketplace Health Report
        </button>
        <button
          onClick={() => setActiveTab('anomalies')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'anomalies'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <span>Marketplace Anomalies</span>
          {anomalies.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
              {anomalies.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('copilot')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'copilot'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          Admin Operations Assistant
        </button>
      </div>

      {/* TAB 1: HEALTH REPORT */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          {loadingHealth ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Synthesizing 10-dimension marketplace health metrics...</span>
            </div>
          ) : healthReport ? (
            <div className="space-y-4">
              {/* Executive Summary Banner */}
              <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/80 border border-indigo-500/30 p-4 rounded-2xl text-white shadow-xl flex items-start gap-3">
                <Activity className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-indigo-300 uppercase tracking-wider block">AI Operational Summary</span>
                  <p className="text-slate-200 font-medium leading-relaxed">{healthReport.executiveSummary}</p>
                </div>
              </div>

              {/* 10-Dimension Health Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. GMV & Orders */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Gross Merchandise Value</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white">{healthReport.sections?.marketplacePerformance?.gmv}</div>
                  <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                    <span>Total Orders: {healthReport.sections?.marketplacePerformance?.totalOrders}</span>
                    <span className="text-emerald-400 font-semibold">{healthReport.sections?.marketplacePerformance?.healthStatus}</span>
                  </div>
                </div>

                {/* 2. Catalog & Listings */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Catalog & Inventory</span>
                    <Package className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white">{healthReport.sections?.catalogInventory?.totalListings}</div>
                  <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                    <span>Active Listings: {healthReport.sections?.catalogInventory?.activeAvailable}</span>
                    <span>Avg: {healthReport.sections?.catalogInventory?.averagePrice}</span>
                  </div>
                </div>

                {/* 3. Fulfillment SLA */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Fulfillment SLA Health</span>
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white">{healthReport.sections?.fulfillmentHealth?.onTimeRate}</div>
                  <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                    <span>SLA Events: {healthReport.sections?.fulfillmentHealth?.totalSlaEvents}</span>
                    <span className="text-rose-400">Breaches: {healthReport.sections?.fulfillmentHealth?.slaBreaches}</span>
                  </div>
                </div>

                {/* 4. Payment Integrity */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Payment Integrity</span>
                    <ShieldAlert className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white">{healthReport.sections?.paymentIntegrity?.successRate}</div>
                  <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                    <span>Successful: {healthReport.sections?.paymentIntegrity?.successfulPayments}</span>
                    <span>Total: {healthReport.sections?.paymentIntegrity?.totalPayments}</span>
                  </div>
                </div>

                {/* 5. Customer Sentiment */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Customer Sentiment</span>
                    <Activity className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white">{healthReport.sections?.customerSentiment?.averageRating}</div>
                  <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                    <span>Total Reviews: {healthReport.sections?.customerSentiment?.totalReviews}</span>
                    <span className="text-amber-300">Verified</span>
                  </div>
                </div>

                {/* 6. Active Anomalies */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Active Anomalies</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white">{healthReport.sections?.activeAnomaliesCount}</div>
                  <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                    <span>Requiring Human Review</span>
                    <span className="text-indigo-400 underline cursor-pointer" onClick={() => setActiveTab('anomalies')}>Inspect</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 2: ANOMALIES */}
      {activeTab === 'anomalies' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-white text-base">Detected Marketplace Signals & Anomalies</h3>
              <p className="text-xs text-slate-400">Signals represent statistical deviations; human review is required before taking any action.</p>
            </div>
          </div>

          {loadingAnomalies ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading anomalies...</div>
          ) : anomalies.length === 0 ? (
            <div className="p-8 text-center text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
              No active anomalies detected across marketplace operations.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Anomaly Type</th>
                    <th className="p-3">Affected Entity</th>
                    <th className="p-3">Confidence</th>
                    <th className="p-3">Detected At</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {anomalies.map((a, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          (a.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300')
                        }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-white">{a.anomaly_type}</td>
                      <td className="p-3 font-mono text-slate-400">{a.affected_entity_type} {a.affected_entity_id ? `#${a.affected_entity_id}` : ''}</td>
                      <td className="p-3">{a.confidence}%</td>
                      <td className="p-3 text-slate-400">{new Date(a.detected_at).toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedAnomaly(a)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[11px]"
                        >
                          View Evidence
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Anomaly Evidence Modal */}
          {selectedAnomaly && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-white">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="font-bold text-base text-indigo-300">Anomaly Investigation Details</h4>
                  <button onClick={() => setSelectedAnomaly(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                <div className="space-y-2 text-xs">
                  <div><span className="text-slate-400 font-bold">Type: </span>{selectedAnomaly.anomaly_type}</div>
                  <div><span className="text-slate-400 font-bold">Severity: </span>{selectedAnomaly.severity}</div>
                  <div><span className="text-slate-400 font-bold">Confidence: </span>{selectedAnomaly.confidence}%</div>
                  <div><span className="text-slate-400 font-bold">Entity: </span>{selectedAnomaly.affected_entity_type} {selectedAnomaly.affected_entity_id || ''}</div>
                  <div className="mt-3">
                    <span className="text-slate-400 font-bold block mb-1">Supporting Metric Evidence:</span>
                    <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-indigo-200 font-mono whitespace-pre-wrap">
                      {JSON.stringify(selectedAnomaly.evidence, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setSelectedAnomaly(null)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white"
                  >
                    Close Evidence
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COPILOT */}
      {activeTab === 'copilot' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div>
            <h3 className="font-bold text-white text-base">Admin Operations Assistant</h3>
            <p className="text-xs text-slate-400">Ask operations questions across orders, SLA breaches, and listing moderation.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {['Which orders need attention?', 'Which listings need moderation?', 'How did fulfillment perform this week?'].map((q, idx) => (
              <button
                key={idx}
                onClick={() => { setAssistantQuery(q); }}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <form onSubmit={handleAssistantQuery} className="flex gap-2">
            <input
              type="text"
              value={assistantQuery}
              onChange={(e) => setAssistantQuery(e.target.value)}
              placeholder="Ask about marketplace bottlenecks or pending actions..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={assistantLoading || !assistantQuery.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{assistantLoading ? 'Querying...' : 'Ask AI'}</span>
            </button>
          </form>

          {assistantResponse && (
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs space-y-3">
              <div className="font-bold text-indigo-300 uppercase">{assistantResponse.topic || 'OPERATIONS_INSIGHT'}</div>
              <p className="text-slate-200">{assistantResponse.explanation}</p>
              {assistantResponse.recommendation && (
                <div className="bg-indigo-950/40 p-3 rounded-lg border border-indigo-500/30 text-indigo-100">
                  <strong className="text-emerald-400">Recommendation: </strong>
                  {assistantResponse.recommendation}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAIOperations;
