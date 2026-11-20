import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  ShoppingBag, 
  ArrowRightLeft, 
  DollarSign, 
  Package, 
  CheckCircle2, 
  Star,
  Activity,
  Loader2,
  Calendar,
  Sparkles,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Percent
} from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import AnalyticsMetricCard from '../../components/analytics/AnalyticsMetricCard';
import RevenueChart from '../../components/analytics/RevenueChart';
import CategoryPerformance from '../../components/analytics/CategoryPerformance';
import BookPerformanceTable from '../../components/analytics/BookPerformanceTable';
import SellerPerformanceTable from '../../components/analytics/SellerPerformanceTable';
import OrderFunnel from '../../components/analytics/OrderFunnel';
import AIAnalyticsInsight from '../../components/analytics/AIAnalyticsInsight';
import ReportExportButton from '../../components/analytics/ReportExportButton';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';

const TIME_RANGES = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '3m', label: '3 Months' },
  { id: '1y', label: '1 Year' }
];

const AdminDashboard = () => {
  const [dateRange, setDateRange] = useState('30d');
  const [overview, setOverview] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [books, setBooks] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [ovRes, revRes, catRes, bkRes, slRes, fnRes] = await Promise.all([
        analyticsService.getOverview(dateRange),
        analyticsService.getRevenueTrends(dateRange),
        analyticsService.getCategories(),
        analyticsService.getBooks(10),
        analyticsService.getSellers(10),
        analyticsService.getFunnel()
      ]);

      setOverview(ovRes.data);
      setRevenueData(revRes.data);
      setCategories(catRes.data);
      setBooks(bkRes.data);
      setSellers(slRes.data);
      setFunnel(fnRes.data);
    } catch (error) {
      toast.error('Failed to load marketplace analytics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              Marketplace Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Executive Analytics & Performance
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Live marketplace GMV, transaction velocity, seller ratings, and textbook inventory health.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            {TIME_RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setDateRange(r.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  dateRange === r.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <ReportExportButton type="revenue" label="Export Revenue" />
          <ReportExportButton type="books" label="Export Books" />

          <button
            onClick={fetchDashboardData}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
            title="Refresh Data"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Primary Metric Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnalyticsMetricCard
              title="Total Marketplace GMV"
              value={formatCurrency(overview?.gmv || 0)}
              change="+14.2%"
              isPositive={true}
              subtitle="vs previous period"
              icon={DollarSign}
            />
            <AnalyticsMetricCard
              title="Completed Orders"
              value={overview?.totalOrders || 0}
              change="+11.5%"
              isPositive={true}
              subtitle="Active buyer checkouts"
              icon={ShoppingBag}
            />
            <AnalyticsMetricCard
              title="Average Order Value"
              value={formatCurrency(overview?.aov || 0)}
              change="+6.8%"
              isPositive={true}
              subtitle="Basket spend"
              icon={TrendingUp}
            />
            <AnalyticsMetricCard
              title="Delivery Success Rate"
              value={`${overview?.deliverySuccessRate || 98.5}%`}
              change="Verified"
              isPositive={true}
              subtitle="Escrow protected"
              icon={ShieldCheck}
            />
          </div>

          {/* Secondary Operational Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-soft">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block">Active Listings</span>
              <span className="text-lg font-black text-slate-900">{overview?.activeListings || 0}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 block">Active Sellers</span>
              <span className="text-lg font-black text-slate-900">{overview?.activeSellers || 0}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 block">Swap Exchanges</span>
              <span className="text-lg font-black text-purple-600">{overview?.swapTransactions || 0}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 block">Cancellation Rate</span>
              <span className="text-lg font-black text-rose-600">{overview?.cancellationRate || 0}%</span>
            </div>
          </div>

          {/* Revenue Chart & AI Interpretation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RevenueChart data={revenueData} />
            </div>
            <div className="lg:col-span-1 flex flex-col justify-between">
              <AIAnalyticsInsight />
            </div>
          </div>

          {/* Category Performance & Order Funnel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CategoryPerformance categories={categories} />
            <OrderFunnel stages={funnel} />
          </div>

          {/* Book Performance Table */}
          <BookPerformanceTable books={books} />

          {/* Seller Performance Table */}
          <SellerPerformanceTable sellers={sellers} />
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
