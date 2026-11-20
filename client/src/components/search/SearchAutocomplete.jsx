import React, { useState, useEffect, useRef } from 'react';
import { Search, BookOpen, User, Tag, Hash, Loader2, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import searchService from '../../services/searchService';
import { formatCurrency } from '../../utils/format';

const SearchAutocomplete = ({ placeholder = 'Search titles, authors, ISBN, subjects...', onSearchSubmit, autoFocus = false }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState({ books: [], authors: [], categories: [], isbns: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions({ books: [], authors: [], categories: [], isbns: [] });
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchService.getSuggestions(query.trim(), 6);
        setSuggestions(res.data);
        setIsOpen(true);
      } catch (e) {
        // Non-blocking
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setIsOpen(false);
    if (onSearchSubmit) {
      onSearchSubmit(query.trim());
    } else {
      navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelectBook = (bookId) => {
    setIsOpen(false);
    navigate(`/book/${bookId}`);
  };

  const handleSelectCategory = (cat) => {
    setIsOpen(false);
    navigate(`/browse?genre=${encodeURIComponent(cat)}`);
  };

  const handleSelectAuthor = (auth) => {
    setIsOpen(false);
    navigate(`/browse?author=${encodeURIComponent(auth)}`);
  };

  const hasSuggestions = 
    suggestions.books.length > 0 || 
    suggestions.authors.length > 0 || 
    suggestions.categories.length > 0 ||
    suggestions.isbns.length > 0;

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 text-slate-400 pointer-events-none">
          {loading ? <Loader2 size={16} className="animate-spin text-primary-600" /> : <Search size={16} />}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim().length >= 2) setIsOpen(true); }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-2.5 bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-900 placeholder-slate-400 rounded-2xl border border-transparent focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
        />

        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 max-h-[420px] overflow-y-auto divide-y divide-slate-100">
          {hasSuggestions ? (
            <>
              {/* ISBN Match */}
              {suggestions.isbns?.length > 0 && (
                <div className="p-3 bg-indigo-50/50">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block mb-1.5 flex items-center gap-1">
                    <Hash size={11} /> ISBN Direct Match
                  </span>
                  {suggestions.isbns.map(i => (
                    <div
                      key={i.bookId}
                      onClick={() => handleSelectBook(i.bookId)}
                      className="p-2 bg-white rounded-xl border border-indigo-100 text-xs font-bold text-slate-900 hover:bg-indigo-50 cursor-pointer flex items-center justify-between"
                    >
                      <span>{i.title}</span>
                      <span className="text-[10px] text-indigo-600 font-black">{i.isbn}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Book Titles */}
              {suggestions.books?.length > 0 && (
                <div className="p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2 px-1 flex items-center gap-1">
                    <BookOpen size={11} /> Books
                  </span>
                  <div className="space-y-1">
                    {suggestions.books.map(b => (
                      <div
                        key={b.id}
                        onClick={() => handleSelectBook(b.id)}
                        className="p-2 hover:bg-slate-50 rounded-2xl flex items-center gap-3 cursor-pointer transition-colors"
                      >
                        <img
                          src={b.coverImage || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=100'}
                          alt=""
                          className="w-8 h-11 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-100"
                        />
                        <div className="min-w-0 flex-grow">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{b.title}</h4>
                          <p className="text-[11px] text-slate-500 truncate">by {b.author}</p>
                        </div>
                        <span className="text-xs font-black text-slate-900 shrink-0">{formatCurrency(b.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Authors & Categories */}
              {(suggestions.authors?.length > 0 || suggestions.categories?.length > 0) && (
                <div className="p-3 bg-slate-50/70 grid grid-cols-2 gap-2">
                  {suggestions.categories?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1 px-1 flex items-center gap-1">
                        <Tag size={11} /> Subjects
                      </span>
                      {suggestions.categories.map((cat, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectCategory(cat)}
                          className="px-2 py-1.5 text-xs font-semibold text-slate-700 hover:text-primary-600 hover:bg-white rounded-xl cursor-pointer truncate"
                        >
                          {cat}
                        </div>
                      ))}
                    </div>
                  )}

                  {suggestions.authors?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1 px-1 flex items-center gap-1">
                        <User size={11} /> Authors
                      </span>
                      {suggestions.authors.map((auth, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectAuthor(auth)}
                          className="px-2 py-1.5 text-xs font-semibold text-slate-700 hover:text-primary-600 hover:bg-white rounded-xl cursor-pointer truncate"
                        >
                          {auth}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* View All Matches Footer */}
              <div 
                onClick={handleSubmit}
                className="p-3 text-center bg-slate-50 hover:bg-primary-50 text-xs font-black text-primary-600 cursor-pointer flex items-center justify-center gap-1"
              >
                <span>View all search results for "{query}"</span>
                <ArrowRight size={13} />
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">
              No direct suggestions found. Press Enter to search catalog.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchAutocomplete;
