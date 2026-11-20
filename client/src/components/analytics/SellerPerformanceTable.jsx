import React from 'react';
import { formatCurrency } from '../../utils/format';
import { ShieldCheck, Award, AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const SellerPerformanceTable = ({ sellers = [] }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-soft text-left space-y-4">
      <div>
        <h3 className="text-base font-black text-slate-900 tracking-tight">Seller Performance & Trust Rankings</h3>
        <p className="text-xs text-slate-500 font-medium">Merchant transaction volume, rating health, and fulfillment rates</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-3 px-3">Seller</th>
              <th className="py-3 px-3">Listings</th>
              <th className="py-3 px-3">Orders</th>
              <th className="py-3 px-3">Rating</th>
              <th className="py-3 px-3">Fulfillment</th>
              <th className="py-3 px-3">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {sellers.map((s) => (
              <tr key={s.sellerId} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-3">
                  <Link to={`/seller/${s.sellerId}`} className="font-bold text-slate-900 hover:text-primary-600 flex items-center gap-1">
                    <span>{s.name}</span>
                    <ExternalLink size={11} className="text-slate-400" />
                  </Link>
                  <span className="text-[10px] text-slate-400">{s.college}</span>
                </td>
                <td className="py-3 px-3">{s.activeListings}</td>
                <td className="py-3 px-3 font-bold">{s.ordersCount}</td>
                <td className="py-3 px-3 text-amber-600 font-bold">⭐ {s.rating}</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">{s.fulfillmentRate}%</td>
                <td className="py-3 px-3 font-black text-slate-900">{formatCurrency(s.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SellerPerformanceTable;
