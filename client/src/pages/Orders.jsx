import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import orderService from '../services/orderService';
import { formatCurrency } from '../utils/format';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Calendar, 
  ChevronRight, 
  Download, 
  FileText, 
  BookOpen, 
  ExternalLink,
  Star,
  MapPin,
  RotateCcw,
  Receipt,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReviewModal from '../components/ReviewModal';
import ReportModal from '../components/disputes/ReportModal';
import OptimizedImage from '../components/OptimizedImage';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReviewItem, setSelectedReviewItem] = useState(null);
  const [selectedReportOrder, setSelectedReportOrder] = useState(null);
  const [selectedRefundOrder, setSelectedRefundOrder] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await orderService.getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundReason.trim()) {
      toast.error('Please enter a reason for the refund request');
      return;
    }
    setSubmittingRefund(true);
    try {
      await orderService.requestRefund(selectedRefundOrder.id, { reason: refundReason });
      toast.success('Refund request submitted successfully and is under review');
      setSelectedRefundOrder(null);
      setRefundReason('');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit refund request');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleDownloadInvoice = async (e, orderId) => {
    e.stopPropagation();
    try {
      const response = await orderService.downloadInvoice(orderId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QUIRO_Invoice_QR-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Invoice downloaded');
    } catch (err) {
      toast.error('Failed to download invoice');
    }
  };

  return (
    <div className="bg-[#FAFAF9] min-h-screen pt-20 pb-24 text-left animate-in fade-in duration-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-slate-200/80">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 block mb-1">
              Purchase History & Fulfillment
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              My Orders
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Track live shipments, download verified GST invoices, rate sellers, and raise dispute claims.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/disputes"
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <ShieldAlert size={14} />
              <span>Dispute Center</span>
            </Link>
          </div>
        </div>

        {/* Order List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-6 h-40 animate-pulse" />
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-6">
            {orders.map(order => (
              <div 
                key={order.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-soft hover:border-primary-200 transition-all space-y-4"
              >
                {/* Order Top Meta */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                      Order #BN-{order.id}
                    </span>
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                      <Calendar size={13} />
                      {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    order.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    order.status === 'cancelled' || order.status === 'refunded' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    'bg-primary-50 text-primary-700 border border-primary-200'
                  }`}>
                    {order.status}
                  </span>
                </div>

                {/* Items in Order */}
                <div className="space-y-3">
                  {(order.items || []).map(item => (
                    <div key={item.id} className="flex items-center gap-3.5">
                      <div className="w-12 h-16 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                        <OptimizedImage src={item.cover_image} alt={item.title} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                        <p className="text-[10px] text-slate-500 font-medium">by {item.author}</p>
                        <span className="text-[10px] font-semibold text-slate-400">Sold by {item.seller_name || 'Campus Seller'}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-slate-900">{formatCurrency(item.price)}</span>
                        {order.status === 'delivered' && (
                          <button
                            onClick={() => setSelectedReviewItem(item)}
                            className="block text-[10px] font-bold text-amber-600 hover:underline mt-1"
                          >
                            Rate Seller
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Bar: Grand Total & Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3.5 border-t border-slate-100">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Paid:</span>
                    <span className="text-sm font-black text-slate-900">{formatCurrency(order.total_price)}</span>
                  </div>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
                    {order.status !== 'cancelled' && order.status !== 'refunded' && (
                      <button
                        onClick={() => { setSelectedRefundOrder(order); setRefundReason(''); }}
                        className="bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-200 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>Request Refund</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedReportOrder(order)}
                      className="bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <ShieldAlert size={13} />
                      <span>Report Issue</span>
                    </button>

                    <button
                      onClick={(e) => handleDownloadInvoice(e, order.id)}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Download size={13} />
                      <span>Invoice (PDF)</span>
                    </button>

                    <Link
                      to={`/orders/${order.id}`}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors shadow-sm active:scale-[0.98]"
                    >
                      <span>Track Package</span>
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">No orders placed yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You have not placed any orders yet. Discover textbooks and pre-owned reads on our marketplace.
            </p>
            <Link to="/browse" className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 shadow-sm mt-2">
              <BookOpen size={14} />
              <span>Explore Marketplace</span>
            </Link>
          </div>
        )}

      </div>

      {/* Review Modal */}
      {selectedReviewItem && (
        <ReviewModal
          isOpen={!!selectedReviewItem}
          onClose={() => setSelectedReviewItem(null)}
          book={selectedReviewItem}
          onReviewSubmitted={() => {
            fetchOrders();
            setSelectedReviewItem(null);
          }}
        />
      )}

      {/* Report / Dispute Modal */}
      {selectedReportOrder && (
        <ReportModal
          isOpen={!!selectedReportOrder}
          onClose={() => setSelectedReportOrder(null)}
          targetType="order"
          targetId={selectedReportOrder.id}
          targetTitle={`Order #BN-${selectedReportOrder.id}`}
          onSuccess={() => {
            fetchOrders();
            setSelectedReportOrder(null);
          }}
        />
      )}

      {/* Refund Request Modal */}
      {selectedRefundOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[#DCE2E8] shadow-2xl relative text-left space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <RotateCcw size={16} />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 leading-tight">Request Refund</h3>
                  <p className="text-[11px] text-stone-500">Order #BN-{selectedRefundOrder.id} &middot; Total: {formatCurrency(selectedRefundOrder.total_price)}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRefundOrder(null)} 
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRequestRefundSubmit} className="space-y-4">
              <div className="p-3 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl text-xs text-stone-600 leading-relaxed">
                Refunds are processed back to your original Razorpay payment method upon verification by the administrator.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Reason for Refund Request:
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
                  onClick={() => setSelectedRefundOrder(null)}
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

export default Orders;
