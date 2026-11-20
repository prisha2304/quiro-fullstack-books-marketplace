import { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Clock, 
  Package, 
  ArrowRightLeft, 
  Star, 
  User, 
  AlertCircle,
  Loader2,
  Inbox,
  ShoppingBag,
  CheckCircle2
} from 'lucide-react';
import notificationService from '../services/notificationService';
import DashboardSidebar from '../components/DashboardSidebar';
import toast from 'react-hot-toast';

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await notificationService.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'order_placed':
      case 'order_shipped':
         return <Package className="w-5 h-5 text-amber-600" />;
      case 'swap_request':
      case 'swap_accepted':
         return <ArrowRightLeft className="w-5 h-5 text-indigo-600" />;
      case 'review':
         return <Star className="w-5 h-5 text-amber-500" />;
      default:
         return <Bell className="w-5 h-5 text-primary-600" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-32 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-12">
        <DashboardSidebar />

        <div className="flex-grow">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900 mb-2">Notifications</h1>
              <p className="text-slate-500 font-medium tracking-tight">Stay updated on your orders, swaps, and account activity.</p>
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="flex items-center px-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-black text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-all shadow-sm"
              >
                <CheckCheck className="w-4 h-4 mr-2" /> Mark all read
              </button>
            )}
          </header>

          {loading ? (
             <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
             </div>
          ) : notifications.length > 0 ? (
             <div className="space-y-4">
                {notifications.map(notification => (
                  <div 
                    key={notification.id}
                    className={`group relative bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm transition-all hover:shadow-xl hover:translate-x-1 ${!notification.is_read ? 'border-l-4 border-l-primary-600 bg-primary-50/10' : ''}`}
                  >
                    <div className="flex items-start gap-6">
                       <div className={`w-14 h-14 shrink-0 rounded-3xl flex items-center justify-center shadow-lg transition-all ${!notification.is_read ? 'bg-primary-600 text-white shadow-primary-100 scale-110' : 'bg-slate-50 text-slate-400'}`}>
                          {getIcon(notification.type)}
                       </div>
                       
                       <div className="flex-grow pr-10">
                          <div className="flex items-center mb-1">
                             <h3 className={`text-lg font-black transition-colors ${!notification.is_read ? 'text-slate-900' : 'text-slate-500'}`}>
                                {notification.title}
                             </h3>
                             {!notification.is_read && (
                               <span className="ml-3 w-2 h-2 bg-primary-600 rounded-full animate-pulse" />
                             )}
                          </div>
                          <p className="text-sm font-medium text-slate-600 leading-relaxed max-w-2xl">{notification.message}</p>
                          <div className="flex items-center mt-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                             <Clock className="w-3.5 h-3.5 mr-1.5" /> {new Date(notification.created_at).toLocaleString()}
                          </div>
                       </div>
                    </div>

                    <div className="absolute top-8 right-8 flex space-x-2 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                       {!notification.is_read && (
                         <button 
                           onClick={() => handleMarkRead(notification.id)}
                           className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-green-600 rounded-2xl shadow-sm transition-all"
                           title="Mark as read"
                         >
                            <CheckCheck className="w-5 h-5" />
                         </button>
                       )}
                       <button 
                         onClick={() => handleDelete(notification.id)}
                         className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-red-500 rounded-2xl shadow-sm transition-all"
                         title="Delete"
                       >
                          <Trash2 className="w-5 h-5" />
                       </button>
                    </div>
                  </div>
                ))}
             </div>
          ) : (
             <div className="text-center py-32 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                <Inbox className="w-20 h-20 text-slate-200 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-slate-900 mb-2">No notifications yet</h3>
                <p className="text-stone-500 max-w-xs mx-auto">We'll alert you here when something important happens on QUIRO.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
