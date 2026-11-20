import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Trash2, 
  X, 
  BookOpen, 
  Star, 
  ExternalLink, 
  Bot, 
  User, 
  Lightbulb,
  ArrowRight,
  ShoppingBag,
  Heart,
  CheckCircle2,
  SlidersHorizontal,
  Compass,
  Trophy,
  History,
  LogIn,
  PackageCheck,
  PiggyBank,
  Award,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  AlertCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import AIComparisonCard from './AIComparisonCard';
import AIBuyingVerdict from './AIBuyingVerdict';
import AISmartActionCard from './AISmartActionCard';
import AICartAnalysisCard from './AICartAnalysisCard';
import AIBundleCard from './AIBundleCard';
import AIBudgetPlanner from './AIBudgetPlanner';
import AIValueScore from './AIValueScore';
import AIDiscoveryModes from './AIDiscoveryModes';
import AIBookImageSearch from './AIBookImageSearch';
import AIBookMatchResults from './AIBookMatchResults';
import api from '../../services/api';
import toast from 'react-hot-toast';

const GENERAL_SUGGESTED_PROMPTS = [
  'Recommend books for me',
  'Build a DSA bundle under ₹1500',
  'I have ₹1000 for programming books',
  'Find Like New Java books under ₹500',
  'Can you optimize my cart?'
];

const BOOK_CONTEXT_PROMPTS = [
  'Is this worth buying?',
  'Is there a newer edition?',
  'Is the seller trustworthy?',
  'Add to cart',
  'Save for later',
  'Find a cheaper alternative'
];

