import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import notificationService from '../services/notificationService';
import NotificationDropdown from './NotificationDropdown';
import toast from 'react-hot-toast';

const NotificationBell = () => {
  const { user } = useAuth();
  const { socket } = useSocket() || {};
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [animateBell, setAnimateBell] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Real-time WebSocket event listener
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data) => {
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
      setAnimateBell(true);
      setTimeout(() => setAnimateBell(false), 1200);
      
      // Toast brief alert
      toast((t) => (
        <div className="flex items-start gap-2.5 text-xs text-left">
          <Bell size={16} className="text-primary-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900">{data.title || 'New Notification'}</p>
            <p className="text-slate-500 line-clamp-1">{data.message}</p>
          </div>
        </div>
      ), { duration: 4000 });
    };

    const handleCountUpdate = (data) => {
      if (typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    };

    socket.on('notification', handleNewNotification);
    socket.on('NOTIFICATION_NEW', handleNewNotification);
    socket.on('NOTIFICATION_CREATED', handleNewNotification);
    socket.on('NOTIFICATION_COUNT_UPDATE', handleCountUpdate);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('NOTIFICATION_NEW', handleNewNotification);
      socket.off('NOTIFICATION_CREATED', handleNewNotification);
      socket.off('NOTIFICATION_COUNT_UPDATE', handleCountUpdate);
    };
  }, [socket]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getNotifications(15, 0);
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      const deleted = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (deleted && !deleted.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl border text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all cursor-pointer ${
          isOpen ? 'bg-slate-100 border-slate-300 shadow-2xs' : 'bg-white border-slate-200 shadow-2xs'
        } ${animateBell ? 'animate-bounce text-primary-600' : ''}`}
        title="Notifications"
        aria-label="Open notifications"
      >
        <Bell size={18} />

        {/* Red Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-rose-600 text-white font-black text-[8.5px] rounded-full flex items-center justify-center border-[1.5px] border-white shadow-2xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllRead={handleMarkAllRead}
          onDelete={handleDelete}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default NotificationBell;
