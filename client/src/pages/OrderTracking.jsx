import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import orderService from '../services/orderService';
import { formatCurrency } from '../utils/format';
import OptimizedImage from '../components/OptimizedImage';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  FileText, 
  Download, 
  ArrowLeft, 
  ShieldCheck, 
  RotateCcw, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  User,
  ShoppingBag,
  CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';

const OrderTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [refundInfo, setRefundInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const [orderRes, refundRes] = await Promise.all([
          orderService.getOrderById(id),
          orderService.getRefundStatus(id).catch(() => ({ data: { hasRefund: false } }))
        ]);
        setOrder(orderRes.data);
        if (refundRes.data?.hasRefund) {
          setRefundInfo(refundRes.data.refund);
        }
      } catch (err) {
        toast.error('Failed to load order tracking details');
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, navigate]);

  const handleRequestRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundReason.trim()) {
      toast.error('Please enter a reason for the refund request');
      return;
    }
    setSubmittingRefund(true);
    try {
      await orderService.requestRefund(id, { reason: refundReason });
      toast.success('Refund request submitted successfully and is under review');
      setShowRefundModal(false);
      setRefundReason('');
      const { data } = await orderService.getRefundStatus(id);
      if (data?.hasRefund) {
        setRefundInfo(data.refund);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit refund request');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order? Any payment will be refunded to your original payment method.')) {
      return;
    }
    setCancelling(true);
    try {
      await orderService.cancelOrder(id);
      toast.success('Order cancelled successfully');
      setOrder(prev => ({ ...prev, status: 'cancelled' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setDownloading(true);
    try {
      const response = await orderService.downloadInvoice(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QUIRO_Invoice_QR-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      toast.error('Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  };

  const handleViewInvoice = async () => {
    try {
      const response = await orderService.downloadInvoice(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      toast.error('Failed to open invoice');
    }
  };

  if (loading || !order) return (
    <div className="max-w-5xl mx-auto px-4 py-28 animate-pulse text-left">
      <div className="h-6 bg-slate-200 rounded w-1/4 mb-6"></div>
      <div className="h-48 bg-slate-200 rounded-2xl mb-8"></div>
      <div className="h-80 bg-slate-200 rounded-2xl"></div>
    </div>
  );

  const steps = [
    { key: 'confirmed', label: 'Payment Confirmed', desc: 'Order placed & funds in escrow' },
    { key: 'packed', label: 'Order Packed', desc: 'Verified & packed by seller' },
    { key: 'shipped', label: 'Shipped', desc: 'Handed over to courier partner' },
    { key: 'out_for_delivery', label: 'Out For Delivery', desc: 'Courier out for delivery' },
    { key: 'delivered', label: 'Delivered', desc: 'Successfully received & verified' }
  ];

  const statusOrder = ['pending', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
  const currentIndex = statusOrder.indexOf(order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';

  return (
    <div className="bg-[#FAFAF9] min-h-screen pt-20 pb-24 text-left animate-in fade-in duration-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Navigation Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <Link to="/orders" className="text-xs font-bold text-slate-600 hover:text-primary-600 flex items-center gap-1.5 transition-colors">
            <ArrowLeft size={14} />
            <span>Back to All Orders</span>
          </Link>
          <span className="text-xs font-semibold text-slate-400">Order ID: #BN-{order.id}</span>
        </div>

        {/* Top Header Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-soft mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                  Live Shipment Tracker
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs font-semibold text-slate-500">
                  Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Shipment Tracking for Order #BN-{order.id}
              </h1>
            </div>

            {/* Action Buttons: Invoice & Cancellation */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {(order.status === 'pending' || order.status === 'confirmed') && (
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Cancel this order and initiate immediate refund"
                >
                  <AlertCircle size={14} />
                  <span>{cancelling ? 'Cancelling...' : 'Cancel Order'}</span>
                </button>
              )}
              <button
                onClick={handleViewInvoice}
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <FileText size={14} />
                <span>View Invoice</span>
              </button>
              <button
                onClick={handleDownloadInvoice}
                disabled={downloading}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
              >
                <Download size={14} />
                <span>{downloading ? 'Downloading...' : 'Download Invoice (PDF)'}</span>
              </button>
            </div>
          </div>

          {/* Shipment Visual Timeline */}
          {isCancelled ? (
            <div className="p-6 bg-rose-50 border border-rose-100 rounded-xl mt-6 flex items-center gap-3 text-rose-700">
              <AlertCircle size={24} className="shrink-0" />
              <div>
                <h3 className="text-sm font-bold">This order was {order.status.toUpperCase()}</h3>
                <p className="text-xs text-rose-600 mt-0.5">Payment has been refunded to your original payment method via Razorpay escrow.</p>
              </div>
            </div>
          ) : (
            <div className="mt-8 pt-2">
              <div className="relative">
                
                {/* Connecting Progress Line */}
                <div className="hidden sm:block absolute top-1/2 left-8 right-8 -translate-y-1/2 h-1 bg-slate-200 z-0">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, (Math.max(0, currentIndex - 1) / (steps.length - 1)) * 100))}%` }}
                  ></div>
                </div>

                {/* Milestones Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 sm:gap-2 relative z-10">
                  {steps.map((step, idx) => {
                    const isCompleted = currentIndex >= statusOrder.indexOf(step.key);
                    const isCurrent = order.status === step.key;

                    return (
                      <div key={step.key} className="flex sm:flex-col items-center sm:items-center text-left sm:text-center gap-3 sm:gap-2">
                        {/* Step Circle Pin */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shrink-0 ${
                          isCurrent ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow-sm' :
                          isCompleted ? 'bg-emerald-500 text-white shadow-2xs' :
                          'bg-slate-200 text-slate-500'
                        }`}>
                          {isCompleted ? <CheckCircle2 size={16} /> : idx + 1}
                        </div>

                        {/* Step Text */}
                        <div>
                          <p className={`text-xs font-bold ${
                            isCurrent ? 'text-primary-700 font-extrabold' :
                            isCompleted ? 'text-slate-900' : 'text-slate-400'
                          }`}>
                            {step.label}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium hidden sm:block mt-0.5">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Live Tracking Number Pill */}
              {order.tracking_number && (
                <div className="mt-6 p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Truck size={16} className="text-primary-600 shrink-0" />
                    <span className="text-slate-600 font-medium">Tracking Number:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-blue-200">
                      {order.tracking_number}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Standard Inspected Delivery
                  </span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* 2-Column Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Order Items (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-soft">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4">
                Ordered Items ({(order.items || []).length})
              </h3>

              <div className="space-y-3">
                {(order.items || []).map(item => (
                  <div key={item.id} className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                    <div className="w-12 h-16 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                      <OptimizedImage src={item.cover_image} alt={item.title} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                      <p className="text-[10px] text-slate-500 font-medium">by {item.author}</p>
                      <span className="inline-flex items-center text-[10px] font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.2 rounded mt-1">
                        Sold by {item.seller_name || 'QUIRO Official Hub'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-900 block">{formatCurrency(item.price)}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Qty: {item.quantity || 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Escrow Buyer Protection Seal */}
            <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-2xl p-4 flex items-start gap-3">
              <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <span className="font-bold">QUIRO 7-Day Escrow Protection:</span> Your payment is securely held in Razorpay escrow and will only be disbursed to the seller once the delivery is verified intact.
              </div>
            </div>
          </div>

          {/* RIGHT: Shipping Destination & Payment Summary (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Delivery Destination */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-soft space-y-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
                <MapPin size={14} className="text-primary-600" />
                <span>Shipping Address</span>
              </h3>
              <p className="text-xs font-bold text-slate-800">{order.buyer_name || 'Student Buyer'}</p>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{order.shipping_address || 'Address provided at checkout'}</p>
              {order.buyer_phone && <p className="text-xs text-slate-500 font-medium">Contact: {order.buyer_phone}</p>}
            </div>

            {/* Financial Ledger & Payment Details */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-soft space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
                <CreditCard size={14} className="text-emerald-600" />
                <span>Payment Summary</span>
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Payment Method:</span>
                  <span className="font-bold text-slate-800">{order.payment?.method?.toUpperCase() || 'Razorpay Prepaid'}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Shipping Fee:</span>
                  <span className="font-bold text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST Taxes:</span>
                  <span className="font-bold text-slate-800">Included</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Amount Paid:</span>
                  <span className="text-primary-700 font-extrabold">{formatCurrency(order.total_price)}</span>
                </div>
              </div>
            </div>

            {/* Refund Status or Request Section */}
            {refundInfo ? (
              <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-soft space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <RotateCcw size={14} className="text-amber-600" />
                    <span>Refund Status</span>
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    refundInfo.status === 'REFUND_COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    refundInfo.status === 'REFUND_FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {refundInfo.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-stone-600 font-medium">
                  Amount: <strong className="text-slate-900">₹{refundInfo.amount}</strong>
                </p>
                {refundInfo.reason && (
                  <p className="text-[11px] text-stone-500 italic">
                    Reason: &ldquo;{refundInfo.reason}&rdquo;
                  </p>
                )}
                {refundInfo.processed_at && (
                  <p className="text-[10px] text-stone-400">
                    Processed at: {new Date(refundInfo.processed_at).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              order.status !== 'cancelled' && order.status !== 'refunded' && (
                <div className="bg-white border border-[#DCE2E8] rounded-2xl p-5 shadow-soft space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Need a Refund?</h4>
                      <p className="text-[11px] text-stone-500">Subject to QUIRO 7-day buyer protection policy.</p>
                    </div>
                    <button
                      onClick={() => setShowRefundModal(true)}
                      className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Request Refund
                    </button>
                  </div>
                </div>
              )
            )}

          </div>

        </div>

      </div>

      {/* Refund Request Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[#DCE2E8] shadow-2xl relative text-left space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <RotateCcw size={16} />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 leading-tight">Request Refund</h3>
                  <p className="text-[11px] text-stone-500">Order #BN-{order.id} &middot; Total: {formatCurrency(order.total_price)}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRefundModal(false)} 
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRequestRefundSubmit} className="space-y-4">
              <div className="p-3 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl text-xs text-stone-600 leading-relaxed">
                Refunds are processed back to your original payment method upon review by the marketplace administrator.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Reason for Refund:
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Received incorrect edition, binding damaged, or package arrived after course semester started."
                  rows={4}
                  required
                  className="w-full p-3 bg-white border border-[#DCE2E8] rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#35152F] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#DCE2E8] text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRefund}
                  className="px-5 py-2.5 rounded-xl bg-[#35152F] hover:bg-[#2A1025] text-white text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submittingRefund ? 'Submitting...' : 'Submit Refund Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrderTracking;
