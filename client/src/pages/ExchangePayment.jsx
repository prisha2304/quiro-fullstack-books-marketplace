import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, Truck, ArrowRightLeft, CreditCard, CheckCircle2, 
  Clock, AlertCircle, RefreshCw, ChevronLeft, MapPin, Sparkles,
  Lock, ArrowRight, BookOpen, User, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import swapService from '../services/swapService';
import OptimizedImage from '../components/OptimizedImage';

const ExchangePayment = () => {
  const { id: swapId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket() || {};

  const [swap, setSwap] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  const fetchDetails = useCallback(async () => {
    if (!swapId) return;
    try {
      setLoading(true);
      setError(null);
      const [swapRes, configRes] = await Promise.all([
        swapService.getSwapDetails(swapId),
        swapService.getSwapConfig().catch(() => ({ data: null }))
      ]);

      setSwap(swapRes.data);
      if (configRes?.data) {
        setConfig(configRes.data);
      } else if (swapRes.data?.config) {
        setConfig(swapRes.data.config);
      }
    } catch (err) {
      console.error('Failed to load exchange details:', err);
      setError(err.response?.data?.message || 'Unable to load exchange information');
    } finally {
      setLoading(false);
    }
  }, [swapId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (data) => {
      if (!data?.reference_id || String(data.reference_id) === String(swapId)) {
        fetchDetails();
      }
    };

    socket.on('SWAP_PAYMENT_CONFIRMED', handleUpdate);
    socket.on('SWAP_COURIER_UPDATED', handleUpdate);
    socket.on('SWAP_COMPLETED', handleUpdate);

    return () => {
      socket.off('SWAP_PAYMENT_CONFIRMED', handleUpdate);
      socket.off('SWAP_COURIER_UPDATED', handleUpdate);
      socket.off('SWAP_COMPLETED', handleUpdate);
    };
  }, [socket, swapId, fetchDetails]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 bg-[#FAF9F6]">
        <div className="w-12 h-12 border-3 border-[#35152F] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-[#35152F] uppercase tracking-widest">
          Loading Exchange Checkout...
        </p>
      </div>
    );
  }

  if (error || !swap) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-8 border border-[#DCE2E8] shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold text-[#35152F] mb-2">Exchange Not Available</h2>
          <p className="text-slate-600 text-sm mb-6">{error || 'This exchange could not be found or you do not have permission to view it.'}</p>
          <Link
            to="/swaps"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#35152F] text-white font-semibold hover:bg-[#4A1D41] transition-all"
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

  const myPaid = isRequester ? Boolean(swap.requester_paid) : Boolean(swap.owner_paid);
  const partnerPaid = isRequester ? Boolean(swap.owner_paid) : Boolean(swap.requester_paid);
  const bothPaid = myPaid && partnerPaid;

  const myAddress = isRequester ? swap.addresses?.requester : swap.addresses?.owner;
  const partnerAddress = isRequester ? swap.addresses?.owner : swap.addresses?.requester;

  const myBook = isRequester ? {
    title: swap.offered_title,
    author: swap.offered_author,
    image: swap.offered_image,
    condition: swap.offered_condition,
    role: 'Book You Are Giving'
  } : {
    title: swap.requested_title,
    author: swap.requested_author,
    image: swap.requested_image,
    condition: swap.requested_condition,
    role: 'Book You Are Giving'
  };

  const incomingBook = isRequester ? {
    title: swap.requested_title,
    author: swap.requested_author,
    image: swap.requested_image,
    condition: swap.requested_condition,
    role: 'Book You Will Receive'
  } : {
    title: swap.offered_title,
    author: swap.offered_author,
    image: swap.offered_image,
    condition: swap.offered_condition,
    role: 'Book You Will Receive'
  };

  const feeAmount = parseFloat(swap.shipping_fee_per_user || config?.shippingFeePerUser || '79.00');
  const breakdown = config?.breakdown || {
    baseShipping: Math.round(feeAmount * 0.70 * 100) / 100,
    packagingAndHandling: Math.round(feeAmount * 0.20 * 100) / 100,
    protectiveInsurance: Math.round((feeAmount - Math.round(feeAmount * 0.70 * 100) / 100 - Math.round(feeAmount * 0.20 * 100) / 100) * 100) / 100
  };

  const referenceCode = swap.courier_tracking || `QRO-EX-${String(swap.id).padStart(5, '0')}`;

  const handlePayNow = async () => {
    setPaying(true);
    try {
      const intentRes = await swapService.createManagedPayment(swapId);
      const paymentIntent = intentRes.data;

      const proceedWithVerification = async (verifyPayload) => {
        try {
          const verifyRes = await swapService.verifyManagedPayment(swapId, verifyPayload);
          setSwap(verifyRes.data);
          toast.success('Shipping fee payment confirmed!');
          if (verifyRes.data?.requester_paid && verifyRes.data?.owner_paid) {
            toast.success('Both participants have paid! Dispatch initialized.', { icon: '📦' });
            setTimeout(() => {
              navigate(`/swaps/${swapId}/tracking`);
            }, 1200);
          }
        } catch (vErr) {
          toast.error(vErr.response?.data?.message || 'Payment verification failed');
        } finally {
          setPaying(false);
        }
      };

      if (paymentIntent.isTestMode) {
        // Test sandbox mode
        await proceedWithVerification({
          razorpay_order_id: paymentIntent.rzpOrderId,
          razorpay_payment_id: `pay_sandbox_${Date.now()}`,
          razorpay_signature: `sig_sandbox_${Date.now()}`
        });
      } else {
        // Razorpay Checkout Modal
        const options = {
          key: paymentIntent.keyId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency || 'INR',
          name: 'QUIRO Exchange Logistics',
          description: `Doorstep Exchange Fee for Reference #${referenceCode}`,
          order_id: paymentIntent.rzpOrderId,
          handler: function (response) {
            proceedWithVerification(response);
          },
          prefill: {
            name: user?.full_name || '',
            email: user?.email || '',
            contact: myAddress?.phone || ''
          },
          theme: { color: '#35152F' },
          modal: {
            ondismiss: function () {
              setPaying(false);
              toast('Payment cancelled or closed');
            }
          }
        };

        if (window.Razorpay) {
          const rzp = new window.Razorpay(options);
          rzp.open();
        } else {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => {
            const rzp = new window.Razorpay(options);
            rzp.open();
          };
          script.onerror = () => {
            toast.error('Could not load Razorpay SDK. Please check your connection.');
            setPaying(false);
          };
          document.body.appendChild(script);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate exchange fee payment');
      setPaying(false);
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5A323]/20 text-[#35152F] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#E5A323]" />
            QUIRO Managed Exchange
          </span>
        </div>

        {/* Page Header */}
        <div className="bg-gradient-to-r from-[#35152F] via-[#4A1D41] to-[#35152F] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-72 h-72 bg-[#E5A323]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <span className="text-[#E5A323] text-xs font-bold uppercase tracking-widest block mb-2">
              Exchange Checkout & Escrow Logistics
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-tight">
              Complete Your Exchange
            </h1>
            <p className="text-sm text-[#DCE2E8] mt-2 leading-relaxed">
              QUIRO handles doorstep pickup, protective packaging, safe round-trip delivery, and condition verification so both readers can exchange books with complete peace of mind.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/10 text-xs text-[#DCE2E8]">
              <div>
                <span className="text-white/60 block text-[10px] uppercase tracking-wider">Exchange Reference</span>
                <span className="font-mono font-bold text-white text-sm">{referenceCode}</span>
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div>
                <span className="text-white/60 block text-[10px] uppercase tracking-wider">Payment Model</span>
                <span className="font-bold text-[#E5A323]">Split 50 / 50 (₹{feeAmount.toFixed(2)} each)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Both Books Comparison Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#DCE2E8] shadow-sm">
          <h2 className="text-lg font-serif font-bold text-[#35152F] mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#E5A323]" /> Books in This Exchange
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* My Book */}
            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#DCE2E8] flex gap-4 items-center">
              <div className="w-16 h-22 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 shadow border border-slate-200">
                <OptimizedImage
                  src={myBook.image}
                  alt={myBook.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-[#35152F] uppercase tracking-wider block mb-1">
                  {myBook.role}
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate">{myBook.title}</h3>
                <p className="text-xs text-slate-500 truncate">{myBook.author || 'Unknown author'}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-semibold text-slate-700 capitalize">
                    {myBook.condition || 'Good'}
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <User className="w-3 h-3" /> By {myName}
                  </span>
                </div>
              </div>
            </div>

            {/* Incoming Book */}
            <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#DCE2E8] flex gap-4 items-center">
              <div className="w-16 h-22 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 shadow border border-slate-200">
                <OptimizedImage
                  src={incomingBook.image}
                  alt={incomingBook.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-[#E5A323] uppercase tracking-wider block mb-1">
                  {incomingBook.role}
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate">{incomingBook.title}</h3>
                <p className="text-xs text-slate-500 truncate">{incomingBook.author || 'Unknown author'}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800 capitalize">
                    {incomingBook.condition || 'Good'}
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <User className="w-3 h-3" /> By {partnerName}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Participants & Payment Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Status Card */}
          <div className={`p-6 rounded-3xl border transition-all ${
            myPaid ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-white border-[#DCE2E8] shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                  myPaid ? 'bg-emerald-600 text-white' : 'bg-[#35152F] text-white'
                }`}>
                  {myPaid ? <Check className="w-5 h-5" /> : 'You'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#35152F]">{myName}</h4>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Your Share ({myRole})
                  </span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                myPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {myPaid ? 'Paid & Confirmed' : 'Payment Due'}
              </span>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 pt-3 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Fee Amount:</span>
                <span className="font-bold text-[#35152F]">₹{feeAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span>Razorpay (TEST MODE)</span>
              </div>
            </div>
          </div>

          {/* Partner Status Card */}
          <div className={`p-6 rounded-3xl border transition-all ${
            partnerPaid ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-white border-[#DCE2E8] shadow-sm'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                  partnerPaid ? 'bg-emerald-600 text-white' : 'bg-[#DCE2E8] text-[#35152F]'
                }`}>
                  {partnerPaid ? <Check className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#35152F]">{partnerName}</h4>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Partner Share ({partnerRole})
                  </span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                partnerPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {partnerPaid ? 'Paid & Confirmed' : 'Awaiting Payment'}
              </span>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5 pt-3 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Fee Amount:</span>
                <span className="font-bold text-[#35152F]">₹{feeAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="italic">{partnerPaid ? 'Completed' : 'Partner hasn’t paid yet'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Waiting Notice or Dispatch Ready Banner */}
        {bothPaid ? (
          <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-3xl p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-serif font-bold text-emerald-950">
              Both Payments Confirmed!
            </h3>
            <p className="text-sm text-emerald-800 max-w-lg mx-auto">
              QUIRO Express Logistics order is active. Doorstep pickup and tracking are now live for both readers.
            </p>
            <div className="pt-2">
              <Link
                to={`/swaps/${swapId}/tracking`}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-[#35152F] text-white font-bold hover:bg-[#4A1D41] shadow-lg hover:shadow-xl transition-all"
              >
                Go to Exchange Tracking <ArrowRight className="w-5 h-5 text-[#E5A323]" />
              </Link>
            </div>
          </div>
        ) : myPaid && !partnerPaid ? (
          <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-6 text-center space-y-2">
            <Clock className="w-10 h-10 text-amber-600 mx-auto animate-pulse" />
            <h3 className="text-lg font-bold text-amber-950">
              Waiting for the other participant to complete payment.
            </h3>
            <p className="text-xs text-amber-800 max-w-md mx-auto">
              Your share has been securely recorded. As soon as {partnerName} completes their payment, courier pickup will be automatically scheduled.
            </p>
            <div className="pt-2">
              <button
                onClick={fetchDetails}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-50 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Check Partner Status
              </button>
            </div>
          </div>
        ) : null}

        {/* Address & Fee Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Confirmed Delivery Address (Left 2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-[#DCE2E8] shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-[#35152F] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#E5A323]" /> Confirmed Addresses
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Securely recorded. Visible only to exchange participants and verified QUIRO logistics handlers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* My Address */}
              <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#DCE2E8]">
                <span className="text-[10px] font-bold text-[#35152F] uppercase tracking-wider block mb-2">
                  Your Address ({myRole})
                </span>
                {myAddress ? (
                  <div className="text-xs text-slate-700 space-y-1">
                    <p className="font-bold text-[#1F1924]">{myAddress.full_name}</p>
                    <p>{myAddress.phone}</p>
                    <p className="text-slate-600 mt-1">
                      <strong className="text-slate-800">Pickup:</strong> {myAddress.pickup_address || myAddress.address_line1}
                    </p>
                    <p className="text-slate-600">
                      <strong className="text-slate-800">Delivery:</strong> {myAddress.delivery_address || myAddress.address_line1}
                    </p>
                    <p>{myAddress.city}, {myAddress.state} — {myAddress.postal_code}</p>
                    {myAddress.delivery_instructions && (
                      <p className="text-[11px] text-slate-500 italic mt-1">
                        Note: {myAddress.delivery_instructions}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-rose-500 font-semibold">Address not recorded yet</p>
                )}
              </div>

              {/* Partner Address */}
              <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#DCE2E8]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Partner Address ({partnerRole})
                </span>
                {partnerAddress ? (
                  <div className="text-xs text-slate-700 space-y-1">
                    <p className="font-bold text-[#1F1924]">{partnerAddress.full_name}</p>
                    <p className="text-slate-500">{partnerAddress.city}, {partnerAddress.state} — {partnerAddress.postal_code}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-2 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Verified by QUIRO Address Engine
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 font-semibold">Waiting for partner address</p>
                )}
              </div>
            </div>

            {/* Logistics Escrow Assurance */}
            <div className="p-4 rounded-2xl bg-[#35152F]/5 border border-[#35152F]/15 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#35152F] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 space-y-1">
                <h5 className="font-bold text-[#35152F]">QUIRO Safe Exchange Guarantee</h5>
                <p className="text-slate-600 leading-relaxed">
                  Both readers are protected by our condition inspection on pickup. If either book does not match its listing description, the exchange is cancelled and shipping fees are promptly refunded.
                </p>
              </div>
            </div>
          </div>

          {/* Fee Breakdown & Payment Action (Right Col) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#DCE2E8] shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-[#35152F] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#E5A323]" /> Fee Breakdown
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Standard doorstep round-trip logistics fee.
              </p>

              <div className="mt-6 space-y-3 text-xs text-slate-600 pb-4 border-b border-slate-100">
                <div className="flex justify-between">
                  <span>Base Courier Pickup & Transport</span>
                  <span className="font-semibold text-slate-900">₹{breakdown.baseShipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Protective Book Mailer Packaging</span>
                  <span className="font-semibold text-slate-900">₹{breakdown.packagingAndHandling.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transit Insurance & Guarantee</span>
                  <span className="font-semibold text-slate-900">₹{breakdown.protectiveInsurance.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-500">Your Payable Amount:</span>
                  <span className="text-2xl font-serif font-bold text-[#35152F]">
                    ₹{feeAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Total Exchange Logistics Cost:</span>
                  <span>₹{(feeAmount * 2).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div>
              {myPaid ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    You Have Completed Payment
                  </div>
                  <Link
                    to={`/swaps/${swapId}/tracking`}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#35152F] text-white font-bold hover:bg-[#4A1D41] flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    View Tracking Simulator <ChevronLeft className="w-4 h-4 rotate-180" />
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handlePayNow}
                  disabled={paying}
                  className="w-full py-4 px-6 rounded-2xl bg-[#35152F] hover:bg-[#4A1D41] text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 group"
                >
                  {paying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#E5A323]" />
                      Processing Test Payment...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-[#E5A323] group-hover:scale-110 transition-transform" />
                      Pay ₹{feeAmount.toFixed(2)} via Razorpay
                    </>
                  )}
                </button>
              )}

              <p className="text-[11px] text-slate-400 text-center mt-3">
                Razorpay TEST MODE active. No real credit card or bank account will be charged.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExchangePayment;

