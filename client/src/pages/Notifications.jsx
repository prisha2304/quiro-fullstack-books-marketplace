import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Clock, 
  Package, 
  ArrowRightLeft, 
  Star, 
  MessageCircle,
  BookOpen,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Inbox,
  Filter,
  SlidersHorizontal,
  ExternalLink,
  ChevronRight,
  Settings,
  Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import notificationService from '../services/notificationService';
import DashboardSidebar from '../components/DashboardSidebar';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'ORDERS', label: 'Orders' },
  { id: 'SWAPS', label: 'Swaps' },
  { id: 'MESSAGES', label: 'Messages' },
  { id: 'REVIEWS', label: 'Reviews' },
  { id: 'MARKETPLACE', label: 'Marketplace' },
  { id: 'SYSTEM', label: 'System' }
];

const getTypeConfig = (type) => {
  switch (type) {
    case 'ORDER_CONFIRMED':
    case 'ORDER_PACKED':
    case 'ORDER_SHIPPED':
    case 'ORDER_OUT_FOR_DELIVERY':
    case 'ORDER_DELIVERED':
    case 'ORDER_PLACED':
    case 'NEW_ORDER':
      return {
        icon: <Package size={18} />,
        bgColor: 'bg-blue-50 text-blue-600 border-blue-200',
        badge: 'Order'
      };
    case 'SWAP_REQUESTED':
    case 'SWAP_ACCEPTED':
    case 'SWAP_DISPATCHED':
    case 'SWAP_COMPLETED':
    case 'SWAP_REQUEST':
      return {
        icon: <ArrowRightLeft size={18} />,
        bgColor: 'bg-purple-50 text-purple-600 border-purple-200',
        badge: 'Swap'
      };
    case 'NEW_MESSAGE':
      return {
        icon: <MessageCircle size={18} />,
        bgColor: 'bg-indigo-50 text-indigo-600 border-indigo-200',
        badge: 'Chat'
      };
    case 'NEW_REVIEW':
      return {
        icon: <Star size={18} />,
        bgColor: 'bg-amber-50 text-amber-600 border-amber-200',
        badge: 'Review'
      };
    case 'WISHLIST_RESTOCK':
    case 'PRICE_DROP':
    case 'BOOK_APPROVED':
      return {
        icon: <BookOpen size={18} />,
        bgColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        badge: 'Marketplace'
      };
    default:
      return {
        icon: <Bell size={18} />,
        bgColor: 'bg-slate-50 text-slate-600 border-slate-200',
        badge: 'System'
      };
  }
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [activeTab]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await notificationService.getNotifications(50, 0, activeTab);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
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

  const handleClearRead = async () => {
    try {
      await notificationService.clearRead();
      setNotifications(notifications.filter(n => !n.is_read));
      toast.success('Cleared read notifications');
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
      toast.success('Notification removed');
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleNotificationAction = (notif) => {
    if (!notif.is_read) {
      handleMarkRead(notif.id);
    }
    if (notif.action_url) {
      navigate(notif.action_url);
    } else if (notif.entity_type === 'ORDER' || notif.type?.includes('ORDER')) {
      navigate(notif.entity_id ? `/orders/${notif.entity_id}` : '/orders');
    } else if (notif.entity_type === 'SWAP' || notif.type?.includes('SWAP')) {
      navigate('/swaps');
    } else if (notif.entity_type === 'MESSAGE' || notif.type === 'NEW_MESSAGE') {
      navigate('/messages');
    } else if (notif.entity_type === 'BOOK' || notif.type?.includes('BOOK')) {
      navigate(notif.entity_id ? `/book/${notif.entity_id}` : '/browse');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-28 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row gap-8">
        <DashboardSidebar />

        <div className="flex-grow space-y-6 text-left">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Notification Center
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 bg-rose-600 text-white font-black text-xs rounded-full">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Live marketplace updates, order alerts, peer swaps, and community announcements.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCheck size={14} className="text-primary-600" />
                  <span>Mark all read</span>
                </button>
              )}

              <button
                onClick={handleClearRead}
                className="px-3.5 py-2 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Clear read</span>
              </button>

              <Link
                to="/notification-settings"
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                title="Notification Settings"
              >
                <Settings size={16} />
              </Link>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white shadow-soft'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications Stream */}
          {loading ? (
            <div className="flex items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notif) => {
                const config = getTypeConfig(notif.type);
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationAction(notif)}
                    className={`group bg-white border rounded-2xl p-4 transition-all shadow-2xs hover:shadow-soft cursor-pointer flex items-start gap-4 relative ${
                      notif.is_read ? 'border-slate-200/80' : 'border-blue-200 bg-blue-50/20'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${config.bgColor}`}>
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-grow min-w-0 pr-8">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {config.badge}
                        </span>
                        <h3 className={`text-xs truncate ${notif.is_read ? 'font-semibold text-slate-800' : 'font-black text-slate-900'}`}>
                          {notif.title}
                        </h3>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0 animate-pulse"></span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {notif.message}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {new Date(notif.created_at).toLocaleString()}
                        </span>
                        {(notif.action_url || notif.entity_type) && (
                          <span className="text-primary-600 font-bold flex items-center gap-0.5 hover:underline">
                            View details <ChevronRight size={10} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notif.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(notif.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-all"
                          title="Mark as read"
                        >
                          <CheckCheck size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(notif.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 space-y-3">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No notifications in this category</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                We will alert you here as soon as there are updates for your orders or account.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Notifications;
