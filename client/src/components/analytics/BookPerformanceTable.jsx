import React from 'react';
import { formatCurrency } from '../../utils/format';
import { Flame, TrendingUp, Gem, AlertTriangle, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const getBadgeConfig = (badge) => {
  switch (badge) {
    case 'BEST_SELLER': return { label: '🔥 Best Seller', cls: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'HIGH_VALUE': return { label: '💎 High Value', cls: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'HIGHLY_RATED': return { label: '⭐ Top Rated', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'SLOW_MOVING': return { label: '⚠ Slow Moving', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    default: return { label: '📈 Trending', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
};

const BookPerformanceTable = ({ books = [] }) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-soft text-left space-y-4">
      <div>
        <h3 className="text-base font-black text-slate-900 tracking-tight">Top Book Performance & Velocity</h3>
        <p className="text-xs text-slate-500 font-medium">Rankings by revenue, student engagement, and conversion classification</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-3 px-3">Book</th>
              <th className="py-3 px-3">Classification</th>
              <th className="py-3 px-3">Price</th>
              <th className="py-3 px-3">Sold</th>
              <th className="py-3 px-3">Views</th>
              <th className="py-3 px-3">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {books.map((b) => {
              const badgeConfig = getBadgeConfig(b.badge);
              return (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <Link to={`/book/${b.id}`} className="font-bold text-slate-900 hover:text-primary-600 truncate max-w-[200px] block">
                      {b.title}
                    </Link>
                    <span className="text-[10px] text-slate-400">{b.genre}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeConfig.cls}`}>
                      {badgeConfig.label}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">{formatCurrency(b.price)}</td>
                  <td className="py-3 px-3">{b.unitsSold}</td>
                  <td className="py-3 px-3 text-slate-500">{b.views}</td>
                  <td className="py-3 px-3 font-black text-slate-900">{formatCurrency(b.revenue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BookPerformanceTable;