const AIChatWindow = ({
  isOpen,
  onClose,
  messages = [],
  onSendMessage,
  onClearHistory,
  loading = false,
  activeBookContext = null
}) => {
  const [inputText, setInputText] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);
  
  // Voice State: 'IDLE' | 'LISTENING' | 'PROCESSING' | 'ERROR'
  const [voiceState, setVoiceState] = useState('IDLE');
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('booknest_ai_voice_enabled') === 'true';
  });
  const [speakingId, setSpeakingId] = useState(null);
  const [proactiveTip, setProactiveTip] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const { addToCart, addToWishlist } = useMarketplace() || {};
  const { user } = useAuth() || {};
  const navigate = useNavigate();

  const visibleMessages = messages.slice(-30);

  useEffect(() => {
    if (isOpen) {
      api.get('/ai/proactive-tip')
        .then(res => {
          if (res.data?.tip) setProactiveTip(res.data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Initialize Web Speech Recognition if available
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setVoiceState('LISTENING');
      };

      recognition.onresult = (event) => {
        setVoiceState('PROCESSING');
        let transcript = event.results[0][0].transcript || '';
        
        // Normalize common verbal expressions
        transcript = transcript
          .replace(/five hundred rupees/gi, '₹500')
          .replace(/three hundred rupees/gi, '₹300')
          .replace(/one thousand rupees/gi, '₹1000')
          .replace(/rupees (\d+)/gi, '₹$1')
          .replace(/(\d+) rupees/gi, '₹$1');

        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setVoiceState('IDLE');
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition notice:', event.error);
        setVoiceState('ERROR');
        setTimeout(() => setVoiceState('IDLE'), 2500);
      };

      recognition.onend = () => {
        if (voiceState !== 'ERROR') setVoiceState('IDLE');
      };

      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, loading]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input is not supported in this browser. Please use keyboard input.');
      return;
    }

    if (voiceState === 'LISTENING') {
      recognitionRef.current.stop();
      setVoiceState('IDLE');
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        recognitionRef.current.stop();
        setVoiceState('IDLE');
      }
    }
  };

  const handleReadAloud = (text, id) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    const cleanSpeech = text
      .replace(/[#*`_~]/g, '')
      .replace(/₹/g, 'rupees ')
      .slice(0, 300);

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoicePreference = () => {
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    localStorage.setItem('booknest_ai_voice_enabled', String(nextVal));
    toast.success(nextVal ? 'Voice speech enabled' : 'Voice speech muted');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleSelectPrompt = (prompt) => {
    if (loading) return;
    onSendMessage(prompt);
  };

  const handleVisualSearchComplete = (searchResult) => {
    setShowImageSearch(false);
    onSendMessage(`[Visual Search] Identify: ${searchResult.identified?.title || 'Book Cover'}`);
  };

  const handleAddToCart = async (e, book) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to add books to your cart');
      navigate('/login');
      return;
    }
    try {
      if (addToCart) {
        await addToCart(book.id);
      } else {
        await api.post('/ai/action', { action: 'ADD_TO_CART', bookId: book.id });
        toast.success(`Added "${book.title}" to cart!`);
      }
    } catch (err) {
      toast.error('Could not add to cart');
    }
  };

  const handleSaveToWishlist = async (e, book) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to save books to your wishlist');
      navigate('/login');
      return;
    }
    try {
      if (addToWishlist) {
        await addToWishlist(book.id);
      } else {
        await api.post('/ai/action', { action: 'ADD_TO_WISHLIST', bookId: book.id });
        toast.success(`Saved "${book.title}" to wishlist!`);
      }
    } catch (err) {
      toast.error('Could not save to wishlist');
    }
  };

  const handleAddBundleToCart = async (bundle) => {
    if (!user) {
      toast.error('Please sign in to add bundles to your cart');
      navigate('/login');
      return;
    }
    try {
      const bookIds = (bundle.books || []).map(b => b.id);
      if (bookIds.length === 0) return;
      await api.post('/ai/action', {
        action: 'ADD_BUNDLE_TO_CART',
        payload: { bookIds }
      });
      toast.success(`Added ${bookIds.length} bundle books to cart!`);
      navigate('/cart');
      onClose();
    } catch (err) {
      toast.error('Could not add bundle to cart');
    }
  };

  const handleAddPlanToCart = async (plan) => {
    if (!user) {
      toast.error('Please sign in to add planned books to your cart');
      navigate('/login');
      return;
    }
    try {
      const bookIds = (plan.books || []).map(b => b.id);
      if (bookIds.length === 0) return;
      await api.post('/ai/action', {
        action: 'ADD_BUNDLE_TO_CART',
        payload: { bookIds }
      });
      toast.success(`Added ${bookIds.length} recommended books to cart!`);
      navigate('/cart');
      onClose();
    } catch (err) {
      toast.error('Could not add books to cart');
    }
  };

  const handleExecuteAction = async (action) => {
    try {
      if (action.type === 'REMOVE_FROM_CART') {
        await api.post('/ai/action', { action: 'REMOVE_FROM_CART', bookId: action.book?.id || action.book?.bookId });
        toast.success('Removed item from your cart');
        onSendMessage('Show my cart');
      }
    } catch (err) {
      toast.error('Could not complete action');
    }
  };

  const handleConfirmClear = () => {
    onClearHistory();
    setShowClearConfirm(false);
  };

  if (!isOpen) return null;

  const currentPrompts = activeBookContext ? BOOK_CONTEXT_PROMPTS : GENERAL_SUGGESTED_PROMPTS;

  return (
    <div className="fixed bottom-24 right-4 sm:right-6 w-[440px] max-w-[calc(100vw-2rem)] h-[660px] max-h-[calc(100vh-7.5rem)] bg-white rounded-3xl border border-slate-200/90 shadow-2xl z-50 flex flex-col overflow-hidden text-left animate-in fade-in slide-in-from-bottom-3 duration-200">
      
      {/* Header Bar */}
      <header className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-primary-900/30 shrink-0">
            <Bot size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black tracking-tight text-white">
                NestAI Multimodal Assistant
              </h3>
              <span className="text-[9px] font-bold text-amber-300 bg-amber-400/20 px-1.5 py-0.2 rounded border border-amber-400/30 flex items-center gap-0.5">
                <Sparkles size={9} /> Voice + Visual
              </span>
            </div>
            <p className="text-[10px] text-slate-300 font-medium truncate max-w-[200px]">
              {activeBookContext ? `Discussing: "${activeBookContext.title}"` : 'Voice, Vision & Smart Shopping'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleVoicePreference}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              voiceEnabled ? 'text-amber-400 bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title={voiceEnabled ? 'Mute AI Responses' : 'Enable Speech for AI Responses'}
            aria-label="Toggle Text-to-speech"
          >
            {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            title="Clear Chat Conversation"
            aria-label="Clear Chat Conversation"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            title="Close Assistant"
            aria-label="Close Assistant"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-center justify-between text-xs text-rose-900 shrink-0 animate-in fade-in duration-150">
          <span className="font-semibold">Clear conversation history?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmClear}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all"
            >
              Clear
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-200 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Visual Book Image Search Panel */}
      {showImageSearch && (
        <AIBookImageSearch
          onSearchComplete={handleVisualSearchComplete}
          onClose={() => setShowImageSearch(false)}
        />
      )}

      {/* Discovery Mode Selector Bar */}
      <AIDiscoveryModes onSelectMode={handleSelectPrompt} disabled={loading} />

      {/* Suggested Prompt Chips */}
      <div className="bg-slate-50/70 border-b border-slate-100 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
        <button
          onClick={() => setShowImageSearch(!showImageSearch)}
          className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-200 shrink-0 transition-all flex items-center gap-1 shadow-2xs"
          aria-label="Identify book from image"
        >
          <Camera size={11} />
          <span>📷 Identify Book</span>
        </button>
        {currentPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSelectPrompt(prompt)}
            disabled={loading}
            className="text-[10px] font-semibold text-slate-700 bg-white hover:bg-primary-50 hover:text-primary-600 px-2.5 py-1 rounded-full border border-slate-200/80 shrink-0 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Stream */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-[#FAFAF9]">
        {/* Proactive AI Insight Banner */}
        {proactiveTip && (
          <div 
            onClick={() => {
              if (proactiveTip.suggestedQuery) {
                onSendMessage(proactiveTip.suggestedQuery);
                setProactiveTip(null);
              }
            }}
            className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-primary-500/10 border border-amber-200/80 hover:border-amber-300 rounded-2xl p-3 shadow-2xs text-left cursor-pointer transition-all flex items-start gap-2.5 animate-in slide-in-from-top-2 group"
          >
            <Sparkles size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-grow min-w-0">
              <p className="text-xs font-bold text-slate-800 leading-tight">
                {proactiveTip.tip}
              </p>
              <span className="text-[10px] font-bold text-primary-600 group-hover:underline mt-0.5 block">
                Tap to ask NestAI →
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setProactiveTip(null);
              }}
              className="text-slate-400 hover:text-slate-600 p-0.5"
              title="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Welcome message */}
        <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
          <div className="w-7 h-7 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center shrink-0 mt-0.5">
            <Bot size={14} />
          </div>
          <div className="max-w-[90%] bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs p-3.5 shadow-soft text-xs leading-relaxed text-slate-800 space-y-1.5">
            <p className="font-semibold text-slate-900">
              👋 Hi! I'm your NestAI Voice + Visual Shopping Assistant.
            </p>
            <p className="text-slate-600 font-normal">
              Speak to search, upload book cover images for instant OCR identification, build study bundles, and discover top-rated student textbook deals!
            </p>
          </div>
        </div>

        {/* Dynamic chat history */}
        {visibleMessages.map((item, idx) => (
          <React.Fragment key={item.id || idx}>
            {/* User Query */}
            {item.message && (
              <div className="flex justify-end animate-in fade-in duration-150">
                <div className="max-w-[85%] bg-primary-600 text-white rounded-2xl rounded-br-xs px-3.5 py-2.5 text-xs font-medium shadow-soft">
                  <p className="whitespace-pre-wrap">{item.message}</p>
                </div>
              </div>
            )}

            {/* AI Response */}
            {item.response && (
              <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Sparkles size={13} />
                </div>
                <div className="max-w-[92%] space-y-2.5">
                  
                  {/* Context Indicator Pill */}
                  {item.context?.contextIndicator && (
                    <div className="inline-flex items-center gap-1.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                      <Sparkles size={10} className="text-indigo-500" />
                      <span>{item.context.contextIndicator}</span>
                    </div>
                  )}

                  {/* Study Bundle Card if Present */}
                  {item.bundle && (
                    <AIBundleCard
                      bundle={item.bundle}
                      onAddBundleToCart={handleAddBundleToCart}
                      onClose={onClose}
                    />
                  )}

                  {/* Budget Planner Card if Present */}
                  {item.budgetPlan && (
                    <AIBudgetPlanner
                      plan={item.budgetPlan}
                      onAddPlanToCart={handleAddPlanToCart}
                      onClose={onClose}
                    />
                  )}

                  {/* Smart Action Card if Present */}
                  {item.action && (
                    <AISmartActionCard
                      action={item.action}
                      onExecuteAction={handleExecuteAction}
                      onCancel={() => toast('Action cancelled')}
                      onClose={onClose}
                    />
                  )}

                  {/* Cart Analysis Optimization Card if Present */}
                  {item.cartAnalysis && (
                    <AICartAnalysisCard
                      analysis={item.cartAnalysis}
                      onClose={onClose}
                    />
                  )}

                  {/* Auth Required Guest Card */}
                  {item.action?.requiresAuth && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2.5 text-left">
                      <p className="text-xs text-amber-900 font-medium">
                        Sign in to save books to your QUIRO reading bag or wishlist.
                      </p>
                      <div className="flex items-center gap-2">
                        <Link
                          to="/login"
                          onClick={onClose}
                          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                        >
                          <LogIn size={13} />
                          <span>Sign In</span>
                        </Link>
                        <button
                          onClick={() => toast('Continuing as guest')}
                          className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-medium border border-slate-200"
                        >
                          Continue Browsing
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Structured Comparison Matrix Card if Present */}
                  {item.comparison && (
                    <AIComparisonCard
                      comparisonData={{
                        books: item.recommended_books || item.books,
                        comparison: item.comparison,
                        winner: item.winner,
                        verdict: item.response
                      }}
                      onAddToCart={handleAddToCart}
                      onClose={onClose}
                    />
                  )}

                  {/* Buying Verdict Card if Present */}
                  {item.buyingDecision && !item.comparison && (
                    <AIBuyingVerdict
                      verdictData={{
                        badge: item.buyingDecision.verdict === 'Recommended' ? 'BEST OVERALL' : 'WORTH BUYING',
                        book: (item.recommended_books || item.books)[0],
                        score: item.buyingDecision.confidence ? item.buyingDecision.confidence / 10 : 9.0,
                        highlights: item.buyingDecision.reasons
                      }}
                      onAddToCart={handleAddToCart}
                      onClose={onClose}
                    />
                  )}

                  {/* Standard Text Bubble with Read Aloud CTA */}
                  {!item.comparison && !item.action && !item.bundle && !item.budgetPlan && (
                    <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs p-3.5 shadow-soft text-xs leading-relaxed text-slate-800 space-y-2">
                      <p className="whitespace-pre-wrap font-medium">{item.response}</p>
                      
                      <div className="flex items-center justify-end pt-1 border-t border-slate-100">
                        <button
                          onClick={() => handleReadAloud(item.response, item.id || idx)}
                          className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer"
                          aria-label="Read response aloud"
                        >
                          {speakingId === (item.id || idx) ? (
                            <>
                              <VolumeX size={11} className="text-rose-500" />
                              <span className="text-rose-600">Stop Speaking</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={11} />
                              <span>🔊 Read aloud</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recommendation Cards */}
                  {!item.comparison && !item.buyingDecision && !item.bundle && !item.budgetPlan && (item.recommended_books || item.books) && (item.recommended_books || item.books).length > 0 && (
                    <div className="grid grid-cols-1 gap-2.5 pt-1">
                      {(item.recommended_books || item.books).map((book) => (
                        <div
                          key={book.id}
                          className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs hover:shadow-soft hover:border-primary-300 transition-all flex flex-col gap-2.5 group"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <img
                              src={book.cover_image || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100'}
                              alt=""
                              className="w-12 h-16 object-cover rounded-lg border border-slate-100 shrink-0 bg-slate-100 shadow-2xs"
                            />
                            <div className="min-w-0 flex-grow">
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-primary-600 line-clamp-1 transition-colors">
                                {book.title}
                              </h4>
                              <p className="text-[11px] text-slate-500 truncate">by {book.author || 'Author'}</p>
                              
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs font-black text-slate-900">
                                  {formatCurrency(book.price || 0)}
                                </span>
                                
                                {book.condition && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                    {book.condition}
                                  </span>
                                )}

                                {book.rating > 0 && (
                                  <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                                    <Star size={10} className="fill-amber-400 text-amber-400" /> {book.rating}
                                  </span>
                                )}

                                {book.valueScore && (
                                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                                    <Award size={9} /> {book.valueScore}/100
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                            <Link
                              to={`/book/${book.id}`}
                              onClick={onClose}
                              className="flex-1 py-1.5 bg-slate-50 hover:bg-primary-50 text-slate-700 hover:text-primary-600 rounded-lg text-[11px] font-bold text-center border border-slate-200/70 transition-colors flex items-center justify-center gap-1"
                            >
                              <span>View</span>
                              <ExternalLink size={11} />
                            </Link>

                            <button
                              onClick={(e) => handleAddToCart(e, book)}
                              className="py-1.5 px-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                              title="Add to Cart"
                            >
                              <ShoppingBag size={12} />
                              <span>Add</span>
                            </button>

                            <button
                              onClick={(e) => handleSaveToWishlist(e, book)}
                              className="py-1.5 px-2 bg-slate-100 hover:bg-pink-50 hover:text-pink-600 text-slate-600 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                              title="Save to Wishlist"
                            >
                              <Heart size={12} />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contextual Quick Follow-Up Chips */}
                  {item.followUps && item.followUps.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                        Suggested Actions:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.followUps.map((chip, ci) => (
                          <button
                            key={ci}
                            onClick={() => handleSelectPrompt(chip)}
                            disabled={loading}
                            className="text-[10px] font-semibold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200/80 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View all matching books in Browse URL */}
                  {item.browseUrl && (
                    <Link
                      to={item.browseUrl}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:text-primary-700 bg-blue-50/80 hover:bg-blue-100/80 px-3 py-1.5 rounded-xl border border-blue-200/80 transition-all"
                    >
                      <SlidersHorizontal size={12} />
                      <span>View all matching books in Browse</span>
                      <ArrowRight size={12} />
                    </Link>
                  )}

                </div>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-start gap-2.5 animate-in fade-in duration-150">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles size={13} className="animate-spin" />
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs px-4 py-3 shadow-soft flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">NestAI is processing your request...</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-600 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary-600 animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary-600 animate-bounce delay-200"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice State Banner */}
      {voiceState === 'LISTENING' && (
        <div className="bg-rose-50 border-t border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-700 font-bold animate-pulse" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
            <span>🔴 Listening to your voice... Speak now</span>
          </div>
          <button onClick={toggleVoiceInput} className="text-[11px] text-rose-800 underline cursor-pointer font-bold">
            Done
          </button>
        </div>
      )}

      {/* Composer Input Footer */}
      <footer className="p-3 bg-white border-t border-slate-200/80 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowImageSearch(!showImageSearch)}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              showImageSearch ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
            title="Identify book from image or camera"
            aria-label="Identify book from image"
          >
            <Camera size={15} />
          </button>

          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${
              voiceState === 'LISTENING'
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}
            title="Speak to NestAI"
            aria-label="Start voice input"
          >
            {voiceState === 'LISTENING' ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type or speak a request..."
            className="flex-grow bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-primary-600 focus:ring-2 focus:ring-primary-500/10 transition-all font-medium"
            disabled={loading}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white p-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 flex items-center justify-center"
            title="Send Message"
            aria-label="Send Message"
          >
            <Send size={15} />
          </button>
        </form>
      </footer>

    </div>
  );
};

export default AIChatWindow;
