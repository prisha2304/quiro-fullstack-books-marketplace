import { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  User, 
  BookOpen, 
  Calendar,
  Zap
} from 'lucide-react';
import adminService from '../../services/adminService';
import AdminDataTable from '../../components/AdminDataTable';
import toast from 'react-hot-toast';

const SwapManagement = () => {
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSwaps();
  }, []);

  const fetchSwaps = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getSwaps();
      setSwaps(data);
    } catch (error) {
      toast.error('Failed to load swap records');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await adminService.updateSwap(id, { status });
      toast.success(`Swap status changed to ${status}`);
      fetchSwaps();
    } catch (error) {
      toast.error('Failed to update swap record');
    }
  };

  const columns = [
    { 
      header: 'Exchange Entities', 
      render: (swap) => (
        <div className="flex flex-col space-y-1">
           <div className="flex items-center text-xs font-black text-slate-900 line-clamp-1">
              <Zap className="w-3.5 h-3.5 mr-2 text-indigo-600" /> {swap.requested_title}
           </div>
           <div className="flex items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-5">
              for {swap.offered_title || 'N/A'}
           </div>
        </div>
      )
    },
    { 
      header: 'Participants', 
      render: (swap) => (
        <div className="text-xs font-medium text-slate-600 space-y-1">
           <div className="flex items-center"><User className="w-3 h-3 mr-1.5 text-slate-300" /> {swap.requester_name} (Req)</div>
           <div className="flex items-center"><User className="w-3 h-3 mr-1.5 text-slate-300" /> {swap.owner_name} (Owner)</div>
        </div>
      )
    },
    { 
      header: 'Status', 
      render: (swap) => (
        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
           swap.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' :
           swap.status === 'rejected' || swap.status === 'cancelled' ? 'bg-red-50 text-red-500 border-red-100' :
           'bg-amber-50 text-amber-600 border-amber-100'
        }`}>
           {swap.status}
        </span>
      )
    },
    { 
      header: 'Created At', 
      render: (swap) => (
        <div className="flex items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
           <Calendar className="w-3.5 h-3.5 mr-1.5" /> {new Date(swap.created_at).toLocaleDateString()}
        </div>
      )
    }
  ];

  const filteredSwaps = swaps.filter(s => 
    s.requested_title.toLowerCase().includes(search.toLowerCase()) || 
    s.requester_name.toLowerCase().includes(search.toLowerCase()) ||
    s.owner_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-500">
      <AdminDataTable 
        title="Swap Log Analysis"
        columns={columns}
        data={filteredSwaps}
        loading={loading}
        search={search}
        setSearch={setSearch}
        actions={(swap) => (
          <>
             {swap.status === 'accepted' && (
                <button 
                  onClick={() => handleUpdateStatus(swap.id, 'completed')}
                  className="p-2.5 bg-green-50 text-green-600 hover:bg-green-100 border border-green-100 rounded-xl transition-all"
                  title="Force Complete Swap"
                >
                   <CheckCircle2 className="w-4 h-4" />
                </button>
             )}
             
             {['pending', 'accepted'].includes(swap.status) && (
                <button 
                  onClick={() => handleUpdateStatus(swap.id, 'cancelled')}
                  className="p-2.5 bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 rounded-xl transition-all"
                  title="Force Terminate Swap"
                >
                   <XCircle className="w-4 h-4" />
                </button>
             )}
          </>
        )}
      />
    </div>
  );
};

export default SwapManagement;
