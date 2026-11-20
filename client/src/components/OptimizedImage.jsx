import { useState, useMemo } from 'react';
import { BookOpen } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';

const OptimizedImage = ({ src, alt = 'Book Cover', className = '', ...props }) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Normalize image URL (handle local /uploads, Cloudinary, Open Library, etc.)
  const normalizedSrc = useMemo(() => {
    if (!src || typeof src !== 'string' || !src.trim()) return '';
    let url = src.trim();
    if (url.startsWith('/uploads')) {
      url = `${API_BASE}${url}`;
    }
    if (url.includes('cloudinary.com') && !url.includes('/f_auto,q_auto/')) {
      return url.replace('/upload/', '/upload/f_auto,q_auto,w_600,c_limit/');
    }
    return url;
  }, [src]);

  // Clean fallback when URL is missing, invalid, or fails to load
  if (hasError || !normalizedSrc) {
    return (
      <div 
        className={`bg-gradient-to-br from-[#FAF9F6] to-[#EEF2F6] border border-[#DCE2E8] rounded-lg flex flex-col items-center justify-center text-center p-3 text-stone-500 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <BookOpen size={24} className="mb-1.5 text-primary-600/70 shrink-0" />
        <span className="font-serif text-[11px] font-bold text-slate-800 line-clamp-2 px-1 leading-snug">
          {alt || 'Literary Volume'}
        </span>
        <span className="text-[8px] font-bold tracking-widest text-primary-700/80 mt-1 uppercase">
          QUIRO
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-slate-50 flex items-center justify-center ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center">
          <BookOpen size={20} className="text-slate-300" />
        </div>
      )}

      <img
        src={normalizedSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full h-full object-contain transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...props}
      />
    </div>
  );
};

export default OptimizedImage;
