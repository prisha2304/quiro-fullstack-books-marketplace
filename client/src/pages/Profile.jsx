import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import userService from '../services/userService';
import bookService from '../services/bookService';
import orderService from '../services/orderService';
import swapService from '../services/swapService';
import personalizationService from '../services/personalizationService';
import { formatCurrency } from '../utils/format';
import { 
  User, 
  MapPin, 
  BookOpen, 
  Phone, 
  Calendar, 
  Package, 
  ArrowRightLeft, 
  History, 
  ShieldCheck, 
  Save, 
  Trash2, 
  Edit2, 
  Eye, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Award,
  Sparkles,
  Heart,
  TrendingUp,
  Tag,
  Star,
  Users,
  Compass
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'reading_profile', 'achievements', 'listings', 'orders', 'recently_viewed'
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [readingProfile, setReadingProfile] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [followedSellers, setFollowedSellers] = useState([]);
  
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    college: '',
    bio: '',
    profile_image: ''
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        college: user.college || '',
        bio: user.bio || '',
        profile_image: user.profile_image || ''
      });
      fetchUserData();
      fetchPersonalizationData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const [listingsRes, ordersRes, swapsRes] = await Promise.all([
        bookService.getMyBooks(),
        orderService.getMyOrders(),
        swapService.getReceivedRequests()
      ]);
      setListings(listingsRes.data || []);
      setOrders(ordersRes.data || []);
      setSwaps(swapsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch user data', err);
    }
  };

  const fetchPersonalizationData = async () => {
    try {
      const [profRes, achRes, recRes, folRes] = await Promise.all([
        personalizationService.getUserReadingProfile(),
        personalizationService.getUserAchievements(),
        personalizationService.getRecentlyViewed(8),
        personalizationService.getFollowedSellers()
      ]);
      setReadingProfile(profRes.data);
      setAchievements(achRes.data || []);
      setRecentlyViewed(recRes.data || []);
      setFollowedSellers(folRes.data || []);
    } catch (err) {
      console.error('Failed to load personalization profile', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await userService.updateProfile(profileForm);
      setUser(prev => ({ ...prev, ...data.user }));
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#FAFAF9] min-h-screen pt-20 pb-24 text-left animate-in fade-in duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* User Top Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-soft mb-8 flex flex-col md:flex-row items-center gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 text-2xl sm:text-3xl font-black shrink-0">
            {user?.full_name?.charAt(0) || 'U'}
          </div>

          <div className="flex-grow text-center md:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {user?.full_name || 'QUIRO Reader'}
              </h1>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Verified Reader
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {user?.email} • {user?.college || 'Community Member'}
            </p>
            <p className="text-xs text-slate-600 font-normal italic pt-1 max-w-xl">
              "{user?.bio || 'Avid reader sharing and discovering beloved books on QUIRO.'}"
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 shrink-0 bg-slate-50 border border-slate-200/60 p-3 rounded-2xl">
            <div className="text-center px-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Purchases</span>
              <span className="text-base font-black text-slate-900">{orders.length}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-center px-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Listings</span>
              <span className="text-base font-black text-slate-900">{listings.length}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-center px-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Badges</span>
              <span className="text-base font-black text-amber-600">{achievements.length}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
          {[
            { id: 'info', label: 'Profile Information', icon: <User size={14} /> },
            { id: 'reading_profile', label: 'Reading & Buying Profile', icon: <Compass size={14} /> },
            { id: 'achievements', label: 'Achievements & Badges', icon: <Award size={14} /> },
            { id: 'recently_viewed', label: 'Recently Viewed', icon: <History size={14} /> },
            { id: 'following', label: 'Followed Sellers', icon: <Users size={14} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Profile Information Form */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-soft">
            <h2 className="text-base font-black text-slate-900 mb-4">Edit Student Account Details</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">College / University</label>
                  <input
                    type="text"
                    value={profileForm.college}
                    onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Bio & Academic Interests</label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Reading & Buying Profile */}
        {activeTab === 'reading_profile' && readingProfile && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft md:col-span-2 space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900">Your QUIRO Literary Profile</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Derived from your observed catalog searches, purchases, and book interactions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Top Subject Areas</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {readingProfile.topCategories.map((cat, i) => (
                      <span key={i} className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Typical Price Bracket</span>
                  <span className="text-lg font-black text-slate-900 block mt-1">{readingProfile.typicalPriceRange}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Optimal student textbook affordability bracket</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>Preferred Condition: <strong>{readingProfile.preferredCondition}</strong></span>
                <span>Verified Purchases: <strong>{readingProfile.totalPurchases} orders</strong></span>
              </div>
            </div>

            <div className="bg-linear-to-br from-indigo-600 to-primary-700 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between">
              <div>
                <Sparkles className="w-7 h-7 text-amber-300 mb-3" />
                <h4 className="text-base font-black">Personalized AI Discovery Active</h4>
                <p className="text-xs text-indigo-100 font-medium mt-1.5 leading-relaxed">
                  QUIRO uses these signals to highlight peer discounts, restock alerts, and relevant literary reads on your homepage.
                </p>
              </div>
              <Link to="/browse" className="mt-4 inline-block bg-white text-slate-900 px-4 py-2 rounded-xl text-xs font-bold text-center shadow-xs">
                Explore For You
              </Link>
            </div>
          </div>
        )}

        {/* Tab 3: Achievements & Badges */}
        {activeTab === 'achievements' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-soft space-y-6">
            <div>
              <h3 className="text-base font-black text-slate-900">Marketplace Achievements & Milestones</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Earn verified student reputation badges through orders, reviews, and community participation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {achievements.map((ach) => (
                <div key={ach.id || ach.achievement_key} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                    <Award size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">{ach.title}</h4>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">{ach.description}</p>
                    <span className="text-[9px] font-bold text-slate-400 mt-1 block">
                      Unlocked {new Date(ach.unlocked_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Recently Viewed */}
        {activeTab === 'recently_viewed' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-soft space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Recently Viewed Books ({recentlyViewed.length})</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Quick access to listings you inspected recently.</p>
              </div>
              {recentlyViewed.length > 0 && (
                <button
                  onClick={async () => {
                    await personalizationService.clearRecentlyViewed();
                    setRecentlyViewed([]);
                    toast.success('Recently viewed cleared');
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors"
                >
                  Clear History
                </button>
              )}
            </div>

            {recentlyViewed.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No recently viewed listings yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {recentlyViewed.map((b) => (
                  <Link
                    key={b.id}
                    to={`/book/${b.id}`}
                    className="group bg-slate-50 border border-slate-200/80 rounded-2xl p-3 hover:border-primary-200 hover:shadow-xs transition-all"
                  >
                    <img src={b.cover_image} alt={b.title} className="w-full aspect-[3/4] object-cover rounded-xl mb-2" />
                    <h4 className="text-xs font-black text-slate-900 truncate group-hover:text-primary-600">{b.title}</h4>
                    <span className="text-xs font-bold text-slate-800 block mt-1">{formatCurrency(b.price)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Followed Sellers */}
        {activeTab === 'following' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-soft space-y-6">
            <div>
              <h3 className="text-base font-black text-slate-900">Sellers You Follow ({followedSellers.length})</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Receive alerts when these merchants list new textbooks.</p>
            </div>

            {followedSellers.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">You are not following any campus sellers yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {followedSellers.map((s) => (
                  <div key={s.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-black text-xs">
                        {s.full_name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{s.full_name}</h4>
                        <p className="text-[10px] text-slate-500 font-medium">{s.college || 'Campus Seller'} • {s.listings_count} books</p>
                      </div>
                    </div>
                    <Link to={`/seller/${s.id}`} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-primary-600 hover:bg-primary-50">
                      View Shop
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default Profile;
