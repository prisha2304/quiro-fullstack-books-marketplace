import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import orderService from '../services/orderService';
import { formatCurrency } from '../utils/format';
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
  AlertCircle,
  Search,
  ExternalLink,
  ChevronRight,
  User,
  ShoppingBag,
  RotateCcw,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import OptimizedImage from '../components/OptimizedImage';

const SellerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingModalOrder, setTrackingModalOrder] = useState(null);
  const [trackingInput, setTrackingInput] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await orderService.getSellerOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load seller orders');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus, trackingNum = null) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus, trackingNum);
      toast.success(`Order #${orderId} marked as ${newStatus.toUpperCase()}`);
      fetchOrders();
      setTrackingModalOrder(null);
      setTrackingInput('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order status');
    }
  };

  const handleDownloadInvoice = async (orderId) => {
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

  const filteredOrders = orders.filter(ord => {
    const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;
    const matchesSearch = !searchQuery.trim() || 
      ord.buyer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.book_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.order_id?.toString().includes(searchQuery);

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="bg-[#FAFAF9] min-h-screen pt-20 pb-24 text-left animate-in fade-in duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-slate-200/80">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 block mb-1">
              Fulfillment Command Center
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Seller Incoming Orders
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Review incoming student orders, pack shipments, and provide tracking numbers
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xs">
              Dashboard Overview
            </Link>
            <Link to="/my-listings" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm">
              My Inventory
            </Link>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-soft mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-1.5 bg-slate-100/70 p-1 rounded-xl">
            {['all', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  statusFilter === st 
                    ? 'bg-white text-slate-900 shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by buyer, book, or ID..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-primary-600 focus:bg-white"
            />
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-slate-200 rounded-2xl animate-pulse"></div>)}
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-4">
            {filteredOrders.map((ord, idx) => (
              <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-soft hover:shadow-premium transition-all">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  
                  {/* Book & Order Info (4 cols) */}
                  <div className="lg:col-span-4 flex items-center gap-3.5">
                    <div className="w-14 h-18 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                      <OptimizedImage src={ord.cover_image} alt={ord.book_title} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] font-black text-primary-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                          #BN-{ord.order_id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {new Date(ord.created_at).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 truncate" title={ord.book_title}>
                        {ord.book_title}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium">by {ord.book_author}</p>
                      <p className="text-xs font-black text-slate-900 mt-1">{formatCurrency(ord.item_price || ord.total_price)}</p>
                    </div>
                  </div>

                  {/* Buyer & Shipping Info (4 cols) */}
                  <div className="lg:col-span-4 text-xs space-y-1 bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
                    <div className="flex items-center gap-1 text-slate-800 font-bold">
                      <User size={13} className="text-primary-600" />
                      <span>{ord.buyer_name || 'Buyer'}</span>
                    </div>
                    <div className="flex items-start gap-1 text-[11px] text-slate-600 font-medium">
                      <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="truncate">{ord.shipping_address || 'Address provided at checkout'}</span>
                    </div>
                    {ord.buyer_phone && <p className="text-[10px] text-slate-500 font-semibold pl-4">Phone: {ord.buyer_phone}</p>}
                  </div>

                  {/* Status & Workflow Action CTAs (4 cols) */}
                  <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col justify-between items-start lg:items-end gap-3">
                    
                    {/* Status Pill */}
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        ord.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        ord.status === 'shipped' || ord.status === 'out_for_delivery' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        ord.status === 'packed' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        ord.status === 'confirmed' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {ord.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Action Step Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ord.status === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateStatus(ord.order_id, 'packed')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Mark Packed
                        </button>
                      )}

                      {ord.status === 'packed' && (
                        <button
                          onClick={() => setTrackingModalOrder(ord)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Dispatch / Ship
                        </button>
                      )}

                      {ord.status === 'shipped' && (
                        <button
                          onClick={() => handleUpdateStatus(ord.order_id, 'out_for_delivery')}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Out for Delivery
                        </button>
                      )}

                      {ord.status === 'out_for_delivery' && (
                        <button
                          onClick={() => handleUpdateStatus(ord.order_id, 'delivered')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Mark Delivered
                        </button>
                      )}

                      {/* Download Invoice Button */}
                      <button
                        onClick={() => handleDownloadInvoice(ord.order_id)}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 p-1.5 rounded-lg text-xs transition-colors"
                        title="Download Tax Invoice"
                      >
                        <Download size={13} />
                      </button>

                      <Link
                        to={`/orders/${ord.order_id}`}
                        className="p-1.5 text-slate-400 hover:text-slate-700"
                        title="View Full Order Tracker"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>

                  </div>

                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-900">No incoming orders found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              When students purchase your listed books, their orders will appear here for you to pack and ship.
            </p>
          </div>
        )}

      </div>

      {/* Shipment Tracking Modal */}
      {trackingModalOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-premium space-y-4 text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Truck size={16} className="text-primary-600" /> Dispatch Order #BN-{trackingModalOrder.order_id}
              </h3>
              <button onClick={() => setTrackingModalOrder(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Enter courier partner tracking consignment number for <strong>"{trackingModalOrder.book_title}"</strong>:
            </p>

            <input 
              type="text"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              placeholder="e.g. DTDC-892019482 or INDIA-POST-98201"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-primary-600 focus:bg-white"
            />

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setTrackingModalOrder(null)}
                className="w-1/2 py-2.5 bg-slate-100 rounded-xl font-bold text-xs text-slate-700"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleUpdateStatus(trackingModalOrder.order_id, 'shipped', trackingInput || `BN-EXP-${Date.now().toString().slice(-6)}`)}
                className="w-1/2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SellerOrders;
