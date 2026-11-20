import { useState, useEffect } from 'react';
import { 
  Tag, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Plus, 
  Percent, 
  IndianRupee,
  Calendar,
  X
} from 'lucide-react';
import adminService from '../../services/adminService';
import AdminDataTable from '../../components/AdminDataTable';
import toast from 'react-hot-toast';

const CouponManagement = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form State
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_percent: '',
    max_discount: '',
    min_order_value: '',
    active: true
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getCoupons();
      setCoupons(data);
    } catch (error) {
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await adminService.toggleCoupon(id, !currentStatus);
      toast.success('Coupon status updated');
      fetchCoupons();
    } catch (error) {
      toast.error('Failed to update coupon status');
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Are you sure you want to delete this coupon code permanently?')) return;
    try {
      await adminService.deleteCoupon(id);
      toast.success('Coupon deleted successfully');
      fetchCoupons();
    } catch (error) {
      toast.error('Failed to delete coupon');
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!newCoupon.code.trim()) return toast.error('Code is required');
    if (!newCoupon.discount_percent || parseFloat(newCoupon.discount_percent) <= 0) {
      return toast.error('Please enter a valid discount percentage');
    }

    try {
      await adminService.createCoupon(newCoupon);
      toast.success('Coupon created successfully!');
      setShowCreateModal(false);
      setNewCoupon({
        code: '',
        discount_percent: '',
        max_discount: '',
        min_order_value: '',
        active: true
      });
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create coupon');
    }
  };

  const columns = [
    { 
      header: 'Promo Code & Info', 
      render: (coupon) => (
        <div className="flex items-center">
           <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm shrink-0">
              <Tag className="w-5 h-5 animate-in zoom-in duration-300" />
           </div>
           <div className="ml-4">
              <p className="text-sm font-black text-slate-900 leading-none mb-1 flex items-center">
                 {coupon.code} 
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type: Flat Percentage</p>
           </div>
        </div>
      )
    },
    { 
      header: 'Value & Parameters', 
      render: (coupon) => (
        <div className="flex flex-col space-y-1">
           <div className="flex items-center text-xs text-slate-950 font-black">
              <Percent className="w-3.5 h-3.5 mr-2 text-indigo-500" /> {coupon.discount_percent}% Off
           </div>
           <div className="text-[10.5px] text-slate-500 font-semibold flex items-center">
              Min Spend: ₹{coupon.min_order_value || 0}
              {coupon.max_discount ? ` | Max Cap: ₹${coupon.max_discount}` : ' | No Cap'}
           </div>
        </div>
      )
    },
    { 
      header: 'Promo Status', 
      render: (coupon) => (
        <div className="flex items-center">
           <div className={`w-2 h-2 rounded-full mr-2 ${coupon.active ? 'bg-green-500 shadow-lg shadow-green-150' : 'bg-red-500 shadow-lg shadow-red-150'}`} />
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{coupon.active ? 'Active' : 'Inactive'}</span>
        </div>
      )
    }
  ];

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-end mb-6">
         <button 
           onClick={() => setShowCreateModal(true)}
           className="flex items-center gap-2 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-primary-900/10 hover:shadow-xl hover:-translate-y-[1px] transition-all"
         >
            <Plus className="w-4 h-4" /> Create Coupon Promo
         </button>
      </div>

      <AdminDataTable 
        title="Promotional Coupons"
        columns={columns}
        data={filteredCoupons}
        loading={loading}
        search={search}
        setSearch={setSearch}
        actions={(coupon) => (
          <>
             <button 
               onClick={() => handleToggleStatus(coupon.id, coupon.active)}
               className={`p-2.5 rounded-xl border transition-all ${coupon.active ? 'text-green-600 bg-green-50 hover:bg-green-150 border-green-100' : 'text-slate-400 bg-slate-50 hover:bg-slate-100 border-slate-100'}`}
               title={coupon.active ? 'Deactivate Coupon' : 'Activate Coupon'}
             >
                {coupon.active ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
             </button>
             
             <button 
               onClick={() => handleDeleteCoupon(coupon.id)}
               className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-650 hover:bg-red-50 border border-slate-100 rounded-xl transition-all"
               title="Delete Coupon"
             >
                <Trash2 className="w-4 h-4" />
             </button>
          </>
        )}
      />

      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <form 
            onSubmit={handleCreateCoupon}
            className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl p-8 z-10 overflow-hidden"
          >
             <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <div>
                   <h3 className="text-lg font-black text-slate-900">Create New Coupon Promo</h3>
                   <p className="text-xs text-slate-505 font-medium mt-1">Generate a discount code to apply on user checkouts.</p>
                </div>
                <button type="button" onClick={() => setShowCreateModal(false)} className="p-2 text-slate-450 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all">
                   <X className="w-4 h-4" />
                </button>
             </div>

             <div className="space-y-5">
                <div>
                   <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Coupon Code</label>
                   <input 
                     type="text" 
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white transition-all text-slate-800"
                     placeholder="e.g. MONSOON20"
                     value={newCoupon.code}
                     onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value })}
                     required
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Discount %</label>
                      <input 
                        type="number" 
                        min="1"
                        max="100"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white transition-all text-slate-800"
                        placeholder="e.g. 15"
                        value={newCoupon.discount_percent}
                        onChange={e => setNewCoupon({ ...newCoupon, discount_percent: e.target.value })}
                        required
                      />
                   </div>

                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Min Purchase (₹)</label>
                      <input 
                        type="number" 
                        min="0"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white transition-all text-slate-800"
                        placeholder="e.g. 500"
                        value={newCoupon.min_order_value}
                        onChange={e => setNewCoupon({ ...newCoupon, min_order_value: e.target.value })}
                      />
                   </div>
                </div>

                <div>
                   <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Max Cap Discount (₹) <span className="text-[9px] text-slate-400 capitalize font-medium">(Optional)</span></label>
                   <input 
                     type="number" 
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white transition-all text-slate-800"
                     placeholder="e.g. 150"
                     value={newCoupon.max_discount}
                     onChange={e => setNewCoupon({ ...newCoupon, max_discount: e.target.value })}
                   />
                </div>
             </div>

             <div className="flex gap-4 mt-8 pb-1 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-xs font-black transition-colors"
                >
                   Close
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-black shadow-lg shadow-primary-900/10 transition-all"
                >
                   Save Coupon Code
                </button>
             </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;
