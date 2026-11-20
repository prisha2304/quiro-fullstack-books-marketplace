import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Hero from '../components/Hero';
import BookCard from '../components/BookCard';
import { BookCardSkeleton } from '../components/Skeleton';
import OptimizedImage from '../components/OptimizedImage';
import { 
  ChevronRight,
  TrendingUp,
  Book,
  Heart,
  Sparkles,
  BookOpen,
  ShoppingBag,
  ArrowRightLeft,
  Users,
  Clock,
  ShieldCheck,
  ChevronLeft,
  Flame,
  Search,
  Feather,
  CheckCircle2,
  Send,
  Eye,
  GraduationCap
} from 'lucide-react';
import toast from 'react-hot-toast';

const Home = () => {
  const [sections, setSections] = useState({
    trending: [],
    recent: [],
    fiction: [],
    romance: [],
    mystery: [],
    academic: [],
    preloved: []
  });
  const [selectedGenreTab, setSelectedGenreTab] = useState('all');
  const [swapBooks, setSwapBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  // References for horizontal scrolling rows
  const trendingScrollRef = useRef(null);
  const recentScrollRef = useRef(null);

  const scroll = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchHomeSections = async () => {
      setLoading(true);
      try {
        const [
          trendingRes,
          recentRes,
          fictionRes,
          romanceRes,
          mysteryRes,
          academicRes,
          prelovedRes,
          swapRes
        ] = await Promise.all([
          api.get('/books?limit=8&sort=views_desc'),
          api.get('/books?limit=8&sort=newest'),
          api.get('/books?limit=8&genre=Fiction'),
          api.get('/books?limit=8&genre=Romance'),
          api.get('/books?limit=8&genre=Mystery'),
          api.get('/books?limit=8&genre=Academic and Textbooks'),
          api.get('/books?limit=8&sort=rating_desc'),
          api.get('/swaps/discover?limit=6')
        ]);

        setSections({
          trending: trendingRes.data?.books || [],
          recent: recentRes.data?.books || [],
          fiction: fictionRes.data?.books || [],
          romance: romanceRes.data?.books || [],
          mystery: mysteryRes.data?.books || [],
          academic: academicRes.data?.books || [],
          preloved: prelovedRes.data?.books || []
        });
        setSwapBooks(swapRes.data?.books || []);
      } catch (err) {
        console.error('Failed to load home catalog sections:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeSections();
  }, []);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSubscribed(true);
    toast.success('Welcome to the QUIRO Readers Circle!');
    setEmailInput('');
  };

  // Genre Showcase Navigation Cards
  const genreCategories = [
    { name: 'Fiction & Literature', query: 'Fiction', icon: <Book size={18} />, count: 'Classic & Modern Prose', bg: 'bg-[#FDF6F7]', border: 'border-primary-200' },
    { name: 'Romance & Fantasy', query: 'Romance', icon: <Heart size={18} />, count: 'Love & Epic Worlds', bg: 'bg-[#FBF8F0]', border: 'border-gold-300' },
    { name: 'Mystery & Thriller', query: 'Mystery', icon: <Search size={18} />, count: 'Whodunits & Suspense', bg: 'bg-[#F4ECE0]', border: 'border-stone-300' },
    { name: 'Self-Help & Growth', query: 'Self Help', icon: <Sparkles size={18} />, count: 'Habits & Mindset', bg: 'bg-[#FDFBF7]', border: 'border-primary-100' },
    { name: 'Biography & Memoirs', query: 'Biography', icon: <Feather size={18} />, count: 'Lives of Note', bg: 'bg-[#FAF9F6]', border: 'border-[#DCE2E8]' },
    { name: 'Academic Textbooks', query: 'Academic and Textbooks', icon: <GraduationCap size={18} />, count: 'Engineering, CS & UPSC', bg: 'bg-[#F5EFE6]', border: 'border-[#DCE2E8]' }
  ];

  return (
    <div className="bg-[#FAF9F6] min-h-screen text-slate-900 pb-20 select-none text-left">
      
      {/* 1. Hero Section */}
      <Hero />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16 sm:space-y-20 pt-12 sm:pt-16">
        
        {/* 2. Browse by Genre (Editorial Grid) */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#DCE2E8] pb-4">
            <div>
              <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest block mb-1">
                Explore The Library
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Browse by Literary Genre
              </h2>
            </div>
            <Link to="/browse" className="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1">
              <span>View All 40+ Sub-Genres</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
            {genreCategories.map((g, idx) => (
              <Link
                key={idx}
                to={`/browse?category=${encodeURIComponent(g.query)}`}
                className={`p-4 rounded-2xl border ${g.border} ${g.bg} hover:shadow-hover hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between h-36 group`}
              >
                <div className="w-9 h-9 rounded-xl bg-white border border-[#DCE2E8] text-primary-700 flex items-center justify-center shadow-2xs group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  {g.icon}
                </div>
                <div>
                  <h3 className="font-serif text-xs font-bold text-slate-900 group-hover:text-primary-700 transition-colors leading-snug mb-0.5">
                    {g.name}
                  </h3>
                  <span className="text-[10px] text-stone-500 font-medium block">
                    {g.count}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 3. Trending Books (Horizontal Carousel) */}
        <BookRowSection 
          title="Trending on Reader Shelves"
          subtitle="The most frequently explored and bookmarked volumes this week"
          badge="Popular Reads"
          badgeIcon={<Flame size={12} className="text-primary-600" />}
          books={sections.trending}
          loading={loading}
          scrollRef={trendingScrollRef}
          onScrollLeft={() => scroll(trendingScrollRef, 'left')}
          onScrollRight={() => scroll(trendingScrollRef, 'right')}
          viewAllLink="/browse?sort=views_desc"
        />

        {/* 4. Recently Added */}
        <BookRowSection 
          title="Recently Added to the Collection"
          subtitle="Fresh volumes listed by community readers and student sellers today"
          badge="New Arrivals"
          badgeIcon={<Clock size={12} className="text-primary-600" />}
          books={sections.recent}
          loading={loading}
          scrollRef={recentScrollRef}
          onScrollLeft={() => scroll(recentScrollRef, 'left')}
          onScrollRight={() => scroll(recentScrollRef, 'right')}
          viewAllLink="/browse?sort=newest"
        />

        {/* 5. Curated Literary Showcase (Consolidated Tabbed Section) */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#DCE2E8] pb-4">
            <div>
              <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest block mb-1">
                Curated Collections
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Literary Showcase
              </h2>
              <p className="text-xs text-stone-500 font-medium mt-1">
                Handpicked editions spanning all genres, from timeless fiction to academic references.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#FAF9F6] p-1 rounded-2xl border border-[#DCE2E8]">
              {[
                { id: 'all', label: 'All Showcase' },
                { id: 'fiction', label: 'Fiction' },
                { id: 'romance', label: 'Romance' },
                { id: 'mystery', label: 'Mystery' },
                { id: 'academic', label: 'Academic' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedGenreTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedGenreTab === tab.id
                      ? 'bg-[#35152F] text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabbed Books Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5">
            {loading ? (
              [...Array(6)].map((_, i) => <BookCardSkeleton key={i} />)
            ) : (() => {
              let displayBooks = [];
              if (selectedGenreTab === 'all') {
                displayBooks = [
                  ...(sections.fiction || []).slice(0, 2),
                  ...(sections.romance || []).slice(0, 2),
                  ...(sections.mystery || []).slice(0, 1),
                  ...(sections.academic || []).slice(0, 1)
                ];
                if (displayBooks.length === 0) displayBooks = sections.trending || [];
              } else if (selectedGenreTab === 'fiction') {
                displayBooks = sections.fiction || [];
              } else if (selectedGenreTab === 'romance') {
                displayBooks = sections.romance || [];
              } else if (selectedGenreTab === 'mystery') {
                displayBooks = sections.mystery || [];
              } else if (selectedGenreTab === 'academic') {
                displayBooks = sections.academic || [];
              }

              if (displayBooks.length === 0) {
                return (
                  <div className="col-span-full py-10 text-center text-xs text-stone-500 bg-white rounded-2xl border border-[#DCE2E8]">
                    No listings found in this category.
                  </div>
                );
              }

              return displayBooks.slice(0, 6).map(book => (
                <BookCard key={book.id} book={book} />
              ));
            })()}
          </div>

          <div className="pt-2 text-right">
            <Link
              to={
                selectedGenreTab === 'fiction' ? '/browse?category=Fiction' :
                selectedGenreTab === 'romance' ? '/browse?category=Romance' :
                selectedGenreTab === 'mystery' ? '/browse?category=Mystery' :
                selectedGenreTab === 'academic' ? '/browse?category=Academic and Textbooks' :
                '/browse'
              }
              className="text-xs font-bold text-primary-600 hover:text-primary-800 inline-flex items-center gap-1"
            >
              <span>Explore All {selectedGenreTab === 'all' ? 'Books' : selectedGenreTab} Volumes</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </section>

        {/* 9. Pre-loved Books Worth Discovering (Grid) */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#DCE2E8] pb-4">
            <div>
              <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest block mb-1">
                Highest Rated Volumes
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Pre-Loved Books Worth Discovering
              </h2>
              <p className="text-xs text-stone-500 font-medium mt-1">
                Cherished copies in verified Like New and Good condition with excellent reader ratings
              </p>
            </div>
            <Link to="/browse?sort=rating_desc" className="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1">
              <span>View All Highly Rated</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5">
            {loading ? (
              [...Array(6)].map((_, i) => <BookCardSkeleton key={i} />)
            ) : (
              sections.preloved.slice(0, 6).map((book) => (
                <BookCard key={book.id} book={book} />
              ))
            )}
          </div>
        </section>

        {/* 10. Books Available for Swapping Section */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#DCE2E8] pb-4">
            <div>
              <span className="text-[10px] font-bold text-[#E5A323] uppercase tracking-widest block mb-1">
                Community Book Exchange
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#35152F]">
                Discover Books Available for Swapping
              </h2>
              <p className="text-xs text-stone-500 font-medium mt-1">
                Verified copies listed by our community readers for direct peer exchange without cash
              </p>
            </div>
            <Link to="/swaps" className="text-xs font-bold text-[#35152F] hover:text-[#2A1025] flex items-center gap-1">
              <span>Explore All Available Swaps</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4.5">
            {loading ? (
              [...Array(6)].map((_, i) => <BookCardSkeleton key={i} />)
            ) : swapBooks.length === 0 ? (
              <div className="col-span-full bg-white border border-[#DCE2E8] rounded-2xl p-8 text-center space-y-2">
                <ArrowRightLeft className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="text-xs text-stone-500">No swap listings currently available. Be the first to list a book for exchange!</p>
                <Link to="/sell" className="inline-block bg-[#35152F] text-white text-xs font-bold px-4 py-2 rounded-xl">
                  List Book for Swap
                </Link>
              </div>
            ) : (
              swapBooks.slice(0, 6).map((book) => (
                <div 
                  key={book.id} 
                  className="group bg-white border border-[#DCE2E8] rounded-2xl overflow-hidden flex flex-col justify-between hover:shadow-hover hover:-translate-y-1 transition-all duration-200 text-left"
                >
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
                    <span className="absolute top-2 right-2 bg-[#E5A323] text-[#35152F] text-[8px] font-bold px-1.5 py-0.5 rounded shadow-2xs">
                      Swap
                    </span>
                  </div>

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
                      <p className="text-[10px] text-stone-500 font-medium truncate mb-0.5">
                        by <span className="text-stone-700 font-semibold">{book.author}</span>
                      </p>
                      <p className="text-[9px] text-stone-500 truncate">
                        Owner: <Link to={`/seller/${book.seller_id}`} className="font-semibold text-[#35152F] hover:underline">{book.seller_name || 'Reader'}</Link>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center gap-1.5">
                      <Link
                        to={`/swaps?requested=${book.id}`}
                        className="flex-1 py-1.5 bg-[#35152F] hover:bg-[#2A1025] text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-2xs"
                      >
                        <ArrowRightLeft size={11} />
                        <span>Request Swap</span>
                      </Link>
                      <Link
                        to={`/book/${book.id}`}
                        className="p-1.5 bg-[#FAF9F6] hover:bg-stone-100 text-stone-600 rounded-lg border border-[#DCE2E8] transition-all"
                        title="View Details"
                      >
                        <Eye size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 11. How Buying, Selling & Swapping Works */}
        <section className="bg-white border border-[#DCE2E8] rounded-3xl p-8 sm:p-12 shadow-soft space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#E5A323] block">
              Circulating Stories Across India
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#35152F]">
              How QUIRO Works
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 font-medium">
              "Your Next Chapter Could Be Someone's First." A seamless community model crafted for readers, book lovers, and students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-6 rounded-2xl bg-[#FAF9F6] border border-[#DCE2E8] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#35152F] text-white flex items-center justify-center font-serif text-base font-bold shadow-2xs">
                1
              </div>
              <h3 className="font-serif text-lg font-bold text-[#35152F]">Discover &amp; Purchase</h3>
              <p className="text-xs text-stone-600 font-medium leading-relaxed">
                Explore hundreds of verified pre-loved books at 40-70% below bookstore retail. Orders are protected with verified condition checks and secure checkout.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FAF9F6] border border-[#DCE2E8] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#35152F] text-white flex items-center justify-center font-serif text-base font-bold shadow-2xs">
                2
              </div>
              <h3 className="font-serif text-lg font-bold text-[#35152F]">Swap Directly with Peers</h3>
              <p className="text-xs text-stone-600 font-medium leading-relaxed">
                Exchange textbooks and novels without financial friction. Select an eligible book from your shelf, propose a swap, and trade stories with fellow readers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FAF9F6] border border-[#DCE2E8] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#35152F] text-white flex items-center justify-center font-serif text-base font-bold shadow-2xs">
                3
              </div>
              <h3 className="font-serif text-lg font-bold text-[#35152F]">Pass It Forward</h3>
              <p className="text-xs text-stone-600 font-medium leading-relaxed">
                Finished reading? List your book in minutes with simple pricing. Keep books circulating and recover reading funds for your next discovery.
              </p>
            </div>
          </div>
        </section>

        {/* 11. Join the Reading Community (Newsletter & Club) */}
        <section className="bg-gradient-to-br from-[#1F0B1C] via-[#35152F] to-[#2A1025] rounded-3xl p-8 sm:p-14 text-white shadow-editorial text-center sm:text-left relative overflow-hidden">
          <div className="max-w-2xl relative z-10 space-y-4">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full text-[#E5A323] backdrop-blur-xs border border-white/15">
              <Sparkles size={12} className="text-[#E5A323]" /> The QUIRO Circle
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-white">
              Your Next Chapter Awaits
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 font-medium leading-relaxed max-w-lg">
              Receive curated book recommendations, rare edition drop alerts, and invitations to community swap events delivered straight to your inbox.
            </p>

            {subscribed ? (
              <div className="inline-flex items-center gap-2 bg-emerald-600/30 border border-emerald-400 text-emerald-100 px-4 py-2.5 rounded-xl text-xs font-bold">
                <CheckCircle2 size={16} /> Thank you for joining the QUIRO Circle!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2.5 max-w-md pt-2">
                <input 
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Enter your email address..."
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder:text-stone-300 outline-none focus:bg-white/20"
                />
                <button
                  type="submit"
                  className="bg-[#E5A323] hover:bg-[#C78814] text-[#35152F] font-bold px-6 py-3 rounded-xl text-xs shadow-2xs transition-all active:scale-95 shrink-0 cursor-pointer"
                >
                  Join Circle
                </button>
              </form>
            )}
          </div>

          {/* Decorative Subtle Foliage / Shape */}
          <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-80 h-80 rounded-full bg-[#E5A323]/10 pointer-events-none blur-3xl"></div>
        </section>

      </div>
    </div>
  );
};

// Reusable Carousel Row Component
const BookRowSection = ({ 
  title, 
  subtitle, 
  badge, 
  badgeIcon, 
  books, 
  loading, 
  scrollRef, 
  onScrollLeft, 
  onScrollRight, 
  viewAllLink 
}) => {
  if (!loading && books.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#DCE2E8] pb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            {badgeIcon}
            <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest">{badge}</span>
          </div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link to={viewAllLink} className="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 mr-2">
            <span>Explore All</span>
            <ChevronRight size={14} />
          </Link>
          <div className="hidden sm:flex items-center gap-1.5">
            <button 
              onClick={onScrollLeft}
              className="w-8 h-8 rounded-lg bg-white border border-[#DCE2E8] text-stone-600 hover:text-primary-600 hover:border-primary-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={onScrollRight}
              className="w-8 h-8 rounded-lg bg-white border border-[#DCE2E8] text-stone-600 hover:text-primary-600 hover:border-primary-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-1"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="w-44 sm:w-48 shrink-0">
              <BookCardSkeleton />
            </div>
          ))
        ) : (
          books.map((book) => (
            <div key={book.id} className="w-44 sm:w-48 shrink-0" style={{ scrollSnapAlign: 'start' }}>
              <BookCard book={book} />
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default Home;
