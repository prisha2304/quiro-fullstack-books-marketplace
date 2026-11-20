import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusCircle, 
  BookOpen, 
  ShoppingBag, 
  ArrowRightLeft, 
  Heart, 
  TrendingUp,
  Clock,
  ArrowRight,
  Package,
  CheckCircle2,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import userService from '../services/userService';
import DashboardSidebar from '../components/DashboardSidebar';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';

const DashboardOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await userService.getDashboardStats();
      setStats(data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
     <div className="max-w-7xl mx-auto px-4 py-32 animate-pulse">
        <div className="flex gap-12">
           <div className="hidden lg:block w-72 h-96 bg-slate-50 rounded-[40px]" />
           <div className="flex-grow space-y-8">
              <div className="h-12 w-64 bg-slate-50 rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-50 rounded-3xl" />)}
              </div>
           </div>
        </div>
     </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-32 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-12">
        <DashboardSidebar />

        <div className="flex-grow">
          <header className="mb-12">
            <h1 className="text-4xl font-black text-slate-900 mb-2">Account Overview</h1>
            <p className="text-slate-500 font-medium">Welcome back! Here's what's happening with your activities.</p>
          </header>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
             <StatCard label="Total Revenue" value={formatCurrency(stats.revenueEarned)} icon={<TrendingUp className="w-6 h-6 text-green-600" />} color="green" />
             <StatCard label="Books Sold" value={stats.booksSold} icon={<DollarSign className="w-6 h-6 text-primary-600" />} color="primary" />
             <StatCard label="Swaps Done" value={stats.booksSwapped} icon={<ArrowRightLeft className="w-6 h-6 text-indigo-600" />} color="indigo" />
             <StatCard label="Books Purchased" value={stats.booksPurchased} icon={<ShoppingBag className="w-6 h-6 text-amber-600" />} color="amber" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
             {/* Secondary stats */}
             <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-900 mb-6">Marketplace Status</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <StatusCard 
                     label="Pending Orders" 
                     value={stats.pendingOrders} 
                     icon={<Package className="w-5 h-5" />} 
                     link="/my-listings"
                     color="primary"
                   />
                   <StatusCard 
                     label="Swap Requests" 
                     value={stats.pendingSwaps} 
                     icon={<ArrowRightLeft className="w-5 h-5" />} 
                     link="/swaps"
                     color="indigo"
                   />
                   <StatusCard 
                     label="Wishlist Items" 
                     value={stats.wishlistCount} 
                     icon={<Heart className="w-5 h-5" />} 
                     link="/wishlist"
                     color="red"
                   />
                   <StatusCard 
                     label="Active Listings" 
                     value={stats.booksListed - stats.booksSold - stats.booksSwapped} 
                     icon={<CheckCircle2 className="w-5 h-5" />} 
                     link="/my-listings"
                     color="green"
                   />
                </div>
             </div>

             {/* Recent Activity */}
             <div>
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-slate-900">Recent Activity</h3>
                   <Link to="/notifications" className="text-primary-600 font-bold text-sm hover:underline">View all</Link>
                </div>
                <div className="bg-white rounded-[40px] border border-slate-100 p-8 space-y-6">
                   {stats.recentActivity && stats.recentActivity.length > 0 ? (
                      stats.recentActivity.map((activity, idx) => (
                        <ActivityItem key={idx} activity={activity} />
                      ))
                   ) : (
                      <div className="text-center py-10">
                         <Clock className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                         <p className="text-slate-400 font-bold text-sm italic uppercase tracking-widest">No recent activity</p>
                      </div>
                   )}
                </div>
             </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-16">
             <h3 className="text-xl font-black text-slate-900 mb-8 text-center sm:text-left">Quick Actions</h3>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <QuickAction title="Sell Book" icon={<PlusCircle />} link="/sell" color="primary" />
                <QuickAction title="Browse" icon={<BookOpen />} link="/browse" color="indigo" />
                <QuickAction title="Orders" icon={<ShoppingBag />} link="/orders" color="amber" />
                <QuickAction title="Wishlist" icon={<Heart />} link="/wishlist" color="red" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-xl shadow-slate-100/50 group hover:shadow-2xl hover:scale-[1.02] transition-all">
     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-${color}-100 bg-${color}-50`}>
        {icon}
     </div>
     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
     <p className="text-3xl font-black text-slate-900">{value}</p>
  </div>
);

const StatusCard = ({ label, value, icon, link, color }) => (
  <Link to={link} className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:border-primary-200 transition-all hover:bg-slate-50 group">
     <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
           {icon}
        </div>
        <div>
           <p className="text-xs font-black text-slate-900">{label}</p>
           <p className="text-lg font-black text-slate-900">{value}</p>
        </div>
     </div>
     <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
  </Link>
);

const ActivityItem = ({ activity }) => (
  <div className="flex items-start space-x-4 pb-6 border-b border-slate-50 last:border-0 last:pb-0">
     <div className="mt-1 w-2 h-2 rounded-full bg-primary-600 shrink-0" />
     <div>
        <p className="text-sm font-black text-slate-900 leading-tight mb-1">{activity.title}</p>
        <p className="text-xs text-slate-500 font-medium line-clamp-1">{activity.message}</p>
        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-2 block">{new Date(activity.created_at).toLocaleDateString()}</span>
     </div>
  </div>
);

const QuickAction = ({ title, icon, link, color }) => (
  <Link to={link} className="flex flex-col items-center justify-center p-8 bg-white border border-slate-100 rounded-[32px] hover:shadow-xl hover:-translate-y-1 transition-all group">
     <div className={`w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 transition-all group-hover:bg-${color}-50 group-hover:text-${color}-600 group-hover:scale-110 shadow-sm`}>
        {icon}
     </div>
     <p className="text-sm font-black text-slate-900">{title}</p>
  </Link>
);

export default DashboardOverview;
