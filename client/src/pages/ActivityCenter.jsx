import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Package, 
  ArrowRightLeft, 
  MessageSquare, 
  Star, 
  Megaphone, 
  Clock, 
  ChevronRight, 
  Filter, 
  ExternalLink,
  Sparkles,
  Inbox,
  Loader2,
  Calendar,
  AlertTriangle,
  Tag
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import DashboardSidebar from '../components/DashboardSidebar';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'ALL', label: 'All Activity' },
  { id: 'ORDERS', label: 'Orders' },
  { id: 'MESSAGES', label: 'Messages' },
  { id: 'SWAPS', label: 'Swaps' },
  { id: 'REVIEWS', label: 'Reviews' },
  { id: 'ANNOUNCEMENTS', label: 'Announcements' }
];

const getCategoryBadge = (category) => {
  switch (category) {
    case 'BOOK_FAIR':
      return { label: 'Book Fair', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <Sparkles size={11} /> };
    case 'OFFER':
      return { label: 'Special Offer', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <Tag size={11} /> };
    case 'MAINTENANCE':
      return { label: 'Maintenance Notice', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: <AlertTriangle size={11} /> };
    case 'CAMPUS_EVENT':
      return { label: 'Campus Event', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Calendar size={11} /> };
    default:
      return { label: 'Announcement', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: <Megaphone size={11} /> };
  }
};

const getTypeIcon = (type, category) => {
  switch (type) {
    case 'ANNOUNCEMENTS':
      return <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0"><Megaphone size={18} /></div>;
    case 'ORDERS':
      return <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary-600 border border-blue-200 flex items-center justify-center shrink-0"><Package size={18} /></div>;
    case 'SWAPS':
      return <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0"><ArrowRightLeft size={18} /></div>;
    case 'MESSAGES':
      return <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0"><MessageSquare size={18} /></div>;
    case 'REVIEWS':
      return <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center shrink-0"><Star size={18} className="fill-amber-400 text-amber-400" /></div>;
    default:
      return <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0"><Bell size={18} /></div>;
  }
};

const ActivityCenter = () => {
  const [activeTab, setActiveTab] = useState('ALL');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, [activeTab]);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const res = await api.get('/activity', { params: { filter: activeTab, limit: 40 } });
      setActivities(res.data || []);
    } catch (err) {
      console.error('Failed to load activity stream', err);
      toast.error('Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-col lg:flex-row gap-8 bg-[#FAFAF9] min-h-screen text-left animate-in fade-in duration-200">
      
      {/* Sidebar Navigation */}
      <DashboardSidebar />

      {/* Main Activity Stream Content */}
      <main className="flex-grow space-y-6 min-w-0">
        
        {/* Header Title */}
        <div className="pb-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 block mb-1">
              Personal Stream
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Marketplace Activity Center
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live updates across orders, peer swaps, messages, verified reviews, and campus broadcasts
            </p>
          </div>

          <button
            onClick={fetchActivity}
            className="text-xs font-bold text-slate-600 hover:text-primary-600 bg-white border border-slate-200/80 px-3.5 py-2 rounded-xl shadow-2xs hover:bg-slate-50 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Clock size={13} />
            <span>Refresh Feed</span>
          </button>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200/80 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Activity Feed Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0"></div>
                <div className="flex-grow space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-2.5 bg-slate-100 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((item) => {
              const badge = item.category ? getCategoryBadge(item.category) : null;
              const formattedTime = new Date(item.timestamp).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-soft hover:shadow-premium hover:border-slate-300 transition-all flex items-start justify-between gap-4 group"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {getTypeIcon(item.type, item.category)}

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                          {item.title}
                        </h3>

                        {badge && (
                          <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${badge.color}`}>
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium pt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {formattedTime}
                        </span>
                        {item.meta?.author && (
                          <span>Posted by {item.meta.author}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.link && (
                    <Link
                      to={item.link}
                      className="text-slate-400 group-hover:text-primary-600 p-2 rounded-xl group-hover:bg-blue-50 transition-all shrink-0 self-center"
                      title="Open details"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/80 space-y-3">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No activity in this category</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your actions, updates, messages, and campus broadcasts will appear here in chronological order.
            </p>
          </div>
        )}

      </main>
    </div>
  );
};

export default ActivityCenter;
