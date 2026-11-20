import React from 'react';
import { DollarSign, ArrowUpRight, Clock, CheckCircle, Percent, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

const SellerFinancialSummary = ({ summary = {} }) => {
    const gross = parseFloat(summary.gross_sales || 0);
    const fees = parseFloat(summary.total_platform_fees || 0);
    const net = parseFloat(summary.net_earnings || 0);
    const pending = parseFloat(summary.pending_payouts || 0);
    const completed = parseFloat(summary.completed_payouts || 0);

    const cards = [
        {
            title: 'Gross Book Sales',
            value: formatCurrency(gross),
            subtitle: `${summary.total_transactions || 0} completed orders`,
            icon: DollarSign,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-100'
        },
        {
            title: 'Net Seller Earnings',
            value: formatCurrency(net),
            subtitle: 'After 5% marketplace fee',
            icon: ArrowUpRight,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100'
        },
        {
            title: 'Pending Payouts',
            value: formatCurrency(pending),
            subtitle: 'In verification / fulfillment',
            icon: Clock,
            color: 'text-amber-600 bg-amber-50 border-amber-100'
        },
        {
            title: 'Completed Payouts',
            value: formatCurrency(completed),
            subtitle: 'Dispatched to bank/UPI',
            icon: CheckCircle,
            color: 'text-blue-600 bg-blue-50 border-blue-100'
        }
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((c, i) => {
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

            {/* Marketplace Fee Transparency Notice */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Total Platform Fees Deducted: <strong>{formatCurrency(fees)}</strong> (Transparent 5% rate)</span>
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Community Escrow Protected
                </span>
            </div>
        </div>
    );
};

export default SellerFinancialSummary;
