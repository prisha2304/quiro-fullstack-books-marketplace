import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Truck, CheckCircle2, Clock, MapPin, Sparkles, AlertCircle, 
  ChevronLeft, ArrowRightLeft, BookOpen, RefreshCw, ShieldCheck, 
  UserCheck, RotateCcw, PackageCheck, AlertTriangle, Check, ArrowRight,
  ExternalLink, Calendar, Box, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import swapService from '../services/swapService';
import OptimizedImage from '../components/OptimizedImage';

const DEFAULT_STAGES = [
  { id: 'payment_confirmed', label: 'Payment Confirmed', desc: 'Shipping fees verified for both readers. Courier dispatch initialized.' },
  { id: 'pickup_scheduled', label: 'Pickup Scheduled', desc: 'Doorstep pickup appointment scheduled for both reader locations.' },
  { id: 'pickup_partner_assigned', label: 'Pickup Partner Assigned', desc: 'Dedicated delivery partner assigned to collect packages.' },
  { id: 'pickup_partner_en_route', label: 'Pickup Partner On The Way', desc: 'Courier agent en route to the pickup addresses.' },
  { id: 'book_collected', label: 'Book Collected', desc: 'Both books collected in tamper-evident protective QUIRO packaging.' },
  { id: 'in_transit', label: 'In Transit', desc: 'Packages sorted at central hub and dispatched to destination addresses.' },
  { id: 'out_for_delivery', label: 'Out For Delivery', desc: 'Packages out for final doorstep delivery to each reader.' },
  { id: 'delivered', label: 'Delivered', desc: 'Packages successfully delivered to readers\' doorsteps.' },
  { id: 'awaiting_confirmations', label: 'Awaiting Both Confirmations', desc: 'Readers inspecting books and confirming receipt on QUIRO.' },
  { id: 'exchange_completed', label: 'Exchange Completed', desc: 'Both readers confirmed! Exchange officially completed.' }
];

