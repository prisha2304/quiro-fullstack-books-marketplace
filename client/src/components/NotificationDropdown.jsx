import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  ArrowRightLeft, 
  MessageCircle, 
  Star, 
  BookOpen, 
  ShieldCheck, 
  Bell, 
  CheckCheck, 
  Trash2, 
  Clock, 
  ChevronRight,
  Inbox,
  Sparkles,
  AlertCircle
} from 'lucide-react';

const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

const getTypeConfig = (type) => {
  switch (type) {
    case 'ORDER_PLACED':
    case 'ORDER_SHIPPED':
    case 'ORDER_DELIVERED':
    case 'NEW_ORDER':
    case 'ORDER_UPDATE':
      return {
        icon: <Package size={15} />,
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-600',
        borderColor: 'border-blue-100'
      };
    case 'SWAP_REQUEST':
    case 'SWAP_ACCEPTED':
    case 'NEW_SWAP_REQUEST':
      return {
        icon: <ArrowRightLeft size={15} />,
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-600',
        borderColor: 'border-purple-100'
      };
    case 'NEW_MESSAGE':
      return {
        icon: <MessageCircle size={15} />,
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-600',
        borderColor: 'border-indigo-100'
      };
    case 'NEW_REVIEW':
      return {
        icon: <Star size={15} />,
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-600',
        borderColor: 'border-amber-100'
      };
    case 'BOOK_APPROVED':
    case 'BOOK_REJECTED':
      return {
        icon: <BookOpen size={15} />,
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-600',
        borderColor: 'border-emerald-100'
      };
    default:
      return {
        icon: <Bell size={15} />,
        bgColor: 'bg-slate-50',
        textColor: 'text-primary-600',
        borderColor: 'border-slate-100'
      };
  }
};

const NotificationDropdown = ({ 
  notifications = [], 
  unreadCount = 0, 
  onMarkAsRead, 
  onMarkAllRead, 
  onDelete, 
  onClose 
}) => {
  const navigate = useNavigate();

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      onMarkAsRead(notif.id);
    }

    onClose();

    // Contextual Routing
    if (notif.entity_type === 'ORDER' || notif.type?.includes('ORDER')) {
      navigate(notif.entity_id ? `/orders/${notif.entity_id}` : '/orders');
    } else if (notif.entity_type === 'SWAP' || notif.type?.includes('SWAP')) {
      navigate('/swaps');
    } else if (notif.entity_type === 'MESSAGE' || notif.type === 'NEW_MESSAGE') {
      navigate('/messages');
    } else if (notif.entity_type === 'BOOK' || notif.type?.includes('BOOK') || notif.type === 'NEW_REVIEW') {
      navigate(notif.entity_id ? `/book/${notif.entity_id}` : '/browse');
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200/90 rounded-2xl shadow-premium z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
      
      {/* Top Header Bar */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full shadow-2xs">
              {unreadCount} new
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-[11px] font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <CheckCheck size={13} />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
        {notifications.length > 0 ? (
          notifications.map((notif) => {
            const config = getTypeConfig(notif.type);
            const timeAgo = formatTimeAgo(notif.created_at);

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3.5 transition-colors flex items-start gap-3 cursor-pointer group relative ${
                  notif.is_read ? 'bg-white hover:bg-slate-50/80' : 'bg-blue-50/30 hover:bg-blue-50/60'
                }`}
              >
                {/* Type Icon */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
                  {config.icon}
                </div>

                {/* Message Body */}
                <div className="flex-grow min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h4 className={`text-xs truncate ${notif.is_read ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'}`}>
                      {notif.title || notif.type?.replace(/_/g, ' ')}
                    </h4>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0"></span>
                    )}
                  </div>
                  
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-normal">
                    {notif.message}
                  </p>

                  <span className="text-[9px] text-slate-400 font-medium block mt-1 flex items-center gap-1">
                    <Clock size={10} /> {timeAgo}
                  </span>
                </div>

                {/* Delete Button on Hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notif.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all absolute right-2 top-3"
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center space-y-2">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-xs font-bold text-slate-800">You're all caught up!</h4>
            <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
              No new alerts or updates right now.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Footer Link */}
      <div className="p-2.5 border-t border-slate-100 bg-slate-50/70 text-center">
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center justify-center gap-1 transition-colors"
        >
          <span>View Notification Center</span>
          <ChevronRight size={13} />
        </Link>
      </div>

    </div>
  );
};

export default NotificationDropdown;
