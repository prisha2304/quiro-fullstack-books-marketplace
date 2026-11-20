import React, { useState, useEffect } from 'react';
import { 
    Activity, Server, Database, Zap, AlertTriangle, CheckCircle, 
    RefreshCw, Clock, ArrowUpRight, Play, ShieldAlert, Cpu
} from 'lucide-react';
import api from '../../services/api';

const AdminProductionHealth = () => {
    const [diagnostics, setDiagnostics] = useState(null);
    const [dependencies, setDependencies] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [triggeringJob, setTriggeringJob] = useState(null);
    const [jobSuccessMessage, setJobSuccessMessage] = useState(null);

    const fetchHealthData = async () => {
        try {
            setRefreshing(true);
            const [diagRes, depRes] = await Promise.all([
                api.get('/health/diagnostics'),
                api.get('/health/dependencies')
            ]);
            setDiagnostics(diagRes.data);
            setDependencies(depRes.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch production health');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchHealthData();
        const interval = setInterval(fetchHealthData, 15000); // 15s auto-poll
        return () => clearInterval(interval);
    }, []);

    const triggerJob = async (jobKey) => {
        try {
            setTriggeringJob(jobKey);
            const res = await api.post('/intelligence/automation/run', { jobKey });
            setJobSuccessMessage(`Job ${jobKey} completed: ${JSON.stringify(res.data.summary || {})}`);
            setTimeout(() => setJobSuccessMessage(null), 5000);
            fetchHealthData();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Job execution failed');
        } finally {
            setTriggeringJob(null);
        }
    };

    if (loading && !diagnostics) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
                <div className="flex items-center space-x-3 text-indigo-400">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span className="font-mono text-sm tracking-widest uppercase">Loading Production Diagnostics...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-slate-800 gap-4">
                <div>
                    <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">Live Telemetry</span>
                    </div>
                    <h1 className="text-2xl font-black text-white mt-1">Production Diagnostics & Reliability</h1>
                    <p className="text-xs text-slate-400 mt-0.5">System observability, health monitoring, error rates, and automated operations</p>
                </div>
                <button
                    onClick={fetchHealthData}
                    disabled={refreshing}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-xl text-xs font-bold text-slate-200 transition-all shadow-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>Refresh Snapshot</span>
                </button>
            </div>

            {error && (
                <div className="mt-6 p-4 bg-rose-950/40 border border-rose-800 rounded-xl flex items-center space-x-3 text-rose-300 text-xs">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                    <span>{error}</span>
                </div>
            )}

            {jobSuccessMessage && (
                <div className="mt-6 p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl flex items-center space-x-3 text-emerald-300 text-xs">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                    <span>{jobSuccessMessage}</span>
                </div>
            )}

            {/* Core Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">API Status</span>
                        <Server className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-white mt-2 flex items-center space-x-2">
                        <span className="text-emerald-400">●</span>
                        <span>{diagnostics?.system?.apiStatus || 'UP'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">Uptime: {diagnostics?.system?.uptime}</p>
                </div>

                <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Database</span>
                        <Database className="w-4 h-4 text-indigo-400" />
                    </div>
                    <p className="text-2xl font-black text-white mt-2 flex items-center space-x-2">
                        <span className="text-emerald-400">●</span>
                        <span>{diagnostics?.system?.dbStatus || 'HEALTHY'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">Total Queries: {diagnostics?.database?.totalQueries || 0}</p>
                </div>

                <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">5xx Error Rate</span>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                    <p className="text-2xl font-black text-white mt-2">
                        {diagnostics?.reliability?.rate5xx || '0.00%'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">4xx Rate: {diagnostics?.reliability?.rate4xx || '0.00%'}</p>
                </div>

                <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Latency</span>
                        <Clock className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-2xl font-black text-white mt-2">
                        {diagnostics?.reliability?.avgResponseTimeMs || 0} ms
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">Slow Requests: {diagnostics?.reliability?.slowRequestsCount || 0}</p>
                </div>
            </div>

            {/* Middle Section: Dependencies & Operations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Dependency Readiness */}
                <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl">
                    <div className="flex items-center space-x-2 pb-4 border-b border-slate-800">
                        <Cpu className="w-4 h-4 text-indigo-400" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Dependency Readiness Checks</h2>
                    </div>
                    <div className="space-y-3 mt-4">
                        {dependencies?.checks && Object.entries(dependencies.checks).map(([key, check]) => (
                            <div key={key} className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                                <div>
                                    <p className="text-xs font-bold text-white capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                                    <p className="text-[11px] text-slate-500 font-mono">
                                        {check.mode || (check.latencyMs !== undefined ? `Latency: ${check.latencyMs}ms` : 'Verified')}
                                    </p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    check.status === 'UP' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                                }`}>
                                    {check.status || 'OK'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Marketplace Operations Metrics */}
                <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl">
                    <div className="flex items-center space-x-2 pb-4 border-b border-slate-800">
                        <ShieldAlert className="w-4 h-4 text-indigo-400" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Operational Reliability Failure Counts</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                            <span className="text-[11px] text-slate-400 font-bold">Payment Failures</span>
                            <p className="text-lg font-black text-white mt-1">{diagnostics?.operations?.paymentFailures || 0}</p>
                        </div>
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                            <span className="text-[11px] text-slate-400 font-bold">Webhook Failures</span>
                            <p className="text-lg font-black text-white mt-1">{diagnostics?.operations?.webhookFailures || 0}</p>
                        </div>
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                            <span className="text-[11px] text-slate-400 font-bold">Background Job Failures</span>
                            <p className="text-lg font-black text-white mt-1">{diagnostics?.operations?.jobFailures || 0}</p>
                        </div>
                        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                            <span className="text-[11px] text-slate-400 font-bold">AI Operations Failures</span>
                            <p className="text-lg font-black text-white mt-1">{diagnostics?.operations?.aiFailures || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Background Job Engine & Controls */}
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl mt-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Background Jobs & Automation Engine</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {[
                        { key: 'EXPIRE_RESERVATIONS', name: 'Expire Stale Reservations', desc: 'Releases cart locks older than 15m' },
                        { key: 'REFRESH_INTELLIGENCE_CACHE', name: 'Refresh Demand Cache', desc: 'Updates category trends and velocity' },
                        { key: 'DETECT_CATALOG_GAPS', name: 'Scan Catalog Gaps', desc: 'Identifies underserved academic subjects' },
                        { key: 'DETECT_STALE_LISTINGS', name: 'Detect Stale Listings', desc: 'Flags 0-view items >60 days old' },
                        { key: 'SCAN_SLA_BREACH_RISKS', name: 'Scan SLA Risks', desc: 'Monitors seller packing deadlines' }
                    ].map((job) => (
                        <div key={job.key} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between">
                            <div>
                                <p className="text-xs font-bold text-white">{job.name}</p>
                                <p className="text-[11px] text-slate-400 mt-1">{job.desc}</p>
                            </div>
                            <button
                                onClick={() => triggerJob(job.key)}
                                disabled={triggeringJob === job.key}
                                className="mt-4 flex items-center justify-center space-x-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded-lg text-xs font-bold transition-all"
                            >
                                <Play className="w-3 h-3" />
                                <span>{triggeringJob === job.key ? 'Executing...' : 'Trigger Now'}</span>
                            </button>
                        </div>
                    ))}
                </div>

                {/* Execution History Table */}
                <div className="mt-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Execution Stream</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider font-mono">
                                <tr>
                                    <th className="py-2.5 px-3">Job Key</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Attempt</th>
                                    <th className="py-2.5 px-3">Duration</th>
                                    <th className="py-2.5 px-3">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono">
                                {diagnostics?.recentJobExecutions?.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-950/40">
                                        <td className="py-2.5 px-3 text-white font-bold">{item.job_key}</td>
                                        <td className="py-2.5 px-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                item.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                                            }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-400">{item.attempt_number} / {item.max_attempts}</td>
                                        <td className="py-2.5 px-3 text-slate-300">{item.duration_ms || 0}ms</td>
                                        <td className="py-2.5 px-3 text-slate-500">{new Date(item.created_at).toLocaleTimeString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminProductionHealth;
