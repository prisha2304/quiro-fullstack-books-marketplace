import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  MapPin, 
  FileText,
  AlertCircle,
  RotateCcw,
  CreditCard,
  DollarSign,
  Search,
  Check,
  X
} from 'lucide-react';
import adminService from '../../services/adminService';
import AdminDataTable from '../../components/AdminDataTable';
import toast from 'react-hot-toast';

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'refunds'

  // Process Refund Modal state
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, refundsRes] = await Promise.all([
        adminService.getOrders(),
        adminService.getRefunds().catch(() => ({ data: [] }))
      ]);
      setOrders(ordersRes.data || []);
      setRefunds(refundsRes.data || []);
    } catch (error) {
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await adminService.updateOrder(id, { status });
      toast.success(`Order #${id} marked as ${status}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const openRefundModal = (order) => {
    setSelectedOrderForRefund(order);
    setRefundAmount(order.total_price);
    setRefundReason('Customer requested return/refund');
  };

  const handleProcessRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    setProcessingRefund(true);
    try {
      await adminService.processOrderRefund(selectedOrderForRefund.id, {
        amount: parseFloat(refundAmount),
        reason: refundReason
      });
      toast.success(`Refund of ₹${refundAmount} processed successfully via Razorpay`);
      setSelectedOrderForRefund(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process refund');
    } finally {
      setProcessingRefund(false);
    }
  };

  const orderColumns = [
    { 
      header: 'Identifier', 
      render: (order) => (
        <div className="flex items-center">
           <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 mr-4 border border-slate-100">
              <FileText className="w-5 h-5" />
           </div>
           <div>
              <p className="text-sm font-black text-slate-900 leading-none mb-1">Order #{order.id}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {new Date(order.created_at).toLocaleDateString()}
              </p>
              {order.invoice_number && (
                <span className="text-[9px] font-mono text-slate-500">{order.invoice_number}</span>
              )}
           </div>
        </div>
      )
    },
    { 
      header: 'Customer', 
      render: (order) => (
        <div>
          <div className="flex items-center text-xs font-black text-[#35152F]">
             <User className="w-3.5 h-3.5 mr-1 text-[#E5A323]" /> {order.buyer_name}
          </div>
          <span className="text-[10px] text-stone-400">{order.buyer_email}</span>
        </div>
      )
    },
    { 
      header: 'Financials', 
      render: (order) => (
        <div>
          <div className="text-sm font-black text-slate-900">₹{order.total_price}</div>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
            Prepaid
          </span>
        </div>
      )
    },
    { 
      header: 'Operational Status', 
      render: (order) => (
        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
           order.status === 'confirmed' || order.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-200' :
           order.status === 'refunded' || order.status === 'partially_refunded' ? 'bg-purple-50 text-[#35152F] border-purple-200' :
           order.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
           'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
           {order.status}
        </span>
      )
    }
  ];

  const refundColumns = [
    {
      header: 'Refund ID / Order',
      render: (ref) => (
        <div>
          <p className="text-xs font-bold text-slate-900">Refund #{ref.id}</p>
          <p className="text-[10px] text-stone-500 font-medium">Order #{ref.order_id} &middot; {new Date(ref.created_at).toLocaleDateString()}</p>
          {ref.razorpay_refund_id && (
            <p className="text-[9px] font-mono text-stone-400">{ref.razorpay_refund_id}</p>
          )}
        </div>
      )
    },
    {
      header: 'Customer',
      render: (ref) => (
        <div>
          <p className="text-xs font-bold text-[#35152F]">{ref.buyer_name || `User #${ref.user_id}`}</p>
          <p className="text-[10px] text-stone-400">{ref.buyer_email}</p>
        </div>
      )
    },
    {
      header: 'Amount / Reason',
      render: (ref) => (
        <div>
          <span className="text-sm font-black text-slate-900">₹{ref.amount}</span>
          <p className="text-[10px] text-stone-500 italic line-clamp-1 max-w-xs">{ref.reason || 'No reason provided'}</p>
        </div>
      )
    },
    {
      header: 'Status',
      render: (ref) => (
        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
          ref.status === 'REFUND_COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          ref.status === 'REFUND_FAILED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
          'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          {ref.status.replace(/_/g, ' ')}
        </span>
      )
    }
  ];

  const filteredOrders = orders.filter(o => 
    String(o.id).includes(search) || 
    (o.buyer_name && o.buyer_name.toLowerCase().includes(search.toLowerCase())) ||
    (o.invoice_number && o.invoice_number.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredRefunds = refunds.filter(r => 
    String(r.id).includes(search) ||
    String(r.order_id).includes(search) ||
    (r.buyer_name && r.buyer_name.toLowerCase().includes(search.toLowerCase())) ||
    (r.razorpay_refund_id && r.razorpay_refund_id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      
      {/* Tab Selector */}
      <div className="flex bg-white p-1 rounded-xl border border-[#DCE2E8] shadow-2xs max-w-md">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'orders' ? 'bg-[#35152F] text-white' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          All Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('refunds')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'refunds' ? 'bg-[#35152F] text-white' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Refund Requests ({refunds.length})
        </button>
      </div>

      {activeTab === 'orders' ? (
        <AdminDataTable 
          title="Orders & Transactions"
          columns={orderColumns}
          data={filteredOrders}
          loading={loading}
          search={search}
          setSearch={setSearch}
          actions={(order) => (
            <div className="flex items-center gap-1.5">
               {order.status === 'pending' && (
                  <button 
                    onClick={() => handleUpdateStatus(order.id, 'confirmed')}
                    className="p-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg transition-all"
                    title="Confirm Order"
                  >
                     <CheckCircle2 className="w-4 h-4" />
                  </button>
               )}
               
               {order.status !== 'cancelled' && order.status !== 'refunded' && (
                  <button 
                    onClick={() => openRefundModal(order)}
                    className="p-2 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all"
                    title="Process Refund via Razorpay"
                  >
                     <RotateCcw className="w-4 h-4" />
                  </button>
               )}

               {order.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                    className="p-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg transition-all"
                    title="Cancel Order"
                  >
                     <XCircle className="w-4 h-4" />
                  </button>
               )}
            </div>
          )}
        />
      ) : (
        <AdminDataTable 
          title="Refund Records & Razorpay Audits"
          columns={refundColumns}
          data={filteredRefunds}
          loading={loading}
          search={search}
          setSearch={setSearch}
          actions={(ref) => (
            ref.status === 'REFUND_REQUESTED' && (
              <button
                onClick={() => {
                  const matchedOrder = orders.find(o => o.id === ref.order_id) || { id: ref.order_id, total_price: ref.amount };
                  openRefundModal(matchedOrder);
                }}
                className="px-3 py-1.5 bg-[#35152F] hover:bg-[#2A1025] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
              >
                Approve &amp; Refund
              </button>
            )
          )}
        />
      )}

      {/* Process Refund Modal */}
      {selectedOrderForRefund && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DCE2E8] shadow-2xl relative text-left space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-amber-700" />
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Process Razorpay Refund
                </h3>
              </div>
              <button onClick={() => setSelectedOrderForRefund(null)} className="p-1 text-stone-400 hover:text-stone-700">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-stone-500">
              Issuing refund for <strong>Order #{selectedOrderForRefund.id}</strong> (Total: ₹{selectedOrderForRefund.total_price}).
              This will trigger a live or test refund through the connected Razorpay gateway.
            </p>

            <form onSubmit={handleProcessRefundSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Refund Amount (₹):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={selectedOrderForRefund.total_price}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  required
                  className="w-full p-2.5 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-[#35152F]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Administrative Reason / Notes:
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  required
                  className="w-full p-2.5 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#35152F] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForRefund(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE2E8] text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingRefund}
                  className="px-5 py-2 rounded-xl bg-[#35152F] hover:bg-[#2A1025] text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {processingRefund ? 'Processing...' : 'Execute Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrderManagement;
