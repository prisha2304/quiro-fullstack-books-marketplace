import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Grid, 
  Search, 
  Loader2,
  CheckCircle2,
  Tag,
  BookOpen
} from 'lucide-react';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', icon: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getCategories();
      setCategories(data);
    } catch (error) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminService.createCategory(newCat);
      toast.success('Category created successfully');
      setNewCat({ name: '', icon: '' });
      setShowModal(false);
      fetchCategories();
    } catch (error) {
      toast.error('Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex justify-between items-center mb-12">
         <div>
            <h1 className="text-4xl font-black text-slate-900 mb-2 font-display">Categorization Hub</h1>
            <p className="text-slate-500 font-medium tracking-tight">Taxonomy management for marketplace organization.</p>
         </div>
         <button 
           onClick={() => setShowModal(true)}
           className="btn-primary py-4 px-8 rounded-2xl font-black text-sm flex items-center shadow-xl shadow-primary-200"
         >
            <Plus className="w-5 h-5 mr-2" /> Add Taxonomy
         </button>
      </header>

      {loading ? (
         <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
         </div>
      ) : (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {categories.map((cat) => (
               <div key={cat.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-100/50 group hover:scale-[1.03] transition-all">
                  <div className="flex items-center justify-between mb-8">
                     <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-all border border-slate-100">
                        <Grid className="w-6 h-6" />
                     </div>
                     <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit className="w-4 h-4" /></button>
                        <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                     </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2 truncate">{cat.name}</h3>
                  <div className="flex items-center text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">
                     <BookOpen className="w-3.5 h-3.5 mr-2" /> Taxonomy active
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* Create Modal */}
      {showModal && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-8 border-b border-slate-100">
                  <h3 className="text-xl font-black text-slate-900">New Category</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Industrial Taxonomy Definition</p>
               </div>
               <form onSubmit={handleCreate} className="p-8 space-y-6">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Category Name</label>
                     <input 
                       type="text" 
                       required
                       value={newCat.name}
                       onChange={(e) => setNewCat({...newCat, name: e.target.value})}
                       className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm font-bold"
                       placeholder="e.g. Science Fiction"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Icon Identifier</label>
                     <input 
                       type="text" 
                       value={newCat.icon}
                       onChange={(e) => setNewCat({...newCat, icon: e.target.value})}
                       className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm font-bold"
                       placeholder="Lucide icon name"
                     />
                  </div>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="w-full btn-primary py-5 rounded-2xl font-black text-sm flex items-center justify-center shadow-xl shadow-primary-200"
                  >
                     {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                     Establish Category
                  </button>
               </form>
            </div>
         </div>
      )}
    </div>
  );
};

export default CategoryManagement;
