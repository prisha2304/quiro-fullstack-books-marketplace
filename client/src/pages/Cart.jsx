import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowRight, BookOpen, ShieldCheck, Truck, RotateCcw, Plus, Minus, RefreshCw, LogIn } from 'lucide-react';
import cartService from '../services/cartService';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatCurrency } from '../utils/format';
import OptimizedImage from '../components/OptimizedImage';
import toast from 'react-hot-toast';

const Cart = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { 
    refreshCounts, 
    getGuestCart, 
    removeFromGuestCart, 
    updateGuestCartQuantity, 
    clearGuestCart 
  } = useMarketplace();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCart();
  }, [user]);

  const fetchCart = async () => {
    setLoading(true);
    try {
      if (user) {
        const { data } = await cartService.getCart();
        setItems(data || []);
      } else {
        const guestItems = getGuestCart();
        setItems(guestItems || []);
      }
    } catch (error) {
      toast.error('Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (bookId) => {
    try {
      if (user) {
        await cartService.removeFromCart(bookId);
      } else {
        removeFromGuestCart(bookId);
      }
      setItems(prev => prev.filter(item => (item.id || item.book_id) !== bookId));
      refreshCounts();
      toast.success('Removed from cart');
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const handleUpdateQuantity = async (bookId, newQty) => {
    if (newQty < 1) {
      handleRemove(bookId);
      return;
    }
    try {
      if (user) {
        await cartService.updateQuantity(bookId, newQty);
      } else {
        updateGuestCartQuantity(bookId, newQty);
      }
      setItems(prev => prev.map(item => (item.id || item.book_id) === bookId ? { ...item, quantity: newQty } : item));
      refreshCounts();
    } catch (error) {
      toast.error('Failed to update quantity');
    }
  };

  const handleClearCart = async () => {
    try {
      if (user) {
        await cartService.clearCart();
      } else {
        clearGuestCart();
      }
      setItems([]);
      refreshCounts();
      toast.success('Cart cleared');
    } catch (error) {
      toast.error('Failed to clear cart');
    }
  };

  // Coupons State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Calculations (matching server orderController logic)
  const subtotal = items.reduce((acc, curr) => acc + (parseFloat(curr.price) * (parseInt(curr.quantity) || 1)), 0);
  
  let discount = 0;
  if (appliedCoupon) {
    discount = subtotal * (appliedCoupon.discount_percent / 100);
    if (appliedCoupon.max_discount && discount > parseFloat(appliedCoupon.max_discount)) {
      discount = parseFloat(appliedCoupon.max_discount);
    }
  }

  const discountedSubtotal = subtotal - discount;
  const shipping = items.length > 0 ? (discountedSubtotal > 500 ? 0 : 50) : 0;
  const gst = discountedSubtotal * 0.05;
  const platformFee = items.length > 0 ? 29 : 0;
  const total = discountedSubtotal + shipping + gst + platformFee;

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    try {
      const { data } = await cartService.validateCoupon(couponInput);
      if (subtotal < parseFloat(data.min_order_value)) {
        toast.error(`Minimum order value is ${formatCurrency(data.min_order_value)}`);
        return;
      }
      setAppliedCoupon(data);
      toast.success(`Coupon ${data.code} applied!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon code');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
  };

  if (loading) return (
     <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse">
        <div className="h-10 w-48 bg-slate-100 rounded-lg mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-4">
              {[...Array(2)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl" />)}
           </div>
           <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
     </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 min-h-screen bg-white animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 text-left">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-3">
          <ShoppingBag className="w-6 h-6 text-primary-600 shadow-sm" /> Shopping Bag
        </h1>
        {items.length > 0 && (
          <button 
            onClick={handleClearCart} 
            className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors cursor-pointer select-none"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Guest Shopping Notice Banner */}
      {!user && (
        <div className="mb-6 p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
              <LogIn className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">Shopping as a Guest</p>
              <p className="text-[11px] text-amber-700">Your items are saved in this browser. Sign in at checkout to merge them into your permanent account.</p>
            </div>
          </div>
          <Link to="/login" className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs">
            Sign In Now
          </Link>
        </div>
      )}

      {items.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
          
          {/* Left Column: Items List */}
          <div className="lg:col-span-8 space-y-4">
            {items.map(item => (
              <CartItem 
                key={item.id} 
                book={item} 
                onRemove={() => handleRemove(item.id)} 
                onQtyChange={(newQty) => handleUpdateQuantity(item.id, newQty)}
              />
            ))}
            
            <div className="pt-4 flex justify-between items-center select-none">
              <Link 
                to="/browse" 
                className="text-primary-600 font-bold flex items-center hover:text-primary-750 transition-colors text-xs"
              >
                <ArrowRight className="w-3.5 h-3.5 mr-1.5 rotate-180" /> Continue Shopping
              </Link>
            </div>
          </div>

          {/* Right Column: Order Summary Card */}
          <aside className="lg:col-span-4 border border-slate-100 bg-white p-5 rounded-2xl shadow-soft">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-5 pb-3 border-b border-slate-50">Order Summary</h3>
            
            {/* Promo Code Coupon input */}
            <div className="mb-6">
              {!appliedCoupon ? (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Coupon code (e.g. WELCOME50)"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="flex-grow px-3 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-primary-500 uppercase placeholder:text-slate-350"
                  />
                  <button type="submit" className="bg-slate-800 text-white px-4 py-2 text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors shrink-0">
                    Apply
                  </button>
                </form>
              ) : (
                <div className="bg-emerald-50/70 border border-emerald-100 text-emerald-700 px-3.5 py-2.5 rounded-xl flex justify-between items-center text-xs font-bold shadow-sm">
                  <span>Code {appliedCoupon.code} (-{appliedCoupon.discount_percent}%)</span>
                  <button onClick={handleRemoveCoupon} className="text-red-500 hover:text-red-750 underline text-[10px] uppercase font-bold">Remove</button>
                </div>
              )}
            </div>

            {/* Price Calculations */}
            <div className="space-y-3.5 mb-6">
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>Subtotal ({items.reduce((acc, curr) => acc + (parseInt(curr.quantity) || 1), 0)} items)</span>
                <span className="font-bold text-slate-850">{formatCurrency(subtotal)}</span>
              </div>
              
              {discount > 0 && (
                <div className="flex justify-between text-xs font-semibold text-emerald-600">
                  <span>Discount Coupon</span>
                  <span className="font-bold">- {formatCurrency(discount)}</span>
                </div>
              )}

              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>Delivery Shipping Fee</span>
                {shipping === 0 ? (
                  <span className="font-bold text-emerald-600">FREE</span>
                ) : (
                  <span className="font-bold text-slate-850">{formatCurrency(shipping)}</span>
                )}
              </div>
              
              {shipping > 0 && (
                <p className="text-[10px] text-primary-600 bg-primary-50 border border-primary-100/50 p-2.5 rounded-xl -mt-1 leading-normal font-semibold">
                  Add {formatCurrency(500 - discountedSubtotal)} more for FREE delivery
                </p>
              )}
              
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>GST Tax (5%)</span>
                <span className="font-bold text-slate-850">{formatCurrency(gst)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>Platform Convenience Fee</span>
                <span className="font-bold text-slate-850">{formatCurrency(platformFee)}</span>
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Grand Total</span>
                <span className="text-xl font-extrabold text-primary-600 leading-none">{formatCurrency(total)}</span>
              </div>
            </div>

            <button 
              onClick={() => navigate('/checkout', { state: { couponCode: appliedCoupon?.code || '' } })}
              className="w-full bg-primary-600 hover:bg-primary-750 text-white py-3.5 text-center font-bold rounded-xl shadow-soft hover:shadow-md transition-all flex items-center justify-center gap-1.5 group select-none active:scale-[0.98] text-xs"
            >
              <span>Proceed to Checkout</span> 
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </button>

            {/* Safe indicators */}
            <div className="mt-5 space-y-2 pt-4 border-t border-slate-50">
              <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 mr-2 text-green-500 shrink-0" /> Secured by Razorpay
              </div>
              <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Truck className="w-4 h-4 mr-2 text-blue-500 shrink-0" /> Standard National Shipping
              </div>
              <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <RotateCcw className="w-4 h-4 mr-2 text-purple-500 shrink-0" /> 7-Day Easy Returns Escrow
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-50/50 border border-slate-100 rounded-2xl shadow-sm max-w-xl mx-auto">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-850 mb-1">Your cart is empty</h3>
          <p className="text-slate-400 font-semibold text-xs mb-6 max-w-xs mx-auto">Looks like you haven't added any books to your shopping bag yet.</p>
          <Link to="/browse" className="bg-primary-600 hover:bg-primary-750 text-white py-3 px-8 text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-all active:scale-[0.98] shadow-sm select-none">
            <BookOpen className="w-4 h-4" /> Browse Library
          </Link>
        </div>
      )}
    </div>
  );
};

const CartItem = ({ book, onRemove, onQtyChange }) => {
  const qty = parseInt(book.quantity) || 1;
  const itemTotal = parseFloat(book.price) * qty;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-soft transition-all duration-300 flex flex-col sm:flex-row gap-4 relative">
      {/* Cover Image */}
      <div className="w-16 aspect-[3/4.2] rounded-lg overflow-hidden shrink-0 mx-auto sm:mx-0 border border-slate-100 bg-slate-50 p-1 flex items-center justify-center">
        <OptimizedImage 
          src={book.cover_image} 
          alt={book.title} 
          className="w-full h-full object-contain" 
        />
      </div>

      {/* Item Details */}
      <div className="flex-grow flex flex-col justify-between text-left">
        <div>
          <div className="flex justify-between items-start gap-4">
             <div className="min-w-0">
               <h3 className="text-sm font-bold text-slate-850 truncate leading-snug">{book.title}</h3>
               <p className="text-[10px] text-slate-400 font-semibold mt-0.5">by {book.author}</p>
               
               <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                 <span className="px-2 py-0.5 bg-slate-50 text-[9px] font-bold text-slate-500 rounded border border-slate-100">
                   {book.condition}
                 </span>
                 <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                   Seller: <span className="text-slate-600">{book.seller_name || 'Admin'}</span>
                 </span>
                 {book.swap_enabled && (
                   <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-[9px] font-bold text-primary-600 rounded border border-primary-100">
                     <RefreshCw className="w-2.5 h-2.5 shrink-0" /> Swap Available
                   </span>
                 )}
               </div>
             </div>
             
             <button 
               onClick={onRemove}
               className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
               title="Remove Item"
             >
               <Trash2 className="w-4 h-4" />
             </button>
          </div>
        </div>

        {/* Quantity and Price Rows */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-5 pt-3.5 border-t border-slate-50 w-full gap-3 select-none">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qty:</span>
            <div className="flex items-center border border-slate-205 rounded-xl bg-white overflow-hidden h-7 w-20 shadow-sm">
              <button 
                onClick={() => onQtyChange(qty - 1)}
                className="w-7 h-full flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-500 border-r border-slate-200"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="flex-1 text-center text-xs font-bold text-slate-800">
                {qty}
              </span>
              <button 
                onClick={() => onQtyChange(qty + 1)}
                className="w-7 h-full flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-500 border-l border-slate-200"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
          
          <div className="text-right sm:self-center">
            <div className="text-sm font-extrabold text-slate-800">{formatCurrency(itemTotal)}</div>
            {qty > 1 && (
              <div className="text-[9px] text-slate-400 font-bold block mt-0.5">
                ({formatCurrency(book.price)} / unit)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
