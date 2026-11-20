import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Lock, CreditCard, CheckCircle2, 
  MapPin, Phone, User, AlertCircle, Loader2, ArrowLeft,
  DollarSign, RefreshCw, ShoppingBag, FileText, CheckCircle
} from 'lucide-react';
import cartService from '../services/cartService';
import { createPaymentOrder, verifyPayment, reportPaymentFailure, retryPayment, getPaymentConfig } from '../services/paymentService';
import { formatCurrency } from '../utils/format';
import InventoryReservationNotice from '../components/checkout/InventoryReservationNotice';
import PaymentRetry from '../components/checkout/PaymentRetry';
import PaymentStatus from '../components/checkout/PaymentStatus';
import OptimizedImage from '../components/OptimizedImage';

const Checkout = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isRazorpayConfigured, setIsRazorpayConfigured] = useState(true);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  
  // Checkout & Payment State
  const [step, setStep] = useState(1); // 1: Info & Review, 2: Payment/Processing, 3: Success, 4: Failed
  const [priceChangeWarning, setPriceChangeWarning] = useState(null);
  const [paymentError, setPaymentError] = useState(null);
  const [failedPaymentId, setFailedPaymentId] = useState(null);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    city: '',
    postalCode: '',
    phone: '',
    couponCode: ''
  });

  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    shipping: 0,
    gst: 0,
    platformFee: 29,
    total: 0
  });

  const calculateLocalTotals = (cartItems) => {
    let sub = 0;
    cartItems.forEach(item => {
      sub += parseFloat(item.price) * (parseInt(item.quantity) || 1);
    });
    const disc = 0;
    const ship = sub > 500 ? 0 : 50;
    const gst = parseFloat((sub * 0.05).toFixed(2));
    const fee = 29.00;
    const grand = parseFloat((sub + ship + gst + fee).toFixed(2));

    setTotals({
      subtotal: sub,
      discount: disc,
      shipping: ship,
      gst: gst,
      platformFee: fee,
      total: grand
    });
  };

  useEffect(() => {
    const initCheckout = async () => {
      try {
        const config = await getPaymentConfig();
        setIsRazorpayConfigured(config.isConfigured);
        setRazorpayKeyId(config.keyId);

        const res = await cartService.getCart();
        const cartItems = res.data?.items || res.data || [];
        if (cartItems.length === 0) {
          navigate('/cart');
          return;
        }
        setItems(cartItems);
        calculateLocalTotals(cartItems);
      } catch (err) {
        console.error('Checkout init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initCheckout();
  }, [navigate]);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!formData.address || !formData.city || !formData.postalCode || !formData.phone) {
      alert('Please fill in all shipping details');
      return;
    }

    setSubmitting(true);
    setPaymentError(null);
    setPriceChangeWarning(null);

    const fullShippingAddress = `${formData.fullName}, ${formData.address}, ${formData.city} - ${formData.postalCode}, Phone: ${formData.phone}`;

    try {
      // 1. Create Payment Order on Backend with Idempotency
      const orderPayload = {
        shipping_address: fullShippingAddress,
        couponCode: formData.couponCode || null,
        expectedSubtotal: totals.subtotal,
        idempotencyKey
      };

      const paymentOrder = await createPaymentOrder(orderPayload);
      setTotals(paymentOrder.totals || totals);

      // 2. Open Razorpay / Mock Gateway
      if (paymentOrder.isTestMode) {
        // Execute Sandbox Verification
        const verificationPayload = {
          orderId: paymentOrder.orderId,
          razorpay_order_id: paymentOrder.rzpOrderId,
          razorpay_payment_id: `pay_sandbox_${Date.now()}`,
          razorpay_signature: `sig_sandbox_${Date.now()}`,
          method: 'Sandbox UPI/Card'
        };

        const verifyResult = await verifyPayment(verificationPayload);
        setConfirmedOrder({
          orderId: paymentOrder.orderId,
          invoiceNumber: `INV-${new Date().getFullYear()}-${paymentOrder.orderId}`,
          amount: paymentOrder.totals.total
        });
        setStep(3); // Success step
      } else {
        // Live Razorpay Modal
        const openModal = () => {
          const options = {
            key: paymentOrder.keyId,
            amount: paymentOrder.amount,
            currency: paymentOrder.currency,
            name: 'QUIRO Marketplace',
            description: 'Secure Literary Books Order',
            order_id: paymentOrder.rzpOrderId,
            handler: async function (response) {
              try {
                await verifyPayment({
                  orderId: paymentOrder.orderId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  method: 'Razorpay'
                });

                setConfirmedOrder({
                  orderId: paymentOrder.orderId,
                  invoiceNumber: `INV-${new Date().getFullYear()}-${paymentOrder.orderId}`,
                  amount: paymentOrder.totals.total
                });
                setStep(3);
              } catch (err) {
                setPaymentError(err.response?.data?.message || 'Payment verification failed');
                setFailedPaymentId(paymentOrder.paymentId);
                setStep(4);
              }
            },
            prefill: {
              name: formData.fullName,
              contact: formData.phone
            },
            theme: { color: '#35152F' },
            modal: {
              ondismiss: async function () {
                await reportPaymentFailure(paymentOrder.paymentId, 'Payment modal dismissed by user');
                setPaymentError('Payment was cancelled or closed');
                setFailedPaymentId(paymentOrder.paymentId);
                setStep(4);
              }
            }
          };

          if (window.Razorpay) {
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', async function (response) {
              await reportPaymentFailure(paymentOrder.paymentId, response.error?.description || 'Transaction declined');
              setPaymentError(response.error?.description || 'Transaction declined');
              setFailedPaymentId(paymentOrder.paymentId);
              setStep(4);
            });
            rzp.open();
          } else {
            setPaymentError('Razorpay checkout script is loading. Please retry.');
            setStep(4);
          }
        };

        if (!window.Razorpay) {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true;
          script.onload = () => openModal();
          script.onerror = () => {
            setPaymentError('Unable to load payment gateway script. Please check your network and retry.');
            setStep(4);
          };
          document.body.appendChild(script);
        } else {
          openModal();
        }
      }
    } catch (error) {
      if (error.response?.data?.error === 'PRICE_CHANGED') {
        setPriceChangeWarning(error.response.data.details);
        if (error.response.data.details.totals) {
          setTotals(error.response.data.details.totals);
        }
      } else {
        const isNetworkErr = !error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK');
        const friendlyMsg = isNetworkErr
          ? 'Unable to reach the payment service. Please ensure your connection is active and retry.'
          : (error.response?.data?.message || error.message || 'Checkout failed');
        setPaymentError(friendlyMsg);
        setStep(4);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!failedPaymentId) {
      setStep(1);
      return;
    }

    setSubmitting(true);
    setPaymentError(null);

    try {
      const retryResult = await retryPayment(failedPaymentId);
      if (retryResult.isTestMode) {
        await verifyPayment({
          orderId: retryResult.orderId,
          razorpay_order_id: retryResult.rzpOrderId,
          razorpay_payment_id: `pay_retry_${Date.now()}`,
          razorpay_signature: `sig_retry_${Date.now()}`,
          method: 'Sandbox UPI/Card'
        });

        setConfirmedOrder({
          orderId: retryResult.orderId,
          invoiceNumber: `INV-${new Date().getFullYear()}-${retryResult.orderId}`,
          amount: totals.total
        });
        setStep(3);
      } else {
        // Open Razorpay for retry
        const options = {
          key: retryResult.keyId,
          amount: retryResult.amount,
          currency: retryResult.currency,
          name: 'QUIRO Marketplace',
          description: `Retry Order #${retryResult.orderId}`,
          order_id: retryResult.rzpOrderId,
          handler: async function (response) {
            try {
              await verifyPayment({
                orderId: retryResult.orderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                method: 'Razorpay'
              });

              setConfirmedOrder({
                orderId: retryResult.orderId,
                invoiceNumber: `INV-${new Date().getFullYear()}-${retryResult.orderId}`,
                amount: totals.total
              });
              setStep(3);
            } catch (err) {
              setPaymentError(err.response?.data?.message || 'Payment verification failed');
              setStep(4);
            }
          },
          theme: { color: '#35152F' }
        };

        if (window.Razorpay) {
          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      }
    } catch (err) {
      setPaymentError(err.response?.data?.message || 'Failed to re-initiate payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Preparing secure checkout...</p>
      </div>
    );
  }

  // STEP 3: ORDER CONFIRMED
  if (step === 3 && confirmedOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6 animate-fadeIn">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-soft">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Payment Verified & Captured
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-3">Order Confirmed!</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Order #{confirmedOrder.orderId} • Total {formatCurrency(confirmedOrder.amount)}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-left space-y-3">
          <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-200/80 font-semibold text-slate-600">
            <span>Invoice Reference</span>
            <span className="font-mono text-indigo-600 font-bold">{confirmedOrder.invoiceNumber}</span>
          </div>
          <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-200/80 font-semibold text-slate-600">
            <span>Escrow Status</span>
            <span className="text-emerald-600 font-bold flex items-center gap-1">
              <ShieldCheck size={14} /> Held securely for delivery
            </span>
          </div>
          <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
            <span>Fulfillment</span>
            <span className="text-slate-800">Sellers have been notified to dispatch</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <button
            onClick={() => navigate('/orders')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-750 text-white text-xs font-bold rounded-xl transition-all shadow-soft flex items-center justify-center gap-2"
          >
            <FileText size={16} />
            <span>Track Orders & Invoices</span>
          </button>
          <button
            onClick={() => navigate('/browse')}
            className="px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <ShoppingBag size={16} />
            <span>Continue Shopping</span>
          </button>
        </div>
      </div>
    );
  }

  // STEP 4: PAYMENT FAILED / RETRY
  if (step === 4) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <PaymentRetry 
          reason={paymentError} 
          onRetry={handleRetryPayment} 
          retrying={submitting} 
        />
      </div>
    );
  }

  // STEP 1 & 2: MAIN CHECKOUT FLOW
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-100">
        <div>
          <button 
            onClick={() => navigate('/cart')} 
            className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Cart
          </button>
          <h1 className="text-xl font-bold text-slate-900">Secure Marketplace Checkout</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Safe transactions with Community Escrow & Buyer Protection</p>
        </div>

        <div className="flex items-center gap-3">
          <PaymentStatus status="PENDING" />
          <span className="text-xs text-slate-400 font-semibold">• Step 1 of 2</span>
        </div>
      </div>

      {/* Inventory Reservation Notice */}
      <div className="mb-6">
        <InventoryReservationNotice ttlMinutes={15} onExpire={() => {
          alert('Checkout session expired. Returning to cart.');
          navigate('/cart');
        }} />
      </div>

      {/* Price Change Warning Banner */}
      {priceChangeWarning && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 shadow-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Listing Price Updated in Marketplace</p>
            <p className="text-[11px] text-amber-800">
              One or more items in your cart had their listing price updated by sellers. Your new grand total is <strong>{formatCurrency(priceChangeWarning.newTotal)}</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Shipping Form & Payment Method */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleCheckoutSubmit} className="space-y-6">
            
            {/* Delivery Information Card */}
            <section className="border border-slate-100 bg-white rounded-2xl p-5 md:p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-50">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Delivery Address</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600 transition-colors"
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    placeholder="Hostel / Flat No., Street, Landmark"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600 transition-colors"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">City / Campus</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bangalore"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600 transition-colors"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Postal Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 560001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600 transition-colors"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600 transition-colors"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
            </section>

            {/* Payment Method Card */}
            <section className="border border-slate-100 bg-white rounded-2xl p-5 md:p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-50">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Payment Gateway</h3>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-white flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-bold mb-0.5">
                    {isRazorpayConfigured ? 'Razorpay Secure Checkout' : 'Razorpay Test Sandbox'}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                    <ShieldCheck size={12} /> UPI, Debit/Credit Cards, NetBanking
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              </div>
              <p className="text-[10px] text-slate-400 mt-3 italic">
                {isRazorpayConfigured 
                  ? 'PCI-DSS compliant payment processing powered by Razorpay.' 
                  : 'Test mode active: Sandbox verification will simulate payment capture without real charges.'}
              </p>
            </section>

            {/* Submit checkout order button */}
            <button 
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-600 hover:bg-primary-750 text-white py-4 rounded-xl font-bold transition-all shadow-soft flex items-center justify-center disabled:opacity-50 select-none active:scale-[0.98] text-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span>Processing Payment Intent...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  <span>Pay Securely & Place Order • {formatCurrency(totals.total)}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Order Items Review list */}
        <aside className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 pb-3 border-b border-slate-50 flex justify-between items-center">
              <span>Review Items</span> 
              <span className="text-[10px] text-slate-400 font-semibold lowercase">
                ({items.reduce((acc, curr) => acc + (parseInt(curr.quantity) || 1), 0)} units)
              </span>
            </h3>
            
            <div className="space-y-4 mb-5 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 aspect-[3/4.2] object-contain rounded border border-slate-100 bg-slate-50 p-0.5 shrink-0 flex items-center justify-center">
                    <OptimizedImage 
                      src={item.cover_image} 
                      alt={item.title}
                      className="w-full h-full object-contain" 
                    />
                  </div>
                  <div className="flex-grow min-w-0 text-left">
                    <h4 className="text-xs font-bold text-slate-800 truncate leading-tight">{item.title}</h4>
                    <p className="text-[9px] text-slate-400 font-semibold mt-0.5">by {item.author}</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase">Qty: {item.quantity || 1}</p>
                  </div>
                  <div className="text-xs font-bold text-slate-850 shrink-0">
                    {formatCurrency(parseFloat(item.price) * (parseInt(item.quantity) || 1))}
                  </div>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>Subtotal</span>
                <span className="font-bold text-slate-850">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-xs font-semibold text-emerald-600">
                  <span>Coupon Discount</span>
                  <span className="font-bold">- {formatCurrency(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>Shipping Fee</span>
                {totals.shipping === 0 ? (
                  <span className="font-bold text-emerald-600">FREE</span>
                ) : (
                  <span className="font-bold text-slate-850">{formatCurrency(totals.shipping)}</span>
                )}
              </div>
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>GST (5%)</span>
                <span className="font-bold text-slate-850">{formatCurrency(totals.gst)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-slate-500">
                <span>Platform Fee</span>
                <span className="font-bold text-slate-850">{formatCurrency(totals.platformFee)}</span>
              </div>
              <div className="pt-3.5 border-t border-slate-50 flex justify-between items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Grand Total</span>
                <span className="text-lg font-extrabold text-primary-600 leading-none">{formatCurrency(totals.total)}</span>
              </div>
            </div>

            {/* Escrow Guarantee info */}
            <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-start text-left">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="ml-2.5">
                <p className="text-[10px] font-bold text-slate-850 uppercase tracking-widest mb-0.5">Community Escrow Guard</p>
                <p className="text-[9px] text-slate-400 leading-relaxed font-semibold">Your funds are safe. Payouts are dispatched to sellers only upon delivery verification.</p>
              </div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default Checkout;
