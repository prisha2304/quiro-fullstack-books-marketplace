import React, { useState } from 'react';
import { Bell, BellOff, Check, Loader2, DollarSign } from 'lucide-react';
import personalizationService from '../../services/personalizationService';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const PriceAlertButton = ({ bookId, currentPrice = 0, isSubscribed = false, onToggle }) => {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(isSubscribed);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [targetPrice, setTargetPrice] = useState(Math.round(currentPrice * 0.9));

  const handleToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error('Please log in to set price drop alerts');
      return;
    }

    if (subscribed) {
      setLoading(true);
      try {
        await personalizationService.removePriceAlert(bookId);
        setSubscribed(false);
        if (onToggle) onToggle(false);
        toast.success('Price drop alert removed');
      } catch (err) {
        toast.error('Failed to remove price alert');
      } finally {
        setLoading(false);
      }
    } else {
      setShowModal(true);
    }
  };

  const handleConfirmAlert = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await personalizationService.createPriceAlert(bookId, targetPrice);
      setSubscribed(true);
      setShowModal(false);
      if (onToggle) onToggle(true);
      toast.success(`Price drop alert set for ₹${targetPrice}!`);
    } catch (err) {
      toast.error('Failed to activate price alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          subscribed
            ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
        }`}
        title={subscribed ? 'Price alert active' : 'Notify me if price drops'}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : subscribed ? (
          <>
            <Bell className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Alert Active</span>
          </>
        ) : (
          <>
            <Bell className="w-3.5 h-3.5 text-slate-500" />
            <span>Price Drop Alert</span>
          </>
        )}
      </button>

      {/* Target Price Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-left animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Bell size={16} />
              </div>
              <h3 className="text-sm font-black text-slate-900">Set Price Drop Alert</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              We'll instantly notify you via browser push and notifications when this book drops to or below your target price.
            </p>

            <form onSubmit={handleConfirmAlert} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Target Price (Current: ₹{currentPrice})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    max={currentPrice}
                    min={1}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {loading ? 'Setting...' : 'Activate Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default PriceAlertButton;
