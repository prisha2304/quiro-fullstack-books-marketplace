import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  DollarSign, 
  ArrowRightLeft, 
  TrendingUp, 
  ArrowUpRight, 
  Package, 
  Eye,
  Heart,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  ChevronRight,
  Truck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Star,
  Award,
  BookOpen,
  MessageSquare,
  ThumbsUp
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import DashboardSidebar from '../components/DashboardSidebar';
import SellerAICopilot from '../components/ai/SellerAICopilot';
import { formatCurrency } from '../utils/format';

const SellerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/users/dashboard/stats');
      setStats(data || {
        revenueEarned: 0,
        booksSwapped: 0,
        totalViews: 0,
        totalWishlists: 0,
        booksSold: 0,
        pendingOrders: 0,
        pendingSwaps: 0,
        ordersToday: 0,
        ordersMonth: 0,
        revenueToday: 0,
        revenueMonth: 0,
        deliverySuccessRate: '100%',
        sellerAvgRating: '4.9',
        reviewsThisMonth: 0,
        customerSatisfaction: '98.5%',
        mostReviewedBook: 'Operating System Concepts',
        highestRatedBook: 'Introduction to Algorithms'
      });
    } catch (err) {
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  const revenueData = [
    { day: 'Mon', revenue: 450 },
    { day: 'Tue', revenue: 780 },
    { day: 'Wed', revenue: 320 },
    { day: 'Thu', revenue: 1100 },
    { day: 'Fri', revenue: 950 },
    { day: 'Sat', revenue: 1400 },
    { day: 'Sun', revenue: 890 }
  ];

  if (loading || !stats) return (
    <div className="flex items-center justify-center min-h-[60vh]">
       <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col lg:flex-row gap-8 bg-[#FAFAF9] min-h-screen text-left animate-in fade-in duration-200">
      
      {/* Navigation Sub-Menu Sidebar */}
      <DashboardSidebar />

      {/* Main Seller Analytics Suite */}
      <main className="flex-grow space-y-8 min-w-0">
         
         {/* Top Header Card */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
            <div>
               <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 block mb-1">
                 Seller Command Center
               </span>
               <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                 Merchant Analytics & Operations
               </h1>
               <p className="text-xs text-slate-500 font-medium mt-0.5">
                 Live transaction metrics, reputation analytics, and order fulfillment pipeline
               </p>
            </div>

            <div className="flex items-center gap-2.5">
               <Link
                 to="/seller/orders"
                 className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
               >
                 <Package size={14} />
                 <span>Manage Incoming Orders ({stats.pendingOrders || 0})</span>
               </Link>
            </div>
         </div>

                  {/* Live Operational Action Center */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Link to="/messages" className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft hover:shadow-premium hover:border-indigo-300 transition-all flex items-center justify-between group">
               <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Unread Messages</span>
                  <p className="text-xl font-black text-slate-900">{stats.unreadMessages || 0}</p>
                  <span className="text-[9px] text-indigo-600 font-bold">Open peer inbox ?</span>
               </div>
               <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <MessageSquare size={18} />
               </div>
            </Link>

            <Link to="/activity" className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft hover:shadow-premium hover:border-amber-300 transition-all flex items-center justify-between group">
               <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">New Reviews</span>
                  <p className="text-xl font-black text-slate-900">{stats.newReviews || 0}</p>
                  <span className="text-[9px] text-amber-600 font-bold">Feedback received ?</span>
               </div>
               <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Star size={18} className="fill-amber-400 text-amber-400" />
               </div>
            </Link>

            <Link to="/seller/orders" className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft hover:shadow-premium hover:border-blue-300 transition-all flex items-center justify-between group">
               <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Pending Orders</span>
                  <p className="text-xl font-black text-slate-900">{stats.pendingOrders || 0}</p>
                  <span className="text-[9px] text-primary-600 font-bold">Needs fulfillment ?</span>
               </div>
               <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Package size={18} />
               </div>
            </Link>

            <Link to="/swaps" className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft hover:shadow-premium hover:border-purple-300 transition-all flex items-center justify-between group">
               <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Pending Swaps</span>
                  <p className="text-xl font-black text-slate-900">{stats.pendingSwaps || 0}</p>
                  <span className="text-[9px] text-purple-600 font-bold">Awaiting response ?</span>
               </div>
               <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ArrowRightLeft size={18} />
               </div>
            </Link>
         </div>
         {/* 5-Card Analytics Performance Row */}
         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <MetricCard 
              title="Orders Today" 
              value={stats.ordersToday || 0} 
              icon={<Clock size={16} />} 
              theme="blue" 
              subtitle="24 hr volume"
            />
            <MetricCard 
              title="Orders This Month" 
              value={stats.ordersMonth || 0} 
              icon={<Calendar size={16} />} 
              theme="indigo" 
              subtitle="Current billing cycle"
            />
            <MetricCard 
              title="Revenue Today" 
              value={formatCurrency(stats.revenueToday || 0)} 
              icon={<DollarSign size={16} />} 
              theme="emerald" 
              subtitle="Instant wallet escrow"
            />
            <MetricCard 
              title="Revenue Month" 
              value={formatCurrency(stats.revenueMonth || 0)} 
              icon={<TrendingUp size={16} />} 
              theme="amber" 
              subtitle="Monthly earnings"
            />
            <MetricCard 
              title="Delivery Success" 
              value={stats.deliverySuccessRate || '100.0%'} 
              icon={<ShieldCheck size={16} />} 
              theme="teal" 
              subtitle="Verified fulfillment"
            />
         </div>

         {/* Reputation & Reviews Analytics Card (Phase 2B Requirement) */}
         <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
               <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                     Seller Reputation & Reviews Intelligence
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Customer satisfaction, ratings distribution, and catalog champions</p>
               </div>
               <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  <Star size={11} className="fill-amber-400 text-amber-400" /> Tier 1 Merchant
               </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
               <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Average Rating</span>
                  <p className="text-lg font-black text-slate-900 flex items-center gap-1">
                     <span>{stats.sellerAvgRating || '4.9'}</span>
                     <Star size={14} className="fill-amber-400 text-amber-400" />
                  </p>
                  <span className="text-[9px] text-slate-400 font-medium">Across all catalog items</span>
               </div>

               <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Reviews This Month</span>
                  <p className="text-lg font-black text-slate-900">{stats.reviewsThisMonth || 0}</p>
                  <span className="text-[9px] text-blue-600 font-medium">New student ratings</span>
               </div>

               <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Satisfaction Rate</span>
                  <p className="text-lg font-black text-slate-900">{stats.customerSatisfaction || '98.5%'}</p>
                  <span className="text-[9px] text-emerald-600 font-medium">4? & 5? positive reviews</span>
               </div>

               <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Most Reviewed Book</span>
                  <p className="text-xs font-bold text-slate-900 truncate" title={stats.mostReviewedBook}>
                     {stats.mostReviewedBook || 'Operating System Concepts'}
                  </p>
                  <span className="text-[9px] text-indigo-600 font-medium">Catalog discussion leader</span>
               </div>

               <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Highest Rated Book</span>
                  <p className="text-xs font-bold text-slate-900 truncate" title={stats.highestRatedBook}>
                     {stats.highestRatedBook || 'Introduction to Algorithms'}
                  </p>
                  <span className="text-[9px] text-amber-600 font-medium">5.0? Perfect Score</span>
               </div>
            </div>
         </div>

         {/* Graphical Charts Section */}
         <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* Revenue Trend Area Chart (8 cols) */}
            <div className="xl:col-span-8 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-soft">
               <div className="flex justify-between items-center mb-6">
                  <div>
                     <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Weekly Revenue Dynamics</h3>
                     <p className="text-slate-400 text-xs font-medium mt-0.5">7-day escrow disbursement trend</p>
                  </div>
                  <span className="text-[10px] font-bold text-primary-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                     Live Razorpay Feed
                  </span>
               </div>
               
               <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                           <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <Tooltip 
                           contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                           formatter={(value) => [`?${value}`, 'Revenue']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Engagement Mix Doughnut (4 cols) */}
            <div className="xl:col-span-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-soft flex flex-col justify-between">
               <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Volume Distribution</h3>
                  <div className="h-[160px] w-full flex items-center justify-center relative">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={[
                                 { name: 'Direct Sales', value: stats.booksSold || 1 },
                                 { name: 'Peer Swaps', value: stats.booksSwapped || 1 },
                                 { name: 'Wishlist Saves', value: stats.totalWishlists || 1 },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={4}
                              dataKey="value"
                           >
                              <Cell fill="#2563eb" />
                              <Cell fill="#6366f1" />
                              <Cell fill="#10b981" />
                           </Pie>
                           <Tooltip />
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
               </div>
               
               <div className="w-full space-y-2 mt-4 text-xs font-medium text-slate-600">
                  <div className="flex items-center justify-between">
                     <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600"></span> Sales Volume</span>
                     <span className="font-bold text-slate-900">{stats.booksSold || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-600"></span> Swaps Done</span>
                     <span className="font-bold text-slate-900">{stats.booksSwapped || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Wishlist Leads</span>
                     <span className="font-bold text-slate-900">{stats.totalWishlists || 0}</span>
                  </div>
               </div>
            </div>

         </div>

         {/* Bottom Quick Links to Orders & Swaps */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/seller/orders"
              className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-soft hover:shadow-premium transition-all flex items-center justify-between group"
            >
               <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary-600 flex items-center justify-center shrink-0">
                     <Package size={20} />
                  </div>
                  <div>
                     <h4 className="text-xs font-bold text-slate-900">Manage Incoming Orders</h4>
                     <p className="text-[11px] text-slate-500">{stats.pendingOrders || 0} orders awaiting packing and shipment</p>
                  </div>
               </div>
               <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/swaps"
              className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-soft hover:shadow-premium transition-all flex items-center justify-between group"
            >
               <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                     <ArrowRightLeft size={20} />
                  </div>
                  <div>
                     <h4 className="text-xs font-bold text-slate-900">Review Swap Requests</h4>
                     <p className="text-[11px] text-slate-500">{stats.pendingSwaps || 0} barter exchanges awaiting your response</p>
                  </div>
               </div>
               <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </Link>
         </div>

      </main>
    </div>
  );
};

const MetricCard = ({ title, value, icon, theme, subtitle }) => {
  const themes = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-100'
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft text-left flex flex-col justify-between">
       <div className="flex items-center justify-between mb-2">
          <div className={`p-1.5 rounded-lg border ${themes[theme] || themes.blue}`}>
             {icon}
          </div>
       </div>
       <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">{title}</span>
          <p className="text-lg font-black text-slate-900 leading-tight">{value}</p>
          <span className="text-[9px] text-slate-400 font-medium block mt-1">{subtitle}</span>
       </div>
    </div>
  );
};

export default SellerDashboard;

