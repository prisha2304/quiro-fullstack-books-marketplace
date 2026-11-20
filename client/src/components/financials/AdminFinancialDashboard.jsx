import React, { useState, useEffect } from 'react';
import { getAdminFinancialOverview, getAdminFinancialLedger, updateSellerPayoutStatus } from '../../services/financialService';
import { formatCurrency } from '../../utils/format';
import { DollarSign, ArrowUpRight, TrendingUp, AlertTriangle, RotateCcw, CheckCircle, ShieldCheck, RefreshCw, FileText } from 'lucide-react';

const AdminFinancialDashboard = () => {
    const [overview, setOverview] = useState(null);
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [overviewData, ledgerData] = await Promise.all([
                getAdminFinancialOverview(),
                getAdminFinancialLedger(filterType, 50, 0)
            ]);
            setOverview(overviewData);
            setLedger(ledgerData);
        } catch (error) {
            console.error('Failed to load financial dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterType]);

    if (loading && !overview) {
        return <div className="p-8 text-center text-xs text-slate-400">Loading marketplace financial analytics...</div>;
    }

    const metrics = overview?.metrics || {};

    const metricCards = [
        {
            title: 'Gross Merchandise Value (GMV)',
            value: formatCurrency(metrics.grossMerchandiseValue || 0),
            subtitle: `${metrics.capturedPaymentsCount || 0} captured orders`,
            icon: DollarSign,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-100'
        },
        {
            title: 'Platform Fee Revenue',
            value: formatCurrency(metrics.totalPlatformFees || 0),
            subtitle: 'Net marketplace earnings',
            icon: TrendingUp,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100'
        },
        {
            title: 'Pending Seller Payouts',
            value: formatCurrency(metrics.pendingSellerPayouts || 0),
            subtitle: 'Escrow liability pending release',
            icon: AlertTriangle,
            color: 'text-amber-600 bg-amber-50 border-amber-100'
        },
        {
            title: 'Total Refunds Processed',
            value: formatCurrency(metrics.totalRefunds || 0),
            subtitle: `Refund rate: ${metrics.refundRate || 0}%`,
            icon: RotateCcw,
            color: 'text-purple-600 bg-purple-50 border-purple-100'
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-slate-900">Financial Reliability & Ledger</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time marketplace revenue, escrow liabilities, and append-only audit trail</p>
                </div>
                <button 
                    onClick={fetchData} 
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
                    title="Refresh Data"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {metricCards.map((c, i) => {
                    const Icon = c.icon;
                    return (
                        <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft hover:border-slate-200 transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.title}</span>
                                <div className={`p-2 rounded-xl border ${c.color}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-xl font-bold text-slate-900">{c.value}</div>
                            <div className="text-[11px] text-slate-400 mt-1">{c.subtitle}</div>
                        </div>
                    );
                })}
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment Success Rate</p>
                        <p className="text-lg font-extrabold text-emerald-600 mt-0.5">{metrics.paymentSuccessRate || 100}%</p>
                    </div>
                    <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100"><ShieldCheck size={18} /></span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dispatched Seller Payouts</p>
                        <p className="text-lg font-extrabold text-blue-600 mt-0.5">{formatCurrency(metrics.completedSellerPayouts || 0)}</p>
                    </div>
                    <span className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100"><CheckCircle size={18} /></span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-soft flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Failed Payment Volume</p>
                        <p className="text-lg font-extrabold text-rose-600 mt-0.5">{formatCurrency(metrics.failedVolume || 0)}</p>
                    </div>
                    <span className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100"><AlertTriangle size={18} /></span>
                </div>
            </div>

            {/* Append-Only Financial Ledger */}
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-soft">
                <div className="p-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Append-Only Financial Ledger</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <select 
                            value={filterType} 
                            onChange={(e) => setFilterType(e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-700 outline-none"
                        >
                            <option value="">All Transaction Types</option>
                            <option value="PAYMENT">PAYMENT</option>
                            <option value="SELLER_EARNING">SELLER_EARNING</option>
                            <option value="PLATFORM_FEE">PLATFORM_FEE</option>
                            <option value="REFUND">REFUND</option>
                            <option value="PAYOUT">PAYOUT</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="py-3 px-4">Transaction ID</th>
                                <th className="py-3 px-4">Type</th>
                                <th className="py-3 px-4">Direction</th>
                                <th className="py-3 px-4">Amount</th>
                                <th className="py-3 px-4">Party</th>
                                <th className="py-3 px-4">Order / Invoice</th>
                                <th className="py-3 px-4">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                            {ledger.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-slate-400">
                                        No ledger transactions recorded for this filter.
                                    </td>
                                </tr>
                            ) : (
                                ledger.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3 px-4 font-mono font-bold text-slate-800 text-[11px]">
                                            {tx.transaction_id}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                tx.transaction_type === 'PAYMENT' ? 'bg-emerald-50 text-emerald-700' :
                                                tx.transaction_type === 'REFUND' ? 'bg-rose-50 text-rose-700' :
                                                tx.transaction_type === 'PLATFORM_FEE' ? 'bg-indigo-50 text-indigo-700' :
                                                tx.transaction_type === 'SELLER_EARNING' ? 'bg-blue-50 text-blue-700' :
                                                'bg-purple-50 text-purple-700'
                                            }`}>
                                                {tx.transaction_type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`font-mono text-[10px] font-bold ${tx.direction === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {tx.direction === 'CREDIT' ? '+ CREDIT' : '- DEBIT'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 font-bold text-slate-900">
                                            {formatCurrency(tx.amount)}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">
                                            {tx.seller_name ? `Seller: ${tx.seller_name}` : tx.user_name ? `Buyer: ${tx.user_name}` : 'Platform'}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                                            {tx.invoice_number || (tx.order_id ? `#${tx.order_id}` : '—')}
                                        </td>
                                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminFinancialDashboard;
