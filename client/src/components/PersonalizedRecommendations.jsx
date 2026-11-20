import { useState, useEffect, useRef } from 'react';
import BookCard from './BookCard';
import { BookCardSkeleton } from './Skeleton';
import recommendationService from '../services/recommendationService';
import bookService from '../services/bookService';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

const PersonalizedRecommendations = ({ 
  title = "Recommended For You", 
  subtitle = "Tailored to your reading history and favorite genres",
  limit = 8,
  badgeText = "Personalized For You",
  isCarousel = true
}) => {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const fetchPersonalized = async () => {
      try {
        const { data } = await recommendationService.getPersonalizedRecommendations(limit);
        if (isMounted) {
          setBooks(Array.isArray(data) ? data.slice(0, limit) : []);
        }
      } catch (error) {
        try {
          const { data } = await bookService.getFeaturedBooks();
          if (isMounted) {
            setBooks(Array.isArray(data) ? data.slice(0, limit) : []);
          }
        } catch (e) {
          if (isMounted) setBooks([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPersonalized();

    // Event-driven real-time refresh when user browses or takes marketplace action
    const handleActivityChange = () => {
      fetchPersonalized();
    };

    window.addEventListener('booknest-activity-updated', handleActivityChange);
    window.addEventListener('focus', handleActivityChange);

    return () => {
      isMounted = false;
      window.removeEventListener('booknest-activity-updated', handleActivityChange);
      window.removeEventListener('focus', handleActivityChange);
    };
  }, [user, limit]);

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

  if (!loading && books.length === 0) return null;

  return (
    <section className="my-10 pt-8 border-t border-slate-200/80 text-left">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="p-1 bg-amber-50 text-amber-600 rounded-md">
              <Sparkles size={13} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              {badgeText}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Carousel Navigation Buttons */}
        {isCarousel && (
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
        )}
      </div>
      
      {isCarousel ? (
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto no-scrollbar py-2 px-1 -mx-1 scroll-smooth snap-x"
        >
          {loading ? (
            [...Array(limit)].map((_, i) => (
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
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {loading ? (
            [...Array(limit)].map((_, i) => <BookCardSkeleton key={i} />)
          ) : (
            books.map(book => <BookCard key={book.id} book={book} />)
          )}
        </div>
      )}
    </section>
  );
};

export default PersonalizedRecommendations;
