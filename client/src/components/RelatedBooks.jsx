import { useState, useEffect, useRef } from 'react';
import BookCard from './BookCard';
import { BookCardSkeleton } from './Skeleton';
import recommendationService from '../services/recommendationService';
import { Sparkles, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

const RelatedBooks = ({ currentBookId, currentGenre }) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!currentBookId) return;
      setLoading(true);
      try {
        const { data } = await recommendationService.getGenreRecommendations(currentBookId);
        setBooks(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching genre recommendations:', error);
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
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

  if (!loading && books.length === 0) return null;

  return (
    <section className="my-10 pt-8 border-t border-slate-200/80 text-left">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="p-1 bg-blue-50 text-blue-600 rounded-md">
              <Layers size={13} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              Curated by Genre
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            You May Also Like
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {currentGenre ? `Top rated books in ${currentGenre}` : 'Handpicked community recommendations'}
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

export default RelatedBooks;
