import { useState, useEffect, useRef } from 'react';
import { Search, Book, User, Calendar, Loader2 } from 'lucide-react';
import { searchBooks, parseBookData } from '../services/googleBooksService';

const GoogleBooksSearch = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (val) => {
    setQuery(val);
    if (val.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    const books = await searchBooks(val);
    setResults(books);
    setIsOpen(true);
    setLoading(false);
  };

  const handleSelect = (book) => {
    const parsedData = parseBookData(book);
    onSelect(parsedData);
    setQuery(parsedData.title);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? <Loader2 className="w-5 h-5 text-primary-500 animate-spin" /> : <Search className="w-5 h-5 text-slate-400" />}
        </div>
        <input
          type="text"
          className="input-field pl-10"
          placeholder="Type book title to search & autofill..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length >= 3 && setIsOpen(true)}
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white card shadow-2xl border-slate-200 overflow-hidden">
          {results.map((book) => (
            <button
              key={book.id}
              onClick={() => handleSelect(book)}
              className="w-full text-left p-4 hover:bg-primary-50 border-b border-slate-50 last:border-0 flex items-start space-x-4 transition-colors"
            >
              {book.volumeInfo.imageLinks?.thumbnail ? (
                <img src={book.volumeInfo.imageLinks.thumbnail} alt="" className="w-12 h-16 object-cover rounded shadow-sm" />
              ) : (
                <div className="w-12 h-16 bg-slate-100 rounded flex items-center justify-center">
                  <Book className="w-6 h-6 text-slate-300" />
                </div>
              )}
              <div className="flex-grow min-w-0">
                <h4 className="font-bold text-slate-900 truncate">{book.volumeInfo.title}</h4>
                <div className="flex items-center text-xs text-slate-500 mt-1">
                  <User className="w-3 h-3 mr-1" /> {book.volumeInfo.authors?.join(', ')}
                </div>
                <div className="flex items-center text-xs text-slate-500 mt-0.5">
                  <Calendar className="w-3 h-3 mr-1" /> {book.volumeInfo.publishedDate}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoogleBooksSearch;
