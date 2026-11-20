import React from 'react';
import { ShoppingCart, Heart, Trash2, ArrowRight, ExternalLink, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const AISmartActionCard = ({
  action,
  onExecuteAction,
  onCancel,
  onClose
}) => {
  if (!action) return null;

  const { type, book, requiresConfirmation, success, message } = action;

  return (
    <div className="bg-gradient-to-br from-white to-blue-50/40 border border-blue-200/80 rounded-2xl p-3.5 shadow-soft space-y-3 animate-in fade-in zoom-in-95 duration-150 text-left">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary-600 text-white flex items-center justify-center shadow-2xs">
            {type === 'ADD_TO_CART' && <ShoppingCart size={13} />}
            {type === 'REMOVE_FROM_CART' && <Trash2 size={13} className="text-rose-200" />}
            {type === 'ADD_TO_WISHLIST' && <Heart size={13} className="text-pink-200" />}
            {type === 'START_CHECKOUT' && <Sparkles size={13} />}
          </div>
          <span className="text-xs font-black text-slate-900 uppercase tracking-tight">
            {type === 'ADD_TO_CART' && '🛒 Add to Cart'}
            {type === 'REMOVE_FROM_CART' && '🗑️ Remove Item'}
            {type === 'ADD_TO_WISHLIST' && '⭐ Saved for Later'}
            {type === 'START_CHECKOUT' && '🚀 Ready for Checkout'}
          </span>
        </div>

        {success && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-1">
            <CheckCircle2 size={11} /> Success
          </span>
        )}
      </div>

      {/* Book details snippet if available */}
      {book && (
        <div className="bg-white border border-slate-200/70 rounded-xl p-2.5 flex items-center gap-3">
          <img
            src={book.cover_image || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100'}
            alt=""
            className="w-10 h-14 object-cover rounded-lg border border-slate-100 shrink-0 bg-slate-100"
          />
          <div className="min-w-0 flex-grow">
            <h4 className="text-xs font-bold text-slate-900 truncate">{book.title}</h4>
            <p className="text-[11px] text-slate-500 truncate">by {book.author || 'Author'}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-black text-slate-900">
                {formatCurrency(book.price || 0)}
              </span>
              {book.condition && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                  {book.condition}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Description */}
      {message && (
        <p className="text-xs text-slate-700 font-medium leading-relaxed">
          {message}
        </p>
      )}

      {/* Interactive CTAs */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        {requiresConfirmation ? (
          <>
            <button
              onClick={() => onExecuteAction(action)}
              className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 size={12} />
              <span>Confirm Remove</span>
            </button>
            <button
              onClick={onCancel}
              className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {type === 'ADD_TO_CART' && (
              <Link
                to="/cart"
                onClick={onClose}
                className="flex-1 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold text-center transition-all shadow-2xs flex items-center justify-center gap-1"
              >
                <span>View Cart</span>
                <ArrowRight size={12} />
              </Link>
            )}

            {type === 'ADD_TO_WISHLIST' && (
              <Link
                to="/wishlist"
                onClick={onClose}
                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold text-center transition-all shadow-2xs flex items-center justify-center gap-1"
              >
                <span>View Wishlist</span>
                <ArrowRight size={12} />
              </Link>
            )}

            {book && (
              <Link
                to={`/book/${book.id}`}
                onClick={onClose}
                className="py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all flex items-center gap-1"
              >
                <span>View Book</span>
                <ExternalLink size={11} />
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AISmartActionCard;
