import React, { useState, useEffect } from 'react';
import { BookOpen, Tag, Star, ArrowRight } from 'lucide-react';
import searchService from '../../services/searchService';
import BookCard from '../BookCard';

const SimilarBooks = ({ bookId }) => {
  const [similar, setSimilar] = useState([]);
  const [cheaper, setCheaper] = useState([]);
  const [activeTab, setActiveTab] = useState('SIMILAR');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    searchService.getSimilar(bookId)
      .then(res => {
        setSimilar(res.data?.similar || []);
        setCheaper(res.data?.cheaper || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookId]);

  const items = activeTab === 'CHEAPER' ? cheaper : similar;
  if (!loading && items.length === 0) return null;

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Discover Similar Textbooks
          </h3>
          <p className="text-xs text-slate-500 font-medium">Alternative editions, similar subjects, and cheaper student listings</p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('SIMILAR')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SIMILAR' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
            }`}
          >
            Similar Books ({similar.length})
          </button>
          {cheaper.length > 0 && (
            <button
              onClick={() => setActiveTab('CHEAPER')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'CHEAPER' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              Cheaper ({cheaper.length})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map(b => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </div>
  );
};

export default SimilarBooks;
