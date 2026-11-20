import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Package, 
  Truck, 
  ArrowRightLeft, 
  MessageCircle, 
  Star, 
  Heart, 
  Tag, 
  Megaphone,
  CheckCircle2,
  Save,
  ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardSidebar from '../components/DashboardSidebar';
import toast from 'react-hot-toast';

const SETTINGS_CATEGORIES = [
  { id: 'orders', label: 'Orders & Payments', desc: 'Updates when orders are confirmed or paid', icon: Package },
  { id: 'shipping', label: 'Shipping & Delivery', desc: 'Live tracking alerts when items are dispatched or delivered', icon: Truck },
  { id: 'swaps', label: 'Book Swaps', desc: 'New swap proposals, acceptances, and exchanges', icon: ArrowRightLeft },
  { id: 'messages', label: 'Direct Messages', desc: 'Instant chat messages from buyers and sellers', icon: MessageCircle },
  { id: 'reviews', label: 'Verified Reviews', desc: 'Feedback and ratings left on your listings', icon: Star },
  { id: 'wishlist', label: 'Wishlist Restock', desc: 'Alerts when saved textbooks become available again', icon: Heart },
  { id: 'priceDrops', label: 'Price Drop Alerts', desc: 'Notifications when wishlist books get discounted', icon: Tag },
  { id: 'announcements', label: 'Marketplace Announcements', desc: 'Book fairs, campus promotions, and platform updates', icon: Megaphone }
];

const NotificationSettings = () => {
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('booknest_notification_prefs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      orders: true,
      shipping: true,
      swaps: true,
      messages: true,
      reviews: true,
      wishlist: true,
      priceDrops: true,
      announcements: true
    };
  });

  const handleToggle = (id) => {
    setPreferences(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      localStorage.setItem('booknest_notification_prefs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSave = () => {
    localStorage.setItem('booknest_notification_prefs', JSON.stringify(preferences));
    toast.success('Notification preferences saved!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-28 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row gap-8">
        <DashboardSidebar />

        <div className="flex-grow space-y-6 text-left max-w-3xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft">
            <div className="flex items-center gap-3">
              <Link to="/notifications" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors">
                <ChevronLeft size={16} />
              </Link>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Notification Preferences
                </h1>
                <p className="text-xs text-stone-500 font-medium">
                  Choose which real-time alerts and updates you receive on QUIRO.
                </p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-soft flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={14} />
              <span>Save Changes</span>
            </button>
          </div>

          {/* Preferences List */}
          <div className="bg-white rounded-3xl border border-slate-200/80 divide-y divide-slate-100 p-2 shadow-soft">
            {SETTINGS_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isEnabled = preferences[cat.id] !== false;

              return (
                <div key={cat.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-primary-600" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{cat.label}</h4>
                      <p className="text-[11px] text-slate-500">{cat.desc}</p>
                    </div>
                  </div>

                  {/* Switch */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggle(cat.id)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
