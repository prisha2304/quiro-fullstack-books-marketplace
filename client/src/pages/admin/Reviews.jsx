import { useState, useEffect } from 'react';
import { 
  Star, 
  Trash2, 
  User, 
  BookOpen, 
  AlertCircle, 
  ShieldAlert,
  Calendar,
  MessageSquare
} from 'lucide-react';
import adminService from '../../services/adminService';
import AdminDataTable from '../../components/AdminDataTable';
import toast from 'react-hot-toast';

const ReviewManagement = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getReviews();
      setReviews(data);
    } catch (error) {
      toast.error('Failed to load social reputation data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this review? This will impact the seller\'s average rating.')) return;
    try {
      await adminService.deleteReview(id);
      toast.success('Review deleted successfully');
      fetchReviews();
    } catch (error) {
      toast.error('Failed to delete review');
    }
  };

  const columns = [
    { 
      header: 'Evaluation Context', 
      render: (rev) => (
        <div className="flex flex-col space-y-1">
           <div className="flex items-center text-xs font-black text-slate-900 line-clamp-1">
              <BookOpen className="w-3.5 h-3.5 mr-2 text-indigo-600" /> {rev.book_title}
           </div>
           <div className="flex items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-5">
              Seller: {rev.seller_name}
           </div>
        </div>
      )
    },
    { 
      header: 'Reviewer', 
      render: (rev) => (
        <div className="flex items-center text-xs font-black text-slate-600">
           <User className="w-3.5 h-3.5 mr-2 text-slate-300" /> {rev.reviewer_name}
        </div>
      )
    },
    { 
      header: 'Rating', 
      render: (rev) => (
        <div className="flex items-center text-amber-500">
           {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-3 h-3 ${i < rev.rating ? 'fill-current' : 'text-slate-200'}`} />
           ))}
           <span className="ml-2 text-xs font-black text-slate-900">{rev.rating}.0</span>
        </div>
      )
    },
    { 
      header: 'Feedback Content', 
      render: (rev) => (
        <div className="flex items-start max-w-sm">
           <MessageSquare className="w-3.5 h-3.5 mr-3 text-slate-300 mt-1 shrink-0" />
           <p className="text-xs text-slate-500 font-medium italic line-clamp-2 leading-relaxed">"{rev.comment || 'No comment provided'}"</p>
        </div>
      )
    }
  ];

  const filteredReviews = reviews.filter(r => 
    r.reviewer_name.toLowerCase().includes(search.toLowerCase()) || 
    r.seller_name.toLowerCase().includes(search.toLowerCase()) ||
    r.comment?.toLowerCase().includes(search.toLowerCase()) ||
    r.book_title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-500">
      <AdminDataTable 
        title="Social Reputation Control"
        columns={columns}
        data={filteredReviews}
        loading={loading}
        search={search}
        setSearch={setSearch}
        actions={(rev) => (
          <>
             <button 
               onClick={() => handleDelete(rev.id)}
               className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-100 rounded-xl transition-all"
               title="Delete Abusive Content"
             >
                <Trash2 className="w-4 h-4" />
             </button>
             <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl border border-slate-100 transition-all">
                <ShieldAlert className="w-4 h-4" />
             </button>
          </>
        )}
      />
    </div>
  );
};

export default ReviewManagement;
