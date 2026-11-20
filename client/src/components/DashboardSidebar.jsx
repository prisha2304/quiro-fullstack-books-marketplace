import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  ArrowRightLeft, 
  Heart, 
  Bell, 
  Settings, 
  LogOut,
  User,
  PlusCircle,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DashboardSidebar = () => {
  const { logout } = useAuth();
  const location = useLocation();

  const menuItems = [
    { label: 'Overview', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'My Listings', path: '/my-listings', icon: <PlusCircle className="w-5 h-5" /> },
    { label: 'Purchase History', path: '/orders', icon: <ShoppingBag className="w-5 h-5" /> },
    { label: 'Swap Requests', path: '/swaps', icon: <ArrowRightLeft className="w-5 h-5" /> },
    { label: 'My Wishlist', path: '/wishlist', icon: <Heart className="w-5 h-5" /> },
    { label: 'Notifications', path: '/notifications', icon: <Bell className="w-5 h-5" /> },
    { label: 'Profile Settings', path: '/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-full lg:w-72 flex-shrink-0">
      <div className="bg-white rounded-[40px] border border-slate-100 p-6 sticky top-32 shadow-xl shadow-slate-100/50">
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-4 px-6 py-4 rounded-2xl font-black text-sm transition-all ${
                location.pathname === item.path
                  ? 'bg-primary-600 text-white shadow-xl shadow-primary-200 translate-x-2'
                  : 'text-slate-500 hover:text-primary-600 hover:bg-primary-50'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
          
          <div className="pt-6 mt-6 border-t border-slate-100">
             <Link
                to="/browse"
                className="flex items-center space-x-4 px-6 py-4 rounded-2xl font-black text-sm text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
             >
                <BookOpen className="w-5 h-5" />
                <span>Marketplace</span>
             </Link>
             <button
                onClick={logout}
                className="w-full flex items-center space-x-4 px-6 py-4 rounded-2xl font-black text-sm text-red-500 hover:bg-red-50 transition-all"
             >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
             </button>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
