import React from 'react';
import { formatCurrency } from '../../utils/format';
import { CheckCircle, Clock, AlertCircle, ArrowDownLeft } from 'lucide-react';

const SellerTransactionTable = ({ transactions = [], loading = false }) => {
    if (loading) {
        return (
            <div className="p-8 text-center text-xs text-slate-400">
                Loading financial transactions...
            </div>
        );
    }

    if (!transactions || transactions.length === 0) {
        return (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <p className="text-xs font-semibold text-slate-500">No transactions found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">When buyers purchase your listings, payouts will appear here.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-soft">
            <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Payout Transactions</h4>
                <span className="text-[11px] text-slate-400 font-medium">{transactions.length} records</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
                        <tr>
                            <th className="py-3 px-4">Invoice / Order</th>
                            <th className="py-3 px-4">Book Title(s)</th>
                            <th className="py-3 px-4">Gross Sale</th>
                            <th className="py-3 px-4">Fee (5%)</th>
                            <th className="py-3 px-4">Net Payout</th>
                            <th className="py-3 px-4">Payout Status</th>
                            <th className="py-3 px-4">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                        {transactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                                    {tx.invoice_number || `#${tx.order_id}`}
                                </td>
                                <td className="py-3 px-4 max-w-[200px] truncate text-slate-800" title={tx.book_titles}>
                                    {tx.book_titles || 'Book Listing'}
                                </td>
                                <td className="py-3 px-4 text-slate-900 font-semibold">
                                    {formatCurrency(tx.gross_amount)}
                                </td>
                                <td className="py-3 px-4 text-rose-500">
                                    -{formatCurrency(tx.platform_fee)}
                                </td>
                                <td className="py-3 px-4 text-emerald-600 font-bold">
                                    {formatCurrency(tx.seller_amount)}
                                </td>
                                <td className="py-3 px-4">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                        tx.payout_status === 'PAID' 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                            : tx.payout_status === 'REVERSED'
                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}>
                                        {tx.payout_status === 'PAID' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                        <span>{tx.payout_status}</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-slate-400 text-[11px]">
                                    {new Date(tx.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SellerTransactionTable;
