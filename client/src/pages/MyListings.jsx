import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusCircle, 
  Trash2, 
  Eye, 
  TrendingUp, 
  Package, 
  CheckCircle2, 
  AlertCircle,
  Edit2,
  RefreshCw,
  ShoppingBag,
  Clock,
  DollarSign,
  Search,
  ArrowRightLeft,
  ChevronRight,
  Filter,
  Check,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import bookService from '../services/bookService';
import swapService from '../services/swapService';
import OptimizedImage from '../components/OptimizedImage';
import userService from '../services/userService';
import { formatCurrency } from '../utils/format';
import { BookCardSkeleton } from '../components/Skeleton';

const MyListings = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalListed: 0,
    sold: 0,
    swapped: 0,
    revenue: 0,
    pendingOrders: 0,
    pendingSwaps: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [booksRes, swapsRes, dashboardStatsRes] = await Promise.all([
        bookService.getMyBooks(),
        swapService.getReceivedRequests().catch(err => {
          console.warn('Could not fetch swap requests for seller stats:', err);
          return { data: [] };
        }),
        userService.getDashboardStats().catch(() => ({ data: {} }))
      ]);
      
      const books = Array.isArray(booksRes.data) ? booksRes.data : [];
      setListings(books);
      
      const soldBooks = books.filter(b => b.status === 'sold');
      const swappedBooks = books.filter(b => b.status === 'swapped');
      const revenue = soldBooks.reduce((sum, b) => sum + (parseFloat(b.price) || 0), 0);
      const pendingSwaps = (Array.isArray(swapsRes.data) ? swapsRes.data : []).filter(s => s.status === 'pending').length;

      setStats({
        totalListed: books.length,
        sold: soldBooks.length,
        swapped: swappedBooks.length,
        revenue: revenue || parseFloat(dashboardStatsRes.data?.revenueEarned || 0),
        pendingOrders: dashboardStatsRes.data?.pendingOrders || 0,
        pendingSwaps: pendingSwaps
      });
      
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to load listings data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this listing?')) return;
    
    try {
      await bookService.deleteBook(id);
      toast.success('Listing removed successfully');
      setListings(listings.filter(l => l.id !== id));
    } catch (error) {
      toast.error('Failed to delete listing');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const listing = listings.find(l => l.id === id);
      await bookService.updateBook(id, { ...listing, status: newStatus });
      toast.success(`Listing status updated to ${newStatus}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Filter listings based on active tab and search query
  const filteredListings = listings.filter(item => {
    const matchesTab = 
      activeTab === 'available' ? item.status === 'available' :
      activeTab === 'sold' ? item.status === 'sold' :
      activeTab === 'swapped' ? item.status === 'swapped' :
      activeTab === 'draft' ? (item.status === 'draft' || item.status === 'inactive') : true;

    const matchesSearch = !searchQuery.trim() || 
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.genre?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const availableCount = listings.filter(l => l.status === 'available').length;
  const soldCount = listings.filter(l => l.status === 'sold').length;
  const swappedCount = listings.filter(l => l.status === 'swapped').length;
  const draftCount = listings.filter(l => l.status === 'draft' || l.status === 'inactive').length;

  return (
    <div className="bg-[#FAFAF9] min-h-screen pt-20 pb-24 text-left animate-in fade-in duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header Title & Create Listing CTA */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 pb-6 border-b border-slate-200/80">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 block mb-1">
              Seller Command Center
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              My Marketplace Listings
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage your academic and textbook inventory, monitor orders, and track revenue
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              to="/dashboard"
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xs transition-colors"
            >
              Dashboard
            </Link>
            <Link 
              to="/sell" 
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
            >
              <PlusCircle size={15} />
              <span>List New Book</span>
            </Link>
          </div>
        </div>

        {/* Seller Analytics Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Revenue</span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <DollarSign size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">{formatCurrency(stats.revenue)}</p>
            <span className="text-[10px] text-slate-400 font-semibold">{stats.sold} completed book sales</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Listings</span>
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Package size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">{availableCount}</p>
            <span className="text-[10px] text-slate-400 font-semibold">Live in public catalog</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Swaps Completed</span>
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <ArrowRightLeft size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">{stats.swapped}</p>
            <span className="text-[10px] text-slate-400 font-semibold">{stats.pendingSwaps} requests pending</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Books Sold</span>
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">{stats.sold}</p>
            <span className="text-[10px] text-slate-400 font-semibold">100% verified fulfillment</span>
          </div>

        </div>

        {/* Tab Navigation & Search Bar Controls */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft mb-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            
            {/* 4 Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100/70 p-1 rounded-xl">
              <TabButton 
                active={activeTab === 'available'} 
                onClick={() => setActiveTab('available')} 
                label="Active Listings" 
                count={availableCount} 
              />
              <TabButton 
                active={activeTab === 'sold'} 
                onClick={() => setActiveTab('sold')} 
                label="Sold Books" 
                count={soldCount} 
              />
              <TabButton 
                active={activeTab === 'swapped'} 
                onClick={() => setActiveTab('swapped')} 
                label="Swapped Books" 
                count={swappedCount} 
              />
              <TabButton 
                active={activeTab === 'draft'} 
                onClick={() => setActiveTab('draft')} 
                label="Drafts" 
                count={draftCount} 
              />
            </div>

            {/* Quick Search */}
            <div className="relative w-full md:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your listings..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-primary-600 focus:bg-white"
              />
            </div>

          </div>
        </div>

        {/* Listings Display Grid */}
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <BookCardSkeleton key={i} />)}
            </div>
          ) : filteredListings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredListings.map(book => (
                <MyListingCard 
                  key={book.id} 
                  book={book} 
                  onDelete={() => handleDelete(book.id)}
                  onStatusChange={(newStatus) => handleStatusChange(book.id, newStatus)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center space-y-4">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  No {activeTab} listings found
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  {searchQuery ? `No listings match your search query "${searchQuery}".` : `You currently have no books in the ${activeTab} category.`}
                </p>
              </div>
              {activeTab === 'available' && !searchQuery && (
                <Link to="/sell" className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm">
                  <PlusCircle size={14} />
                  <span>List Your First Book</span>
                </Link>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label, count }) => (
  <button 
    onClick={onClick}
    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
      active 
        ? 'bg-white text-slate-900 shadow-2xs' 
        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
    }`}
  >
    <span>{label}</span>
    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
      active ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
    }`}>
      {count}
    </span>
  </button>
);

const MyListingCard = ({ book, onDelete, onStatusChange }) => {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft hover:shadow-premium transition-all flex gap-4 text-left">
      {/* Thumbnail Cover */}
      <div className="w-20 sm:w-24 aspect-[3/4.2] rounded-xl overflow-hidden bg-slate-50 border border-slate-100 p-1 shrink-0 flex items-center justify-center">
        <OptimizedImage 
          src={book.cover_image} 
          alt={book.title} 
          className="w-full h-full object-contain" 
        />
      </div>

      {/* Info & Action Controls */}
      <div className="flex-grow flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-primary-600 block truncate">
                {book.genre || 'Academic'}
              </span>
              <h3 className="text-sm font-bold text-slate-900 truncate" title={book.title}>
                {book.title}
              </h3>
            </div>
            
            {/* Status Pill */}
            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
              book.status === 'available' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              book.status === 'sold' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
              book.status === 'swapped' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
              'bg-slate-100 text-slate-600'
            }`}>
              {book.status}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 font-medium truncate mb-2">
            by {book.author} · <span className="font-semibold text-slate-700">{book.condition || 'Good'}</span>
          </p>

          <div className="flex items-center gap-3 text-xs font-black text-slate-900 mb-3">
            <span>{formatCurrency(book.price)}</span>
            {book.swap_enabled && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                <RefreshCw size={10} /> Swap Enabled
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            {book.status === 'available' ? (
              <button 
                onClick={() => onStatusChange('sold')}
                className="text-[11px] font-bold text-primary-600 hover:underline cursor-pointer"
              >
                Mark as Sold
              </button>
            ) : (
              <button 
                onClick={() => onStatusChange('available')}
                className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
              >
                Mark as Available
              </button>
            )}
            <span className="text-slate-300">|</span>
            <Link 
              to={`/book/${book.id}`} 
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <Eye size={12} /> View Listing
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <Link 
              to={`/sell/edit/${book.id}`}
              className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-50 rounded-lg transition-colors"
              title="Edit Listing"
            >
              <Edit2 size={13} />
            </Link>
            <button 
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Delete Listing"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MyListings;
