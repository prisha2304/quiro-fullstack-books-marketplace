import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { 
  Heart, 
  Search, 
  LayoutGrid, 
  LogOut,
  User,
  ChevronDown,
  ShoppingBasket,
  History,
  TrendingUp,
  X,
  ArrowRight,
  ShieldAlert,
  Menu,
  Feather,
  BookOpen,
  ArrowRightLeft,
  Plus
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import NotificationBell from './NotificationBell';
import OptimizedImage from './OptimizedImage';
import api from '../services/api';
import useDebounce from '../hooks/useDebounce';

const RECENT_SEARCHES_KEY = 'quiro_recent_searches';
const LEGACY_SEARCHES_KEY = 'fable_recent_searches';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cartCount, wishlistCount } = useMarketplace();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState({ titles: [], authors: [], genres: [], popular: [] });
  const [recentSearches, setRecentSearches] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [categories, setCategories] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const searchContainerRef = useRef(null);
  const categoriesRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Debounce search input by 300ms
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Load Recent Searches on Mount (supporting both new and legacy key)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY) || localStorage.getItem(LEGACY_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  // Fetch Categories for Navigation
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await api.get('/categories');
        setCategories(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        // Fallback categories if offline
        setCategories([
          { name: 'Fiction', parent_category: 'Fiction' },
          { name: 'Romance', parent_category: 'Romance' },
          { name: 'Mystery', parent_category: 'Mystery & Thriller' },
          { name: 'Biography', parent_category: 'Non-Fiction' },
          { name: 'Self Help', parent_category: 'Self-Help & Growth' },
          { name: 'Academic and Textbooks', parent_category: 'Academic & Professional' }
        ]);
      }
    };
    fetchCats();
  }, []);

  // Fetch Live Autocomplete Suggestions
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions({ titles: [], authors: [], genres: [], popular: [] });
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const fetchSuggestions = async () => {
      try {
        const res = await api.get(`/books/suggestions?q=${encodeURIComponent(debouncedQuery.trim())}`, {
          signal: abortControllerRef.current.signal
        });
        setSuggestions(res.data || { titles: [], authors: [], genres: [], popular: [] });
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setSuggestions({ titles: [], authors: [], genres: [], popular: [] });
        }
      }
    };

    fetchSuggestions();

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [debouncedQuery]);

  // Click Outside to Dismiss
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
      if (categoriesRef.current && !categoriesRef.current.contains(event.target)) {
        setShowCategories(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveRecentSearch = (term) => {
    if (!term || !term.trim()) return;
    try {
      const updated = [term.trim(), ...recentSearches.filter(s => s.toLowerCase() !== term.trim().toLowerCase())].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {
      // Ignore
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    saveRecentSearch(searchQuery);
    setShowSuggestions(false);
    navigate(`/browse?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const executeDirectSearch = (term) => {
    setSearchQuery(term);
    saveRecentSearch(term);
    setShowSuggestions(false);
    navigate(`/browse?search=${encodeURIComponent(term)}`);
  };

  // Group categories by parent for organized dropdown
  const groupedCategories = categories.reduce((acc, cat) => {
    const parent = cat.parent_category || 'Other Genres';
    if (!acc[parent]) acc[parent] = [];
    acc[parent].push(cat);
    return acc;
  }, {});

  return (
    <header className="fixed top-0 left-0 right-0 h-[75px] bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#DCE2E8] z-50 transition-all select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        
        {/* Left Area: Logo & Categories */}
        <div className="flex items-center gap-3 sm:gap-6 shrink-0 relative" ref={categoriesRef}>
          {/* QUIRO Official Logo */}
          <Link to="/" className="flex items-center gap-2 group select-none">
            <img 
              src="/quiro-logo.png" 
              alt="QUIRO" 
              className="h-11 sm:h-[50px] w-auto max-w-[155px] sm:max-w-[185px] object-contain transition-transform group-hover:scale-[1.03] drop-shadow-xs" 
            />
          </Link>

          {/* Categories Button */}
          <button 
            onClick={() => setShowCategories(!showCategories)}
            className="hidden md:flex items-center gap-2 text-xs font-semibold text-stone-700 hover:text-primary-600 transition-colors cursor-pointer bg-white/80 border border-[#DCE2E8] px-3.5 py-2 rounded-xl shadow-2xs hover:border-primary-300"
          >
            <LayoutGrid size={15} className="text-primary-600" />
            <span>Genres</span>
            <ChevronDown size={13} className={`transition-transform duration-200 text-stone-400 ${showCategories ? 'rotate-180' : ''}`} />
          </button>

          {/* Grouped Multi-Genre Dropdown Menu */}
          {showCategories && (
            <div className="absolute left-[140px] top-full mt-2 w-80 bg-white border border-[#DCE2E8] rounded-2xl shadow-premium py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[480px] overflow-y-auto custom-scrollbar text-left">
              <div className="px-4 py-1.5 border-b border-stone-100 flex items-center justify-between">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Browse by Genre</p>
                <Link 
                  to="/browse" 
                  onClick={() => setShowCategories(false)}
                  className="text-[10px] font-bold text-primary-600 hover:underline uppercase tracking-wider"
                >
                  View All
                </Link>
              </div>

              <div className="p-2 space-y-3">
                {Object.entries(groupedCategories).map(([parent, cats]) => (
                  <div key={parent} className="space-y-1">
                    <button
                      onClick={() => {
                        setShowCategories(false);
                        navigate(`/browse?category=${encodeURIComponent(parent)}`);
                      }}
                      className="w-full text-left px-2.5 py-1 text-[11px] font-bold text-primary-700 hover:text-primary-800 flex items-center justify-between rounded hover:bg-primary-50/50"
                    >
                      <span>{parent}</span>
                      <ArrowRight size={11} className="text-primary-400" />
                    </button>
                    <div className="grid grid-cols-2 gap-0.5 pl-2">
                      {cats.slice(0, 4).map(c => (
                        <button
                          key={c.id || c.name}
                          onClick={() => {
                            setShowCategories(false);
                            navigate(`/browse?category=${encodeURIComponent(c.name)}`);
                          }}
                          className="text-left px-2 py-1 text-[11px] text-stone-600 hover:text-primary-600 hover:bg-stone-50 rounded truncate transition-colors"
                          title={c.name}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center Area: Upgraded Search Bar & Autocomplete */}
        <div className="relative flex-grow max-w-[500px]" ref={searchContainerRef}>
          <form onSubmit={handleSearchSubmit} className="flex h-12 w-full bg-white border border-[#DCE2E8] rounded-xl overflow-hidden focus-within:border-[#E5A323] focus-within:ring-2 focus-within:ring-[#E5A323]/25 transition-all shadow-2xs">
            <div className="flex items-center px-3.5 text-stone-400">
              <Search size={16} />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search novels, authors, ISBN, or genres..." 
              className="flex-grow bg-transparent border-none outline-none text-xs font-medium text-slate-800 placeholder:text-stone-500"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="px-2 text-stone-400 hover:text-stone-600 flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" className="bg-[#35152F] text-white px-5 text-xs font-semibold hover:bg-[#4A1D41] transition-colors shrink-0 cursor-pointer">
              Search
            </button>
          </form>
          
          {/* Autocomplete & Recent Searches Dropdown */}
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#DCE2E8] rounded-2xl shadow-premium py-3 z-50 max-h-[460px] overflow-y-auto text-left animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* 1. Recent Searches */}
              {recentSearches.length > 0 && !searchQuery.trim() && (
                <div className="mb-4 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                      <History size={12} /> Recent Inquiries
                    </span>
                    <button 
                      onClick={() => {
                        setRecentSearches([]);
                        localStorage.removeItem(RECENT_SEARCHES_KEY);
                        localStorage.removeItem(LEGACY_SEARCHES_KEY);
                      }}
                      className="text-[10px] text-stone-400 hover:text-primary-600 font-semibold"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term, idx) => (
                      <button
                        key={idx}
                        onClick={() => executeDirectSearch(term)}
                        className="text-xs font-medium text-stone-700 hover:text-primary-600 bg-[#FAF9F6] hover:bg-primary-50/70 px-3 py-1 rounded-lg border border-[#DCE2E8] transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Popular Literary Tags */}
              {!searchQuery.trim() && (
                <div className="px-4">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                    <TrendingUp size={12} className="text-primary-600" /> Trending Topics
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Fiction', 'Romance', 'Psychological Thriller', 'High Fantasy', 'Self-Help', 'Calculus'].map((tag, i) => (
                      <button
                        key={i}
                        onClick={() => executeDirectSearch(tag)}
                        className="bg-[#FAF9F6] hover:bg-primary-50 text-stone-600 hover:text-primary-700 text-xs font-semibold px-3 py-1 rounded-lg border border-[#DCE2E8] transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Matching Books Results */}
              {searchQuery.trim() && suggestions.titles && suggestions.titles.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4 mb-2">Matching Volumes</p>
                  {suggestions.titles.map(book => (
                    <button
                      key={book.id}
                      onClick={() => {
                        saveRecentSearch(searchQuery);
                        setShowSuggestions(false);
                        navigate(`/book/${book.id}`);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-primary-50/40 flex items-center gap-3 transition-colors border-b border-stone-50 last:border-0 cursor-pointer"
                    >
                      <OptimizedImage 
                        src={book.cover_image} 
                        alt={book.title}
                        className="w-8 aspect-[2/3] object-cover rounded shadow-2xs shrink-0 bg-stone-100" 
                      />
                      <div className="min-w-0 flex-grow">
                        <p className="text-xs font-bold text-slate-800 truncate">{book.title}</p>
                        <p className="text-[10px] text-stone-500 truncate font-medium">by {book.author} &middot; <span className="text-primary-600 font-semibold">{book.genre}</span></p>
                      </div>
                      <span className="text-xs font-extrabold text-slate-800 shrink-0">₹{book.price}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 4. Matching Authors Results */}
              {searchQuery.trim() && suggestions.authors && suggestions.authors.length > 0 && (
                <div className="mb-3 px-4">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Authors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.authors.map((author, idx) => (
                      <button
                        key={idx}
                        onClick={() => executeDirectSearch(author)}
                        className="text-xs font-medium text-stone-700 hover:text-primary-600 bg-[#FAF9F6] hover:bg-primary-50 px-2.5 py-1 rounded-lg border border-[#DCE2E8] transition-colors"
                      >
                        {author}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Direct View All Matches Link */}
              {searchQuery.trim() && (
                <div className="border-t border-[#DCE2E8] pt-2 px-4">
                  <button
                    onClick={handleSearchSubmit}
                    className="w-full py-2 text-center text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>View all matching results for "{searchQuery}"</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Right Area: Nav Links & Actions */}
        <div className="flex items-center gap-3">
          {/* Prominently Styled Main Action Buttons */}
          <div className="hidden lg:flex items-center gap-2.5 mr-1 pr-3 border-r border-[#DCE2E8]">
            {/* Browse Button */}
            <Link 
              to="/browse" 
              className="h-10 px-3.5 rounded-xl font-bold text-xs bg-white text-[#35152F] border border-[#DCE2E8] hover:border-[#35152F]/40 hover:bg-[#FAF9F6] shadow-2xs hover:shadow-xs flex items-center gap-1.5 transition-all"
            >
              <BookOpen size={14} className="text-[#35152F]" />
              <span>Browse</span>
            </Link>

            {/* Swap Button with subtle Marigold accent */}
            <Link 
              to="/swaps" 
              className="h-10 px-3.5 rounded-xl font-bold text-xs bg-[#E5A323]/10 hover:bg-[#E5A323]/20 text-[#35152F] border border-[#E5A323]/40 hover:border-[#E5A323] shadow-2xs hover:shadow-xs flex items-center gap-1.5 transition-all relative group"
            >
              <ArrowRightLeft size={14} className="text-[#E5A323] group-hover:rotate-180 transition-transform duration-300" />
              <span>Swap</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5A323]" />
            </Link>

            {/* Sell Button */}
            <Link 
              to="/sell" 
              className="h-10 px-4 rounded-xl font-bold text-xs bg-[#35152F] hover:bg-[#4A1D41] text-white shadow-xs hover:shadow-sm flex items-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Plus size={14} className="text-[#E5A323]" />
              <span>Sell Book</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <NavIconButton to="/wishlist" icon={<Heart size={18} />} badge={wishlistCount} title="Wishlist" />
            <NavIconButton to="/cart" icon={<ShoppingBasket size={18} />} badge={cartCount} title="Cart" />
            <NotificationBell />
          </div>

          {/* User Profile */}
          {user ? (
            <div className="relative group pl-1 border-l border-[#DCE2E8]">
              <button className="flex items-center gap-2 hover:bg-stone-50 p-1 rounded-xl transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700 font-bold text-xs shadow-2xs">
                  {user.full_name?.charAt(0) || 'U'}
                </div>
                <ChevronDown size={14} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#DCE2E8] rounded-xl shadow-premium opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 py-1.5 z-50 text-left">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4 py-1.5 border-b border-stone-100 truncate">Hello, {user.username}</p>
                {user.role === 'ADMIN' && (
                  <DropdownItem to="/admin" icon={<ShieldAlert size={15} className="text-primary-600" />} label="Admin Studio" />
                )}
                <DropdownItem to="/dashboard" icon={<LayoutGrid size={15}/>} label="Seller Studio" />
                <DropdownItem to="/swaps" icon={<ArrowRightLeft size={15}/>} label="My Book Swaps" />
                <DropdownItem to="/orders" icon={<BookOpen size={15}/>} label="Order History" />
                <DropdownItem to="/profile" icon={<User size={15}/>} label="My Profile" />
                <div className="h-px bg-stone-100 my-1.5" />
                <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2 text-xs text-rose-700 font-semibold hover:bg-rose-50 transition-colors cursor-pointer">
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2.5">
              <Link to="/login" className="text-xs font-semibold text-stone-700 hover:text-primary-600 px-3 py-2 rounded-xl transition-colors">
                Sign In
              </Link>
              <Link to="/register" className="text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl shadow-2xs transition-all active:scale-[0.98]">
                Join Community
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-stone-600 hover:text-primary-600 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-[#FAF9F6] border-b border-[#DCE2E8] px-4 py-5 shadow-lg animate-in slide-in-from-top-2 duration-200 text-left">
          <nav className="flex flex-col gap-1">
            <Link 
              to="/browse" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-xs font-bold text-stone-800 hover:bg-white hover:text-primary-600 transition-colors flex items-center justify-between"
            >
              <span>Browse Catalog</span>
              <BookOpen size={15} className="text-stone-400" />
            </Link>
            <Link 
              to="/swaps" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-xs font-bold text-stone-800 hover:bg-white hover:text-primary-600 transition-colors flex items-center justify-between"
            >
              <span>Book Exchange Marketplace</span>
              <ArrowRightLeft size={15} className="text-primary-600" />
            </Link>
            <Link 
              to="/sell" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-xs font-bold text-stone-800 hover:bg-white hover:text-primary-600 transition-colors flex items-center justify-between"
            >
              <span>Sell Pre-Loved Books</span>
              <LayoutGrid size={15} className="text-stone-400" />
            </Link>
            
            <div className="h-px bg-[#DCE2E8] my-2" />
            
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-white">
                  Seller Studio
                </Link>
                <Link to="/orders" onClick={() => setIsMobileMenuOpen(false)} className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-white">
                  My Orders
                </Link>
                <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 hover:bg-white">
                  My Profile
                </Link>
                <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 text-left">
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="w-1/2 py-2 text-center rounded-xl border border-[#DCE2E8] bg-white text-xs font-bold text-stone-700">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="w-1/2 py-2 text-center rounded-xl bg-primary-600 text-white text-xs font-bold">
                  Join Community
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

const NavIconButton = ({ to, icon, badge, title }) => (
  <Link 
    to={to} 
    className="relative w-10 h-10 flex items-center justify-center text-[#35152F] hover:text-[#4A1D41] bg-white/70 hover:bg-white border border-[#DCE2E8] hover:border-[#35152F]/30 rounded-xl transition-all cursor-pointer shadow-2xs hover:shadow-xs"
    title={title}
  >
    {icon}
    {badge > 0 && (
      <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 bg-[#E5A323] text-[#35152F] text-[8.5px] font-black rounded-full flex items-center justify-center shadow-2xs border-[1.5px] border-white">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </Link>
);

const DropdownItem = ({ to, icon, label }) => (
  <Link to={to} className="flex items-center gap-3 px-4 py-2 text-xs text-stone-700 font-semibold hover:bg-[#FAF9F6] hover:text-primary-600 transition-colors">
    <span className="text-stone-400">{icon}</span>
    <span>{label}</span>
  </Link>
);

export default Navbar;
