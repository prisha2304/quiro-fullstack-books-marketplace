import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  Filter, 
  Eye, 
  Clock, 
  CheckCircle2, 
  X, 
  AlertTriangle, 
  RotateCcw, 
  CreditCard, 
  Send, 
  UserX, 
  UserCheck, 
  AlertOctagon, 
  Ban, 
  ExternalLink,
  Loader2,
  RefreshCw,
  Building,
  DollarSign
} from 'lucide-react';
import disputeService from '../../services/disputeService';
import SellerTrustBadge from '../../components/disputes/SellerTrustBadge';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';

const AdminDisputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filters & Sorting
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Selected Dispute for Investigation Workspace
  const [selectedDisputeId, setSelectedDisputeId] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  // Admin Action Form State
  const [actionStatus, setActionStatus] = useState('');
  const [actionPriority, setActionPriority] = useState('');
  const [resolutionType, setResolutionType] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [internalNote, setInternalNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    fetchDisputes();
    fetchStats();
  }, [statusFilter, priorityFilter, typeFilter, sortBy]);

  const fetchStats = async () => {
    try {
      const { data } = await disputeService.getTrustSafetyStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to load trust stats:', e.message);
    }
  };

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const { data } = await disputeService.getAdminDisputes({
        status: statusFilter === 'ALL' ? null : statusFilter,
        priority: priorityFilter === 'ALL' ? null : priorityFilter,
        entityType: typeFilter === 'ALL' ? null : typeFilter,
        search: searchQuery || null,
        sortBy
      });
      setDisputes(data || []);
    } catch (error) {
      toast.error('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  const openInvestigation = async (disputeId) => {
    setSelectedDisputeId(disputeId);
    setWorkspaceLoading(true);
    try {
      const { data } = await disputeService.getDisputeById(disputeId);
      setWorkspace(data);
      setActionStatus(data.dispute.status);
      setActionPriority(data.dispute.priority);
      setRefundAmount(data.dispute.refund_amount || data.transaction?.order?.total_price || 0);
    } catch (error) {
      toast.error('Failed to load investigation workspace');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedDisputeId) return;

    setSubmittingAction(true);
    try {
      await disputeService.updateDisputeStatus(workspace.dispute.id, {
        status: actionStatus || workspace.dispute.status,
        priority: actionPriority || workspace.dispute.priority,
        resolutionType: resolutionType || null,
        resolutionNotes: resolutionNotes || null,
        refundAmount: parseFloat(refundAmount || 0)
      });

      if (internalNote.trim()) {
        await disputeService.addMessage(workspace.dispute.id, {
          message: internalNote.trim(),
          isInternal: true
        });
        setInternalNote('');
      }

      toast.success('Dispute updated successfully');
      openInvestigation(workspace.dispute.id);
      fetchDisputes();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update dispute');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handlePostInternalNote = async (e) => {
    e.preventDefault();
    if (!internalNote.trim()) return;

    try {
      await disputeService.addMessage(workspace.dispute.id, {
        message: internalNote.trim(),
        isInternal: true
      });
      setInternalNote('');
      openInvestigation(workspace.dispute.id);
      toast.success('Internal audit note recorded');
    } catch (error) {
      toast.error('Failed to record internal note');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-left">
      
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
              Trust & Safety Moderation
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Marketplace Disputes & Investigation Center
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Investigate buyer claims, examine damaged book evidence, issue refunds, and resolve student disputes.
          </p>
        </div>

        {stats && (
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-amber-600 uppercase block">Open Cases</span>
              <span className="text-lg font-black text-amber-900">{stats.openDisputes}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-2xl text-center">
              <span className="text-[10px] font-bold text-rose-600 uppercase block">High Priority</span>
              <span className="text-lg font-black text-rose-900">{stats.highPriorityDisputes}</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-grow max-w-md bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchDisputes()}
            placeholder="Search dispute code, reason, or student name..."
            className="bg-transparent outline-none text-xs font-medium text-slate-800 w-full placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="WAITING_FOR_USER">Waiting for Buyer</option>
            <option value="WAITING_FOR_SELLER">Waiting for Seller</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest_priority">Highest Priority</option>
            <option value="unresolved">Oldest Unresolved</option>
          </select>

          <button
            onClick={fetchDisputes}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Disputes Dense Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Dispute ID</th>
                <th className="py-3.5 px-4">Entity</th>
                <th className="py-3.5 px-4">Claimant (Buyer)</th>
                <th className="py-3.5 px-4">Respondent (Seller)</th>
                <th className="py-3.5 px-4">Reason</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-12">
                    <Loader2 className="w-6 h-6 text-primary-600 animate-spin mx-auto mb-2" />
                    <span className="text-xs font-bold text-slate-400">Loading cases...</span>
                  </td>
                </tr>
              ) : disputes.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-400 font-medium">
                    No disputes match the selected filters.
                  </td>
                </tr>
              ) : (
                disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors font-medium text-slate-700">
                    <td className="py-3.5 px-4 font-mono font-black text-slate-900">
                      #{d.dispute_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {d.entity_type} #{d.entity_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900">{d.initiator_name}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900">{d.respondent_name}</span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate" title={d.reason}>
                      {d.reason}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        d.priority === 'URGENT' || d.priority === 'HIGH'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {d.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        d.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        d.status === 'UNDER_REVIEW' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        d.status === 'OPEN' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openInvestigation(d.id)}
                        className="bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 ml-auto transition-colors"
                      >
                        <Eye size={13} />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investigation Workspace Modal / Drawer */}
      {selectedDisputeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl border border-slate-200 text-left relative animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      Case #{workspace?.dispute?.dispute_code}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {workspace?.dispute?.status}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">
                    {workspace?.dispute?.reason}
                  </h2>
                </div>
              </div>

              <button 
                onClick={() => setSelectedDisputeId(null)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {workspaceLoading || !workspace ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-400">Loading Case Workspace...</span>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Customer vs Seller Reputation Intelligence Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Buyer Card */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">Claimant (Buyer)</span>
                    <h4 className="text-sm font-black text-slate-900">{workspace.initiator?.full_name}</h4>
                    <p className="text-xs text-slate-500 font-medium">{workspace.initiator?.email} • {workspace.initiator?.college || 'Campus Student'}</p>
                    <div className="mt-2 text-[11px] font-bold text-slate-600 flex items-center gap-3">
                      <span>Total Purchases: {workspace.initiator?.total_orders || 0}</span>
                      <span>Account Standing: {workspace.initiator?.status}</span>
                    </div>
                  </div>

                  {/* Seller Card */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Merchant (Seller)</span>
                      {workspace.sellerTrust && (
                        <SellerTrustBadge
                          trustScore={workspace.sellerTrust.trustScore}
                          grade={workspace.sellerTrust.grade}
                          isSuspended={workspace.sellerTrust.isSuspended}
                          breakdown={workspace.sellerTrust.breakdown}
                        />
                      )}
                    </div>
                    <h4 className="text-sm font-black text-slate-900">{workspace.respondent?.full_name}</h4>
                    <p className="text-xs text-slate-500 font-medium">{workspace.respondent?.email} • {workspace.respondent?.college || 'Seller'}</p>
                    <div className="mt-2 text-[11px] font-bold text-slate-600 flex items-center gap-3">
                      <span>Listings: {workspace.respondent?.total_listings || 0}</span>
                      <span>Rating: {workspace.respondent?.avg_rating || '4.8'} ★</span>
                    </div>
                  </div>
                </div>

                {/* Seller Explainable Risk Flags */}
                {workspace.sellerRiskFlags && workspace.sellerRiskFlags.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 text-rose-600" />
                      <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">Seller Review Signals & Risk Flags</h4>
                    </div>
                    {workspace.sellerRiskFlags.map((rf, idx) => (
                      <div key={idx} className="text-xs text-rose-800 font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span><strong>{rf.title}:</strong> {rf.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Claim Statement & Evidence Photos */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Claim Statement</h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium mb-4">
                    {workspace.dispute.description}
                  </p>

                  {workspace.evidence && workspace.evidence.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Submitted Photographs</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {workspace.evidence.map((ev) => (
                          <div key={ev.id} className="rounded-xl overflow-hidden border border-slate-200">
                            <img src={ev.file_url} alt="Evidence" className="w-full h-24 object-cover" />
                            <div className="p-1.5 text-[9px] font-bold text-slate-600 truncate bg-slate-50">{ev.caption || 'Evidence'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Administrative Resolution Controls */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-sm font-black text-white">Trust & Safety Resolution Console</h3>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateStatus} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Transition</label>
                        <select
                          value={actionStatus}
                          onChange={(e) => setActionStatus(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="UNDER_REVIEW">UNDER REVIEW</option>
                          <option value="WAITING_FOR_USER">WAITING FOR BUYER</option>
                          <option value="WAITING_FOR_SELLER">WAITING FOR SELLER</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="REJECTED">REJECTED</option>
                          <option value="ESCALATED">ESCALATED</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                        <select
                          value={actionPriority}
                          onChange={(e) => setActionPriority(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                        >
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                          <option value="URGENT">URGENT</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Formal Resolution</label>
                        <select
                          value={resolutionType}
                          onChange={(e) => setResolutionType(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 outline-none"
                        >
                          <option value="">No Resolution Yet</option>
                          <option value="REFUND_APPROVED">Approve Full / Partial Refund</option>
                          <option value="RETURN_APPROVED">Approve Return to Seller</option>
                          <option value="REJECTED">Reject Buyer Claim</option>
                          <option value="MUTUAL_RESOLUTION">Mutual Campus Resolution</option>
                        </select>
                      </div>
                    </div>

                    {resolutionType === 'REFUND_APPROVED' && (
                      <div className="bg-emerald-950/40 border border-emerald-800 p-3 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-300">Refund Amount (₹):</span>
                        <input
                          type="number"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white w-32"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Official Resolution Decision & Notes</label>
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="State findings, book condition verification result, and final decision..."
                        rows={2}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-xs font-medium text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Internal Admin Note (Hidden from Users)</label>
                      <input
                        type="text"
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                        placeholder="Notes for fellow moderators (e.g. seller contacted via phone)..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={submittingAction}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                      >
                        {submittingAction ? 'Executing...' : 'Commit Resolution & Audit'}
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDisputes;
