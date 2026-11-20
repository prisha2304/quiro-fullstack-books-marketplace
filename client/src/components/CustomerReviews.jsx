import { useState, useEffect } from 'react';
import { 
  Star, 
  ThumbsUp, 
  Flag, 
  CheckCircle2, 
  Edit2, 
  Trash2, 
  MessageSquare, 
  PlusCircle, 
  ShieldCheck, 
  AlertCircle,
  X,
  Sparkles,
  ChevronDown,
  UserCheck
} from 'lucide-react';
import reviewService from '../services/reviewService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const CustomerReviews = ({ bookId, sellerId, bookTitle }) => {
  const { user } = useAuth();
  const [data, setData] = useState({
    total_reviews: 0,
    avg_rating: '0.0',
    distribution: { 5: { count: 0, percentage: 0 }, 4: { count: 0, percentage: 0 }, 3: { count: 0, percentage: 0 }, 2: { count: 0, percentage: 0 }, 1: { count: 0, percentage: 0 } },
    top_positive: null,
    top_critical: null,
    reviews: []
  });
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('recent');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [eligibility, setEligibility] = useState({ canReview: false, isVerified: false, hasReviewed: false });
  const [editingReview, setEditingReview] = useState(null);

  // Form State
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [bookId, sortBy]);

  useEffect(() => {
    if (user && bookId) {
      checkUserEligibility();
    }
  }, [user, bookId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await reviewService.getBookReviews(bookId, sortBy);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load reviews', err);
    } finally {
      setLoading(false);
    }
  };

  const checkUserEligibility = async () => {
    try {
      const res = await reviewService.checkEligibility(bookId);
      setEligibility(res.data);
      if (res.data.existingReview) {
        setEditingReview(res.data.existingReview);
      }
    } catch (err) {
      setEligibility({ canReview: false, isVerified: false });
    }
  };

  const handleHelpful = async (reviewId) => {
    if (!user) return toast.error('Please log in to vote on reviews');
    try {
      const res = await reviewService.markHelpful(reviewId);
      toast.success(res.data.message);
      fetchReviews();
    } catch (err) {
      toast.error('Failed to vote');
    }
  };

  const handleReport = async (reviewId) => {
    if (!user) return toast.error('Please log in to report a review');
    try {
      await reviewService.reportReview(reviewId);
      toast.success('Review reported to moderators for verification');
    } catch (err) {
      toast.error('Failed to report review');
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete your review?')) return;
    try {
      await reviewService.deleteReview(reviewId);
      toast.success('Review deleted');
      fetchReviews();
      checkUserEligibility();
    } catch (err) {
      toast.error('Failed to delete review');
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return toast.error('Please write your review comment');
    setSubmitting(true);
    try {
      if (editingReview && eligibility.hasReviewed) {
        await reviewService.updateReview(editingReview.id, { rating, title, comment });
        toast.success('Review updated successfully!');
      } else {
        await reviewService.createReview({
          book_id: bookId,
          seller_id: sellerId,
          rating,
          title,
          comment
        });
        toast.success('Verified review submitted successfully!');
      }
      setShowReviewModal(false);
      setTitle('');
      setComment('');
      fetchReviews();
      checkUserEligibility();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (rev) => {
    setRating(rev.rating);
    setTitle(rev.title || '');
    setComment(rev.comment || '');
    setEditingReview(rev);
    setShowReviewModal(true);
  };

  const avgRatingNum = parseFloat(data.avg_rating || 0).toFixed(1);

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-soft text-left mt-8 space-y-8">
      
      {/* Top Header & Write Review Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 block mb-1">
            Community Feedback
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Customer Reviews & Ratings
          </h2>
        </div>

        {user ? (
          eligibility.canReview ? (
            <button
              onClick={() => {
                setRating(5);
                setTitle('');
                setComment('');
                setShowReviewModal(true);
              }}
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <PlusCircle size={15} />
              <span>Write a Verified Review</span>
            </button>
          ) : eligibility.hasReviewed ? (
            <button
              onClick={() => openEditModal(eligibility.existingReview || editingReview)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit2 size={13} />
              <span>Edit Your Review</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
              <ShieldCheck size={14} className="text-slate-400" />
              <span>Purchase required to review</span>
            </div>
          )
        ) : (
          <span className="text-xs text-slate-400 font-medium">Log in to write a review</span>
        )}
      </div>

      {/* Aggregate Rating Breakdown & Star Progress Bars (Amazon Style) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-50/70 p-6 rounded-2xl border border-slate-200/60">
        
        {/* Overall Score Box (4 cols) */}
        <div className="md:col-span-4 flex flex-col items-center md:items-start text-center md:text-left border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 md:pr-6">
          <div className="text-4xl sm:text-5xl font-black text-slate-900 leading-none mb-2">
            {avgRatingNum}
          </div>
          
          <div className="flex items-center gap-1 text-amber-400 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                size={18} 
                className={star <= Math.round(parseFloat(data.avg_rating || 0)) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} 
              />
            ))}
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Based on <strong>{data.total_reviews}</strong> verified student ratings
          </p>

          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 mt-3">
            <UserCheck size={12} />
            <span>100% Verified Purchase Reviews</span>
          </div>
        </div>

        {/* 5-Star Distribution Bars (8 cols) */}
        <div className="md:col-span-8 space-y-2.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const row = data.distribution?.[star] || { count: 0, percentage: 0 };
            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-12 font-bold text-slate-700 flex items-center gap-1 text-right justify-end">
                  {star} <Star size={11} className="fill-amber-400 text-amber-400" />
                </span>

                {/* Progress Track */}
                <div className="flex-grow h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${row.percentage}%` }}
                  ></div>
                </div>

                <span className="w-12 text-slate-500 font-bold text-right">
                  {row.percentage}%
                </span>
                <span className="w-8 text-[10px] text-slate-400 text-right">
                  ({row.count})
                </span>
              </div>
            );
          })}
        </div>

      </div>

      {/* Top Positive & Top Critical Reviews Highlight (Goodreads / Amazon Style) */}
      {(data.top_positive || data.top_critical) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Top Positive Review */}
          {data.top_positive ? (
            <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-2xl p-5 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                Top Positive Review
              </span>
              <div className="flex items-center gap-1 text-amber-400 pt-1">
                {[...Array(data.top_positive.rating)].map((_, i) => (
                  <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <h4 className="text-xs font-bold text-slate-900">{data.top_positive.title || 'Excellent Condition'}</h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed italic">"{data.top_positive.comment}"</p>
              <div className="text-[10px] text-slate-400 pt-1">
                By <span className="font-bold text-slate-700">{data.top_positive.reviewer_name}</span> · {data.top_positive.helpful_count || 0} students found this helpful
              </div>
            </div>
          ) : null}

          {/* Top Critical Review */}
          {data.top_critical ? (
            <div className="bg-amber-50/50 border border-amber-200/70 rounded-2xl p-5 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                Top Critical Review
              </span>
              <div className="flex items-center gap-1 text-amber-400 pt-1">
                {[...Array(data.top_critical.rating)].map((_, i) => (
                  <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <h4 className="text-xs font-bold text-slate-900">{data.top_critical.title || 'Fair Condition'}</h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed italic">"{data.top_critical.comment}"</p>
              <div className="text-[10px] text-slate-400 pt-1">
                By <span className="font-bold text-slate-700">{data.top_critical.reviewer_name}</span> · {data.top_critical.helpful_count || 0} students found this helpful
              </div>
            </div>
          ) : null}

        </div>
      )}

      {/* Sorting Tabs Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
        <h3 className="text-sm font-bold text-slate-900">
          Showing {data.reviews.length} Customer Reviews
        </h3>

        <div className="flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-xl">
          {[
            { key: 'recent', label: 'Most Recent' },
            { key: 'highest', label: 'Highest Rated' },
            { key: 'lowest', label: 'Lowest Rated' },
            { key: 'helpful', label: 'Most Helpful' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSortBy(tab.key)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sortBy === tab.key ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Reviews List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse"></div>)}
        </div>
      ) : data.reviews.length > 0 ? (
        <div className="space-y-4">
          {data.reviews.map((rev) => {
            const isAuthor = user && rev.reviewer_id === user.id;

            return (
              <div key={rev.id} className="p-5 rounded-2xl border border-slate-200/70 bg-white hover:border-slate-300 transition-all space-y-3">
                
                {/* Reviewer Meta & Badges */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-slate-700 shrink-0">
                      {rev.reviewer_name?.charAt(0).toUpperCase() || 'U'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{rev.reviewer_name}</span>
                        {rev.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                            <CheckCircle2 size={10} /> Verified Purchase
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {rev.reviewer_college && ` · ${rev.reviewer_college}`}
                      </span>
                    </div>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={13} className={s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                    ))}
                  </div>
                </div>

                {/* Title & Comment */}
                {rev.title && (
                  <h4 className="text-xs font-bold text-slate-900">{rev.title}</h4>
                )}

                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {rev.comment}
                </p>

                {/* Helpful & Report Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleHelpful(rev.id)}
                      className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 font-bold text-[11px] cursor-pointer bg-slate-50 hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-slate-200/60 transition-colors"
                    >
                      <ThumbsUp size={12} />
                      <span>Helpful ({rev.helpful_count || 0})</span>
                    </button>
                    
                    <button
                      onClick={() => handleReport(rev.id)}
                      className="text-slate-400 hover:text-rose-600 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Flag size={11} />
                      <span>Report</span>
                    </button>
                  </div>

                  {isAuthor && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(rev)}
                        className="text-[11px] font-bold text-primary-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rev.id)}
                        className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No reviews yet for this edition</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Be the first student to read and leave a verified review.
          </p>
        </div>
      )}

      {/* Review Submission Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-premium space-y-5 text-left animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingReview && eligibility.hasReviewed ? 'Edit Your Verified Review' : 'Write a Customer Review'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{bookTitle}</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              
              {/* Star Rating Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Overall Rating</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 text-amber-400 cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star 
                        size={24} 
                        className={(hoverRating || rating) >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} 
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-2">
                    {rating === 5 ? '5 Stars (Excellent)' : rating === 4 ? '4 Stars (Good)' : rating === 3 ? '3 Stars (Average)' : rating === 2 ? '2 Stars (Below Average)' : '1 Star (Poor)'}
                  </span>
                </div>
              </div>

              {/* Review Headline */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Review Headline</label>
                <input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's most important to know? (e.g. Crisp condition, fast shipping)"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-primary-600 focus:bg-white"
                />
              </div>

              {/* Review Body */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Write your review</label>
                <textarea 
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was the physical book condition, textbook binding, clarity of pages, and delivery speed?"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-primary-600 focus:bg-white"
                  required
                ></textarea>
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="w-1/2 py-2.5 bg-slate-100 rounded-xl font-bold text-xs text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Verified Review'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerReviews;
