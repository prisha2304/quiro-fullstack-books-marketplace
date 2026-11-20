import React from 'react';
import { AlertTriangle, RefreshCw, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PaymentRetry = ({ reason, onRetry, retrying = false }) => {
    const navigate = useNavigate();

    return (
        <div className="p-6 bg-rose-50/90 border border-rose-200 rounded-2xl text-center space-y-4 shadow-sm animate-fadeIn">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
                <h3 className="text-base font-bold text-rose-900">Payment Unsuccessful</h3>
                <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">
                    {reason || 'The transaction could not be completed. No money was deducted from your account.'}
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                    onClick={onRetry}
                    disabled={retrying}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                    <span>{retrying ? 'Re-initiating...' : 'Retry Payment'}</span>
                </button>

                <button
                    onClick={() => navigate('/cart')}
                    className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                    <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />
                    <span>Return to Cart</span>
                </button>
            </div>
        </div>
    );
};

export default PaymentRetry;
