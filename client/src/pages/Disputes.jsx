import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  MessageSquare, 
  FileText, 
  Filter, 
  Loader2, 
  PlusCircle,
  Package,
  ArrowRightLeft
} from 'lucide-react';
import disputeService from '../services/disputeService';
import toast from 'react-hot-toast';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Cases' },
  { id: 'OPEN', label: 'Open' },
  { id: 'UNDER_REVIEW', label: 'Under Review' },
  { id: 'WAITING_FOR_SELLER', label: 'Waiting for Seller' },
  { id: 'WAITING_FOR_USER', label: 'Action Required' },
  { id: 'RESOLVED', label: 'Resolved' }
];

const Disputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');

  useEffect(() => {
    fetchDisputes();
  }, [activeFilter]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const { data } = await disputeService.getMyDisputes({
        status: activeFilter === 'ALL' ? null : activeFilter
      });
      setDisputes(data || []);
    } catch (error) {
      toast.error('Failed to load dispute cases');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200"><Clock size={12} /> Open</span>;
      case 'UNDER_REVIEW':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200"><ShieldAlert size={12} /> Under Review</span>;
      case 'WAITING_FOR_USER':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle size={12} /> Action Required</span>;
      case 'WAITING_FOR_SELLER':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200"><Clock size={12} /> Waiting on Seller</span>;
      case 'RESOLVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={12} /> Resolved</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Closed</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 text-left animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              Trust & Safety Center
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1.5">
            Dispute & Transaction Protection
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Track order resolutions, damaged textbook reports, return requests, and mediation status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/orders"
            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
          >
            <Package size={15} />
            <span>Dispute an Order</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === f.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Disputes List */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-2" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading disputes...</p>
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-soft">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-4">
            <ShieldCheck size={32} />
          </div>
          <h3 className="text-base font-black text-slate-900">No Disputes in this Category</h3>
          <p className="text-xs text-slate-500 font-medium max-w-md mx-auto mt-1">
            You currently have no open claims or transaction reports in this status. All orders and swaps are in good standing!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <Link
              key={d.id}
              to={`/disputes/${d.dispute_code || d.id}`}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft hover:border-primary-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    #{d.dispute_code}
                  </span>
                  {getStatusBadge(d.status)}
                  <span className="text-[11px] font-bold text-slate-400">
                    • {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                    {d.entity_type} #{d.entity_id}
                  </span>
                </div>

                <h3 className="text-sm md:text-base font-black text-slate-900 group-hover:text-primary-600 transition-colors">
                  {d.reason}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-1 font-medium">
                  {d.description}
                </p>

                <div className="flex items-center gap-4 text-xs font-bold text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <MessageSquare size={13} /> {d.message_count || 1} message(s)
                  </span>
                  {d.evidence_count > 0 && (
                    <span className="flex items-center gap-1 text-primary-600">
                      <FileText size={13} /> {d.evidence_count} evidence file(s)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Claimant / Counterpart</span>
                  <span className="text-xs font-bold text-slate-700">{d.initiator_name} vs {d.respondent_name}</span>
                </div>
                <div className="w-9 h-9 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 group-hover:border-primary-200 transition-all">
                  <ChevronRight size={18} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  );
};

export default Disputes;
