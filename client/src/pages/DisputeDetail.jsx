import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShieldAlert, 
  ShieldCheck, 
  ArrowLeft, 
  Send, 
  Paperclip, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  CreditCard, 
  Package, 
  User, 
  Building, 
  Loader2,
  Lock,
  ExternalLink
} from 'lucide-react';
import disputeService from '../services/disputeService';
import { useAuth } from '../context/AuthContext';
import SellerTrustBadge from '../components/disputes/SellerTrustBadge';
import DisputeTimeline from '../components/disputes/DisputeTimeline';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';
import OptimizedImage from '../components/OptimizedImage';

const DisputeDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Seller response modal / form
  const [sellerResponseText, setSellerResponseText] = useState('');
  const [acceptReturn, setAcceptReturn] = useState(false);
  const [evidenceLink, setEvidenceLink] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Evidence upload form
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');
  const [evidenceCaption, setEvidenceCaption] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  useEffect(() => {
    fetchDisputeDetails();
  }, [id]);

  const fetchDisputeDetails = async () => {
    setLoading(true);
    try {
      const { data } = await disputeService.getDisputeById(id);
      setWorkspace(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load dispute workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSendingMessage(true);
    try {
      await disputeService.addMessage(workspace.dispute.id, {
        message: newMessage.trim()
      });
      setNewMessage('');
      fetchDisputeDetails();
      toast.success('Message posted to case thread');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAddEvidence = async (e) => {
    e.preventDefault();
    if (!newEvidenceUrl.trim()) return;

    setUploadingEvidence(true);
    try {
      await disputeService.addEvidence(workspace.dispute.id, {
        fileUrl: newEvidenceUrl.trim(),
        fileType: 'image',
        caption: evidenceCaption.trim() || 'Claim verification image'
      });
      setNewEvidenceUrl('');
      setEvidenceCaption('');
      fetchDisputeDetails();
      toast.success('Evidence added to investigation file');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add evidence');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleSellerResponse = async (e) => {
    e.preventDefault();
    if (!sellerResponseText.trim()) {
      toast.error('Please enter an explanation response');
      return;
    }

    setSubmittingResponse(true);
    try {
      await disputeService.sellerRespond(workspace.dispute.id, {
        responseText: sellerResponseText.trim(),
        acceptReturn,
        evidenceUrl: evidenceLink.trim() || null
      });
      setSellerResponseText('');
      fetchDisputeDetails();
      toast.success('Response submitted successfully to the case');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-2" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Case Investigation...</p>
      </div>
    );
  }

  if (!workspace || !workspace.dispute) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h2 className="text-xl font-bold text-slate-900">Case Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">This dispute may not exist or you do not have permission to view it.</p>
        <Link to="/disputes" className="mt-4 inline-block text-xs font-bold text-primary-600">Back to Dispute Center</Link>
      </div>
    );
  }

  const { dispute, initiator, respondent, transaction, messages, evidence, sellerTrust } = workspace;
  const isInitiator = user?.id === dispute.initiator_id;
  const isRespondent = user?.id === dispute.respondent_id;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 text-left animate-in fade-in duration-300">
      
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/disputes"
            className="w-9 h-9 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                #{dispute.dispute_code}
              </span>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {dispute.status}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              {dispute.reason}
            </h1>
          </div>
        </div>

        {sellerTrust && (
          <div>
            <SellerTrustBadge
              trustScore={sellerTrust.trustScore}
              grade={sellerTrust.grade}
              isSuspended={sellerTrust.isSuspended}
              breakdown={sellerTrust.breakdown}
            />
          </div>
        )}
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Timeline, Case Discussion, Evidence */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Dispute Case Summary Box */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
              Case Description & Claim
            </h3>
            <p className="text-sm font-medium text-slate-700 leading-relaxed">
              {dispute.description}
            </p>

            {/* Return / Refund Status Cards */}
            {(dispute.return_status !== 'NONE' || dispute.refund_status !== 'NONE') && (
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dispute.return_status !== 'NONE' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-center gap-2.5">
                    <RotateCcw className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-purple-600 block">Return Protocol</span>
                      <span className="text-xs font-black text-purple-900">{dispute.return_status}</span>
                    </div>
                  </div>
                )}

                {dispute.refund_status !== 'NONE' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-600 block">Refund Escrow</span>
                      <span className="text-xs font-black text-emerald-900">{dispute.refund_status} ({formatCurrency(dispute.refund_amount)})</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seller Response Box (if user is respondent and case is open) */}
          {isRespondent && dispute.status !== 'RESOLVED' && (
            <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white">Merchant Action Center</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                As the seller, provide your explanation, tracking confirmation, or choose to accept the return.
              </p>

              <form onSubmit={handleSellerResponse} className="space-y-4">
                <textarea
                  value={sellerResponseText}
                  onChange={(e) => setSellerResponseText(e.target.value)}
                  placeholder="Explain your stance, shipping condition, or propose a solution..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-3 text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={acceptReturn}
                      onChange={(e) => setAcceptReturn(e.target.checked)}
                      className="rounded border-slate-700 text-primary-600 focus:ring-0 w-4 h-4 bg-slate-800"
                    />
                    <span>Accept Return / Authorize Buyer Return</span>
                  </label>

                  <button
                    type="submit"
                    disabled={submittingResponse}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {submittingResponse ? 'Submitting...' : 'Post Formal Response'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Evidence Gallery */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Case Evidence & Photographs ({evidence.length})
              </h3>
            </div>

            {evidence.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No photo evidence uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {evidence.map((ev) => (
                  <div key={ev.id} className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img 
                      src={ev.file_url} 
                      alt={ev.caption || 'Dispute Evidence'} 
                      className="w-full h-32 object-cover"
                      onError={(e) => { e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23f1f5f9"><rect width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="sans-serif" font-size="14">Evidence File</text></svg>'; }}
                    />
                    <div className="p-2 text-[10px] font-bold text-slate-700 truncate bg-white">
                      {ev.caption || 'Evidence'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Evidence Submission Input */}
            {dispute.status !== 'RESOLVED' && (
              <form onSubmit={handleAddEvidence} className="flex gap-2 pt-2 border-t border-slate-100">
                <input
                  type="url"
                  value={newEvidenceUrl}
                  onChange={(e) => setNewEvidenceUrl(e.target.value)}
                  placeholder="Paste image link URL (e.g. proof of damage)..."
                  className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={uploadingEvidence || !newEvidenceUrl.trim()}
                  className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                >
                  {uploadingEvidence ? 'Uploading...' : 'Add Evidence'}
                </button>
              </form>
            )}
          </div>

          {/* Chronological Case History Timeline */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
              Official Chronological Timeline & Events
            </h3>
            <DisputeTimeline dispute={dispute} messages={messages} transaction={transaction} />
          </div>

          {/* Message Thread */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
              Mediation Discussion Thread
            </h3>

            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-2">
              {messages.map((m) => {
                const isMe = m.sender_id === user?.id;
                let bgStyle = isMe ? 'bg-primary-50 border-primary-100 ml-auto' : 'bg-slate-50 border-slate-100 mr-auto';
                if (m.sender_role === 'ADMIN') {
                  bgStyle = 'bg-indigo-50 border-indigo-200 mx-auto w-full';
                }

                return (
                  <div key={m.id} className={`max-w-lg p-3.5 rounded-2xl border ${bgStyle} text-left`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-black text-slate-800">
                        {m.sender_name} {m.sender_role === 'ADMIN' ? '🛡️ (QUIRO Trust Admin)' : `(${m.sender_role})`}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 leading-relaxed">
                      {m.message}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Send Message Input */}
            {dispute.status !== 'RESOLVED' ? (
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message to the counterpart & mediator..."
                  className="flex-grow bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !newMessage.trim()}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>Send</span>
                </button>
              </form>
            ) : (
              <div className="bg-slate-50 p-3.5 rounded-2xl text-center text-xs font-bold text-slate-500">
                🔒 This dispute has been resolved and closed. Conversation is archived.
              </div>
            )}
          </div>

        </div>

        {/* Right 1 Col: Transaction & Counterpart Information */}
        <div className="space-y-6">
          
          {/* Transaction Summary Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft text-left">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
              Disputed Transaction
            </h3>

            {transaction?.order && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Order ID</span>
                  <Link to={`/orders/${transaction.order.id}`} className="text-xs font-mono font-black text-primary-600 flex items-center gap-1">
                    #{transaction.order.id} <ExternalLink size={12} />
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Total Amount</span>
                  <span className="text-xs font-black text-slate-900">{formatCurrency(transaction.order.total_price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Order Status</span>
                  <span className="text-xs font-bold uppercase text-slate-700">{transaction.order.status}</span>
                </div>

                {transaction.items && transaction.items.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Items in Order</span>
                    {transaction.items.map((it) => (
                      <div key={it.id} className="flex items-center gap-2.5 bg-slate-50 p-2 rounded-xl">
                        <div className="w-8 h-11 shrink-0 overflow-hidden rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center">
                          <OptimizedImage 
                            src={it.cover_image} 
                            alt={it.title} 
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{it.title}</p>
                          <p className="text-[10px] text-slate-500 font-medium">₹{it.price} • {it.condition || 'Used'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Involved Parties Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-soft text-left">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
              Parties Involved
            </h3>

            <div className="space-y-4">
              {/* Buyer */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-xs">
                  {initiator?.full_name?.charAt(0) || 'B'}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Buyer / Claimant</span>
                  <p className="text-xs font-bold text-slate-900">{initiator?.full_name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{initiator?.college || 'Student'}</p>
                </div>
              </div>

              {/* Seller */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-black text-xs">
                  {respondent?.full_name?.charAt(0) || 'S'}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Seller / Merchant</span>
                  <p className="text-xs font-bold text-slate-900">{respondent?.full_name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{respondent?.total_listings || 0} listings listed</p>
                </div>
              </div>
            </div>
          </div>

          {/* QUIRO Safe Transaction Guarantee Banner */}
          <div className="bg-linear-to-br from-emerald-500 to-teal-700 text-white rounded-3xl p-6 shadow-md text-left">
            <ShieldCheck className="w-8 h-8 text-emerald-200 mb-3" />
            <h4 className="text-sm font-black text-white">QUIRO Escrow Protection</h4>
            <p className="text-xs text-emerald-100 font-medium mt-1 leading-relaxed">
              Payments are protected until delivery is verified. In cases of damaged or missing items, our community moderation team verifies claims and initiates verified refunds.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};

export default DisputeDetail;
