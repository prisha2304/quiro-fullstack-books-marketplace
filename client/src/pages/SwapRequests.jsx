import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import swapService from '../services/swapService';
import ExchangeAcceptanceModal from '../components/swaps/ExchangeAcceptanceModal';
import ExchangeTrackerModal from '../components/swaps/ExchangeTrackerModal';
import { 
  ArrowRightLeft, 
  CheckCircle2, 
  X, 
  Check, 
  Clock, 
  MessageSquare, 
  Star, 
  AlertCircle,
  Truck,
  Package,
  RotateCcw,
  RefreshCw,
  Sparkles,
  Inbox,
  Send,
  Calendar,
  BookOpen,
  Filter,
  User,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle,
  Bookmark
} from 'lucide-react';
import toast from 'react-hot-toast';
import OptimizedImage from '../components/OptimizedImage';

const SwapRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: urlSwapId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { socket } = useSocket() || {};

  // Post-Acceptance & Tracker Modal States
  const [activeAcceptanceSwap, setActiveAcceptanceSwap] = useState(null);
  const [activeTrackerSwapId, setActiveTrackerSwapId] = useState(urlSwapId || searchParams.get('swap') || null);

  // Sync route URL or query param to tracker modal
  useEffect(() => {
    if (urlSwapId) {
      setActiveTrackerSwapId(urlSwapId);
    } else if (searchParams.get('swap')) {
      setActiveTrackerSwapId(searchParams.get('swap'));
    }
  }, [urlSwapId, searchParams]);

  // Active tab: 'discover' (default), 'incoming', 'outgoing', 'my_listings', 'completed'
  const initialTab = searchParams.get('tab') || (searchParams.get('requested') ? 'discover' : 'discover');
  const [activeTab, setActiveTab] = useState(initialTab);

  // Data states
  const [discoverBooks, setDiscoverBooks] = useState([]);
  const [discoverPagination, setDiscoverPagination] = useState({});
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [mySwapListings, setMySwapListings] = useState([]);
  const [completedSwaps, setCompletedSwaps] = useState([]);
  
  // Filter states for Discover
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null);

  // Propose Swap Modal state
  const [targetBook, setTargetBook] = useState(null);
  const [myBooks, setMyBooks] = useState([]);
  const [selectedOfferedBookId, setSelectedOfferedBookId] = useState('');
  const [swapMessage, setSwapMessage] = useState('');
  const [submittingSwap, setSubmittingSwap] = useState(false);
  const [loadingMyBooks, setLoadingMyBooks] = useState(false);

  // Update tab in URL when changed
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', newTab);
    setSearchParams(params, { replace: true });
  };

  // 1. Fetch Discoverable Swap Books
  const fetchDiscoverBooks = useCallback(async () => {
    try {
      const res = await swapService.getDiscoverSwapBooks({
        genre: selectedGenre || undefined,
        condition: selectedCondition !== 'All' ? selectedCondition : undefined,
        search: searchKeyword.trim() || undefined,
        limit: 24
      });
      setDiscoverBooks(res.data?.books || []);
      setDiscoverPagination(res.data?.pagination || {});
    } catch (err) {
      console.error('Failed to load discoverable swap books:', err);
    }
  }, [selectedGenre, selectedCondition, searchKeyword]);

  // 2. Fetch User Requests & Listings
  const fetchUserRequests = useCallback(async () => {
    if (!user) return;
    try {
      const [inRes, outRes, listRes, compRes] = await Promise.all([
        swapService.getIncomingRequests(),
        swapService.getOutgoingRequests(),
        swapService.getMySwapListings(),
        swapService.getCompletedSwaps()
      ]);
      setIncoming(Array.isArray(inRes.data) ? inRes.data : []);
      setOutgoing(Array.isArray(outRes.data) ? outRes.data : []);
      setMySwapListings(Array.isArray(listRes.data) ? listRes.data : []);
      setCompletedSwaps(Array.isArray(compRes.data) ? compRes.data : []);
    } catch (err) {
      console.error('Failed to load user swap requests and listings:', err);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDiscoverBooks(), fetchUserRequests()]);
      setLoading(false);
    };
    loadData();
  }, [fetchDiscoverBooks, fetchUserRequests]);

  // Real-time Socket.IO Listeners
  useEffect(() => {
    if (!socket) return;
    const onSwapUpdate = () => {
      fetchUserRequests();
      fetchDiscoverBooks();
    };

    socket.on('NEW_SWAP_REQUEST', onSwapUpdate);
    socket.on('SWAP_ACCEPTED', onSwapUpdate);
    socket.on('SWAP_REJECTED', onSwapUpdate);
    socket.on('SWAP_CANCELLED', onSwapUpdate);
    socket.on('SWAP_COMPLETED', onSwapUpdate);
    socket.on('SWAP_CONFIRMED', onSwapUpdate);

    return () => {
      socket.off('NEW_SWAP_REQUEST', onSwapUpdate);
      socket.off('SWAP_ACCEPTED', onSwapUpdate);
      socket.off('SWAP_REJECTED', onSwapUpdate);
      socket.off('SWAP_CANCELLED', onSwapUpdate);
      socket.off('SWAP_COMPLETED', onSwapUpdate);
      socket.off('SWAP_CONFIRMED', onSwapUpdate);
    };
  }, [socket, fetchUserRequests, fetchDiscoverBooks]);

  // Resilient Polling Fallback (every 15s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        fetchUserRequests();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user, fetchUserRequests]);

  // Handle URL query for auto-opening modal (e.g. ?requested=468)
  useEffect(() => {
    const requestedId = searchParams.get('requested');
    if (requestedId && discoverBooks.length > 0) {
      const match = discoverBooks.find(b => String(b.id) === String(requestedId));
      if (match) {
        openSwapModal(match);
      }
    }
  }, [searchParams, discoverBooks]);

  // Open Propose Swap Modal
  const openSwapModal = async (book) => {
    if (!user) {
      toast.error('Please sign in to propose a book exchange');
      navigate('/login');
      return;
    }

    if (book.seller_id === user.id) {
      toast.error('You cannot propose a swap for your own book listing');
      return;
    }

    setTargetBook(book);
    setLoadingMyBooks(true);
    try {
      const res = await swapService.getMyEligibleBooks();
      const eligible = Array.isArray(res.data) ? res.data : [];
      setMyBooks(eligible);
      if (eligible.length > 0) {
        setSelectedOfferedBookId(eligible[0].id);
      }
    } catch (err) {
      toast.error('Failed to load your book inventory');
    } finally {
      setLoadingMyBooks(false);
    }
  };

  const closeSwapModal = () => {
    setTargetBook(null);
    setSelectedOfferedBookId('');
    setSwapMessage('');
    if (searchParams.get('requested')) {
      const params = new URLSearchParams(searchParams);
      params.delete('requested');
      setSearchParams(params, { replace: true });
    }
  };

  // Submit Swap Proposal
  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    if (!selectedOfferedBookId) {
      toast.error('Please select one of your books to offer in exchange');
      return;
    }

    setSubmittingSwap(true);
    try {
      await swapService.requestSwap({
        requested_book_id: targetBook.id,
        offered_book_id: selectedOfferedBookId,
        message: swapMessage.trim() || undefined
      });
      toast.success('Exchange proposal sent to the reader!');
      closeSwapModal();
      await fetchUserRequests();
      handleTabChange('outgoing');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit exchange proposal');
    } finally {
      setSubmittingSwap(false);
    }
  };

  // Respond to incoming request (Accept / Decline)
  const handleAction = async (id, status) => {
    setActionInProgress(id);
    try {
      const match = incoming.find(r => r.id === id);
      await swapService.respondSwap(id, status);
      toast.success(`Exchange proposal ${status === 'accepted' ? 'accepted' : 'declined'}`);
      await Promise.all([fetchUserRequests(), fetchDiscoverBooks()]);

      // If accepted, immediately show Acceptance Modal with Option A / Option B
      if (status === 'accepted') {
        setActiveAcceptanceSwap(match || { id });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update swap proposal');
    } finally {
      setActionInProgress(null);
    }
  };

  // Select Method from Acceptance Modal
  const handleSelectExchangeMethodFromModal = async (method) => {
    if (!activeAcceptanceSwap) return;
    const targetId = activeAcceptanceSwap.id;
    setActionInProgress(targetId);
    try {
      await swapService.selectExchangeMethod(targetId, method);
      setActiveAcceptanceSwap(null);
      setActiveTrackerSwapId(targetId);
      toast.success(`Exchange method recorded: ${method === 'SELF_ARRANGED' ? 'Direct Exchange' : 'QUIRO Managed Courier'}`);
      await Promise.all([fetchUserRequests(), fetchDiscoverBooks()]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save exchange method');
    } finally {
      setActionInProgress(null);
    }
  };

  // Cancel outgoing request
  const handleCancelOutgoing = async (id) => {
    setActionInProgress(id);
    try {
      await swapService.cancelSwap(id);
      toast.success('Exchange proposal cancelled');
      await Promise.all([fetchUserRequests(), fetchDiscoverBooks()]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel swap proposal');
    } finally {
      setActionInProgress(null);
    }
  };

  // Two-party Confirmation Workflow
  const handleConfirmCompletion = async (id) => {
    setActionInProgress(id);
    try {
      const res = await swapService.confirmCompletion(id);
      if (res.data?.completed) {
        toast.success(res.data.message || 'Book exchange completed! Both readers confirmed receipt.');
      } else {
        toast.success(res.data?.message || 'Your confirmation has been recorded! Waiting for the counterparty to confirm receipt.');
      }
      await Promise.all([fetchUserRequests(), fetchDiscoverBooks()]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record swap confirmation');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="bg-[#FAF9F6] min-h-screen pt-24 pb-24 text-left animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Marketplace Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8 pb-6 border-b border-[#DCE2E8]">
          <div className="max-w-xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#E5A323] block mb-1">
              Community Book Barter
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#35152F] tracking-tight">
              Book Exchange Marketplace
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 font-medium mt-1 leading-relaxed">
              "Your Next Chapter Could Be Someone's First." Trade books directly with fellow readers across India without cash transactions. Propose an exchange from your library and discover stories waiting for their next reader.
            </p>
          </div>

          {/* 5-Section Navigation Tabs */}
          <div className="flex flex-wrap bg-white p-1 rounded-2xl border border-[#DCE2E8] shadow-2xs gap-1">
            <button
              onClick={() => handleTabChange('discover')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'discover' 
                  ? 'bg-[#35152F] text-white shadow-2xs' 
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <BookOpen size={14} />
              <span>Discover Swap Books</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'discover' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
                {discoverBooks.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (!user) {
                  toast.error('Please sign in to view incoming requests');
                  navigate('/login');
                  return;
                }
                handleTabChange('incoming');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'incoming' 
                  ? 'bg-[#35152F] text-white shadow-2xs' 
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <Inbox size={14} />
              <span>Incoming</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'incoming' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
                {incoming.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (!user) {
                  toast.error('Please sign in to view outgoing requests');
                  navigate('/login');
                  return;
                }
                handleTabChange('outgoing');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'outgoing' 
                  ? 'bg-[#35152F] text-white shadow-2xs' 
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <Send size={14} />
              <span>Outgoing</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'outgoing' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
                {outgoing.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (!user) {
                  toast.error('Please sign in to view your swap listings');
                  navigate('/login');
                  return;
                }
                handleTabChange('my_listings');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'my_listings' 
                  ? 'bg-[#35152F] text-white shadow-2xs' 
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <Bookmark size={14} />
              <span>My Swap Listings</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'my_listings' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
                {mySwapListings.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (!user) {
                  toast.error('Please sign in to view completed swaps');
                  navigate('/login');
                  return;
                }
                handleTabChange('completed');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'completed' 
                  ? 'bg-[#35152F] text-white shadow-2xs' 
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              <CheckCircle size={14} />
              <span>Completed Swaps</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'}`}>
                {completedSwaps.length}
              </span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: DISCOVER SWAP BOOKS                                     */}
        {/* ============================================================== */}
        {activeTab === 'discover' && (
          <div className="space-y-6">
            
            {/* Search and Filters Bar */}
            <div className="bg-white border border-[#DCE2E8] rounded-2xl p-4 shadow-soft space-y-3">
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                
                {/* Search input */}
                <div className="relative w-full md:w-80">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Search by title, author, keyword..."
                    className="w-full pl-9 pr-3 py-2 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-[#35152F] transition-all"
                  />
                  {searchKeyword && (
                    <button onClick={() => setSearchKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Condition Filter */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0">Condition:</span>
                  <select
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                    className="p-2 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#35152F]"
                  >
                    <option value="All">All Conditions</option>
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>
              </div>

              {/* Genre Quick Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#DCE2E8]/60 no-scrollbar">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest shrink-0 mr-1 flex items-center gap-1">
                  <Filter size={11} /> Genre:
                </span>
                {['All', 'Fiction', 'Romance', 'Mystery', 'Biography', 'Self Help', 'Academic and Textbooks', 'Computer Science'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setSelectedGenre(g === 'All' ? '' : g)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer ${
                      (selectedGenre === '' && g === 'All') || selectedGenre === g
                        ? 'bg-[#35152F] text-white border-[#35152F] shadow-2xs'
                        : 'bg-[#FAF9F6] border-[#DCE2E8] text-stone-700 hover:border-primary-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="h-64 bg-white border border-[#DCE2E8] rounded-xl animate-pulse p-3" />
                ))}
              </div>
            ) : discoverBooks.length === 0 ? (
              <div className="bg-white border border-[#DCE2E8] rounded-2xl p-16 text-center space-y-4 shadow-soft">
                <ArrowRightLeft className="w-12 h-12 text-stone-300 mx-auto" />
                <h3 className="font-serif text-xl font-bold text-slate-900">No Swap Books Matching Filter</h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  {searchKeyword || selectedGenre || selectedCondition !== 'All' 
                    ? 'No swap listings match your search criteria. Try resetting filters or browsing all genres.' 
                    : 'Be the first reader to list an eligible swap book and invite exchanges from our community.'}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  {(searchKeyword || selectedGenre || selectedCondition !== 'All') && (
                    <button
                      onClick={() => { setSearchKeyword(''); setSelectedGenre(''); setSelectedCondition('All'); }}
                      className="bg-[#DCE2E8] text-stone-800 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-stone-300 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                  <Link to="/sell" className="inline-flex items-center gap-2 bg-[#35152F] hover:bg-[#2A1025] text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs">
                    <Plus size={14} /> List a Book for Swap
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {discoverBooks.map((book) => (
                  <div 
                    key={book.id} 
                    className="group bg-white border border-[#DCE2E8] rounded-xl overflow-hidden flex flex-col justify-between hover:shadow-hover hover:-translate-y-1 transition-all duration-200 text-left"
                  >
                    {/* Visual Cover */}
                    <div className="relative aspect-[2/3] w-full bg-[#FAF9F6] p-2 flex items-center justify-center overflow-hidden border-b border-[#DCE2E8]/60">
                      <Link to={`/book/${book.id}`} className="w-full h-full flex items-center justify-center">
                        <OptimizedImage 
                          src={book.cover_image} 
                          alt={book.title} 
                          className="max-h-full max-w-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      </Link>
                      <span className="absolute top-2 left-2 bg-[#35152F]/90 backdrop-blur-xs text-[#FAF9F6] text-[8px] font-bold px-1.5 py-0.5 rounded shadow-2xs">
                        {book.condition || 'Good'}
                      </span>
                      <span className="absolute top-2 right-2 bg-emerald-600/90 backdrop-blur-xs text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-2xs">
                        Swap Eligible
                      </span>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3 flex flex-col flex-grow justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#E5A323] block truncate mb-0.5">
                          {book.genre || 'Literature'}
                        </span>
                        <Link 
                          to={`/book/${book.id}`}
                          className="font-serif text-xs font-bold text-slate-900 line-clamp-2 hover:text-[#35152F] transition-colors leading-snug mb-1 h-8 block"
                          title={book.title}
                        >
                          {book.title}
                        </Link>
                        <p className="text-[10px] text-stone-500 font-medium truncate mb-1">
                          by <span className="text-stone-700 font-semibold">{book.author}</span>
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-stone-500 font-medium truncate">
                          <User size={10} className="text-stone-400" />
                          <span>Owner:</span>
                          <Link 
                            to={`/seller/${book.seller_id}`} 
                            className="font-semibold text-[#35152F] hover:underline truncate"
                          >
                            {book.seller_name || 'Reader'}
                          </Link>
                        </div>
                        {book.preferred_book && (
                          <div className="mt-1.5 p-1.5 rounded bg-[#FAF9F6] border border-[#DCE2E8] text-[9px] text-stone-600 line-clamp-1">
                            <span className="font-bold text-[#35152F]">Wants:</span> {book.preferred_book}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => openSwapModal(book)}
                        className="w-full mt-2 py-2 bg-[#35152F] hover:bg-[#2A1025] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <ArrowRightLeft size={13} />
                        <span>Request Swap</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: INCOMING REQUESTS                                       */}
        {/* ============================================================== */}
        {activeTab === 'incoming' && (
          <div>
            {incoming.length === 0 ? (
              <div className="bg-white border border-[#DCE2E8] rounded-2xl p-16 text-center space-y-3 shadow-soft">
                <Inbox className="w-12 h-12 text-stone-300 mx-auto" />
                <h3 className="font-serif text-xl font-bold text-slate-900">No Incoming Exchange Requests</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                  When other readers propose an exchange for your swap-eligible books, they will appear here with offered book details for your review.
                </p>
                <div className="pt-2">
                  <Link to="/sell" className="inline-flex items-center gap-2 bg-[#35152F] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs">
                    <Plus size={14} /> Make More Books Swap-Eligible
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {incoming.map((req) => (
                  <div key={req.id} className="bg-white border border-[#DCE2E8] rounded-2xl p-5 sm:p-6 shadow-soft flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center min-w-0">
                      
                      {/* Books Exchange Graphic */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Requested Book (Mine) */}
                        <div className="w-16 aspect-[2/3] bg-stone-100 rounded-lg overflow-hidden border border-[#DCE2E8] shadow-2xs relative">
                          <OptimizedImage src={req.requested_image} alt={req.requested_title} className="w-full h-full object-contain p-1" />
                        </div>
                        
                        <div className="w-7 h-7 rounded-full bg-stone-100 border border-[#DCE2E8] text-[#35152F] flex items-center justify-center shrink-0">
                          <ArrowRightLeft size={13} />
                        </div>

                        {/* Offered Book (Theirs) */}
                        <div className="w-16 aspect-[2/3] bg-stone-100 rounded-lg overflow-hidden border border-[#DCE2E8] shadow-2xs relative">
                          <OptimizedImage src={req.offered_image} alt={req.offered_title} className="w-full h-full object-contain p-1" />
                        </div>
                      </div>

                      {/* Request Details */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            req.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            req.status === 'completed' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            req.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            req.status === 'cancelled' ? 'bg-stone-100 text-stone-600' :
                            'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {req.status}
                          </span>
                          <span className="text-xs text-stone-400 font-medium">
                            {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate">
                          Offered: &ldquo;<span className="text-[#35152F]">{req.offered_title}</span>&rdquo; {req.offered_author && `by ${req.offered_author}`} ({req.offered_condition || 'Good'})
                        </p>
                        <p className="text-xs text-stone-600 truncate">
                          In exchange for your listing: <strong>{req.requested_title}</strong>
                        </p>
                        <p className="text-xs text-stone-500">
                          From reader: <Link to={`/seller/${req.requester_id}`} className="font-semibold text-[#35152F] hover:underline">{req.requester_name}</Link>
                        </p>
                        {req.message && (
                          <p className="text-xs text-stone-600 bg-[#FAF9F6] p-2 rounded-lg border border-[#DCE2E8] italic mt-1.5">
                            &ldquo;{req.message}&rdquo;
                          </p>
                        )}

                        {/* Partner confirmation status helper */}
                        {req.status === 'accepted' && req.requester_confirmed === 1 && req.owner_confirmed !== 1 && (
                          <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            <span>{req.requester_name} has confirmed book receipt! Please confirm once you receive yours to complete the trade.</span>
                          </div>
                        )}
                        {req.status === 'accepted' && req.owner_confirmed === 1 && (
                          <div className="mt-2 p-2 rounded-lg bg-stone-100 border border-stone-200 text-xs text-stone-600 font-medium flex items-center gap-1.5">
                            <Clock size={14} className="text-stone-500 shrink-0" />
                            <span>You have confirmed receipt. Waiting for {req.requester_name} to confirm their copy.</span>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
                      {req.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleAction(req.id, 'accepted')}
                            disabled={actionInProgress === req.id}
                            className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Check size={14} /> Accept Exchange
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'rejected')}
                            disabled={actionInProgress === req.id}
                            className="flex-1 md:flex-initial bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <X size={14} /> Decline
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setActiveTrackerSwapId(req.id)}
                            className="bg-[#35152F] hover:bg-[#4A1D41] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <ArrowRightLeft size={13} className="text-[#E5A323]" />
                            <span>Track & Manage Exchange</span>
                          </button>

                          {req.owner_confirmed === 1 ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                              <CheckCircle2 size={14} /> Confirmed by You
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConfirmCompletion(req.id)}
                              disabled={actionInProgress === req.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle size={14} />
                              <span>Confirm Received</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: OUTGOING REQUESTS                                       */}
        {/* ============================================================== */}
        {activeTab === 'outgoing' && (
          <div>
            {outgoing.length === 0 ? (
              <div className="bg-white border border-[#DCE2E8] rounded-2xl p-16 text-center space-y-3 shadow-soft">
                <Send className="w-12 h-12 text-stone-300 mx-auto" />
                <h3 className="font-serif text-xl font-bold text-slate-900">No Outgoing Exchange Proposals</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                  You haven&rsquo;t proposed any book exchanges yet. Explore the Discover Swap Books tab to find titles you&rsquo;d like to trade for.
                </p>
                <div className="pt-2">
                  <button onClick={() => handleTabChange('discover')} className="bg-[#35152F] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs cursor-pointer">
                    Browse Discoverable Swap Books
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {outgoing.map((req) => (
                  <div key={req.id} className="bg-white border border-[#DCE2E8] rounded-2xl p-5 sm:p-6 shadow-soft flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center min-w-0">
                      
                      {/* Books Exchange Graphic */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Requested Book */}
                        <div className="w-16 aspect-[2/3] bg-stone-100 rounded-lg overflow-hidden border border-[#DCE2E8] shadow-2xs relative">
                          <OptimizedImage src={req.requested_image} alt={req.requested_title} className="w-full h-full object-contain p-1" />
                        </div>
                        
                        <div className="w-7 h-7 rounded-full bg-stone-100 border border-[#DCE2E8] text-[#35152F] flex items-center justify-center shrink-0">
                          <ArrowRightLeft size={13} />
                        </div>

                        {/* Offered Book */}
                        <div className="w-16 aspect-[2/3] bg-stone-100 rounded-lg overflow-hidden border border-[#DCE2E8] shadow-2xs relative">
                          <OptimizedImage src={req.offered_image} alt={req.offered_title} className="w-full h-full object-contain p-1" />
                        </div>
                      </div>

                      {/* Request Details */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            req.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            req.status === 'completed' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            req.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            req.status === 'cancelled' ? 'bg-stone-100 text-stone-600' :
                            'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {req.status}
                          </span>
                          <span className="text-xs text-stone-400 font-medium">
                            {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate">
                          Requested: &ldquo;<span className="text-[#35152F]">{req.requested_title}</span>&rdquo;
                        </p>
                        <p className="text-xs text-stone-600 truncate">
                          You offered: <strong>{req.offered_title}</strong> ({req.offered_condition || 'Good'})
                        </p>
                        <p className="text-xs text-stone-500">
                          Book owner: <Link to={`/seller/${req.owner_id}`} className="font-semibold text-[#35152F] hover:underline">{req.owner_name}</Link>
                        </p>
                        {req.message && (
                          <p className="text-xs text-stone-600 bg-[#FAF9F6] p-2 rounded-lg border border-[#DCE2E8] italic mt-1.5">
                            Your message: &ldquo;{req.message}&rdquo;
                          </p>
                        )}

                        {/* Partner confirmation status helper */}
                        {req.status === 'accepted' && req.owner_confirmed === 1 && req.requester_confirmed !== 1 && (
                          <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            <span>{req.owner_name} has confirmed receiving your book! Please confirm once you receive yours to complete the trade.</span>
                          </div>
                        )}
                        {req.status === 'accepted' && req.requester_confirmed === 1 && (
                          <div className="mt-2 p-2 rounded-lg bg-stone-100 border border-stone-200 text-xs text-stone-600 font-medium flex items-center gap-1.5">
                            <Clock size={14} className="text-stone-500 shrink-0" />
                            <span>You have confirmed receipt. Waiting for {req.owner_name} to confirm their copy.</span>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
                      {req.status === 'pending' ? (
                        <button
                          onClick={() => handleCancelOutgoing(req.id)}
                          disabled={actionInProgress === req.id}
                          className="bg-white hover:bg-stone-50 text-stone-600 border border-[#DCE2E8] px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
                        >
                          Cancel Proposal
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setActiveTrackerSwapId(req.id)}
                            className="bg-[#35152F] hover:bg-[#4A1D41] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <ArrowRightLeft size={13} className="text-[#E5A323]" />
                            <span>Track & Manage Exchange</span>
                          </button>

                          {req.requester_confirmed === 1 ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                              <CheckCircle2 size={14} /> Confirmed by You
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConfirmCompletion(req.id)}
                              disabled={actionInProgress === req.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle size={14} />
                              <span>Confirm Received</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: MY SWAP LISTINGS                                        */}
        {/* ============================================================== */}
        {activeTab === 'my_listings' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-[#DCE2E8] shadow-soft">
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900">Your Books Available for Exchange</h3>
                <p className="text-xs text-stone-500 font-medium">Other readers can discover these titles and propose book exchanges with you.</p>
              </div>
              <Link to="/sell" className="inline-flex items-center gap-2 bg-[#35152F] hover:bg-[#2A1025] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs">
                <Plus size={14} /> List Another Book for Swap
              </Link>
            </div>

            {mySwapListings.length === 0 ? (
              <div className="bg-white border border-[#DCE2E8] rounded-2xl p-16 text-center space-y-3 shadow-soft">
                <Bookmark className="w-12 h-12 text-stone-300 mx-auto" />
                <h3 className="font-serif text-xl font-bold text-slate-900">No Swap Listings on Your Shelf</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                  You haven&rsquo;t enabled book swapping for any of your catalog books yet. Enable swap on your existing listings or post a new book.
                </p>
                <div className="pt-2">
                  <Link to="/sell" className="inline-flex items-center gap-2 bg-[#35152F] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs">
                    <Plus size={14} /> Add Book for Swap
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {mySwapListings.map((book) => (
                  <div key={book.id} className="bg-white border border-[#DCE2E8] rounded-2xl p-4 shadow-soft flex gap-3.5 items-start">
                    <div className="w-14 aspect-[2/3] bg-[#FAF9F6] border border-[#DCE2E8] rounded-lg overflow-hidden shrink-0">
                      <OptimizedImage src={book.cover_image} alt={book.title} className="w-full h-full object-contain p-1" />
                    </div>
                    <div className="min-w-0 flex-grow space-y-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        book.status === 'available' ? 'bg-emerald-50 text-emerald-700' :
                        book.status === 'reserved' ? 'bg-amber-50 text-amber-800' :
                        'bg-stone-100 text-stone-600'
                      }`}>
                        {book.status}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">{book.title}</h4>
                      <p className="text-[10px] text-stone-500 font-medium truncate">by {book.author}</p>
                      <p className="text-[10px] text-stone-600 font-semibold">₹{book.price} &middot; {book.condition || 'Good'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: COMPLETED SWAPS                                         */}
        {/* ============================================================== */}
        {activeTab === 'completed' && (
          <div>
            {completedSwaps.length === 0 ? (
              <div className="bg-white border border-[#DCE2E8] rounded-2xl p-16 text-center space-y-3 shadow-soft">
                <CheckCircle className="w-12 h-12 text-stone-300 mx-auto" />
                <h3 className="font-serif text-xl font-bold text-slate-900">No Completed Swaps Yet</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                  When you and your trading partner both confirm book receipt, your completed exchanges will appear here as part of your barter journey.
                </p>
                <div className="pt-2">
                  <button onClick={() => handleTabChange('discover')} className="bg-[#35152F] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs cursor-pointer">
                    Discover Books to Exchange
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {completedSwaps.map((req) => (
                  <div key={req.id} className="bg-white border border-emerald-200/80 rounded-2xl p-5 sm:p-6 shadow-soft flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center min-w-0">
                      
                      {/* Books Exchange Graphic */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-16 aspect-[2/3] bg-stone-100 rounded-lg overflow-hidden border border-[#DCE2E8] shadow-2xs relative">
                          <OptimizedImage src={req.requested_image} alt={req.requested_title} className="w-full h-full object-contain p-1" />
                        </div>
                        
                        <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                          <ArrowRightLeft size={13} />
                        </div>

                        <div className="w-16 aspect-[2/3] bg-stone-100 rounded-lg overflow-hidden border border-[#DCE2E8] shadow-2xs relative">
                          <OptimizedImage src={req.offered_image} alt={req.offered_title} className="w-full h-full object-contain p-1" />
                        </div>
                      </div>

                      {/* Request Details */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Completed Exchange
                          </span>
                          <span className="text-xs text-stone-400 font-medium">
                            {new Date(req.updated_at || req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900">
                          Trade between &ldquo;<span className="text-[#35152F]">{req.requested_title}</span>&rdquo; and &ldquo;<span className="text-[#35152F]">{req.offered_title}</span>&rdquo;
                        </p>
                        <p className="text-xs text-stone-600">
                          Readers: <strong>{req.requester_name}</strong> &amp; <strong>{req.owner_name}</strong>
                        </p>
                      </div>

                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setActiveTrackerSwapId(req.id)}
                        className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        <ArrowRightLeft size={13} />
                        <span>View Details</span>
                      </button>
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                        <CheckCircle2 size={15} />
                        <span>Completed</span>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ============================================================== */}
      {/* PROPOSE SWAP MODAL WORKFLOW                                    */}
      {/* ============================================================== */}
      {targetBook && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#DCE2E8] shadow-2xl relative text-left space-y-6 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-stone-100 text-[#35152F] flex items-center justify-center">
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 leading-tight">Propose Book Exchange</h3>
                  <p className="text-[11px] text-stone-500">Offer one of your available books in exchange</p>
                </div>
              </div>
              <button onClick={closeSwapModal} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Target Book Card Summary */}
            <div className="p-3.5 bg-[#FAF9F6] border border-[#DCE2E8] rounded-2xl flex items-center gap-3.5">
              <div className="w-12 aspect-[2/3] bg-white rounded overflow-hidden border border-[#DCE2E8] shrink-0">
                <OptimizedImage src={targetBook.cover_image} alt={targetBook.title} className="w-full h-full object-contain p-0.5" />
              </div>
              <div className="min-w-0 flex-grow">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#E5A323] block truncate">
                  You are requesting
                </span>
                <p className="text-xs font-bold text-slate-900 truncate">{targetBook.title}</p>
                <p className="text-[10px] text-stone-500 truncate">by {targetBook.author} &middot; Condition: <strong>{targetBook.condition}</strong></p>
                <p className="text-[10px] text-stone-600">Owner: <strong>{targetBook.seller_name || 'Reader'}</strong></p>
              </div>
            </div>

            {/* Select User's Own Book Form */}
            <form onSubmit={handleSubmitProposal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Select a book from your library to offer:
                </label>
                
                {loadingMyBooks ? (
                  <div className="h-12 bg-stone-100 rounded-xl animate-pulse" />
                ) : myBooks.length === 0 ? (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-center space-y-2">
                    <p className="text-xs font-semibold text-amber-900">You don&rsquo;t have any available books in your inventory.</p>
                    <p className="text-[11px] text-amber-700">List a book for sale/swap first to propose trades.</p>
                    <Link to="/sell" onClick={closeSwapModal} className="inline-block bg-[#35152F] text-white text-xs font-bold px-4 py-1.5 rounded-lg">
                      Add a Book Listing
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedOfferedBookId}
                    onChange={(e) => setSelectedOfferedBookId(e.target.value)}
                    required
                    className="w-full p-3 bg-white border border-[#DCE2E8] rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-[#35152F]"
                  >
                    {myBooks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} by {b.author} ({b.condition || 'Good'}, ₹{b.price})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Personal message to the owner (optional):
                </label>
                <textarea
                  value={swapMessage}
                  onChange={(e) => setSwapMessage(e.target.value)}
                  placeholder="e.g. Hello! I loved this copy and would be thrilled to exchange it for your book. Both bindings are intact."
                  rows={3}
                  className="w-full p-3 bg-white border border-[#DCE2E8] rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#35152F] resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={closeSwapModal}
                  className="px-4 py-2.5 rounded-xl border border-[#DCE2E8] text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSwap || myBooks.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-[#35152F] hover:bg-[#2A1025] text-white text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {submittingSwap ? 'Submitting...' : 'Send Exchange Proposal'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* POST-ACCEPTANCE SUCCESS MODAL: OPTION A vs OPTION B            */}
      {/* ============================================================== */}
      {activeAcceptanceSwap && (
        <ExchangeAcceptanceModal
          swap={activeAcceptanceSwap}
          onClose={() => setActiveAcceptanceSwap(null)}
          onSelectMethod={handleSelectExchangeMethodFromModal}
          loading={actionInProgress === activeAcceptanceSwap?.id}
        />
      )}

      {/* ============================================================== */}
      {/* DEDICATED EXCHANGE TRACKER & FULFILLMENT MODAL                 */}
      {/* ============================================================== */}
      {activeTrackerSwapId && (
        <ExchangeTrackerModal
          swapId={activeTrackerSwapId}
          onClose={() => {
            setActiveTrackerSwapId(null);
            if (urlSwapId) {
              navigate('/swaps?tab=incoming', { replace: true });
            } else if (searchParams.get('swap')) {
              const p = new URLSearchParams(searchParams);
              p.delete('swap');
              setSearchParams(p, { replace: true });
            }
          }}
          onRefreshList={() => {
            fetchUserRequests();
            fetchDiscoverBooks();
          }}
        />
      )}

    </div>
  );
};

export default SwapRequests;
