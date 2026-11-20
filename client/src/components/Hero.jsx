import { useState } from 'react';
import { ArrowRight, Search, ShieldCheck, RefreshCw, BookOpen, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Hero = () => {
  const navigate = useNavigate();
  const [heroSearch, setHeroSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (heroSearch.trim()) params.append('search', heroSearch.trim());
    if (selectedCategory) params.append('category', selectedCategory);
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <div className="relative pt-12 pb-12 sm:pt-16 sm:pb-16 lg:pt-16 lg:pb-20 bg-[#FAF9F6] border-b border-[#DCE2E8] overflow-hidden text-left">
      
      {/* Subtle Warm Background Accent Gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#35152F]/5 rounded-full blur-3xl pointer-events-none -translate-y-36 translate-x-36"></div>
      <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-[#E5A323]/10 rounded-full blur-3xl pointer-events-none translate-y-36 -translate-x-36"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column (7 cols): Editorial Typography, Search Bar & Value Props */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* QUIRO Badge */}
            <div className="inline-flex items-center gap-2.5 bg-white border border-[#DCE2E8] px-4 py-1.5 rounded-full shadow-2xs backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-[#E5A323]"></span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#35152F]">
                QUIRO Book Marketplace &amp; Exchange
              </span>
            </div>

            {/* Main Headline Featuring the Official Tagline */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#35152F] leading-[1.12]">
              Your Next Chapter <br className="hidden sm:inline" />
              <span className="text-[#E5A323] italic font-serif">Could Be Someone's First.</span>
            </h1>

            {/* Supporting Text */}
            <p className="text-sm sm:text-base text-stone-600 font-medium leading-relaxed max-w-xl">
              Discover your next favourite read, find affordable textbooks, sell books you've finished, or exchange stories with fellow readers across India on QUIRO.
            </p>

            {/* Quick Search & Genre Filter Bar */}
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row bg-white border border-[#DCE2E8] p-1.5 rounded-2xl shadow-soft max-w-xl transition-all focus-within:border-[#E5A323] focus-within:ring-2 focus-within:ring-[#E5A323]/25">
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#FAF9F6] text-xs font-semibold text-stone-700 px-3 py-3 sm:py-0 sm:h-12 rounded-xl border border-[#DCE2E8] outline-none cursor-pointer sm:w-44 mb-2 sm:mb-0 transition-colors"
              >
                <option value="">All Genres</option>
                <option value="Fiction">Fiction &amp; Literature</option>
                <option value="Romance">Romance &amp; Fantasy</option>
                <option value="Mystery">Mystery &amp; Thriller</option>
                <option value="Self Help">Self-Help &amp; Growth</option>
                <option value="Biography">Biography &amp; Memoirs</option>
                <option value="Academic and Textbooks">Academic Textbooks</option>
                <option value="Computer Science">Computer Science</option>
              </select>

              <div className="flex-grow flex items-center px-3.5 gap-2 bg-transparent h-12">
                <Search size={16} className="text-stone-400 shrink-0" />
                <input 
                  type="text" 
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                  placeholder="Search novels, authors, or ISBN..." 
                  className="w-full bg-transparent border-none outline-none text-xs font-medium text-slate-800 placeholder:text-stone-500"
                />
              </div>

              <button 
                type="submit"
                className="bg-[#35152F] hover:bg-[#2A1025] text-white px-6 py-2.5 sm:h-12 rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-[0.98] shrink-0 cursor-pointer flex items-center justify-center"
              >
                Explore
              </button>
            </form>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link 
                to="/browse" 
                className="bg-[#35152F] hover:bg-[#2A1025] text-white px-6 py-3.5 rounded-xl font-bold text-xs transition-all shadow-editorial flex items-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                <span>Explore Books</span>
                <ArrowRight size={14} className="text-[#E5A323]" />
              </Link>
              
              <Link 
                to="/sell" 
                className="bg-white hover:bg-stone-50 text-[#35152F] border border-[#DCE2E8] px-6 py-3.5 rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
              >
                Sell Your Books
              </Link>

              <Link 
                to="/swaps" 
                className="bg-[#EEF2F6] hover:bg-[#DCE2E8] text-[#35152F] border border-[#DCE2E8] px-5 py-3.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} className="text-[#E5A323]" />
                <span>Exchange Stories</span>
              </Link>
            </div>

            {/* Community Metrics Bar */}
            <div className="grid grid-cols-3 gap-4 pt-5 border-t border-[#DCE2E8] max-w-lg text-left">
              <div>
                <span className="block font-serif text-lg sm:text-xl font-bold text-[#35152F]">500+</span>
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mt-0.5">Books Listed</span>
              </div>
              <div>
                <span className="block font-serif text-lg sm:text-xl font-bold text-[#35152F]">100%</span>
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mt-0.5">Secure Checkout</span>
              </div>
              <div>
                <span className="block font-serif text-lg sm:text-xl font-bold text-[#E5A323]">40+</span>
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block mt-0.5">Literary Genres</span>
              </div>
            </div>

          </div>

          {/* Right Column (5 cols): Bookstore & Library Composition Graphic with QUIRO Brand Badge */}
          <div className="lg:col-span-5 relative select-none">
            <div className="bg-white border border-[#DCE2E8] rounded-2xl p-4 sm:p-5 shadow-lg shadow-[#35152F]/[0.06] relative overflow-hidden">
              
              {/* QUIRO Brand Header in Card */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#DCE2E8]">
                <img 
                  src="/quiro-logo.png" 
                  alt="QUIRO" 
                  className="h-8 w-auto object-contain" 
                />
                <span className="text-[10px] font-bold text-[#35152F] uppercase tracking-wider bg-[#FAF9F6] border border-[#DCE2E8] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A323]"></span> Official Marketplace
                </span>
              </div>

              {/* High Quality Local Bookstore Illustration */}
              <div className="aspect-[1.32/1] rounded-xl overflow-hidden border border-[#DCE2E8] relative bg-[#FAF9F6]">
                <img 
                  src="/hero-library.svg" 
                  alt="QUIRO Bookstore Library Archive" 
                  className="w-full h-full object-cover scale-[1.06] transition-transform duration-300"
                />
              </div>

              {/* Value Highlights Cards */}
              <div className="grid grid-cols-2 gap-3 mt-4 items-stretch">
                <div className="bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl p-3 text-left h-full flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-[#35152F] font-bold text-xs mb-0.5">
                    <RefreshCw size={13} className="text-[#E5A323] shrink-0" />
                    <span>Book Swapping</span>
                  </div>
                  <p className="text-[10px] text-stone-500 font-medium leading-relaxed">Trade books directly without transaction fees or cash barriers.</p>
                </div>

                <div className="bg-[#FAF9F6] border border-[#DCE2E8] rounded-xl p-3 text-left h-full flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-[#35152F] font-bold text-xs mb-0.5">
                    <ShieldCheck size={13} className="text-[#E5A323] shrink-0" />
                    <span>Secure Transactions</span>
                  </div>
                  <p className="text-[10px] text-stone-500 font-medium leading-relaxed">Safe payments and verified reader book condition ratings.</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Hero;
