
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import personalizationService from '../services/personalizationService';
import { formatCurrency } from '../utils/format';
import {
  Heart,
  Trash2,
  ShoppingCart,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Package,
  ExternalLink,
  User,
  Loader2,
  TrendingDown,
  ArrowUpDown,
  ShoppingBag,
  Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardSidebar from '../components/DashboardSidebar';
import PriceAlertButton from '../components/personalization/PriceAlertButton';
import OptimizedImage from '../components/OptimizedImage';

const Wishlist = () => {
  const { user } = useAuth();
  const { addToCart } = useMarketplace();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    // Check and merge guest wishlist if present
    const guestWishlist = JSON.parse(localStorage.getItem('guest_wishlist') || '[]');
    if (user && guestWishlist.length > 0) {
      personalizationService.mergeWishlist(guestWishlist)
        .then(() => {
          localStorage.removeItem('guest_wishlist');
          fetchWishlist();
        })
        .catch(() => fetchWishlist());
    } else {
      fetchWishlist();
    }
  }, [user, sortBy]);

  const fetchWishlist = async () => {
    setLoading(true);
    try {
      if (user) {
        const { data } = await personalizationService.getWishlist(sortBy);
        setWishlist(data.items || []);
      } else {
        // Fallback for guest
        const guestIds = JSON.parse(localStorage.getItem('guest_wishlist') || '[]');
        setWishlist([]);
      }
    } catch (err) {
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (bookId) => {
    try {
      await personalizationService.removeFromWishlist(bookId);
      setWishlist(prev => prev.filter(item => item.bookId !== bookId));
      toast.success('Removed from wishlist');
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const handleMoveToCart = async (bookId) => {
    try {
      await addToCart(bookId, 1);
      await handleRemove(bookId);
      toast.success('Moved to cart!');
    } catch (err) {
      toast.error('Failed to move item to cart');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-24 animate-in fade-in duration-300 min-h-screen text-left">
      <div className="flex flex-col lg:flex-row gap-8">

        {/* Navigation Sidebar */}
        <DashboardSidebar />

        <div className="flex-grow min-w-0">

          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 pb-6 border-b border-slate-200/80">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block mb-1">
                Saved Books & Price Tracker
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                My Wishlist ({wishlist.length})
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Saved textbooks, automatic price-drop monitoring, and restock notifications.
              </p>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                <ArrowUpDown size={13} /> Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-slate-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none shadow-2xs"
              >
                <option value="date">Date Added</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>

          {/* Wishlist Items List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : wishlist.length > 0 ? (
            <div className="space-y-4">
              {wishlist.map((item) => (
                <div
                  key={item.wishlistId || item.bookId}
                  className="group bg-white border border-slate-200/80 p-5 sm:p-6 rounded-3xl shadow-soft hover:shadow-md hover:border-primary-200 transition-all flex flex-col sm:flex-row items-center gap-6"
                >
                  {/* Book Cover */}
                  <div className="relative shrink-0 w-24 sm:w-28 aspect-[3/4] rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shadow-xs">
                    <OptimizedImage
                      src={item.coverImage}
                      alt={item.title}
                      className="w-full h-full object-contain"
                    />
                    {item.hasPriceDrop && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-white rounded-lg text-[9px] font-black shadow-xs flex items-center gap-0.5">
                        <TrendingDown size={10} />
                        <span>{item.discountPercent}% OFF</span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-grow flex flex-col text-center sm:text-left min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {item.genre}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.isAvailable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                        {item.isAvailable ? 'In Stock' : 'Sold Out'}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                        {item.condition || 'Used'}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900 mb-0.5 group-hover:text-primary-600 transition-colors truncate">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mb-3 italic">
                      by <span className="text-slate-800 font-bold not-italic">{item.author}</span>
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Price</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-black text-slate-900">{formatCurrency(item.price)}</span>
                          {item.hasPriceDrop && (
                            <span className="text-xs font-bold text-slate-400 line-through">
                              {formatCurrency(item.originalPrice)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Seller</span>
                        <Link to={`/seller/${item.seller?.id}`} className="font-bold text-primary-600 hover:underline flex items-center gap-1">
                          <User size={12} /> {item.seller?.name || 'Student Seller'}
                        </Link>
                      </div>

                      <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                      <div className="pt-1 sm:pt-0">
                        <PriceAlertButton
                          bookId={item.bookId}
                          currentPrice={item.price}
                          isSubscribed={item.priceAlertActive}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto shrink-0">
                    <button
                      disabled={!item.isAvailable}
                      onClick={() => handleMoveToCart(item.bookId)}
                      className="flex-grow px-4 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-xs hover:bg-primary-700 transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <ShoppingCart size={14} />
                      <span>Move to Cart</span>
                    </button>
                    <div className="flex gap-2">
                      <Link
                        to={`/book/${item.bookId}`}
                        className="flex-grow p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all flex items-center justify-center border border-slate-200/80"
                        title="View Details"
                      >
                        <ExternalLink size={15} />
                      </Link>
                      <button
                        onClick={() => handleRemove(item.bookId)}
                        className="p-2.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-slate-200/80"
                        title="Remove from Wishlist"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-3xl border border-slate-200/80 shadow-soft">
              <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 mx-auto mb-4">
                <Heart size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Your wishlist is empty</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6 font-medium">
                Save textbooks to your wishlist to receive price-drop notifications and back-in-stock alerts.
              </p>
              <Link to="/browse" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all active:scale-95">
                <ShoppingBag size={14} />
                <span>Explore Catalog</span>
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Wishlist;
