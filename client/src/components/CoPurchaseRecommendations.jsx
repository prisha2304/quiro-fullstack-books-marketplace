import { useState, useEffect, useRef } from 'react';
import BookCard from './BookCard';
import { BookCardSkeleton } from './Skeleton';
import recommendationService from '../services/recommendationService';
import { TrendingUp, ChevronLeft, ChevronRight, Users } from 'lucide-react';

const CoPurchaseRecommendations = ({ currentBookId }) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchCoPurchases = async () => {
      if (!currentBookId) return;
      setLoading(true);
      setError(false);
      try {
        const { data } = await recommendationService.getCoPurchaseRecommendations(currentBookId);
        setBooks(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching co-purchase recommendations:', err);
        setError(true);
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCoPurchases();
  }, [currentBookId]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!loading && (error || books.length === 0)) return null;

  return (
    <section className="my-10 pt-8 border-t border-slate-200/80 text-left">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="p-1 bg-emerald-50 text-emerald-600 rounded-md">
              <TrendingUp size={13} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Community Co-Purchases
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Users Who Bought This Also Bought
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Readers interested in this book frequently purchase these companion titles
          </p>
        </div>

        {/* Carousel Navigation Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
            title="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
            title="Next"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      
      {/* Horizontal Carousel Track */}
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-1 -mx-1 scroll-smooth snap-x"
      >
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="min-w-[180px] sm:min-w-[210px] shrink-0 snap-start">
              <BookCardSkeleton />
            </div>
          ))
        ) : (
          books.map(book => (
            <div key={book.id} className="min-w-[180px] sm:min-w-[210px] max-w-[220px] shrink-0 snap-start">
              <BookCard book={book} />
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default CoPurchaseRecommendations;
