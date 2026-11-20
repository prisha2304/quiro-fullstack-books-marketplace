import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowRightLeft, Heart, Star, ShieldCheck, UserCheck } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatCurrency } from '../utils/format';
import OptimizedImage from './OptimizedImage';

const BookCard = ({ book }) => {
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, wishlistIds } = useMarketplace();
  const isWishlisted = wishlistIds.includes(book.id);

  const originalPrice = book.original_price ? parseFloat(book.original_price) : 0;
  const currentPrice = parseFloat(book.price) || 0;
  const discount = originalPrice > currentPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

  const isOfficial = book.seller_role === 'ADMIN' || (book.seller_name && book.seller_name.toLowerCase().includes('official'));
  const sellerDisplayName = isOfficial ? 'QUIRO Official' : (book.seller_name || 'Verified Reader');

  const handleSellerClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (book.seller_id) {
      navigate(`/seller/${book.seller_id}`);
    }
  };

  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(book.id, book);
  };

  const handleSwapClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/swaps?requested=${book.id}`);
  };

  return (
    <div className="group bg-white border border-[#DCE2E8] rounded-xl overflow-hidden flex flex-col h-full hover:shadow-hover hover:-translate-y-1 transition-all duration-200 relative select-none text-left">
      
      {/* Visual / Cover Image Area (Strict 2:3 Bookstore Aspect Ratio) */}
      <div className="relative aspect-[2/3] w-full bg-[#FAF9F6] p-2 sm:p-2.5 flex items-center justify-center overflow-hidden border-b border-[#DCE2E8]/60">
        <Link to={`/book/${book.id}`} className="w-full h-full flex items-center justify-center">
          <OptimizedImage 
            src={book.cover_image} 
            alt={book.title} 
            className="max-h-full max-w-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-[1.04]"
          />
        </Link>
        
        {/* Top Badges (Discount & Condition) */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
          {discount > 0 && (
            <span className="bg-[#E5A323] text-[#35152F] text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs">
              {discount}% OFF
            </span>
          )}
          <span className="bg-[#35152F]/90 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-2xs">
            {book.condition || 'Good'}
          </span>
        </div>

        {/* Top Right Badges (Swap & Wishlist) */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
          <button 
            type="button"
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              toggleWishlist(book.id); 
            }}
            className={`p-1.5 rounded-lg border transition-all duration-150 cursor-pointer ${
              isWishlisted 
                ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-2xs' 
                : 'bg-white/90 border-[#DCE2E8] text-stone-400 hover:text-rose-600 hover:bg-white shadow-2xs sm:opacity-0 sm:group-hover:opacity-100'
            }`}
            title={isWishlisted ? "Remove from Wishlist" : "Save to Wishlist"}
          >
            <Heart size={13} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Swap Eligible Badge Overlay */}
        {book.swap_enabled ? (
          <div className="absolute bottom-1.5 left-2 right-2 z-10 pointer-events-none">
            <span className="inline-flex items-center gap-1 bg-white/95 border border-[#DCE2E8] text-[#35152F] text-[8px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs shadow-2xs">
              <ArrowRightLeft size={9} className="text-[#E5A323] shrink-0" />
              <span className="truncate">Swap Available</span>
            </span>
          </div>
        ) : null}
      </div>

      {/* Content Area */}
      <div className="p-3 sm:p-3.5 flex flex-col flex-grow justify-between gap-2">
        
        <div>
          {/* Genre Label */}
          <span className="text-[9px] font-bold uppercase tracking-wider text-primary-700 block truncate mb-0.5">
            {book.genre || 'Literature'}
          </span>

          {/* Book Title */}
          <Link 
            to={`/book/${book.id}`} 
            className="font-serif text-xs sm:text-[13px] font-bold text-slate-900 line-clamp-2 hover:text-primary-600 transition-colors leading-snug mb-1 h-8 block"
            title={book.title}
          >
            {book.title}
          </Link>
          
          {/* Author */}
          <p className="text-[10px] text-stone-500 font-medium truncate mb-2">
            by <span className="font-semibold text-stone-700">{book.author}</span>
          </p>

          {/* Seller Attribution & Rating */}
          <div 
            onClick={handleSellerClick}
            className="flex items-center justify-between p-1 rounded-md bg-[#FAF9F6] hover:bg-stone-100 border border-[#DCE2E8]/80 transition-colors cursor-pointer"
            title={`View ${sellerDisplayName}'s profile`}
          >
            <div className="flex items-center gap-1 min-w-0">
              {isOfficial ? (
                <ShieldCheck size={11} className="text-primary-600 shrink-0" />
              ) : (
                <UserCheck size={11} className="text-emerald-600 shrink-0" />
              )}
              <span className="text-[9px] font-semibold text-stone-700 truncate">
                {isOfficial ? 'QUIRO' : sellerDisplayName}
              </span>
            </div>

            <div className="flex items-center gap-0.5 text-gold-600 text-[9px] font-bold shrink-0">
              <Star size={9} className="fill-gold-500 text-gold-500" />
              <span>{book.rating || '4.8'}</span>
            </div>
          </div>
        </div>

        {/* Pricing & Quick Action Strip */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1.5">
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="text-sm font-extrabold text-slate-900">
              {formatCurrency(currentPrice)}
            </span>
            {originalPrice > currentPrice && (
              <span className="text-[10px] text-stone-400 line-through truncate">
                {formatCurrency(originalPrice)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {book.swap_enabled && (
              <button 
                type="button"
                onClick={handleSwapClick}
                className="p-1.5 rounded-lg border border-[#DCE2E8] bg-[#FAF9F6] hover:bg-primary-50 text-stone-600 hover:text-primary-600 transition-colors cursor-pointer"
                title="Propose a Book Swap"
              >
                <ArrowRightLeft size={13} />
              </button>
            )}

            <button 
              type="button"
              onClick={handleQuickAdd}
              disabled={book.status !== 'available'}
              className={`p-1.5 rounded-lg text-white font-bold transition-all shadow-2xs cursor-pointer ${
                book.status === 'available'
                  ? 'bg-primary-600 hover:bg-primary-700 active:scale-95'
                  : 'bg-stone-300 cursor-not-allowed opacity-60'
              }`}
              title={book.status === 'available' ? "Add to Reading Bag" : "Reserved"}
            >
              <ShoppingBag size={13} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};

export default BookCard;
