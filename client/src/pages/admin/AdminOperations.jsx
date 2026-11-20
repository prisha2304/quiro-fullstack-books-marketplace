import React, { useState, useEffect } from 'react';
import sellerOperationsService from '../../services/sellerOperationsService';
import ShipmentStatusBadge from '../../components/seller/ShipmentStatusBadge';
import { 
  Activity, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw 
} from 'lucide-react';

const AdminOperations = () => {
  const [activeTab, setActiveTab] = useState('overview'); // overview, moderation, onboarding, sellers, sla
  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [sellersList, setSellersList] = useState([]);
  const [slaEvents, setSlaEvents] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, modRes, sellersRes, slaRes] = await Promise.all([
        sellerOperationsService.getAdminOperationsOverview(),
        sellerOperationsService.getAdminModerationQueue(),
        sellerOperationsService.getAdminSellers(),
        sellerOperationsService.getAdminSLA()
      ]);

      if (overviewRes.success) setOverviewData(overviewRes);
      if (modRes.success) setModerationQueue(modRes.queue);
      if (sellersRes.success) setSellersList(sellersRes.sellers);
      if (slaRes.success) setSlaEvents(slaRes.events);
    } catch (err) {
      console.error('Failed to load admin operations data:', err);
      setError('Error connecting to operations server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleModeration = async (bookId, decision, reason = '') => {
    setActionLoading(true);
    try {
      await sellerOperationsService.moderateListing(bookId, { decision, reason });
      setMessage(`Listing #${bookId} marked as ${decision}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOnboardingReview = async (sellerId, decision, rejectionReason = '') => {
    setActionLoading(true);
    try {
      await sellerOperationsService.reviewSellerOnboarding(sellerId, { decision, rejectionReason });
      setMessage(`Seller #${sellerId} status updated to ${decision}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !overviewData) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-1/4"></div>
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 bg-slate-800 rounded"></div>
          <div className="h-24 bg-slate-800 rounded"></div>
          <div className="h-24 bg-slate-800 rounded"></div>
          <div className="h-24 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  const metrics = overviewData?.metrics || {};

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Marketplace Operations Command Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Fulfillment surveillance, SLA monitoring, listing quality moderation, & campus seller onboarding
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Operations
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-emerald-400 font-bold">×</button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 font-bold">×</button>
        </div>
      )}

      {/* High-Level Scorecard Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400">Verified Sellers</span>
          <p className="text-xl font-bold text-emerald-400 mt-0.5">{metrics.verified_sellers || 0}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400">Pending Reviews</span>
          <p className="text-xl font-bold text-amber-400 mt-0.5">{metrics.pending_seller_reviews || 0}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400">Flagged Listings</span>
          <p className="text-xl font-bold text-rose-400 mt-0.5">{metrics.flagged_listings || 0}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400">In Fulfillment</span>
          <p className="text-xl font-bold text-cyan-400 mt-0.5">{metrics.pending_fulfillment_orders || 0}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400">SLA Breaches</span>
          <p className="text-xl font-bold text-purple-400 mt-0.5">{metrics.total_sla_breaches || 0}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-[11px] text-slate-400">Open Disputes</span>
          <p className="text-xl font-bold text-orange-400 mt-0.5">{metrics.open_disputes || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Operations Overview' },
          { id: 'moderation', label: `Listing Moderation (${moderationQueue.filter(m => m.moderation_status === 'FLAGGED' || m.is_duplicate_suspect).length})` },
          { id: 'onboarding', label: `Seller Onboarding (${overviewData?.pendingOnboardings?.length || 0})` },
          { id: 'sellers', label: 'Seller Risk Signals' },
          { id: 'sla', label: 'SLA Surveillance' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* At-Risk Fulfillment Orders */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Clock className="text-amber-400" /> At-Risk / Pending Fulfillment Orders
            </h3>
            {overviewData?.atRiskOrders?.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">All campus orders are on schedule.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {overviewData?.atRiskOrders?.slice(0, 6).map(o => (
                  <div key={o.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">Order #{o.id}</span>
                      <span className="text-slate-400 ml-2">Buyer: {o.buyer_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-400 font-semibold">₹{o.total_price}</span>
                      <ShipmentStatusBadge status={o.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Urgent Moderation Items */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Shield className="text-indigo-400" /> Pending Moderation & Duplicates
            </h3>
            {overviewData?.moderationQueue?.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No listings flagged for moderation.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {overviewData?.moderationQueue?.slice(0, 5).map(m => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-10 bg-slate-800 rounded overflow-hidden flex-shrink-0">
                        {m.cover_image && <img src={m.cover_image} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="font-semibold text-white line-clamp-1">{m.title}</p>
                        <p className="text-slate-400 text-[11px]">Seller: {m.seller_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleModeration(m.book_id, 'ACTIVE')}
                        className="px-2 py-1 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleModeration(m.book_id, 'REJECTED', 'Prohibited or low quality listing')}
                        className="px-2 py-1 bg-rose-600/80 hover:bg-rose-500 text-white rounded text-[11px] font-semibold"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LISTING MODERATION */}
      {activeTab === 'moderation' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
          <h3 className="text-base font-bold text-white mb-4">Listing Moderation Queue</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Book Listing</th>
                  <th className="p-3">Seller</th>
                  <th className="p-3">Quality Score</th>
                  <th className="p-3">Flags</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {moderationQueue.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/30">
                    <td className="p-3 flex items-center gap-2">
                      <div className="w-8 h-10 bg-slate-800 rounded overflow-hidden flex-shrink-0">
                        {item.cover_image && <img src={item.cover_image} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <span className="font-bold text-white">{item.title}</span>
                        <p className="text-[11px] text-slate-400">{item.author} • ₹{item.price}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <span>{item.seller_name}</span>
                      <p className="text-[10px] text-slate-500">{item.seller_email}</p>
                    </td>
                    <td className="p-3 font-semibold text-indigo-400">{item.quality_score || 0}%</td>
                    <td className="p-3">
                      {item.is_duplicate_suspect ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                          Duplicate Suspect
                        </span>
                      ) : (
                        <span className="text-slate-500">None</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.moderation_status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                        item.moderation_status === 'FLAGGED' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-rose-500/20 text-rose-300'
                      }`}>
                        {item.moderation_status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      <button
                        onClick={() => handleModeration(item.book_id, 'ACTIVE')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleModeration(item.book_id, 'FLAGGED', 'Needs review')}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold cursor-pointer"
                      >
                        Flag
                      </button>
                      <button
                        onClick={() => handleModeration(item.book_id, 'REJECTED', 'Listing policy violation')}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold cursor-pointer"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SELLER ONBOARDING QUEUE */}
      {activeTab === 'onboarding' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
          <h3 className="text-base font-bold text-white mb-4">Seller Verification Applications</h3>
          <div className="divide-y divide-slate-800/60">
            {overviewData?.pendingOnboardings?.map(seller => (
              <div key={seller.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{seller.seller_display_name || seller.user_name}</span>
                    <span className="text-xs text-slate-400">({seller.campus_department || 'Department unassigned'})</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{seller.seller_bio || 'No bio provided'}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Email: {seller.user_email} • Completeness: {seller.profile_completion_percentage}%</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOnboardingReview(seller.seller_id, 'VERIFIED')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Verify Seller
                  </button>
                  <button
                    onClick={() => handleOnboardingReview(seller.seller_id, 'REJECTED', 'Profile details incomplete')}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SELLER RISK SIGNALS */}
      {activeTab === 'sellers' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
          <h3 className="text-base font-bold text-white mb-4">Seller Operational Surveillance & Risk</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Seller</th>
                  <th className="p-3">Verification</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3">Cancellation Rate</th>
                  <th className="p-3">Dispute Rate</th>
                  <th className="p-3">Risk Level</th>
                  <th className="p-3">Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sellersList.map(s => {
                  const risk = s.risk || {};
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="p-3">
                        <span className="font-bold text-white">{s.full_name}</span>
                        <p className="text-[11px] text-slate-400">{s.college || 'Campus'}</p>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.seller_status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {s.seller_status || 'NOT_STARTED'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold">{s.total_orders || 0}</td>
                      <td className="p-3 font-mono">{risk.metrics?.cancellationRate || 0}%</td>
                      <td className="p-3 font-mono">{risk.metrics?.disputeRate || 0}%</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          risk.riskLevel === 'HIGH' ? 'bg-rose-500/20 text-rose-300' :
                          risk.riskLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {risk.riskLevel || 'LOW'}
                        </span>
                      </td>
                      <td className="p-3">
                        {risk.signals && risk.signals.length > 0 ? (
                          <div className="space-y-1">
                            {risk.signals.map((sig, i) => (
                              <span key={i} className="block text-[11px] text-amber-300">{sig}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">Normal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SLA EVENTS */}
      {activeTab === 'sla' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
          <h3 className="text-base font-bold text-white mb-4">SLA Breach Surveillance Log</h3>
          <div className="divide-y divide-slate-800/60">
            {slaEvents.map(evt => (
              <div key={evt.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Order #{evt.order_id}</span>
                    <span className="text-slate-400">• Seller: {evt.seller_name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Target SLA Type: {evt.sla_type}</p>
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                  evt.sla_status === 'ON_TIME' ? 'bg-emerald-500/20 text-emerald-300' :
                  evt.sla_status === 'BREACHED' ? 'bg-rose-500/20 text-rose-300' :
                  'bg-amber-500/20 text-amber-300'
                }`}>
                  {evt.sla_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOperations;
