import { useState } from 'react';
import { Star, MessageSquare, Send, Loader2, X } from 'lucide-react';
import reviewService from '../services/reviewService';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const ReviewModal = ({ sellerId, bookId, sellerName, onClose, onReviewAdded }) => {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error('Please select a rating');
    
    setSubmitting(true);
    try {
      await reviewService.createReview({
        seller_id: sellerId,
        book_id: bookId,
        rating,
        comment
      });
      toast.success('Review submitted! Thank you.');
      if (onReviewAdded) onReviewAdded();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

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
          className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <div className="flex items-center">
                <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100 mr-4">
                   <Star className="w-6 h-6 fill-current" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900">Rate Seller</h3>
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Your feedback matters</p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 bg-white border border-slate-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-all">
                <X className="w-6 h-6" />
             </button>
          </div>

          <form onSubmit={handleSubmit} className="p-10">
             <div className="text-center mb-10">
                <p className="text-slate-500 font-medium mb-6">How was your experience with <span className="text-slate-900 font-bold">{sellerName}</span>?</p>
                
                <div className="flex items-center justify-center space-x-2">
                   {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        className="p-1 transition-all hover:scale-125 hover:-rotate-6"
                      >
                         <Star 
                           className={`w-10 h-10 transition-colors ${
                              (hover || rating) >= star ? 'text-amber-500 fill-amber-500' : 'text-slate-200'
                           }`} 
                         />
                      </button>
                   ))}
                </div>
                <p className="mt-4 text-xs font-black text-amber-600 uppercase tracking-widest">
                   {rating === 5 ? 'Excellent' : rating === 4 ? 'Good' : rating === 3 ? 'Average' : rating === 2 ? 'Poor' : 'Worst'}
                </p>
             </div>

             <div className="mb-8">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block flex items-center">
                   <MessageSquare className="w-3.5 h-3.5 mr-2" /> Share your experience (Optional)
                </label>
                <textarea 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us about the transaction quality, timing, or communication..."
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-sm h-32 resize-none"
                />
             </div>

             <button 
               type="submit"
               disabled={submitting || !rating}
               className="w-full btn-primary bg-amber-500 hover:bg-amber-600 py-5 font-black flex items-center justify-center disabled:opacity-50 shadow-xl shadow-amber-100"
             >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                Submit Review
             </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ReviewModal;
