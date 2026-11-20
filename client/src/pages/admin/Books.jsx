import { useState, useEffect } from 'react';
import { 
  Trash2, 
  Edit, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Tag, 
  ShieldAlert,
  Archive,
  Star
} from 'lucide-react';
import adminService from '../../services/adminService';
import AdminDataTable from '../../components/AdminDataTable';
import toast from 'react-hot-toast';

const BookManagement = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getBooks();
      setBooks(data);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await adminService.updateBook(id, { status });
      toast.success(`Book marked as ${status}`);
      fetchBooks();
    } catch (error) {
      toast.error('Failed to update book');
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Title', 'Author', 'Genre', 'Price', 'Status', 'Seller'];
    const rows = books.map(b => [b.id, b.title, b.author, b.genre, b.price, b.status, b.seller_name]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "quiro_inventory.csv");
    document.body.appendChild(link);
    link.click();
  };

  const columns = [
    { 
      header: 'Listing', 
      render: (book) => (
        <div className="flex items-center min-w-[200px]">
           <img src={book.cover_image} className="w-10 h-14 object-cover rounded-lg shadow-md shrink-0" />
           <div className="ml-4">
              <p className="text-sm font-black text-slate-900 leading-tight mb-1 line-clamp-1">{book.title}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{book.author}</p>
           </div>
        </div>
      )
    },
    { 
      header: 'Attributes', 
      render: (book) => (
        <div className="flex flex-col space-y-1">
           <div className="flex items-center text-[10px] font-black uppercase text-slate-400">
              <Tag className="w-3 h-3 mr-1.5" /> {book.genre}
           </div>
           <div className="text-sm font-black text-slate-900">₹{book.price}</div>
        </div>
      )
    },
    { 
      header: 'Entity Logic', 
      render: (book) => (
        <div className="flex flex-col space-y-1">
           <div className="flex items-center text-[10px] font-black uppercase text-indigo-600">
              <User className="w-3 h-3 mr-1.5" /> {book.seller_name}
           </div>
           <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">ID: #{book.id}</span>
        </div>
      )
    },
    { 
      header: 'Market Status', 
      render: (book) => (
        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
           book.status === 'available' ? 'bg-green-50 text-green-600 border-green-100' :
           book.status === 'sold' ? 'bg-red-50 text-red-500 border-red-100' :
           'bg-amber-50 text-amber-600 border-amber-100'
        }`}>
           {book.status}
        </span>
      )
    }
  ];

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(search.toLowerCase()) || 
    b.author.toLowerCase().includes(search.toLowerCase()) || 
    b.seller_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-500">
      <AdminDataTable 
        title="Inventory Management"
        columns={columns}
        data={filteredBooks}
        loading={loading}
        search={search}
        setSearch={setSearch}
        onExport={exportCSV}
        actions={(book) => (
          <>
             {book.status !== 'available' && (
                <button 
                  onClick={() => handleUpdateStatus(book.id, 'available')}
                  className="p-2.5 bg-green-50 text-green-600 hover:bg-green-100 border border-green-100 rounded-xl transition-all"
                  title="Approve / Re-list"
                >
                   <CheckCircle2 className="w-4 h-4" />
                </button>
             )}
             
             <button 
               className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 rounded-xl transition-all"
               title="Edit Listing"
             >
                <Edit className="w-4 h-4" />
             </button>

             <button 
               onClick={() => handleUpdateStatus(book.id, 'inappropriate')}
               className="p-2.5 bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100 rounded-xl transition-all"
               title="Mark Inappropriate"
             >
                <ShieldAlert className="w-4 h-4" />
             </button>
          </>
        )}
      />
    </div>
  );
};

export default BookManagement;
