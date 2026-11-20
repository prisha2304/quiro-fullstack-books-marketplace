import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useMarketplace } from '../context/MarketplaceContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';
import { 
  ShoppingBag, 
  ArrowRightLeft,
  ArrowRight, 
  Heart, 
  Share2, 
  ShieldCheck, 
  Truck, 
  RefreshCw, 
  Star, 
  ChevronRight, 
  BookOpen,
  Calendar,
  Languages,
  Info,
  CheckCircle2,
  MessageSquare,
  Shield,
  Building,
  Barcode,
  RotateCcw,
  Sparkles,
  User,
  Zap,
  Check,
  ZoomIn,
  Award,
  Clock,
  UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import SwapModal from '../components/SwapModal';
import RelatedBooks from '../components/RelatedBooks';
import CoPurchaseRecommendations from '../components/CoPurchaseRecommendations';
import PersonalizedRecommendations from '../components/PersonalizedRecommendations';
import CustomerReviews from '../components/CustomerReviews';
import AIReviewSummary from '../components/ai/AIReviewSummary';

const BookDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, toggleWishlist, wishlistIds } = useMarketplace();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const fetchBook = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/books/${id}`);
        setBook(data);
        setActiveImage(data.cover_image || '');

        // Persist viewed book in browsing history and trigger reactive recommendation updates
        try {
          const viewed = JSON.parse(localStorage.getItem('booknest_viewed_books') || '[]');
          const updated = [data.id, ...viewed.filter(bid => bid !== data.id)].slice(0, 20);
          localStorage.setItem('booknest_viewed_books', JSON.stringify(updated));
          window.dispatchEvent(new Event('booknest-activity-updated'));
        } catch (e) {}
      } catch (err) {
        console.error('Failed to fetch book', err);
        toast.error('Book listing not found');
        navigate('/browse');
      } finally {
        setLoading(false);
      }
    };

    fetchBook();
    window.scrollTo(0, 0);
  }, [id, navigate]);

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - left) / width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - top) / height) * 100));
    setZoomPos({ x, y });
  };

  const handleAddToCart = () => {
    if (!book) return;
    for (let i = 0; i < quantity; i++) {
      addToCart(book.id);
    }
    toast.success(`Added ${quantity > 1 ? `${quantity} copies` : '1 copy'} to cart!`);
  };

  const handleBuyNow = () => {
    if (!book) return;
    addToCart(book.id);
    navigate('/checkout');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${book.title} on QUIRO`,
        text: `Check out ${book.title} by ${book.author} on QUIRO!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Listing link copied to clipboard!');
    }
  };

  if (loading || !book) return (
    <div className="pt-24 max-w-7xl mx-auto px-4 sm:px-6 py-12 animate-pulse text-left">
      <div className="h-6 bg-slate-200 rounded w-1/3 mb-6"></div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 h-96 bg-slate-200 rounded-2xl"></div>
        <div className="lg:col-span-5 h-96 bg-slate-200 rounded-2xl"></div>
        <div className="lg:col-span-3 h-96 bg-slate-200 rounded-2xl"></div>
      </div>
    </div>
  );

  const isWishlisted = wishlistIds.includes(book.id);
  const originalPrice = book.original_price ? parseFloat(book.original_price) : 0;
  const currentPrice = parseFloat(book.price) || 0;
  const discount = originalPrice > currentPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;
  const savings = originalPrice > currentPrice ? (originalPrice - currentPrice) : 0;
  const isOfficial = book.seller_role === 'ADMIN' || (book.seller_name && book.seller_name.toLowerCase().includes('official'));

  const galleryImages = (Array.isArray(book.images) && book.images.length > 0)
    ? book.images
    : [book.cover_image].filter(Boolean);

  return (
    <div className="bg-[#FAFAF9] min-h-screen pt-20 pb-24 text-left animate-in fade-in duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-6 flex-wrap">
          <Link to="/" className="hover:text-primary-600 transition-colors">Home</Link>
          <ChevronRight size={11} className="text-slate-400" />
          <Link to="/browse" className="hover:text-primary-600 transition-colors">Browse</Link>
          <ChevronRight size={11} className="text-slate-400" />
          <Link to={`/browse?genre=${book.genre}`} className="text-primary-600 hover:underline font-bold uppercase tracking-wider">
            {book.genre || 'Academic'}
          </Link>
          <ChevronRight size={11} className="text-slate-400" />
          <span className="text-slate-800 font-bold truncate max-w-[240px] sm:max-w-md">{book.title}</span>
        </nav>

        {/* ========================================================
            3-COLUMN DESKTOP MARKETPLACE PDP LAYOUT
           ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ========================================================
              COLUMN 1: COVER GALLERY & HOVER ZOOM (4 cols)
             ======================================================== */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Main Interactive Zoom Box */}
            <div 
              className="relative aspect-[3/4.2] bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-center shadow-soft overflow-hidden group cursor-crosshair select-none"
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={handleMouseMove}
            >
              <img 
                src={activeImage || book.cover_image} 
                alt={book.title} 
                className={`w-full h-full object-contain transition-transform duration-200 ${isZoomed ? 'scale-150 pointer-events-none' : 'scale-100'}`}
                style={isZoomed ? { transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : {}}
              />

              {/* Badges Overlay */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
                {discount > 0 && (
                  <span className="bg-rose-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded shadow-sm">
                    {discount}% OFF
                  </span>
                )}
                <span className="bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                  {book.condition || 'Pre-owned � Good'}
                </span>
              </div>

              {/* Wishlist Button */}
              <button
                onClick={() => toggleWishlist(book.id)}
                className={`absolute top-3 right-3 p-2.5 rounded-xl border transition-all z-20 shadow-sm cursor-pointer ${
                  isWishlisted ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white/95 border-slate-200 text-slate-400 hover:text-rose-600'
                }`}
                title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>

              {/* Zoom hint badge */}
              <div className="absolute bottom-3 right-3 bg-slate-900/75 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <ZoomIn size={11} /> Roll to Zoom
              </div>
            </div>

            {/* Thumbnail Angle Strip */}
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`w-14 sm:w-16 aspect-[3/4] rounded-xl overflow-hidden border-2 p-1 bg-white shrink-0 transition-all cursor-pointer ${
                    activeImage === img ? 'border-primary-600 shadow-2xs' : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>

            {/* Quality Guarantee Pill */}
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center gap-2.5 text-xs text-slate-700 font-medium">
              <ShieldCheck size={18} className="text-primary-600 shrink-0" />
              <span><strong>Inspection Certified:</strong> No missing pages, intact binding & legible textbook print.</span>
            </div>

          </div>

          {/* ========================================================
              COLUMN 2: METADATA, SPECS & REPUTATION (5 cols)
             ======================================================== */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Title, Genre & Author */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary-600 bg-primary-50 px-2 py-0.5 rounded border border-primary-100">
                {book.genre || 'Academic Textbook'}
              </span>

              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug pt-1">
                {book.title}
              </h1>

              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                by <span className="font-bold text-slate-800">{book.author}</span> � {book.publisher || 'Official Academic Edition'}
              </p>
            </div>

            {/* Ratings & Social Proof Header Strip */}
            <div className="flex items-center gap-3 py-1 flex-wrap">
              <div className="flex items-center gap-1 text-amber-500 text-xs font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      size={12} 
                      className={star <= Math.round(parseFloat(book.rating || 4.8)) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} 
                    />
                  ))}
                </div>
                <span className="text-slate-900 ml-1 font-black">{book.rating || '4.8'}</span>
              </div>
              <span className="text-slate-300">|</span>
              <a href="#reviews-section" className="text-xs font-semibold text-primary-600 hover:underline">
                {book.review_count || 12} Verified Student Reviews
              </a>
              <span className="text-slate-300">|</span>
              <span className="text-xs font-medium text-slate-500">
                {book.views || 48} Readers Viewed
              </span>
            </div>

            {/* Synopsis / Description */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Synopsis & Notes
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {book.description || 'This edition contains complete reference material, diagrams, and comprehensive chapter exercises suitable for semester examinations and competitive prep.'}
              </p>
            </div>

            {/* Book Specification Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Book Specifications
              </h3>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                <div className="flex flex-col">
                  <span className="text-slate-400 font-medium">Condition</span>
                  <span className="font-bold text-slate-800">{book.condition || 'Good'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-400 font-medium">ISBN-13 / ID</span>
                  <span className="font-bold text-slate-800 font-mono">{book.isbn || `BN-${book.id}9820`}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-400 font-medium">Language</span>
                  <span className="font-bold text-slate-800">{book.language || 'English'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-400 font-medium">Publication Year</span>
                  <span className="font-bold text-slate-800">{book.publication_year || 'Latest Edition'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-400 font-medium">Publisher</span>
                  <span className="font-bold text-slate-800">{book.publisher || 'Academic Press'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-400 font-medium">Exchange Policy</span>
                  <span className="font-bold text-slate-800">{book.swap_enabled ? 'Available for Swap' : 'Direct Purchase Only'}</span>
                </div>
              </div>
            </div>

            {/* Verified Seller Reputation Profile Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Sold & Fulfilled by
                </span>
                {isOfficial ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-[10px] font-extrabold rounded-md border border-primary-200">
                    <ShieldCheck size={11} className="text-primary-600" /> QUIRO Official Hub
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold rounded-md border border-emerald-200">
                    <Award size={11} className="text-emerald-600" /> Verified Reader Seller
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {book.seller_name ? book.seller_name.charAt(0).toUpperCase() : 'Q'}
                  </div>
                  <div className="min-w-0">
                    <Link 
                      to={book.seller_id ? `/seller/${book.seller_id}` : '#'} 
                      className="text-xs font-bold text-slate-900 truncate hover:text-primary-600 transition-colors block"
                    >
                      {book.seller_name || 'QUIRO Official Hub'}
                    </Link>
                    <p className="text-[11px] text-slate-500 font-medium">
                      ? 4.9 � 99.4% Positive Escrow Rating
                    </p>
                  </div>
                </div>

                <Link
                  to={book.seller_id ? `/seller/${book.seller_id}` : '#'}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-primary-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors shrink-0"
                >
                  View Profile
                </Link>
              </div>

              {/* Seller Trust Highlights */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-[10px] font-semibold text-slate-500">
                <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-900 block">100%</span>
                  <span>Fulfillment</span>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-900 block">&lt; 2 hrs</span>
                  <span>Response</span>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-900 block">7-Day</span>
                  <span>Dispute Hold</span>
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================
              COLUMN 3: STICKY BUY BOX & CONVERSION TILE (3 cols)
             ======================================================== */}
          <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-24">
            
            <div className="bg-white border-2 border-slate-200/90 rounded-2xl p-5 shadow-soft space-y-5">
              
              {/* Pricing Breakdown */}
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {formatCurrency(currentPrice)}
                  </span>
                  {originalPrice > currentPrice && (
                    <span className="text-xs font-semibold text-slate-400 line-through">
                      {formatCurrency(originalPrice)}
                    </span>
                  )}
                </div>

                {discount > 0 && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-md border border-emerald-100">
                    <span>{discount}% OFF</span>
                    <span>�</span>
                    <span>Save {formatCurrency(savings)}</span>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Inclusive of all local taxes & GST</p>
              </div>

              {/* Stock Status & Delivery */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>In Stock � Ready to Dispatch</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-600">
                  <Truck size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">FREE Standard Delivery</strong> on orders over ?499. Dispatched in 24 hrs.
                  </span>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-700">Quantity:</span>
                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden h-8 w-24">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-600 font-bold text-sm"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center text-xs font-bold text-slate-800">
                    {quantity}
                  </span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-full flex items-center justify-center hover:bg-slate-200 text-slate-600 font-bold text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Primary CTAs */}
              <div className="space-y-2.5 pt-1">
                {book.sale_enabled !== false && (
                  <>
                    <button
                      onClick={handleAddToCart}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl font-bold text-xs transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                    >
                      <ShoppingBag size={15} />
                      <span>Add to Cart</span>
                    </button>

                    <button
                      onClick={handleBuyNow}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold text-xs transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                    >
                      <Zap size={15} className="text-amber-400" />
                      <span>Buy Now (Instant Checkout)</span>
                    </button>
                  </>
                )}

                {book.swap_enabled && (
                  <button
                    onClick={() => setShowSwapModal(true)}
                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} className="text-emerald-700" />
                    <span>Propose Peer Book Swap</span>
                  </button>
                )}
              </div>

                            {/* Ask NestAI about this book Card */}
              <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-200/70 rounded-2xl p-4 shadow-soft space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Sparkles size={13} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Ask NestAI about this book</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Instant student advice & comparisons</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {[
                    "Is this good for beginners?",
                    "What books are similar to this?",
                    "Is there a cheaper alternative?",
                    "Compare this with similar books."
                  ].map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('open-nestai-book-context', {
                          detail: { book, prompt }
                        }));
                      }}
                      className="w-full text-left px-3 py-1.5 bg-white hover:bg-primary-50 text-slate-700 hover:text-primary-700 rounded-xl text-[11px] font-semibold border border-slate-200/80 hover:border-primary-300 transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
                    >
                      <span>{prompt}</span>
                      <ArrowRight size={11} className="text-slate-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Trust Guarantee Rail */}
              <div className="pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-600 font-medium">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  <span>Razorpay 256-bit Encrypted Escrow</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-blue-600 shrink-0" />
                  <span>7-Day Return Policy on Damage</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                  <span>100% Student Verified Marketplace</span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* ========================================================
            CUSTOMER REVIEWS & VERIFIED RATINGS SECTION
           ======================================================== */}
        <div id="reviews-section">
          <AIReviewSummary bookId={book.id} />
          <CustomerReviews 
            bookId={book.id} 
            sellerId={book.seller_id} 
            bookTitle={book.title} 
          />
        </div>

        {/* ========================================================
            RECOMMENDATION CAROUSEL STRIPS
           ======================================================== */}
        <div className="mt-12 space-y-4">
          {/* 1. Co-Purchase: Users Who Bought This Also Bought */}
          <CoPurchaseRecommendations currentBookId={book.id} />

          {/* 2. Genre-Based: You May Also Like */}
          <RelatedBooks currentBookId={book.id} currentGenre={book.genre} />

          {/* 3. Personalized Taste Profile */}
          <PersonalizedRecommendations 
            title="Because You Read Similar Books" 
            subtitle="Tailored recommendations curated from your reading activity" 
            limit={6} 
            badgeText="Taste Match" 
            isCarousel={true}
          />
        </div>

      </div>

      {/* ========================================================
          MOBILE STICKY BOTTOM ACTION BAR (< lg viewports)
         ======================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-premium lg:hidden flex items-center justify-between gap-3">
        <div className="flex flex-col text-left">
          <span className="text-lg font-black text-slate-900 leading-none">
            {formatCurrency(currentPrice)}
          </span>
          {discount > 0 && (
            <span className="text-[10px] font-bold text-emerald-600">
              {discount}% OFF
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-grow justify-end max-w-[280px]">
          <button
            onClick={handleAddToCart}
            className="flex-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 py-2.5 px-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1"
          >
            <ShoppingBag size={14} />
            <span>Add</span>
          </button>
          
          <button
            onClick={handleBuyNow}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 px-3 rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-1"
          >
            <span>Buy Now</span>
          </button>
        </div>
      </div>

      {/* Swap Modal */}
      {showSwapModal && (
        <SwapModal book={book} onClose={() => setShowSwapModal(false)} />
      )}

    </div>
  );
};

export default BookDetails;


