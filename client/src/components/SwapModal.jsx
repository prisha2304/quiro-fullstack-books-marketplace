import { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Loader2, CheckCircle2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import bookService from '../services/bookService';
import swapService from '../services/swapService';
import toast from 'react-hot-toast';

const SwapModal = ({ requestedBook, book, onClose }) => {
  const targetBook = requestedBook || book;
  const [myBooks, setMyBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (targetBook) {
      fetchMyBooks();
    }
  }, [targetBook]);

  const fetchMyBooks = async () => {
    try {
      const { data } = await bookService.getMyBooks();
      const booksList = Array.isArray(data) ? data : (Array.isArray(data?.books) ? data.books : []);
      // Only books available for swap can be offered
      setMyBooks(booksList.filter(b => b.status === 'available'));
    } catch (error) {
      toast.error('Failed to load your books');
    } finally {
      setLoading(false);
    }
  };

  if (!targetBook) return null;

  const handleSubmit = async () => {
    if (!selectedBookId) return toast.error('Select a book to offer');
    setSubmitting(true);
    try {
      await swapService.requestSwap({
        requested_book_id: targetBook.id,
        offered_book_id: selectedBookId,
        message
      });
      toast.success('Swap request sent!', { duration: 5000 });
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
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
          className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
        >
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <div className="flex items-center">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 mr-4">
                   <ArrowRightLeft className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-900">Propose a Swap</h3>
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Exchange your book for theirs</p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 bg-white border border-slate-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-all shadow-sm">
                <X className="w-6 h-6" />
             </button>
          </div>

          <div className="p-10">
             <div className="flex items-center justify-between mb-10 gap-6">
                <div className="flex flex-col items-center flex-1 text-center">
                   <img src={targetBook.cover_image} className="w-20 aspect-[3/4] object-cover rounded-xl shadow-md mb-3" />
                   <h4 className="text-xs font-black text-slate-900 line-clamp-1">{targetBook.title}</h4>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Their Book</p>
                </div>
                <div className="flex flex-col items-center">
                   <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                     <ArrowRightLeft className="w-5 h-5 text-slate-400" />
                   </div>
                </div>
                <div className="flex flex-col items-center flex-1 text-center">
                   {selectedBookId ? (
                      <>
                        <img 
                          src={myBooks.find(b => b.id === selectedBookId)?.cover_image} 
                          className="w-20 aspect-[3/4] object-cover rounded-xl shadow-md mb-3 border-2 border-indigo-600" 
                        />
                        <h4 className="text-xs font-black text-indigo-600 line-clamp-1">{myBooks.find(b => b.id === selectedBookId)?.title}</h4>
                      </>
                   ) : (
                      <div className="w-20 aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl mb-3 flex items-center justify-center">
                         <BookOpen className="w-8 h-8 text-slate-200" />
                      </div>
                   )}
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Your Offer</p>
                </div>
             </div>

             <div className="mb-8">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Select one of your books to offer</label>
                {loading ? (
                   <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
                ) : myBooks.length > 0 ? (
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {myBooks.map(book => (
                        <button 
                          key={book.id} 
                          onClick={() => setSelectedBookId(book.id)}
                          className={`p-3 rounded-2xl border-2 transition-all text-left flex items-start space-x-3 ${selectedBookId === book.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}
                        >
                           <img src={book.cover_image} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                           <div className="overflow-hidden">
                              <h5 className="text-[10px] font-black text-slate-900 line-clamp-2 leading-tight">{book.title}</h5>
                              <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase">{book.genre}</p>
                           </div>
                        </button>
                      ))}
                   </div>
                ) : (
                   <div className="p-8 bg-amber-50 rounded-3xl text-center">
                      <p className="text-xs font-bold text-amber-700">You don't have any available books to offer. List a book for swap first!</p>
                   </div>
                )}
             </div>

             <div className="mb-8">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Optional Message</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell the owner why you want to swap..."
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm h-24 resize-none"
                />
             </div>

             <button 
               onClick={handleSubmit}
               disabled={submitting || !selectedBookId}
               className="w-full btn-primary bg-indigo-600 hover:bg-indigo-700 py-4 font-black flex items-center justify-center disabled:opacity-50 shadow-xl shadow-indigo-100"
             >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                Send Swap Request
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SwapModal;
