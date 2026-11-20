import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ImageUpload from '../components/ImageUpload';
import { formatCurrency } from '../utils/format';
import { 
  CheckCircle, 
  BookOpen,
  ArrowRightLeft,
  ChevronLeft,
  ArrowRight,
  Image as ImageIcon,
  Link as LinkIcon,
  DollarSign,
  FileText,
  Eye,
  ChevronRight,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import AIListingOptimizer from '../components/ai/AIListingOptimizer';

const Sell = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mediaMode, setMediaMode] = useState('upload'); // 'upload' or 'url'
  const [step, setStep] = useState(1);

  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    description: '',
    genre: '',
    price: '',
    original_price: '',
    condition: 'Good',
    language: 'English',
    publication_year: '',
    publisher: '',
    cover_image: '',
    additional_images: [],
    sale_enabled: true,
    swap_enabled: false,
    preferred_book: '',
    preferred_genre: '',
    accept_any_book: false
  });

  useEffect(() => {
    if (!user) {
      toast.error('Please login to sell books');
      navigate('/login');
    }
    fetchCategories();
    if (isEditMode) {
      fetchBookDetails();
    }
  }, [user, navigate, id]);

  const fetchBookDetails = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/books/${id}`);
      
      setFormData({
        title: data.title || '',
        author: data.author || '',
        isbn: data.isbn || '',
        description: data.description || '',
        genre: data.genre || '',
        price: data.price !== null ? data.price.toString() : '',
        original_price: data.original_price !== null ? data.original_price.toString() : '',
        condition: data.condition || 'Good',
        language: data.language || 'English',
        publication_year: data.publication_year || '',
        publisher: data.publisher || '',
        cover_image: data.cover_image || '',
        additional_images: Array.isArray(data.additional_images) ? data.additional_images : JSON.parse(data.additional_images || '[]'),
        sale_enabled: data.sale_enabled === 1 || data.sale_enabled === true,
        swap_enabled: data.swap_enabled === 1 || data.swap_enabled === true,
        preferred_book: data.preferred_book || '',
        preferred_genre: data.preferred_genre || '',
        accept_any_book: data.accept_any_book === 1 || data.accept_any_book === true,
        status: data.status || 'available'
      });
      
      if (data.cover_image && !data.cover_image.startsWith('/uploads') && !data.cover_image.includes('cloudinary')) {
        setMediaMode('url');
      }
    } catch (err) {
      toast.error('Failed to load book details');
      navigate('/my-listings');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUploaded = (urls) => {
    setFormData(prev => ({
      ...prev,
      cover_image: urls[0] || '',
      additional_images: urls.slice(1)
    }));
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!formData.title.trim()) return 'Book Title is required';
      if (!formData.author.trim()) return 'Author is required';
      if (!formData.genre) return 'Genre/Category is required';
      if (!formData.description.trim()) return 'Short description is required';
    }
    if (currentStep === 2) {
      if (!formData.price.trim() || isNaN(formData.price) || parseFloat(formData.price) < 0) {
        return 'Please input a valid price (₹0 or more)';
      }
    }
    if (currentStep === 3) {
      if (!formData.cover_image.trim()) {
        return 'Please provide or upload a cover image to continue';
      }
    }
    return null;
  };

  const nextStep = () => {
    const validationError = validateStep(step);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setStep(prev => Math.min(prev + 1, 5));
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    // Complete validation check
    for (let s = 1; s <= 4; s++) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        toast.error(`Error in Step ${s}: ${err}`);
        return;
      }
    }
    
    setLoading(true);
    try {
      if (isEditMode) {
        await api.put(`/books/${id}`, formData);
        toast.success('Book updated successfully!');
      } else {
        await api.post('/books', formData);
        toast.success('Book listed successfully!');
      }
      navigate('/my-listings');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving listing');
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
     { number: 1, label: 'Book Details', icon: <BookOpen size={16} /> },
     { number: 2, label: 'Pricing', icon: <DollarSign size={16} /> },
     { number: 3, label: 'Media', icon: <ImageIcon size={16} /> },
     { number: 4, label: 'Swap Options', icon: <ArrowRightLeft size={16} /> },
     { number: 5, label: 'Preview & Submit', icon: <Eye size={16} /> }
  ];

  return (
    <div className="pb-24 bg-white min-h-screen animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10">
        
        {/* Back navigation & header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 text-left">
           <div>
              <button onClick={() => navigate(-1)} className="flex items-center text-[10px] font-bold text-primary-600 uppercase tracking-widest gap-1 mb-2 hover:translate-x-[-3px] transition-transform">
                 <ChevronLeft size={14}/> Back
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                {isEditMode ? 'Edit Book Listing' : 'List a Book'}
              </h1>
              <p className="text-slate-400 text-xs font-semibold mt-1">
                {isEditMode ? 'Modify details of your marketplace listing' : 'Fill details below to put your pre-owned book for sale/swap.'}
              </p>
           </div>
           <div className="self-start sm:self-center flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-205 px-3.5 py-1.5 rounded-xl shadow-sm">
              <CheckCircle size={12} className="text-emerald-500"/> Verified Closet Listing
           </div>
        </div>

        {/* Stepper Progress bar Dashboard */}
        <div className="mb-10 select-none">
           <div className="flex items-center justify-between relative">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
              {/* Active fill line */}
              <div 
                className="absolute top-1/2 left-0 h-0.5 bg-primary-600 -translate-y-1/2 transition-all duration-300 z-0"
                style={{ width: `${((step - 1) / (stepsList.length - 1)) * 100}%` }}
              ></div>

              {stepsList.map(st => (
                 <button 
                   key={st.number}
                   disabled={st.number > step && validateStep(step) !== null}
                   onClick={() => setStep(st.number)}
                   className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-none"
                 >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border font-bold text-xs ${
                      step === st.number 
                        ? 'bg-primary-600 border-primary-600 text-white shadow-md shadow-primary-100 scale-105' 
                        : step > st.number
                        ? 'bg-primary-50 border-primary-600 text-primary-600'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-350'
                    }`}>
                       {step > st.number ? <CheckCircle size={14} className="text-primary-600" /> : st.icon}
                    </div>
                    <span className={`hidden md:block text-[9px] font-bold uppercase tracking-wider mt-2 transition-colors ${
                      step === st.number ? 'text-primary-600' : 'text-slate-400'
                    }`}>
                       {st.label}
                    </span>
                 </button>
              ))}
           </div>
        </div>

        {/* Form area */}
        <div className="border border-slate-100 rounded-2xl p-6 md:p-8 shadow-soft bg-white text-left">
           
           {/* STEP 1: Basic details */}
           {step === 1 && (
              <div className="space-y-6">
                 <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
                    <BookOpen size={18} className="text-primary-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Step 1: Book details Information</h3>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormGroup label="Book Title" required>
                       <input 
                         type="text" name="title" required value={formData.title} onChange={handleInputChange}
                         placeholder="e.g. The Psychology of Money" className="form-input-pro" 
                       />
                    </FormGroup>
                    <FormGroup label="Author" required>
                       <input 
                         type="text" name="author" required value={formData.author} onChange={handleInputChange}
                         placeholder="e.g. Morgan Housel" className="form-input-pro" 
                       />
                    </FormGroup>
                    <FormGroup label="Category / Genre" required>
                       <select name="genre" required value={formData.genre} onChange={handleInputChange} className="form-input-pro">
                          <option value="">Select a literary genre</option>
                          {Object.entries(
                            categories.reduce((acc, c) => {
                              const p = c.parent_category || 'Other';
                              if (!acc[p]) acc[p] = [];
                              acc[p].push(c);
                              return acc;
                            }, {})
                          ).map(([parent, list]) => (
                            <optgroup key={parent} label={parent}>
                              {list.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                            </optgroup>
                          ))}
                       </select>
                    </FormGroup>
                    <FormGroup label="ISBN Number (10/13 digit code)">
                       <input 
                         type="text" name="isbn" value={formData.isbn} onChange={handleInputChange}
                         placeholder="Optional e.g. 9789390166268" className="form-input-pro" 
                       />
                    </FormGroup>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormGroup label="Language">
                       <input 
                         type="text" name="language" value={formData.language} onChange={handleInputChange}
                         placeholder="e.g. English" className="form-input-pro" 
                       />
                    </FormGroup>
                    <FormGroup label="Publication Year">
                       <input 
                         type="number" name="publication_year" value={formData.publication_year} onChange={handleInputChange}
                         placeholder="e.g. 2021" className="form-input-pro" 
                       />
                    </FormGroup>
                    <FormGroup label="Publisher">
                       <input 
                         type="text" name="publisher" value={formData.publisher} onChange={handleInputChange}
                         placeholder="e.g. HarperCollins" className="form-input-pro" 
                       />
                    </FormGroup>
                 </div>

                 <FormGroup label="Short Description" required>
                    <textarea 
                      name="description" required value={formData.description} onChange={handleInputChange}
                      rows={4} placeholder="Describe the book condition, markings, missing pages, or contents details..." className="form-input-pro h-24 resize-none"
                    />
                 </FormGroup>

                 {/* Phase 9 AI Listing Optimizer */}
                 <div className="pt-2">
                    <AIListingOptimizer 
                      bookData={{ ...formData, id }} 
                      onApplyTitle={(t) => setFormData(prev => ({ ...prev, title: t }))}
                      onApplyDescription={(d) => setFormData(prev => ({ ...prev, description: d }))}
                    />
                 </div>
              </div>
           )}

           {/* STEP 2: Pricing Details */}
           {step === 2 && (
              <div className="space-y-6">
                 <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
                    <DollarSign size={18} className="text-primary-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Step 2: Listing pricing</h3>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormGroup label="List Price (₹)" required>
                       <input 
                         type="number" name="price" required value={formData.price} onChange={handleInputChange}
                         placeholder="e.g. 199 (For free books, input 0)" className="form-input-pro" 
                       />
                    </FormGroup>
                    <FormGroup label="Original MSRP Price (₹)">
                       <input 
                         type="number" name="original_price" value={formData.original_price} onChange={handleInputChange}
                         placeholder="e.g. 399 (Provides discount comparison badge)" className="form-input-pro" 
                       />
                    </FormGroup>
                 </div>

                 <FormGroup label="Book Condition Level" required>
                    <select name="condition" required value={formData.condition} onChange={handleInputChange} className="form-input-pro">
                       <option value="New">Brand New (Unwrapped/Excellent)</option>
                       <option value="Like New">Like New (No wear, no pencil notes)</option>
                       <option value="Good">Good (Minor binding wear, legible pages)</option>
                       <option value="Acceptable">Acceptable (Notes on pages, highly loved copy)</option>
                    </select>
                 </FormGroup>

                 <div className="bg-[#FAF9F6] rounded-xl p-4 border border-[#DCE2E8] flex items-start gap-2.5">
                    <CheckCircle className="text-primary-600 w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-stone-600 font-medium leading-relaxed">
                       Set your own price. Pricing pre-owned books between 40% to 60% of original store cost increases closet clearance and reader discovery.
                    </p>
                 </div>
              </div>
           )}

           {/* STEP 3: Media Photo Uploads */}
           {step === 3 && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                    <div className="flex items-center gap-2">
                       <ImageIcon size={18} className="text-primary-600" />
                       <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Step 3: Cover image upload</h3>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl">
                       <button
                         type="button"
                         onClick={() => setMediaMode('upload')}
                         className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${mediaMode === 'upload' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-450'}`}
                       >
                          <ImageIcon size={12} /> Local File
                       </button>
                       <button
                         type="button"
                         onClick={() => setMediaMode('url')}
                         className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${mediaMode === 'url' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-450'}`}
                       >
                          <LinkIcon size={12} /> External URL
                       </button>
                    </div>
                 </div>

                 {mediaMode === 'upload' ? (
                    <div>
                       <ImageUpload 
                         onUpload={handleImageUploaded} 
                         initialImages={formData.cover_image ? [formData.cover_image, ...formData.additional_images] : []} 
                       />
                       <p className="text-[9px] text-slate-400 font-semibold mt-2 text-center">First uploaded photo is set as main cover catalog representation</p>
                    </div>
                 ) : (
                    <FormGroup label="Cover URL input redirect" required>
                       <div className="flex gap-4 items-center">
                          <input 
                            type="url" name="cover_image" required={mediaMode === 'url'} value={formData.cover_image} onChange={handleInputChange}
                            placeholder="Paste image URL (Unsplash or direct image server link)" className="form-input-pro" 
                          />
                          <div className="w-12 h-12 rounded-xl border border-slate-205 overflow-hidden bg-slate-50 flex items-center justify-center text-slate-350 shrink-0 shadow-inner">
                             {formData.cover_image ? <img src={formData.cover_image} className="w-full h-full object-cover" /> : <LinkIcon size={14}/>}
                          </div>
                       </div>
                    </FormGroup>
                 )}
              </div>
           )}

           {/* STEP 4: Swap specifications */}
           {step === 4 && (
              <div className="space-y-6 text-left">
                 <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
                    <ArrowRightLeft size={18} className="text-primary-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Step 4: Community Book Swap Eligibility</h3>
                 </div>

                 <label className="flex items-start gap-3.5 cursor-pointer group p-5 bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl hover:border-primary-300 transition-colors">
                    <input 
                      type="checkbox" name="swap_enabled" checked={formData.swap_enabled} onChange={handleInputChange}
                      className="w-5 h-5 rounded border-stone-300 text-primary-600 focus:ring-primary-500/20 mt-0.5 cursor-pointer accent-primary-600" 
                    />
                    <div className="space-y-1">
                       <div className="text-sm font-bold text-slate-900 group-hover:text-primary-700 transition-colors">
                          Make this book available for swapping too
                       </div>
                       <p className="text-xs text-stone-500 leading-relaxed font-normal">
                          Allow fellow readers to propose exchanging one of their volumes for this copy. Your listing will appear in the Discover Swap Books marketplace while remaining available for direct purchase until swapped.
                       </p>
                    </div>
                 </label>

                 {formData.swap_enabled && (
                    <div className="p-5 bg-white border border-[#DCE2E8] rounded-xl space-y-5 animate-in fade-in duration-200">
                       <div className="flex items-center gap-2 text-xs font-bold text-primary-700 uppercase tracking-wider pb-2 border-b border-stone-100">
                          <ArrowRightLeft size={14} /> Exchange Preferences (Optional)
                       </div>

                       <FormGroup label="Specific book title you'd love in exchange">
                          <input 
                            type="text" name="preferred_book" value={formData.preferred_book} onChange={handleInputChange}
                            placeholder="e.g. The Midnight Library, Project Hail Mary, Clean Code" className="form-input-pro" 
                          />
                       </FormGroup>
                       
                       <FormGroup label="Preferred exchange genre or category">
                          <input 
                            type="text" name="preferred_genre" value={formData.preferred_genre} onChange={handleInputChange}
                            placeholder="e.g. High Fantasy, Psychological Thriller, Literary Fiction" className="form-input-pro" 
                          />
                       </FormGroup>

                       <label className="flex items-center gap-2.5 cursor-pointer block select-none pt-1">
                          <input 
                            type="checkbox" name="accept_any_book" checked={formData.accept_any_book} onChange={handleInputChange}
                            className="w-4 h-4 rounded border-stone-300 text-primary-600 accent-primary-600 focus:ring-primary-500" 
                          />
                          <span className="text-xs font-semibold text-stone-600">Open to any compelling book of equivalent literary value</span>
                       </label>
                    </div>
                 )}
              </div>
           )}

           {/* STEP 5: Summary Preview */}
           {step === 5 && (
              <div className="space-y-6">
                 <div className="flex items-center gap-2 pb-3 border-b border-slate-50">
                    <Eye size={18} className="text-primary-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Step 5: Catalog Preview</h3>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    {/* Cover Preview */}
                    <div className="flex justify-center items-center">
                       <div className="aspect-[3/4.2] w-full max-w-[200px] rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white p-3 flex items-center justify-center">
                          {formData.cover_image ? (
                             <img src={formData.cover_image} className="w-full h-full object-contain" alt="" />
                          ) : (
                             <span className="text-xs text-slate-400 font-bold">No cover image uploaded</span>
                          )}
                       </div>
                    </div>

                    {/* Meta Preview details */}
                    <div className="space-y-4">
                       <PreviewMetaItem label="Title" value={formData.title || 'N/A'} />
                       <PreviewMetaItem label="Author" value={formData.author || 'N/A'} />
                       <PreviewMetaItem label="Price" value={formatCurrency(formData.price || 0)} />
                       <PreviewMetaItem label="Condition" value={formData.condition} />
                       <PreviewMetaItem label="Genre/Category" value={formData.genre || 'Not selected'} />
                       <PreviewMetaItem label="Swap barter Enabled" value={formData.swap_enabled ? 'Yes swaps active' : 'Sale only'} />
                    </div>
                 </div>
              </div>
           )}

           {/* Stepper Navigation Buttons */}
           <div className="flex justify-between items-center border-t border-slate-50 pt-6 mt-8">
              {step > 1 ? (
                 <button 
                   type="button" 
                   onClick={prevStep}
                   className="bg-white border border-slate-205 hover:bg-slate-50 text-slate-650 h-10 px-5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors text-xs active:scale-[0.98]"
                 >
                    <ChevronLeft size={14}/> Back
                 </button>
              ) : (
                 <div></div>
              )}

              {step < 5 ? (
                 <button 
                   type="button" 
                   onClick={nextStep}
                   className="bg-primary-600 hover:bg-primary-750 text-white h-10 px-6 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors text-xs active:scale-[0.98]"
                 >
                    Next <ChevronRight size={14} />
                 </button>
              ) : (
                 <button 
                   type="button" 
                   onClick={handleSubmit}
                   disabled={loading}
                   className="bg-primary-600 hover:bg-primary-750 text-white h-11 px-8 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs shadow-md shadow-primary-100 disabled:bg-slate-200 active:scale-[0.98]"
                 >
                    {loading ? 'Publishing...' : isEditMode ? 'Save Edits' : 'Publish Book Listing'}
                 </button>
              )}
           </div>

        </div>
      </div>
    </div>
  );
};

const FormGroup = ({ label, children, required }) => (
  <div className="flex flex-col gap-1.5">
     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {label} {required && <span className="text-red-500">*</span>}
     </label>
     {children}
  </div>
);

const PreviewMetaItem = ({ label, value }) => (
  <div className="border-b border-slate-100 pb-2">
     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">{label}</span>
     <span className="text-xs font-bold text-slate-800 block line-clamp-1">{value}</span>
  </div>
);

export default Sell;
