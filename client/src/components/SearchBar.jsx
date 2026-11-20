import { Search, Book, User, Tag, ArrowRight, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useDebounce from '../hooks/useDebounce';
import { motion, AnimatePresence } from 'framer-motion';

const SearchBar = ({ className }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.trim().length > 1) {
      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/recommendations/suggestions?query=${debouncedQuery}`);
      setSuggestions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      submitSearch(query);
    }
  };

  const submitSearch = (text) => {
    setShowSuggestions(false);
    navigate(`/browse?search=${encodeURIComponent(text)}`);
  };

  return (
    <div className={`relative max-w-2xl w-full ${className}`}>
      <form onSubmit={handleSearch} className="relative z-50">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-12 pr-28 py-4 bg-white dark:bg-slate-900 border-0 rounded-2xl shadow-lg ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 transition-all sm:text-base px-6 font-bold"
          placeholder="Search by title, author, or ISBN..."
          value={query}
          onFocus={() => setShowSuggestions(true)}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="absolute right-2 top-2 bottom-2 px-6 bg-primary-600 text-white font-black rounded-xl hover:bg-primary-700 transition-all sm:text-sm active:scale-95 shadow-lg shadow-primary-200 dark:shadow-none"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
        </button>
      </form>

      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-[40]"
          >
            <div className="p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-4">Smart Suggestions</p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(s.text);
                    submitSearch(s.text);
                  }}
                  className="w-full flex items-center px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-2xl group"
                >
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600 transition-all border border-slate-100 dark:border-slate-800">
                    {s.type === 'book' ? <Book className="w-4 h-4" /> : s.type === 'author' ? <User className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                  </div>
                  <div className="ml-4 text-left">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">{s.text}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.type}</p>
                  </div>
                  <ArrowRight className="ml-auto w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </button>
              ))}
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-4 flex justify-center border-t border-slate-100 dark:border-slate-800">
                <button 
                   onClick={() => submitSearch(query)}
                   className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest flex items-center"
                >
                   See all results for "{query}" <ArrowRight className="w-3 h-3 ml-2" />
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSuggestions && (
        <div className="fixed inset-0 z-30" onClick={() => setShowSuggestions(false)} />
      )}
    </div>
  );
};

export default SearchBar;
