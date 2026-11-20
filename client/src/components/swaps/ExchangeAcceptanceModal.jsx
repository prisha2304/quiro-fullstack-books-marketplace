import React from 'react';
import { Sparkles, ArrowRightLeft, UserCheck, Truck, ShieldCheck, CheckCircle2, X } from 'lucide-react';
import OptimizedImage from '../OptimizedImage';

const ExchangeAcceptanceModal = ({ swap, onClose, onSelectMethod, loading = false }) => {
  if (!swap) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1924]/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#FAF9F6] rounded-3xl shadow-2xl border border-[#DCE2E8] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-[#35152F] to-[#4A1D41] text-white">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1.5 text-[#E5A323] text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            <span>Exchange Proposal Accepted</span>
          </div>
          <h2 className="text-2xl font-serif font-bold text-white">
            Exchange Request Accepted!
          </h2>
          <p className="text-xs text-[#DCE2E8]/90 mt-1">
            Both books are now reserved. Choose how you and your exchange partner would like to fulfill this trade.
          </p>
        </div>

        {/* Books Comparison Mini Card */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="bg-white rounded-2xl p-4 border border-[#DCE2E8] shadow-sm flex items-center justify-between gap-4">
            {/* Requested Book */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 shadow-sm border border-slate-200">
                <OptimizedImage
                  src={swap.requested_image}
                  alt={swap.requested_title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Your Book</span>
                <h4 className="text-sm font-bold text-[#1F1924] truncate">{swap.requested_title}</h4>
                <p className="text-xs text-slate-500 truncate">{swap.requested_author || 'Unknown author'}</p>
              </div>
            </div>

            <div className="p-2 bg-[#DCE2E8]/40 text-[#35152F] rounded-full flex-shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>

            {/* Offered Book */}
            <div className="flex items-center gap-3 min-w-0 flex-1 justify-end text-right">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-[#E5A323] tracking-wider">Incoming Book</span>
                <h4 className="text-sm font-bold text-[#1F1924] truncate">{swap.offered_title}</h4>
                <p className="text-xs text-slate-500 truncate">{swap.offered_author || 'Unknown author'}</p>
              </div>
              <div className="w-12 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 shadow-sm border border-slate-200">
                <OptimizedImage
                  src={swap.offered_image}
                  alt={swap.offered_title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-base font-bold text-[#35152F]">Select Exchange Method</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Both readers must agree on the same fulfillment method to proceed.
            </p>
          </div>

          {/* Method Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option A: Direct Self-Arranged */}
            <div className="group relative bg-white hover:bg-[#FAF9F6] border-2 border-[#DCE2E8] hover:border-[#35152F] rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#35152F]/10 text-[#35152F] flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider mb-1">
                    Free • Direct
                  </div>
                  <h4 className="text-base font-serif font-bold text-[#35152F]">
                    Option A: Direct Exchange
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Arrange the exchange yourself. Both readers grant mutual consent to unlock verified email addresses, then meet or coordinate directly.
                  </p>
                </div>

                <ul className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Zero platform or shipping fees</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#E5A323] flex-shrink-0" />
                    <span>Strict email privacy until mutual consent</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onSelectMethod('SELF_ARRANGED')}
                disabled={loading}
                className="mt-5 w-full py-2.5 px-4 bg-[#35152F] hover:bg-[#4A1D41] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Choose Direct Exchange</span>
              </button>
            </div>

            {/* Option B: QUIRO Managed Courier */}
            <div className="group relative bg-white hover:bg-[#FAF9F6] border-2 border-[#E5A323]/50 hover:border-[#E5A323] rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#E5A323]/15 text-[#35152F] flex items-center justify-center">
                  <Truck className="w-5 h-5 text-[#E5A323]" />
                </div>
                <div>
                  <div className="inline-block px-2 py-0.5 rounded-full bg-[#E5A323]/20 text-[#35152F] text-[10px] font-bold uppercase tracking-wider mb-1">
                    ₹79 per reader • Doorstep
                  </div>
                  <h4 className="text-base font-serif font-bold text-[#35152F]">
                    Option B: Through QUIRO
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Doorstep courier pickup and express delivery across India. Full tracking and buyer/seller exchange protection included.
                  </p>
                </div>

                <ul className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Doorstep pickup & tracked delivery</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#E5A323] flex-shrink-0" />
                    <span>Razorpay test payment & full refund protection</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => onSelectMethod('QUIRO_MANAGED')}
                disabled={loading}
                className="mt-5 w-full py-2.5 px-4 bg-[#E5A323] hover:bg-[#d6961c] text-[#35152F] text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Choose QUIRO Managed</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeAcceptanceModal;