const ExchangeTracking = () => {
  const { id: swapId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket() || {};

  const [swap, setSwap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDetails = useCallback(async () => {
    if (!swapId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await swapService.getSwapDetails(swapId);
      setSwap(res.data);
    } catch (err) {
      console.error('Failed to load tracking details:', err);
      setError(err.response?.data?.message || 'Unable to load exchange tracking information');
    } finally {
      setLoading(false);
    }
  }, [swapId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (data) => {
      if (!data?.reference_id || String(data.reference_id) === String(swapId)) {
        fetchDetails();
      }
    };

    socket.on('SWAP_COURIER_UPDATED', handleUpdate);
    socket.on('SWAP_COMPLETED', handleUpdate);
    socket.on('SWAP_CONFIRMED', handleUpdate);

    return () => {
      socket.off('SWAP_COURIER_UPDATED', handleUpdate);
      socket.off('SWAP_COMPLETED', handleUpdate);
      socket.off('SWAP_CONFIRMED', handleUpdate);
    };
  }, [socket, swapId, fetchDetails]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 bg-[#FAF9F6]">
        <div className="w-12 h-12 border-3 border-[#35152F] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-[#35152F] uppercase tracking-widest">
          Loading Exchange Dispatch...
        </p>
      </div>
    );
  }

  if (error || !swap) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-8 border border-[#DCE2E8] shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold text-[#35152F] mb-2">Tracking Unavailable</h2>
          <p className="text-slate-600 text-sm mb-6">{error || 'Exchange not found.'}</p>
          <Link
            to="/swaps"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#35152F] text-white font-semibold hover:bg-[#4A1D41]"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Exchanges
          </Link>
        </div>
      </div>
    );
  }

  const isRequester = parseInt(swap.requester_id, 10) === parseInt(user?.id, 10);
  const isOwner = parseInt(swap.owner_id, 10) === parseInt(user?.id, 10);
  const myRole = isRequester ? 'Requester' : 'Owner';
  const partnerRole = isRequester ? 'Owner' : 'Requester';
  const partnerName = isRequester ? (swap.owner_name || 'Book Owner') : (swap.requester_name || 'Exchange Proposer');
  const myName = user?.full_name || (isRequester ? swap.requester_name : swap.owner_name);

  const stages = swap.stages || DEFAULT_STAGES;
  const currentCourierStage = swap.courier_status || (swap.status === 'completed' ? 'exchange_completed' : 'payment_confirmed');

  // Map aliases
  const normalizeStage = (stg) => {
    if (stg === 'collection_scheduled') return 'pickup_scheduled';
    if (stg === 'dispatched') return 'in_transit';
    if (stg === 'received') return 'awaiting_confirmations';
    return stg;
  };
  const activeNormalized = normalizeStage(currentCourierStage);
  const activeStageIndex = Math.max(0, stages.findIndex(s => s.id === activeNormalized));

  const isCompleted = swap.status === 'completed' || currentCourierStage === 'exchange_completed';

  const myConfirmed = isRequester ? Boolean(swap.requester_confirmed) : Boolean(swap.owner_confirmed);
  const partnerConfirmed = isRequester ? Boolean(swap.owner_confirmed) : Boolean(swap.requester_confirmed);

  const myConfirmedAt = isRequester ? swap.requester_confirmed_at : swap.owner_confirmed_at;
  const partnerConfirmedAt = isRequester ? swap.owner_confirmed_at : swap.requester_confirmed_at;

  const trackingNumber = swap.courier_tracking || `QRO-EX-${String(swap.id).padStart(5, '0')}`;

  const myBook = isRequester ? {
    title: swap.offered_title,
    author: swap.offered_author,
    image: swap.offered_image,
    role: 'Book You Are Giving'
  } : {
    title: swap.requested_title,
    author: swap.requested_author,
    image: swap.requested_image,
    role: 'Book You Are Giving'
  };

  const incomingBook = isRequester ? {
    title: swap.requested_title,
    author: swap.requested_author,
    image: swap.requested_image,
    role: 'Book You Will Receive'
  } : {
    title: swap.offered_title,
    author: swap.offered_author,
    image: swap.offered_image,
    role: 'Book You Will Receive'
  };

  // Handlers
  const handleAdvanceStage = async (stageId = null) => {
    setActionLoading(true);
    try {
      const res = await swapService.advanceCourier(swapId, stageId);
      setSwap(res.data);
      toast.success(`[DEMO] Stage updated to: ${res.data?.courier_status}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to advance stage');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReceipt = async () => {
    setActionLoading(true);
    try {
      const res = await swapService.confirmCompletion(swapId);
      if (res.data?.completed) {
        toast.success(res.data.message || 'Your books have found their next readers! Your QUIRO exchange is complete.', {
          icon: '🎉',
          duration: 5000
        });
      } else {
        toast.success('Your receipt confirmation is recorded! Waiting for your partner to confirm.');
      }
      fetchDetails();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm receipt');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Pending confirmation';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return String(isoString);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/swaps"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#35152F] hover:text-[#4A1D41] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Exchanges
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5A323]/20 text-[#35152F] text-xs font-bold">
              <Truck className="w-3.5 h-3.5 text-[#E5A323]" />
              Track Reference: #{trackingNumber}
            </span>
          </div>
        </div>

        {/* Page Header */}
        <div className="bg-gradient-to-r from-[#35152F] via-[#4A1D41] to-[#35152F] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-72 h-72 bg-[#E5A323]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <span className="text-[#E5A323] text-xs font-bold uppercase tracking-widest block mb-2">
              QUIRO Managed Exchange Dispatch
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-tight">
              Your Exchange Is Underway!
            </h1>
            <p className="text-sm text-[#DCE2E8] mt-2 leading-relaxed">
              Real-time dispatch tracking for your book exchange between <strong>{myName}</strong> and <strong>{partnerName}</strong>.
            </p>
          </div>
        </div>

        {/* Completion Celebration Hero Card */}
        {isCompleted && (
          <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-8 text-white text-center shadow-xl relative overflow-hidden animate-fadeIn">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
              <Sparkles className="w-8 h-8 text-[#E5A323]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-2">
              Exchange Completed!
            </h2>
            <p className="text-base text-emerald-100 max-w-xl mx-auto leading-relaxed font-serif italic">
              "Your books have found their next readers! Your QUIRO exchange is complete."
            </p>
            <div className="mt-6 pt-6 border-t border-white/20 flex flex-wrap items-center justify-center gap-6 text-xs text-emerald-100">
              <div>
                <span className="block opacity-75 text-[10px] uppercase">Your Confirmation</span>
                <span className="font-semibold text-white">{formatDate(myConfirmedAt)}</span>
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div>
                <span className="block opacity-75 text-[10px] uppercase">Partner Confirmation</span>
                <span className="font-semibold text-white">{formatDate(partnerConfirmedAt)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Status Card with Dynamic Messaging */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#DCE2E8] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Current Status
              </span>
              <h3 className="text-2xl font-serif font-bold text-[#35152F]">
                {stages[activeStageIndex]?.label || 'Exchange In Progress'}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {stages[activeStageIndex]?.desc}
              </p>
            </div>
            <div className="flex-shrink-0 text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Stage {activeStageIndex + 1} of {stages.length}
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E5A323]">
                <Clock className="w-4 h-4" />
                Updated {formatDate(swap.updated_at)}
              </div>
            </div>
          </div>

          {/* 10-Stage Sequential Timeline Stepper */}
          <div className="pt-8 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">
              10-Stage Dispatch Progression
            </h4>
            
            <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 space-y-6">
              {stages.map((stage, idx) => {
                const isPassed = idx < activeStageIndex || isCompleted;
                const isCurrent = idx === activeStageIndex && !isCompleted;
                const isUpcoming = idx > activeStageIndex && !isCompleted;

                return (
                  <div key={stage.id} className="relative group">
                    {/* Bullet marker */}
                    <div className={`absolute -left-[31px] sm:-left-[39px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      isPassed 
                        ? 'bg-emerald-600 border-emerald-600 text-white' 
                        : isCurrent
                        ? 'bg-[#35152F] border-[#E5A323] text-white ring-4 ring-[#E5A323]/20'
                        : 'bg-white border-slate-300 text-slate-400'
                    }`}>
                      {isPassed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>

                    <div className={`rounded-2xl p-4 transition-all ${
                      isCurrent 
                        ? 'bg-[#FAF9F6] border-2 border-[#35152F] shadow-sm' 
                        : isPassed 
                        ? 'bg-white border border-[#DCE2E8]' 
                        : 'bg-slate-50/50 border border-transparent opacity-60'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${isCurrent ? 'text-[#35152F]' : isPassed ? 'text-slate-900' : 'text-slate-500'}`}>
                          {stage.label}
                        </span>
                        {isCurrent && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#E5A323]/20 text-[#35152F] text-[10px] font-bold uppercase tracking-wider animate-pulse">
                            Active Stage
                          </span>
                        )}
                        {isPassed && (
                          <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {stage.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Two-Party Receipt Confirmation Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#DCE2E8] shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-serif font-bold text-[#35152F] flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-[#E5A323]" /> Two-Party Receipt Confirmation
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Both readers must physically inspect their received book and confirm receipt to finalize this exchange.
              </p>
            </div>
            {isCompleted && (
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                Fully Confirmed
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* My Confirmation Card */}
            <div className={`p-5 rounded-2xl border ${
              myConfirmed ? 'bg-emerald-50/60 border-emerald-200' : 'bg-[#FAF9F6] border-[#DCE2E8]'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-[#35152F] uppercase tracking-wider">
                  Your Confirmation ({myRole})
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  myConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {myConfirmed ? 'Confirmed' : 'Pending Receipt'}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-bold mb-1">{myName}</p>
              <p className="text-[11px] text-slate-500">
                {myConfirmed ? `Confirmed on ${formatDate(myConfirmedAt)}` : 'Confirm once book arrives at your doorstep.'}
              </p>

              {!myConfirmed && (
                <div className="mt-4">
                  <button
                    onClick={handleConfirmReceipt}
                    disabled={actionLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#35152F] hover:bg-[#4A1D41] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 text-[#E5A323]" /> Confirm I Have Received Book
                  </button>
                </div>
              )}
            </div>

            {/* Partner Confirmation Card */}
            <div className={`p-5 rounded-2xl border ${
              partnerConfirmed ? 'bg-emerald-50/60 border-emerald-200' : 'bg-[#FAF9F6] border-[#DCE2E8]'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Partner Confirmation ({partnerRole})
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  partnerConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {partnerConfirmed ? 'Confirmed' : 'Awaiting Receipt'}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-bold mb-1">{partnerName}</p>
              <p className="text-[11px] text-slate-500">
                {partnerConfirmed ? `Confirmed on ${formatDate(partnerConfirmedAt)}` : 'Waiting for partner to receive book and confirm.'}
              </p>
            </div>
          </div>
        </div>

        {/* DEMO Courier Dispatch Simulator (Test Mode) */}
        <div className="bg-[#1F1924] rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#E5A323] text-[#35152F] text-[10px] font-black uppercase tracking-wider">
                TEST MODE
              </span>
              <h3 className="text-base font-serif font-bold text-white">
                DEMO Courier Dispatch Simulator
              </h3>
            </div>
            <button
              onClick={() => handleAdvanceStage()}
              disabled={actionLoading || isCompleted}
              className="px-4 py-2 rounded-xl bg-[#E5A323] hover:bg-[#c98e1d] text-[#35152F] text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              Advance to Next Stage <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-400">
            For local testing of the complete QUIRO 10-stage courier lifecycle. Click any stage below to jump immediately.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
            {stages.map((stg, i) => (
              <button
                key={stg.id}
                onClick={() => handleAdvanceStage(stg.id)}
                disabled={actionLoading}
                className={`p-2 rounded-xl text-[11px] font-semibold text-left transition-all border ${
                  stg.id === activeNormalized 
                    ? 'bg-[#E5A323]/20 border-[#E5A323] text-[#E5A323]' 
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className="text-[9px] opacity-60 block">Stage {i + 1}</span>
                <span className="truncate block font-bold">{stg.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExchangeTracking;

