import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Sparkles, ArrowRightLeft, ShieldCheck, Truck, UserCheck, 
  CheckCircle2, Clock, MapPin, CreditCard, Copy, Check, 
  AlertCircle, AlertTriangle, RefreshCw, Send, CheckCircle, RotateCcw, 
  ExternalLink, Mail, Phone, PackageCheck, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import swapService from '../../services/swapService';
import OptimizedImage from '../OptimizedImage';

const ExchangeTrackerModal = ({ swapId, onClose, onRefreshList }) => {
  const { user } = useAuth();
  const { socket } = useSocket() || {};

  const [swap, setSwap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Address Form State
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressData, setAddressData] = useState({
    full_name: '',
    phone: '',
    pickup_address: '',
    delivery_address: '',
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    delivery_instructions: ''
  });

  // Fetch full swap details
  const fetchDetails = useCallback(async () => {
    if (!swapId) return;
    try {
      const res = await swapService.getSwapDetails(swapId);
      setSwap(res.data);
      
      // Pre-fill address if exists
      const isReq = parseInt(res.data?.requester_id, 10) === parseInt(user?.id, 10);
      const myAddress = isReq ? res.data?.addresses?.requester : res.data?.addresses?.owner;
      if (myAddress) {
        setAddressData({
          full_name: myAddress.full_name || '',
          phone: myAddress.phone || '',
          pickup_address: myAddress.pickup_address || myAddress.address_line1 || '',
          delivery_address: myAddress.delivery_address || myAddress.address_line1 || '',
          address_line1: myAddress.address_line1 || '',
          city: myAddress.city || '',
          state: myAddress.state || '',
          postal_code: myAddress.postal_code || '',
          delivery_instructions: myAddress.delivery_instructions || ''
        });
      } else if (user) {
        setAddressData(prev => ({
          ...prev,
          full_name: user.full_name || ''
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load exchange details');
    } finally {
      setLoading(false);
    }
  }, [swapId, user]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;
    const onUpdate = (data) => {
      if (!data?.reference_id || String(data.reference_id) === String(swapId)) {
        fetchDetails();
        if (onRefreshList) onRefreshList();
      }
    };

    socket.on('SWAP_METHOD_UPDATED', onUpdate);
    socket.on('SWAP_CONSENT_GRANTED', onUpdate);
    socket.on('SWAP_PAYMENT_CONFIRMED', onUpdate);
    socket.on('SWAP_COURIER_UPDATED', onUpdate);
    socket.on('SWAP_COMPLETED', onUpdate);
    socket.on('SWAP_CONFIRMED', onUpdate);

    return () => {
      socket.off('SWAP_METHOD_UPDATED', onUpdate);
      socket.off('SWAP_CONSENT_GRANTED', onUpdate);
      socket.off('SWAP_PAYMENT_CONFIRMED', onUpdate);
      socket.off('SWAP_COURIER_UPDATED', onUpdate);
      socket.off('SWAP_COMPLETED', onUpdate);
      socket.off('SWAP_CONFIRMED', onUpdate);
    };
  }, [socket, swapId, fetchDetails, onRefreshList]);

  if (!swap && loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1924]/70 backdrop-blur-sm">
        <div className="bg-[#FAF9F6] p-8 rounded-3xl border border-[#DCE2E8] shadow-2xl flex flex-col items-center">
          <RefreshCw className="w-8 h-8 text-[#35152F] animate-spin mb-3" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Exchange Details...</p>
        </div>
      </div>
    );
  }

  if (!swap) return null;

  const isRequester = parseInt(swap.requester_id, 10) === parseInt(user?.id, 10);
  const isOwner = parseInt(swap.owner_id, 10) === parseInt(user?.id, 10);
  const myMethod = isRequester ? swap.requester_method : swap.owner_method;
  const partnerMethod = isRequester ? swap.owner_method : swap.requester_method;
  const partnerName = isRequester ? (swap.owner_name || 'Book Owner') : (swap.requester_name || 'Requester');
  const myRole = isRequester ? 'Requester' : 'Owner';
  const myConsent = isRequester ? swap.requester_consent : swap.owner_consent;
  const partnerConsent = isRequester ? swap.owner_consent : swap.requester_consent;
  const myPaid = isRequester ? swap.requester_paid : swap.owner_paid;
  const partnerPaid = isRequester ? swap.owner_paid : swap.requester_paid;
  const myAddress = isRequester ? swap.addresses?.requester : swap.addresses?.owner;
  const partnerAddress = isRequester ? swap.addresses?.owner : swap.addresses?.requester;
  const myConfirmed = isRequester ? swap.requester_confirmed : swap.owner_confirmed;
  const partnerConfirmed = isRequester ? swap.owner_confirmed : swap.requester_confirmed;
  const partnerEmail = isRequester ? swap.owner_email : swap.requester_email;

  // Handlers
  const handleSelectMethod = async (method) => {
    setActionLoading(true);
    try {
      const res = await swapService.selectExchangeMethod(swapId, method);
      setSwap(res.data);
      toast.success(`Selected ${method === 'SELF_ARRANGED' ? 'Direct Exchange' : 'QUIRO Managed Courier'}`);
      if (onRefreshList) onRefreshList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to select exchange method');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGiveConsent = async () => {
    setActionLoading(true);
    try {
      const res = await swapService.giveConsent(swapId);
      setSwap(res.data);
      toast.success('Your consent to share email has been recorded');
      if (onRefreshList) onRefreshList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit contact consent');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkArranged = async () => {
    setActionLoading(true);
    try {
      const res = await swapService.markArranged(swapId);
      setSwap(res.data);
      toast.success('Exchange marked as arranged!');
      if (onRefreshList) onRefreshList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update arrangement status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!addressData.full_name || !addressData.phone || !addressData.address_line1 || !addressData.city || !addressData.state || !addressData.postal_code) {
      toast.error('Please complete all address fields');
      return;
    }
    setActionLoading(true);
    try {
      const res = await swapService.saveAddress(swapId, addressData);
      setSwap(res.data);
      setShowAddressForm(false);
      toast.success('Delivery address saved successfully');
      if (onRefreshList) onRefreshList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save address');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayShippingFee = async () => {
    setActionLoading(true);
    try {
      const paymentIntent = await swapService.createManagedPayment(swapId);
      
      const proceedWithVerification = async (payData) => {
        try {
          const verifyRes = await swapService.verifyManagedPayment(swapId, payData);
          setSwap(verifyRes.data);
          toast.success('Shipping fee payment confirmed!');
          if (onRefreshList) onRefreshList();
        } catch (verErr) {
          toast.error(verErr.response?.data?.message || 'Payment verification failed');
        } finally {
          setActionLoading(false);
        }
      };

      if (paymentIntent.data.isTestMode) {
        // Automatic Test Sandbox Verification
        await proceedWithVerification({
          razorpay_order_id: paymentIntent.data.rzpOrderId,
          razorpay_payment_id: `pay_sandbox_${Date.now()}`,
          razorpay_signature: `sig_sandbox_${Date.now()}`
        });
      } else {
        // Live Razorpay Checkout Modal
        const options = {
          key: paymentIntent.data.keyId,
          amount: paymentIntent.data.amount,
          currency: paymentIntent.data.currency,
          name: 'QUIRO Exchange Courier',
          description: `Doorstep Exchange Fee for Swap #${swapId}`,
          order_id: paymentIntent.data.rzpOrderId,
          handler: function (response) {
            proceedWithVerification(response);
          },
          prefill: {
            name: user?.full_name || '',
            email: user?.email || '',
            contact: addressData.phone || ''
          },
          theme: { color: '#35152F' },
          modal: {
            ondismiss: function () {
              setActionLoading(false);
              toast('Payment modal closed');
            }
          }
        };

        if (window.Razorpay) {
          const rzp = new window.Razorpay(options);
          rzp.open();
        } else {
          // Dynamic loader fallback
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => {
            const rzp = new window.Razorpay(options);
            rzp.open();
          };
          script.onerror = () => {
            toast.error('Could not load payment checkout script. Please retry.');
            setActionLoading(false);
          };
          document.body.appendChild(script);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate shipping fee payment');
      setActionLoading(false);
    }
  };

  const handleAdvanceCourier = async (stage = null) => {
    setActionLoading(true);
    try {
      const res = await swapService.advanceCourier(swapId, stage);
      setSwap(res.data);
      toast.success(`Courier advanced to: ${res.data.courier_status}`);
      if (onRefreshList) onRefreshList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to advance courier status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelAndRefund = async () => {
    if (!window.confirm('Are you sure you want to cancel this exchange? Any paid shipping fees will be refunded.')) {
      return;
    }
    setActionLoading(true);
    try {
      await swapService.refundSwap(swapId, 'Cancelled by user before courier pickup');
      toast.success('Exchange cancelled and shipping fees refunded');
      fetchDetails();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel exchange');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCompletion = async () => {
    setActionLoading(true);
    try {
      const res = await swapService.confirmCompletion(swapId);
      if (res.data?.completed) {
        toast.success('Both readers confirmed! Exchange officially completed.');
      } else {
        toast.success('Your receipt is recorded! Waiting for partner to confirm receipt.');
      }
      fetchDetails();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm receipt');
    } finally {
      setActionLoading(false);
    }
  };

  const copyEmailToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  // Status computation for UI badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">Exchange Completed</span>;
      case 'delivered':
        return <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">Delivered — Confirm Receipt</span>;
      case 'in_transit':
        return <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">In Transit</span>;
      case 'book_collected':
        return <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">Books Collected</span>;
      case 'payment_completed':
      case 'collection_scheduled':
        return <span className="px-3 py-1 rounded-full bg-[#E5A323]/25 text-[#35152F] text-xs font-bold">Pickup Scheduled</span>;
      case 'awaiting_payment':
        return <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">Awaiting Courier Fee</span>;
      case 'awaiting_addresses':
        return <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">Awaiting Addresses</span>;
      case 'contact_shared':
      case 'arranged':
        return <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">Handover Arranged</span>;
      case 'awaiting_consent':
        return <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">Awaiting Mutual Consent</span>;
      case 'accepted':
        return <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">Accepted — Choose Method</span>;
      default:
        return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#1F1924]/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-[#FAF9F6] rounded-3xl shadow-2xl border border-[#DCE2E8] overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-[#35152F] text-white flex items-center justify-between border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold text-[#E5A323] tracking-widest">
                Exchange Details • #{swap.id}
              </span>
              {getStatusBadge(swap.status)}
            </div>
            <h2 className="text-xl font-serif font-bold text-white">
              {swap.requested_title} &harr; {swap.offered_title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Book Pair Showcase */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-[#DCE2E8] shadow-sm">
            {/* Book A */}
            <div className="flex items-center gap-3.5 p-2 rounded-xl">
              <div className="w-14 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 shadow-sm border border-slate-200">
                <OptimizedImage
                  src={swap.requested_image}
                  alt={swap.requested_title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400">Owner Listing</span>
                <h4 className="text-sm font-bold text-[#1F1924] truncate">{swap.requested_title}</h4>
                <p className="text-xs text-slate-500 truncate">{swap.requested_author}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#DCE2E8]/40 text-[#35152F] text-[10px] font-semibold">
                  Condition: {swap.requested_condition || 'Good'}
                </span>
              </div>
            </div>

            {/* Book B */}
            <div className="flex items-center gap-3.5 p-2 rounded-xl sm:border-l sm:border-slate-100">
              <div className="w-14 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 shadow-sm border border-slate-200">
                <OptimizedImage
                  src={swap.offered_image}
                  alt={swap.offered_title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-[#E5A323]">Requester Listing</span>
                <h4 className="text-sm font-bold text-[#1F1924] truncate">{swap.offered_title}</h4>
                <p className="text-xs text-slate-500 truncate">{swap.offered_author}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#DCE2E8]/40 text-[#35152F] text-[10px] font-semibold">
                  Condition: {swap.offered_condition || 'Good'}
                </span>
              </div>
            </div>
          </div>

          {/* Method Agreement Section */}
          <div className="bg-white rounded-2xl p-5 border border-[#DCE2E8] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#35152F] flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-[#E5A323]" />
                  <span>Exchange Fulfillment Method</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {swap.method_agreed === 1 
                    ? `Agreed: ${swap.exchange_method === 'SELF_ARRANGED' ? 'Option A: Direct Self-Arranged Exchange' : 'Option B: QUIRO Managed Courier Exchange'}`
                    : 'Both readers must select the same method to proceed.'}
                </p>
              </div>

              {swap.method_agreed === 1 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold self-start sm:self-auto">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Method Agreed</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold self-start sm:self-auto">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Alignment Needed</span>
                </div>
              )}
            </div>

            {/* Method Selection Cards if not agreed or user wants to re-select */}
            {swap.status !== 'completed' && (!swap.method_agreed || swap.status === 'awaiting_consent' || swap.status === 'awaiting_addresses') && (
              <div className="space-y-3">
                {/* Disagreement Warning */}
                {myMethod && partnerMethod && myMethod !== partnerMethod && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Method Disagreement:</span> You chose{' '}
                      <span className="font-bold">{myMethod === 'SELF_ARRANGED' ? 'Direct Exchange' : 'QUIRO Managed'}</span>, 
                      but {partnerName} chose{' '}
                      <span className="font-bold">{partnerMethod === 'SELF_ARRANGED' ? 'Direct Exchange' : 'QUIRO Managed'}</span>. 
                      You can align your choice below.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option A Card */}
                  <button
                    onClick={() => handleSelectMethod('SELF_ARRANGED')}
                    disabled={actionLoading}
                    className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                      myMethod === 'SELF_ARRANGED'
                        ? 'border-[#35152F] bg-[#35152F]/5 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-serif font-bold text-[#35152F]">Option A: Direct Exchange</span>
                        {myMethod === 'SELF_ARRANGED' && (
                          <span className="px-2 py-0.5 rounded-full bg-[#35152F] text-white text-[10px] font-bold">Selected by You</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-snug">
                        Free. Coordinate handover directly after mutual email consent.
                      </p>
                    </div>
                    {partnerMethod === 'SELF_ARRANGED' && (
                      <span className="mt-2 text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Partner preferred this option
                      </span>
                    )}
                  </button>

                  {/* Option B Card */}
                  <button
                    onClick={() => handleSelectMethod('QUIRO_MANAGED')}
                    disabled={actionLoading}
                    className={`p-4 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                      myMethod === 'QUIRO_MANAGED'
                        ? 'border-[#E5A323] bg-[#E5A323]/10 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-serif font-bold text-[#35152F]">Option B: QUIRO Managed</span>
                        {myMethod === 'QUIRO_MANAGED' && (
                          <span className="px-2 py-0.5 rounded-full bg-[#E5A323] text-[#35152F] text-[10px] font-bold">Selected by You</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-snug">
                        ₹79 per reader. Doorstep pickup, live tracking & exchange protection.
                      </p>
                    </div>
                    {partnerMethod === 'QUIRO_MANAGED' && (
                      <span className="mt-2 text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Partner preferred this option
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* OPTION A WORKFLOW: Direct Exchange */}
          {swap.exchange_method === 'SELF_ARRANGED' && swap.method_agreed === 1 && (
            <div className="bg-white rounded-2xl p-5 border border-[#DCE2E8] shadow-sm space-y-5 animate-fadeIn">
              <div className="flex items-center gap-2 text-sm font-bold text-[#35152F] border-b border-slate-100 pb-3">
                <UserCheck className="w-4 h-4 text-[#35152F]" />
                <span>Option A: Direct Exchange Handover</span>
              </div>

              {/* Strict Email Privacy & Consent Card */}
              <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#DCE2E8] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#E5A323]" />
                    <span className="text-xs font-bold text-[#35152F] uppercase tracking-wider">
                      Mutual Contact Privacy Gate
                    </span>
                  </div>
                  {swap.isEmailRevealed ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Mutual Consent Granted
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                      Emails Protected
                    </span>
                  )}
                </div>

                {!swap.isEmailRevealed ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      For reader privacy, verified email addresses are completely concealed until <strong>both</strong> you and {partnerName} consent to share contact information.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                      {myConsent === 1 ? (
                        <div className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>You have granted consent. Waiting for {partnerName}...</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleGiveConsent}
                          disabled={actionLoading}
                          className="w-full sm:w-auto px-5 py-2.5 bg-[#35152F] hover:bg-[#4A1D41] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <ShieldCheck className="w-4 h-4 text-[#E5A323]" />
                          <span>Consent to Share My Verified Email</span>
                        </button>
                      )}

                      <span className="text-[11px] text-slate-500">
                        {partnerConsent === 1 ? `✓ ${partnerName} has consented` : `⏳ Waiting for ${partnerName}'s consent`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Mutual consent granted! You can now contact your swap partner directly:</span>
                    </p>

                    <div className="p-3.5 bg-white rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400">Partner Email</span>
                          <p className="text-sm font-bold text-[#1F1924] select-all">{partnerEmail}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyEmailToClipboard(partnerEmail)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                        </button>

                        <a
                          href={`mailto:${partnerEmail}?subject=QUIRO Book Exchange: ${swap.requested_title}`}
                          className="px-3 py-1.5 rounded-lg bg-[#35152F] hover:bg-[#4A1D41] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5 text-[#E5A323]" />
                          <span>Email Reader</span>
                        </a>
                      </div>
                    </div>

                    {swap.status === 'contact_shared' && (
                      <button
                        onClick={handleMarkArranged}
                        disabled={actionLoading}
                        className="mt-2 px-4 py-2 rounded-xl bg-[#DCE2E8]/60 hover:bg-[#DCE2E8] text-[#35152F] text-xs font-bold transition-colors flex items-center gap-2"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Handover as Arranged</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OPTION B WORKFLOW: QUIRO Managed Courier */}
          {swap.exchange_method === 'QUIRO_MANAGED' && swap.method_agreed === 1 && (
            <div className="bg-white rounded-2xl p-5 border border-[#DCE2E8] shadow-sm space-y-5 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#35152F]">
                  <Truck className="w-4 h-4 text-[#E5A323]" />
                  <span>Option B: QUIRO Doorstep Courier Delivery</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {swap.courier_tracking && (
                    <span className="text-xs font-mono font-bold bg-[#DCE2E8]/40 text-[#35152F] px-2.5 py-0.5 rounded-md">
                      Tracking: {swap.courier_tracking}
                    </span>
                  )}
                  <a
                    href={`/swaps/${swap.id}/payment`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#35152F] hover:text-[#4A1D41] bg-white border border-[#DCE2E8] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs hover:shadow-xs"
                  >
                    <span>Full Payment Page</span>
                    <ExternalLink className="w-3 h-3 text-[#E5A323]" />
                  </a>
                  <a
                    href={`/swaps/${swap.id}/tracking`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#35152F] hover:text-[#4A1D41] bg-white border border-[#DCE2E8] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs hover:shadow-xs"
                  >
                    <span>Tracking Page</span>
                    <ExternalLink className="w-3 h-3 text-[#E5A323]" />
                  </a>
                </div>
              </div>

              {/* Step 1: Address Collection */}
              <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#DCE2E8] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#35152F] uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#35152F]" />
                    <span>1. Delivery Addresses</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {partnerAddress ? `✓ ${partnerName}'s address submitted` : `⏳ Waiting for ${partnerName}'s address`}
                  </span>
                </div>

                {!myAddress || showAddressForm ? (
                  <form onSubmit={handleSaveAddress} className="space-y-3 pt-1">
                    <p className="text-xs text-slate-600">Enter the pickup & delivery address for courier dispatch:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          value={addressData.full_name}
                          onChange={e => setAddressData(p => ({ ...p, full_name: e.target.value }))}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#35152F] bg-white"
                          placeholder="e.g. Rahul Sharma"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          required
                          value={addressData.phone}
                          onChange={e => setAddressData(p => ({ ...p, phone: e.target.value }))}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#35152F] bg-white"
                          placeholder="e.g. 9876543210"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Street Address / House No.</label>
                      <input
                        type="text"
                        required
                        value={addressData.address_line1}
                        onChange={e => setAddressData(p => ({ ...p, address_line1: e.target.value }))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#35152F] bg-white"
                        placeholder="House/Flat No., Apartment, Street"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">City</label>
                        <input
                          type="text"
                          required
                          value={addressData.city}
                          onChange={e => setAddressData(p => ({ ...p, city: e.target.value }))}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#35152F] bg-white"
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">State</label>
                        <input
                          type="text"
                          required
                          value={addressData.state}
                          onChange={e => setAddressData(p => ({ ...p, state: e.target.value }))}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#35152F] bg-white"
                          placeholder="State"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Postal PIN</label>
                        <input
                          type="text"
                          required
                          value={addressData.postal_code}
                          onChange={e => setAddressData(p => ({ ...p, postal_code: e.target.value }))}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#35152F] bg-white"
                          placeholder="PIN Code"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-4 py-2 bg-[#35152F] hover:bg-[#4A1D41] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                      >
                        <span>Save Address</span>
                      </button>
                      {myAddress && (
                        <button
                          type="button"
                          onClick={() => setShowAddressForm(false)}
                          className="px-3 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-700">
                      <p className="font-bold text-[#1F1924]">{myAddress.full_name} &bull; {myAddress.phone}</p>
                      <p className="text-slate-500">{myAddress.address_line1}, {myAddress.city}, {myAddress.state} - {myAddress.postal_code}</p>
                    </div>
                    {swap.status === 'awaiting_addresses' && (
                      <button
                        onClick={() => setShowAddressForm(true)}
                        className="text-xs text-[#35152F] font-bold hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Transparent Shipping Fee Payment (Razorpay ₹79) */}
              <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#DCE2E8] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#35152F] uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-[#E5A323]" />
                    <span>2. Doorstep Courier Fee</span>
                  </span>
                  <span className="text-xs font-bold text-[#35152F]">
                    ₹{swap.shipping_fee_per_user || '79.00'} per reader
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200">
                  <div>
                    <p className="text-xs text-slate-700 font-semibold">
                      Your Fee Status:{' '}
                      {myPaid ? (
                        <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid (₹{swap.shipping_fee_per_user || '79.00'})
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold">Pending Payment</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Partner status: {partnerPaid ? `✓ ${partnerName} has paid` : `⏳ Waiting for ${partnerName}'s payment`}
                    </p>
                  </div>

                  {!myPaid && (
                    <button
                      onClick={handlePayShippingFee}
                      disabled={actionLoading || !myAddress}
                      className="px-5 py-2.5 bg-[#35152F] hover:bg-[#4A1D41] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-[#E5A323]" />
                      <span>Pay ₹{swap.shipping_fee_per_user || '79.00'} via Razorpay</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Step 3: Courier Tracking Stepper */}
              {(swap.status === 'payment_completed' || ['collection_scheduled', 'book_collected', 'in_transit', 'delivered', 'completed'].includes(swap.courier_status)) && (
                <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#DCE2E8] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#35152F] uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-[#35152F]" />
                      <span>3. Courier Dispatch & Tracking</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-800">
                      {swap.courier_status === 'delivered' ? 'Delivered' : 'Live Tracking'}
                    </span>
                  </div>

                  {/* 4-Stage Stepper */}
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {[
                      { id: 'collection_scheduled', label: 'Pickup Scheduled' },
                      { id: 'book_collected', label: 'Books Collected' },
                      { id: 'in_transit', label: 'In Transit' },
                      { id: 'delivered', label: 'Delivered' }
                    ].map((step, idx) => {
                      const stages = ['collection_scheduled', 'book_collected', 'in_transit', 'delivered'];
                      const currentIdx = stages.indexOf(swap.courier_status || 'collection_scheduled');
                      const isComplete = currentIdx >= idx;
                      const isCurrent = currentIdx === idx;

                      return (
                        <div key={step.id} className="text-center space-y-1.5">
                          <div className={`h-2 rounded-full transition-all ${
                            isComplete ? 'bg-[#35152F]' : 'bg-slate-200'
                          }`} />
                          <span className={`text-[10px] font-bold block leading-tight ${
                            isCurrent ? 'text-[#35152F]' : isComplete ? 'text-slate-700' : 'text-slate-400'
                          }`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Test Mode Simulation Controller */}
                  {swap.status !== 'completed' && swap.courier_status !== 'delivered' && (
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200/60">
                      <span className="text-[11px] text-slate-500">
                        Test Mode Courier Simulator:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAdvanceCourier()}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-[#E5A323] hover:bg-[#d6961c] text-[#35152F] text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>Advance Courier Stage</span>
                        </button>

                        {['collection_scheduled', 'payment_completed'].includes(swap.courier_status) && (
                          <button
                            onClick={handleCancelAndRefund}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Cancel & Refund
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TWO-PARTY COMPLETION CONFIRMATION */}
          {(swap.status === 'arranged' || swap.status === 'contact_shared' || swap.courier_status === 'delivered' || swap.status === 'delivered') && swap.status !== 'completed' && (
            <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-emerald-700" />
                  <span>Confirm Receipt of Your Book</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-800">
                  {myConfirmed ? '✓ You confirmed' : 'Receipt Pending'}
                </span>
              </div>

              <p className="text-xs text-emerald-800 leading-relaxed">
                Once you have physically received and inspected your exchanged book, confirm receipt below. The exchange officially completes when both readers confirm.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div>
                  <span className="text-xs text-emerald-900 font-semibold">
                    {partnerConfirmed ? `✓ ${partnerName} has confirmed receipt` : `⏳ Waiting for ${partnerName} to confirm`}
                  </span>
                </div>

                {!myConfirmed ? (
                  <button
                    onClick={handleConfirmCompletion}
                    disabled={actionLoading}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>I Have Received My Book</span>
                  </button>
                ) : (
                  <div className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Receipt Recorded</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COMPLETED CELEBRATION */}
          {swap.status === 'completed' && (
            <div className="p-5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white text-center space-y-2 shadow-sm animate-fadeIn">
              <Sparkles className="w-8 h-8 mx-auto text-[#E5A323]" />
              <h3 className="text-base font-serif font-bold">Exchange Officially Completed!</h3>
              <p className="text-xs text-white/90 max-w-md mx-auto">
                Both readers have received their books. Thank you for being a wonderful part of the QUIRO literary community. Happy reading!
              </p>
            </div>
          )}

          {/* Historic Timeline Audit Log */}
          {swap.timeline && swap.timeline.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-[#DCE2E8] shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-[#35152F] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Exchange History Timeline</span>
              </h4>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {swap.timeline.map((entry, idx) => (
                  <div key={entry.id || idx} className="text-xs flex items-start gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-[#E5A323] mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-slate-700 font-medium">{entry.message}</p>
                      <span className="text-[10px] text-slate-400">
                        {new Date(entry.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#FAF9F6] border-t border-[#DCE2E8] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#DCE2E8]/60 hover:bg-[#DCE2E8] text-[#35152F] text-xs font-bold transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeTrackerModal;

