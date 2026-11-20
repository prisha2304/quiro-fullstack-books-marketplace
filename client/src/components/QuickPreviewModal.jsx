import { X, Eye, ShoppingCart, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../utils/format';
import { useMarketplace } from '../context/MarketplaceContext';
import OptimizedImage from './OptimizedImage';

const QuickPreviewModal = ({ book, onClose }) => {
  const { addToCart } = useMarketplace();

  if (!book) return null;

  const isAvailable = book.status === 'available' && book.sale_enabled !== false;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-500 hover:text-slate-900 transition-colors shadow-lg cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Left: Image */}
          <div className="w-full md:w-2/5 aspect-[3/4] md:aspect-auto bg-slate-50 flex items-center justify-center p-4">
            <OptimizedImage 
              src={book.cover_image} 
              alt={book.title} 
              title={book.title} 
              author={book.author}
              className="w-full h-full max-h-[460px] object-contain rounded-2xl shadow-md" 
            />
          </div>

          {/* Right: Info */}
          <div className="w-full md:w-3/5 p-8 md:p-12 flex flex-col">
            <div className="flex-grow">
               <span className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">
                 {book.genre || 'General'}
               </span>
               <h2 className="text-3xl font-black text-slate-900 mb-2 leading-tight">{book.title}</h2>
               <p className="text-lg text-slate-500 mb-6">by <span className="font-bold text-slate-900">{book.author}</span></p>
               
               <div className="flex items-center space-x-4 mb-8">
                  <div className="flex items-center px-2 py-1 bg-amber-50 text-amber-600 font-bold rounded-lg text-xs">
                    <Star className="w-3.5 h-3.5 mr-1 fill-amber-500 text-amber-500" /> {parseFloat(book.rating || 4.0).toFixed(1)}
                  </div>
                  <span className="text-slate-200">|</span>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{book.condition || 'Good'}</span>
               </div>

               <p className="text-slate-600 line-clamp-4 leading-relaxed mb-8">
                 {book.description || "Looking for a great read? This book is in verified condition and ready for a new home. Check out the full details to learn more about the edition and seller."}
               </p>
            </div>

            <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
               <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Price</p>
                  <p className="text-4xl font-black text-slate-900">{formatCurrency(book.price)}</p>
               </div>
               <div className="flex space-x-3 w-full sm:w-auto">
                  <Link 
                    to={`/book/${book.id}`}
                    onClick={onClose}
                    className="flex-grow sm:flex-initial btn-secondary px-6 py-3 flex items-center justify-center cursor-pointer"
                  >
                    <Eye className="w-4 h-4 mr-2" /> Details
                  </Link>
                  <button 
                    disabled={!isAvailable}
                    onClick={() => {
                      if (isAvailable) {
                        addToCart(book.id, book);
                        onClose();
                      }
                    }}
                    className={`flex-grow sm:flex-initial px-8 py-3 flex items-center justify-center rounded-xl font-bold text-xs transition-all shadow-sm select-none active:scale-[0.98] cursor-pointer ${
                      isAvailable 
                        ? 'bg-primary-600 hover:bg-primary-750 text-white' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" /> {isAvailable ? 'Add to Cart' : 'Unavailable'}
                  </button>
               </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default QuickPreviewModal;
