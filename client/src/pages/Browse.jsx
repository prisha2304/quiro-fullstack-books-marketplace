import axios from 'axios';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import BookCard from '../components/BookCard';
import { BookCardSkeleton } from '../components/Skeleton';
import useDebounce from '../hooks/useDebounce';
import { 
  SlidersHorizontal, 
  AlertCircle,
  RefreshCw,
  SearchX,
  X,
  Star,
  Check,
  Search,
  History,
  TrendingUp,
  Filter,
  Sparkles,
  BookOpen,
  ArrowRightLeft
} from 'lucide-react';

const RECENT_SEARCHES_KEY = 'quiro_recent_searches';
const LEGACY_SEARCHES_KEY = 'fable_recent_searches';

const Browse = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [similarBooks, setSimilarBooks] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  // Local filter states
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [localFilters, setLocalFilters] = useState({
    category: searchParams.get('category') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    condition: searchParams.get('condition') || '',
    minRating: searchParams.get('minRating') || '',
    availability: searchParams.get('availability') || 'available',
    sort: searchParams.get('sort') || 'newest',
    page: searchParams.get('page') || '1'
  });

  // Debounce search input by 300ms
  const debouncedSearch = useDebounce(searchInput, 300);
  const abortControllerRef = useRef(null);

  // Sync recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY) || localStorage.getItem(LEGACY_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 8));
      }
    } catch (e) {
      setRecentSearches([]);
    }
  }, []);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await api.get('/categories');
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCategories();
  }, []);

  // Update query params when debounced search or localFilters change
  useEffect(() => {
    const params = {};
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (localFilters.category) params.category = localFilters.category;
    if (localFilters.minPrice) params.minPrice = localFilters.minPrice;
    if (localFilters.maxPrice) params.maxPrice = localFilters.maxPrice;
    if (localFilters.condition) params.condition = localFilters.condition;
    if (localFilters.minRating) params.minRating = localFilters.minRating;
    if (localFilters.availability && localFilters.availability !== 'available') params.availability = localFilters.availability;
    if (localFilters.sort && localFilters.sort !== 'newest') params.sort = localFilters.sort;
    if (localFilters.page && localFilters.page !== '1') params.page = localFilters.page;

    setSearchParams(params, { replace: true });
  }, [debouncedSearch, localFilters, setSearchParams]);

  // Main Book Fetch with AbortController for stale request cancellation
  const fetchBooks = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams(searchParams).toString();
      const { data } = await api.get(`/books?${query}`, { signal: controller.signal });
      const returnedBooks = data.books || [];
      setBooks(returnedBooks);
      setPagination(data.pagination || {});

      // If no matching books were found, fetch alternative suggestions
      if (returnedBooks.length === 0) {
        try {
          const simRes = await api.get('/books?limit=6&sort=rating_desc');
          setSimilarBooks(simRes.data?.books || []);
        } catch (e) {
          // Non-blocking
        }
      } else {
        setSimilarBooks([]);
      }
    } catch (err) {
      const isCanceled = axios.isCancel(err) || 
                         err.name === 'CanceledError' || 
                         err.name === 'AbortError' || 
                         err.code === 'ERR_CANCELED' ||
                         controller.signal.aborted;
      if (!isCanceled) {
        setError('Failed to load books. Please try again.');
        console.error(err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const updateFilters = (newFilters) => {
    setLocalFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setSearchInput('');
    setLocalFilters({
      category: '',
      minPrice: '',
      maxPrice: '',
      condition: '',
      minRating: '',
      availability: 'available',
      sort: 'newest',
      page: '1'
    });
    setSearchParams({});
  };

  const saveRecentSearch = (term) => {
    if (!term || !term.trim()) return;
    const clean = term.trim();
    const updated = [clean, ...recentSearches.filter(s => s.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Group categories by parent for organized sidebar
  const groupedCategories = categories.reduce((acc, cat) => {
    const parent = cat.parent_category || 'Other Genres';
    if (!acc[parent]) acc[parent] = [];
    acc[parent].push(cat);
    return acc;
  }, {});

  // Active filter chips calculation
  const activeFilters = [];
  if (debouncedSearch) activeFilters.push({ label: `Search: "${debouncedSearch}"`, key: 'search' });
  if (localFilters.category) activeFilters.push({ label: `Genre: ${localFilters.category}`, key: 'category' });
  if (localFilters.condition) activeFilters.push({ label: `Condition: ${localFilters.condition}`, key: 'condition' });
  if (localFilters.minRating) activeFilters.push({ label: `Rating: ${localFilters.minRating}★+`, key: 'minRating' });
  if (localFilters.availability && localFilters.availability !== 'available') {
    activeFilters.push({ 
      label: localFilters.availability === 'swap_only' ? 'Swap Only' : localFilters.availability === 'sale_only' ? 'Direct Purchase Only' : 'All Listings', 
      key: 'availability' 
    });
  }
  if (localFilters.minPrice || localFilters.maxPrice) {
    activeFilters.push({ label: `Price: ₹${localFilters.minPrice || 0} - ₹${localFilters.maxPrice || '∞'}`, key: 'price' });
  }

  const resultCount = pagination.total !== undefined ? pagination.total : books.length;

  return (
    <div className="pt-24 pb-20 bg-[#FAF9F6] min-h-screen animate-in fade-in duration-300 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Page Header & Live Search Bar */}
        <div className="pb-6 mb-6 border-b border-[#DCE2E8] text-left">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest block mb-1">
                Library Catalogue &amp; Community Listings
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Explore the Collection
              </h1>
              <p className="text-xs text-stone-500 font-medium mt-1">
                {loading ? (
                  'Searching library shelves...'
                ) : debouncedSearch ? (
                  <>Showing <strong className="text-slate-900 font-bold">{resultCount}</strong> matching listings for &ldquo;<span className="text-primary-700 font-bold">{debouncedSearch}</span>&rdquo;</>
                ) : localFilters.category ? (
                  <>Showing <strong className="text-slate-900 font-bold">{resultCount}</strong> volumes in <strong className="text-primary-700 font-bold">{localFilters.category}</strong></>
                ) : (
                  <>Discover <strong className="text-slate-900 font-bold">{resultCount}</strong> authentic volumes across all literary genres</>
                )}
              </p>
            </div>

            {/* Quick Filter & Sort Options */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowMobileFilters(true)}
                className="lg:hidden flex items-center gap-2 px-3.5 py-2.5 bg-white border border-[#DCE2E8] rounded-xl text-xs font-bold text-stone-700 shadow-2xs cursor-pointer"
              >
                <Filter size={14} className="text-primary-600" />
                <span>Filters {activeFilters.length > 0 && `(${activeFilters.length})`}</span>
              </button>

              <div className="flex items-center bg-white border border-[#DCE2E8] rounded-xl px-3 py-2 shadow-2xs">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mr-2.5">Sort</span>
                <select 
                  value={localFilters.sort} 
                  onChange={(e) => updateFilters({ sort: e.target.value, page: 1 })}
                  className="bg-transparent text-xs font-bold text-stone-700 outline-none cursor-pointer border-none p-0 pr-4"
                >
                  <option value="newest">New Arrivals</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="rating_desc">Highest Reader Rating</option>
                  <option value="views_desc">Most Viewed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Integrated Debounced Search Field */}
          <div className="relative max-w-2xl">
            <div className="flex h-11 bg-white border border-[#DCE2E8] rounded-xl overflow-hidden focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-500/15 transition-all shadow-2xs">
              <div className="flex items-center px-3.5 text-stone-400">
                <Search size={16} />
              </div>
              <input 
                type="text" 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchInput.trim()) {
                    saveRecentSearch(searchInput);
                  }
                }}
                placeholder="Search across title, author, ISBN, publisher, or genre..." 
                className="flex-grow bg-transparent border-none outline-none text-xs font-medium text-slate-800 placeholder:text-stone-400"
              />
              {searchInput && (
                <button 
                  onClick={() => setSearchInput('')}
                  className="px-3 text-stone-400 hover:text-stone-600 flex items-center cursor-pointer"
                  title="Clear search input"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Recent Searches Chips */}
          {recentSearches.length > 0 && !debouncedSearch && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                <History size={11} /> Recent:
              </span>
              {recentSearches.map((term, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSearchInput(term);
                    saveRecentSearch(term);
                  }}
                  className="text-xs font-medium text-stone-600 hover:text-primary-700 bg-white hover:bg-primary-50 px-2.5 py-0.5 rounded-lg border border-[#DCE2E8] transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active Filter Chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 items-center text-left">
            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mr-1">Active Criteria:</span>
            {activeFilters.map((filt, idx) => (
              <div key={idx} className="bg-white text-primary-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-primary-200 shadow-2xs">
                <span>{filt.label}</span>
                <button 
                  onClick={() => {
                    if (filt.key === 'search') setSearchInput('');
                    else if (filt.key === 'price') updateFilters({ minPrice: '', maxPrice: '', page: 1 });
                    else updateFilters({ [filt.key]: '', page: 1 });
                  }} 
                  className="text-stone-400 hover:text-primary-700 transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button onClick={clearFilters} className="text-primary-600 hover:text-primary-800 text-[10px] font-bold uppercase tracking-widest ml-2 cursor-pointer">
              Reset Filters
            </button>
          </div>
        )}

        {/* Main Grid & Desktop Sidebar */}
        <div className="flex flex-col lg:flex-row gap-8">
           
           {/* Desktop Sidebar Filter (Hidden on Mobile) */}
           <aside className="hidden lg:block w-64 shrink-0 text-left">
              <div className="sticky top-24 space-y-6">
                 
                 <div className="border border-[#DCE2E8] bg-white rounded-2xl p-5 shadow-soft space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                       <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                          <SlidersHorizontal size={14} className="text-primary-600"/> Filter Catalog
                       </h3>
                       {activeFilters.length > 0 && (
                          <button onClick={clearFilters} className="text-[9px] font-extrabold text-primary-600 hover:text-primary-800 uppercase tracking-wider cursor-pointer">
                             Clear
                          </button>
                       )}
                    </div>

                    {/* Filter 1: Genre / Categories */}
                    <div className="space-y-2">
                       <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Browse by Genre</h4>
                       <div className="space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                          <button
                            onClick={() => updateFilters({ category: '', page: 1 })}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                              !localFilters.category ? 'bg-primary-50 text-primary-700 font-bold' : 'text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            <span>All Genres</span>
                            {!localFilters.category && <Check size={12} />}
                          </button>
                          
                          {Object.entries(groupedCategories).map(([parent, cats]) => (
                            <div key={parent} className="pt-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 px-2 block mb-0.5">{parent}</span>
                              {cats.map(cat => (
                                <button
                                  key={cat.id || cat.name}
                                  onClick={() => updateFilters({ category: cat.name, page: 1 })}
                                  className={`w-full text-left px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center justify-between cursor-pointer ${
                                    localFilters.category === cat.name ? 'bg-primary-50 text-primary-700 font-bold' : 'text-stone-600 hover:bg-stone-50'
                                  }`}
                                >
                                  <span className="truncate">{cat.name}</span>
                                  {localFilters.category === cat.name && <Check size={11} className="shrink-0" />}
                                </button>
                              ))}
                            </div>
                          ))}
                       </div>
                    </div>

                    {/* Filter 2: Price Range */}
                    <div className="pt-3 border-t border-stone-100 space-y-2">
                       <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Price Range (₹)</h4>
                       <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            placeholder="Min" 
                            value={localFilters.minPrice} 
                            onChange={(e) => updateFilters({ minPrice: e.target.value, page: 1 })}
                            className="w-full p-2 bg-[#FAF9F6] border border-[#DCE2E8] rounded-lg text-xs font-bold outline-none focus:border-primary-600"
                          />
                          <span className="text-stone-300 text-xs">-</span>
                          <input 
                            type="number" 
                            placeholder="Max" 
                            value={localFilters.maxPrice} 
                            onChange={(e) => updateFilters({ maxPrice: e.target.value, page: 1 })}
                            className="w-full p-2 bg-[#FAF9F6] border border-[#DCE2E8] rounded-lg text-xs font-bold outline-none focus:border-primary-600"
                          />
                       </div>
                    </div>

                    {/* Filter 3: Condition */}
                    <div className="pt-3 border-t border-stone-100 space-y-2">
                       <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Book Condition</h4>
                       <div className="space-y-1">
                          {['New', 'Like New', 'Good', 'Acceptable'].map((cond) => (
                             <button
                               key={cond}
                               onClick={() => updateFilters({ condition: localFilters.condition === cond ? '' : cond, page: 1 })}
                               className={`w-full text-left px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                                 localFilters.condition === cond ? 'bg-primary-50 text-primary-700 font-bold' : 'text-stone-600 hover:bg-stone-50'
                               }`}
                             >
                               <span>{cond}</span>
                               {localFilters.condition === cond && <Check size={12} />}
                             </button>
                          ))}
                       </div>
                    </div>

                    {/* Filter 4: Availability */}
                    <div className="pt-3 border-t border-stone-100 space-y-2">
                       <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Exchange &amp; Purchase</h4>
                       <div className="space-y-1.5 text-xs font-semibold text-stone-600">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="availability_desktop" 
                              checked={localFilters.availability === 'available'}
                              onChange={() => updateFilters({ availability: 'available', page: 1 })}
                              className="accent-primary-600"
                            />
                            <span>All Available</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="availability_desktop" 
                              checked={localFilters.availability === 'swap_only'}
                              onChange={() => updateFilters({ availability: 'swap_only', page: 1 })}
                              className="accent-primary-600"
                            />
                            <span>Swap Eligible Only</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="availability_desktop" 
                              checked={localFilters.availability === 'sale_only'}
                              onChange={() => updateFilters({ availability: 'sale_only', page: 1 })}
                              className="accent-primary-600"
                            />
                            <span>Direct Purchase Only</span>
                          </label>
                       </div>
                    </div>

                 </div>
              </div>
           </aside>

           {/* Mobile Filters Slide-Over Drawer */}
           {showMobileFilters && (
             <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end lg:hidden">
               <div className="w-full max-w-xs bg-white h-full p-6 overflow-y-auto space-y-6 text-left animate-in slide-in-from-right duration-200">
                 <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                   <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                     <Filter size={16} className="text-primary-600" /> Filter Library
                   </h3>
                   <button onClick={() => setShowMobileFilters(false)} className="p-1 text-stone-400 hover:text-stone-600 cursor-pointer">
                     <X size={18} />
                   </button>
                 </div>

                 {/* Genre in Mobile */}
                 <div className="space-y-2">
                   <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Genre</h4>
                   <select 
                     value={localFilters.category} 
                     onChange={(e) => updateFilters({ category: e.target.value, page: 1 })}
                     className="w-full p-2.5 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl text-xs font-bold"
                   >
                     <option value="">All Genres</option>
                     {categories.map(cat => <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>)}
                   </select>
                 </div>

                 {/* Price Range Mobile */}
                 <div className="space-y-2">
                   <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Price Range (₹)</h4>
                   <div className="flex items-center gap-2">
                     <input 
                       type="number" 
                       placeholder="Min" 
                       value={localFilters.minPrice} 
                       onChange={(e) => updateFilters({ minPrice: e.target.value, page: 1 })}
                       className="w-full p-2 bg-[#FAF9F6] border border-[#DCE2E8] rounded-lg text-xs font-bold"
                     />
                     <span className="text-stone-300 text-xs">-</span>
                     <input 
                       type="number" 
                       placeholder="Max" 
                       value={localFilters.maxPrice} 
                       onChange={(e) => updateFilters({ maxPrice: e.target.value, page: 1 })}
                       className="w-full p-2 bg-[#FAF9F6] border border-[#DCE2E8] rounded-lg text-xs font-bold"
                     />
                   </div>
                 </div>

                 {/* Condition Mobile */}
                 <div className="space-y-2">
                   <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Condition</h4>
                   <select 
                     value={localFilters.condition} 
                     onChange={(e) => updateFilters({ condition: e.target.value, page: 1 })}
                     className="w-full p-2.5 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl text-xs font-bold"
                   >
                     <option value="">Any Condition</option>
                     {['New', 'Like New', 'Good', 'Acceptable'].map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                 </div>

                 {/* Availability Mobile */}
                 <div className="space-y-2">
                   <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Availability</h4>
                   <select 
                     value={localFilters.availability} 
                     onChange={(e) => updateFilters({ availability: e.target.value, page: 1 })}
                     className="w-full p-2.5 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl text-xs font-bold"
                   >
                     <option value="available">All Available</option>
                     <option value="swap_only">Swap Only</option>
                     <option value="sale_only">Direct Purchase Only</option>
                     <option value="all">All Statuses</option>
                   </select>
                 </div>

                 <div className="pt-4 border-t border-stone-100 flex gap-3">
                   <button onClick={clearFilters} className="w-1/2 py-2.5 bg-stone-100 rounded-xl text-xs font-bold text-stone-700 cursor-pointer">
                     Reset
                   </button>
                   <button onClick={() => setShowMobileFilters(false)} className="w-1/2 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold cursor-pointer">
                     Show Results
                   </button>
                 </div>
               </div>
             </div>
           )}

           {/* Main Listings Grid (Responsive Bookstore Sizing) */}
           <div className="flex-grow min-w-0">
              {loading ? (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4.5">
                    {[...Array(10)].map((_, i) => <BookCardSkeleton key={i} />)}
                 </div>
              ) : error ? (
                 <div className="border border-rose-200 bg-rose-50/50 p-12 rounded-2xl text-center">
                    <AlertCircle className="mx-auto text-primary-600 mb-4 animate-bounce" size={40} />
                    <h3 className="font-serif text-lg font-bold text-slate-800 mb-1">Server Communication Issue</h3>
                    <p className="text-xs text-stone-500 mb-5 font-semibold">{error}</p>
                    <button onClick={fetchBooks} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 mx-auto transition-colors text-xs shadow-sm cursor-pointer">
                       <RefreshCw size={14}/> Reload Listing
                    </button>
                 </div>
              ) : books.length === 0 ? (
                 /* Part 4 Mandated Empty State */
                 <div className="space-y-10">
                   <div className="border border-[#DCE2E8] bg-white p-12 sm:p-16 rounded-2xl text-center space-y-4 shadow-soft">
                      <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 mx-auto">
                        <SearchX size={30} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                          Sorry! We couldn&rsquo;t find this book.
                        </h3>
                        <p className="text-stone-500 font-medium text-xs sm:text-sm max-w-md mx-auto">
                          Try another title, author or ISBN. Our community adds new literary volumes every day.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button 
                          onClick={clearFilters} 
                          className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-bold hover:shadow-editorial transition-all active:scale-[0.98] text-xs cursor-pointer inline-flex items-center gap-2"
                        >
                          <RefreshCw size={14} />
                          <span>Clear Search &amp; Show All Books</span>
                        </button>
                      </div>
                   </div>

                   {/* Explore Similar Books Section */}
                   {similarBooks.length > 0 && (
                     <div className="space-y-4 text-left">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <Sparkles size={16} className="text-primary-600" />
                           <h3 className="font-serif text-lg font-bold text-slate-900">
                             Explore Similar Books in Our Library
                           </h3>
                         </div>
                         <span className="text-xs text-stone-400 font-semibold">Recommended for you</span>
                       </div>
                       
                       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4.5">
                         {similarBooks.map(b => (
                           <BookCard key={b.id} book={b} />
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
              ) : (
                 <>
                    {/* Modern Bookstore Responsive Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4.5 justify-start">
                       {books.map(book => <BookCard key={book.id} book={book} />)}
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                       <div className="mt-12 flex items-center justify-center gap-2 pb-6 select-none">
                          {[...Array(pagination.pages)].map((_, i) => (
                             <button 
                                key={i + 1}
                                onClick={() => updateFilters({ page: i + 1 })}
                                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  pagination.page === i + 1 
                                    ? 'bg-primary-600 text-white shadow-md shadow-primary-900/15' 
                                    : 'bg-white border border-[#DCE2E8] text-stone-600 hover:border-primary-600 hover:text-primary-600'
                                }`}
                             >
                                {i + 1}
                             </button>
                          ))}
                       </div>
                    )}
                 </>
              )}
           </div>

        </div>
      </div>
    </div>
  );
};

export default Browse;
