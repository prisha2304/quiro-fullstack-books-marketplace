import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ShoppingBag, 
  ArrowRightLeft, 
  Star, 
  Grid, 
  BarChart3, 
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Megaphone,
  Activity,
  Sparkles,
  TrendingUp,
  Server
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AdminSidebar = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const menuItems = [
    { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Production Health', path: '/admin/production-health', icon: <Server className="w-5 h-5 text-emerald-400" /> },
    { label: 'Marketplace Intelligence', path: '/admin/intelligence', icon: <TrendingUp className="w-5 h-5 text-indigo-400" /> },
    { label: 'AI Operations Command', path: '/admin/ai-operations', icon: <Sparkles className="w-5 h-5 text-indigo-400" /> },
    { label: 'Operations Command', path: '/admin/operations', icon: <Activity className="w-5 h-5" /> },
    { label: 'Disputes & Safety', path: '/admin/disputes', icon: <ShieldAlert className="w-5 h-5" /> },
    { label: 'Users', path: '/admin/users', icon: <Users className="w-5 h-5" /> },
    { label: 'Books', path: '/admin/books', icon: <BookOpen className="w-5 h-5" /> },
    { label: 'Orders', path: '/admin/orders', icon: <ShoppingBag className="w-5 h-5" /> },
    { label: 'Swaps', path: '/admin/swaps', icon: <ArrowRightLeft className="w-5 h-5" /> },
    { label: 'Reviews', path: '/admin/reviews', icon: <Star className="w-5 h-5" /> },
    { label: 'Categories', path: '/admin/categories', icon: <Grid className="w-5 h-5" /> },
    { label: 'Reports', path: '/admin/reports', icon: <BarChart3 className="w-5 h-5" /> },
    { label: 'Coupons', path: '/admin/coupons', icon: <Tag className="w-5 h-5" /> },
    { label: 'Announcements', path: '/admin/announcements', icon: <Megaphone className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-72 h-screen fixed left-0 top-0 bg-slate-900 text-slate-400 p-6 flex flex-col z-50 overflow-y-auto">
      <div className="flex items-center space-x-3 px-4 mb-12">
         <div className="w-10 h-10 bg-primary-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary-900/20">
            <ShieldCheck className="w-6 h-6" />
         </div>
         <span className="text-xl font-black text-white tracking-widest uppercase">Admin Panel</span>
      </div>

      <nav className="flex-grow space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 px-6 mb-4">Core Management</p>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center space-x-4 px-6 py-4 rounded-2xl font-black text-sm transition-all ${
              location.pathname === item.path
                ? 'bg-primary-600 text-white shadow-xl shadow-primary-900/20'
                : 'hover:text-white hover:bg-slate-800'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="pt-6 mt-6 border-t border-slate-800">
         <div className="flex items-center space-x-4 px-6 py-4 mb-4">
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white border border-slate-700">
                {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
               <p className="text-sm font-black text-white truncate">{user?.full_name}</p>
               <p className="text-[10px] font-bold text-slate-500 uppercase">System Administrator</p>
            </div>
         </div>
         <button
            onClick={logout}
            className="w-full flex items-center space-x-4 px-6 py-4 rounded-2xl font-black text-sm text-red-400 hover:bg-red-950/30 transition-all"
         >
            <LogOut className="w-5 h-5" />
            <span>Terminate Session</span>
         </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
