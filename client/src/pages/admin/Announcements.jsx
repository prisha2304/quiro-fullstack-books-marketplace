import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Send, 
  Trash2, 
  Sparkles, 
  Tag, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Plus,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { id: 'BOOK_FAIR', label: 'Book Fair Announcement', icon: <Sparkles size={14} />, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'OFFER', label: 'Marketplace Offer / Deal', icon: <Tag size={14} />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'MAINTENANCE', label: 'Maintenance Notice', icon: <AlertTriangle size={14} />, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'CAMPUS_EVENT', label: 'Campus Event', icon: <Calendar size={14} />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'GENERAL', label: 'General Announcement', icon: <Megaphone size={14} />, color: 'bg-slate-50 text-slate-700 border-slate-200' }
];

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [form, setForm] = useState({
    title: '',
    message: '',
    category: 'BOOK_FAIR'
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/announcements');
      setAnnouncements(res.data || []);
    } catch (err) {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      return toast.error('Please enter a title and message');
    }

    try {
      setPublishing(true);
      await api.post('/admin/announcements', form);
      toast.success('Announcement broadcasted to all users!');
      setForm({ title: '', message: '', category: 'BOOK_FAIR' });
      fetchAnnouncements();
    } catch (err) {
      toast.error('Failed to publish announcement');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      toast.success('Announcement deleted');
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-8 text-left animate-in fade-in duration-200">
      
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 block mb-1">
          Broadcast Command Center
        </span>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Admin Announcements & Campus Broadcasts
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Publish book fair bulletins, promotions, maintenance notices, and campus events to all active users
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Broadcast Creation Form (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-primary-600 flex items-center justify-center font-bold">
              <Megaphone size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Create New Broadcast</h2>
              <span className="text-[10px] text-slate-400 font-medium">Sends instant push notification</span>
            </div>
          </div>

          <form onSubmit={handlePublish} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Announcement Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-primary-600 transition-all cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Broadcast Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Annual Campus Book Fair 2026 Starts Tomorrow!"
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-primary-600 transition-all font-medium"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Message Content
              </label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Describe details, location, dates, or coupon promo codes..."
                className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-primary-600 transition-all font-medium resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={publishing}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              {publishing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              <span>Publish & Notify All Users</span>
            </button>
          </form>
        </div>

        {/* Broadcasts History List (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Active Broadcast History</h2>
              <span className="text-[10px] text-slate-400 font-medium">{announcements.length} broadcasts stored</span>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : announcements.length > 0 ? (
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto space-y-2">
              {announcements.map((a) => {
                const catObj = CATEGORIES.find((c) => c.id === a.category) || CATEGORIES[4];
                const dateStr = new Date(a.created_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div key={a.id} className="pt-3 pb-3 flex items-start justify-between gap-3 group">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border ${catObj.color}`}>
                          {catObj.icon}
                          <span>{catObj.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Clock size={10} /> {dateStr}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {a.title}
                      </h4>
                      <p className="text-xs text-slate-600 font-normal leading-relaxed">
                        {a.message}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0 cursor-pointer"
                      title="Delete Announcement"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 space-y-1">
              <Megaphone size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No broadcasts published yet</p>
              <p className="text-[11px]">Use the creation form on the left to broadcast announcements.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default Announcements;
