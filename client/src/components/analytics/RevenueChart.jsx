import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatCurrency } from '../../utils/format';

const METRICS = [
  { id: 'revenue', label: 'Revenue (₹)', key: 'revenue' },
  { id: 'orders', label: 'Orders', key: 'orders' },
  { id: 'unitsSold', label: 'Units Sold', key: 'unitsSold' },
  { id: 'aov', label: 'Avg Order Value', key: 'aov' }
];

const RevenueChart = ({ data = [] }) => {
  const [activeMetric, setActiveMetric] = useState('revenue');

  const selectedConfig = METRICS.find(m => m.id === activeMetric) || METRICS[0];

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-soft space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-slate-900 tracking-tight">Financial Performance Trends</h3>
          <p className="text-xs text-slate-500 font-medium">Daily aggregated marketplace volume and transaction activity</p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {METRICS.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveMetric(m.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeMetric === m.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[280px] w-full pt-2">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0F172A', borderRadius: '16px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                formatter={(val) => activeMetric === 'revenue' || activeMetric === 'aov' ? formatCurrency(val) : val}
              />
              <Area type="monotone" dataKey={selectedConfig.key} stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorMetric)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            No chart data available for this range
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueChart;
