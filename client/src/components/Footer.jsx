import { Link } from 'react-router-dom';
import { 
  Github, 
  Twitter, 
  Instagram, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Truck, 
  RefreshCw,
  Heart,
  Sparkles
} from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-[#FAF9F6] border-t border-[#DCE2E8] mt-auto text-left">
      {/* Tagline Callout Banner */}
      <div className="bg-[#35152F] text-white py-6 border-b border-[#2A1025]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E5A323] animate-pulse"></span>
            <p className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#FAF9F6]">
              "Your Next Chapter Could Be Someone's First."
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/browse" 
              className="text-xs font-bold bg-[#E5A323] hover:bg-[#C78814] text-[#35152F] px-4 py-2 rounded-xl transition-all shadow-xs"
            >
              Explore Books
            </Link>
            <Link 
              to="/sell" 
              className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl transition-all"
            >
              Sell Books
            </Link>
          </div>
        </div>
      </div>

      {/* Upper Content: Main Navigation Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 justify-between">
        
        {/* Brand Column */}
        <div className="lg:col-span-2 max-w-sm">
          <Link to="/" className="inline-block mb-3 select-none">
            <img 
              src="/quiro-logo.png" 
              alt="QUIRO" 
              className="h-11 sm:h-12 w-auto max-w-[150px] object-contain" 
            />
          </Link>
          <p className="text-stone-600 text-xs font-medium leading-relaxed mb-6">
            Your Next Chapter Could Be Someone's First. QUIRO is India's dedicated marketplace for book lovers, students, and collectors to buy, sell, and exchange pre-loved books with complete buyer protection and secure checkout.
          </p>
          <div className="flex items-center gap-3">
             <SocialLink icon={<Twitter size={15}/>} label="Twitter" />
             <SocialLink icon={<Instagram size={15}/>} label="Instagram" />
             <SocialLink icon={<Github size={15}/>} label="Github" />
          </div>
        </div>

        {/* Explore Genres */}
        <div>
           <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-4">Explore Genres</h4>
           <ul className="space-y-2.5">
              <FooterLink to="/browse">All Catalog Books</FooterLink>
              <FooterLink to="/browse?category=Fiction">Fiction &amp; Literature</FooterLink>
              <FooterLink to="/browse?category=Romance">Romance &amp; Fantasy</FooterLink>
              <FooterLink to="/browse?category=Mystery">Mystery &amp; Thriller</FooterLink>
              <FooterLink to="/browse?category=Academic and Textbooks">Academic &amp; Professional</FooterLink>
              <FooterLink to="/swaps">Community Book Swaps</FooterLink>
           </ul>
        </div>

        {/* Marketplace Links */}
        <div>
           <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-4">Marketplace</h4>
           <ul className="space-y-2.5">
              <FooterLink to="/sell">Sell Your Books</FooterLink>
              <FooterLink to="/swaps">Propose an Exchange</FooterLink>
              <FooterLink to="/dashboard">Seller Studio</FooterLink>
              <FooterLink to="/cart">My Reading Bag</FooterLink>
              <FooterLink to="/wishlist">Saved Stories</FooterLink>
              <FooterLink to="/orders">Order History</FooterLink>
           </ul>
        </div>

        {/* Contact Column */}
        <div>
           <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest mb-4">Contact &amp; Care</h4>
           <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-xs text-stone-600 font-medium hover:text-primary-600 cursor-pointer transition-colors">
                 <Mail size={14} className="text-primary-600 shrink-0" />
                 support@quiro.in
              </li>
              <li className="flex items-center gap-2.5 text-xs text-stone-600 font-medium hover:text-primary-600 cursor-pointer transition-colors">
                 <Phone size={14} className="text-primary-600 shrink-0" />
                 +91 (800) 420-BOOK
              </li>
              <li className="flex items-start gap-2.5 text-xs text-stone-600 font-medium leading-relaxed">
                 <MapPin size={14} className="text-primary-600 mt-0.5 shrink-0" />
                 <span>QUIRO Books Hub, Banjara Hills,<br />Hyderabad, Telangana 500034</span>
              </li>
           </ul>
        </div>

      </div>

      {/* Trust & Copyright Area */}
      <div className="bg-[#EEF2F6] py-6 border-t border-[#DCE2E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex flex-wrap items-center gap-5 text-[9px] font-bold text-stone-600 uppercase tracking-widest">
              <div className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-primary-600"/> Verified Book Deliveries</div>
              <div className="flex items-center gap-1.5"><RefreshCw size={13} className="text-primary-600"/> Peer-to-Peer Swaps</div>
              <div className="flex items-center gap-1.5"><Truck size={13} className="text-primary-600"/> Pan-India Community</div>
           </div>
           
           <div className="flex flex-col items-center md:items-end gap-1.5">
              <p className="text-xs text-stone-600 font-medium flex items-center gap-1">
                 &copy; {new Date().getFullYear()} QUIRO. Crafted with <Heart size={11} className="text-[#E5A323] fill-[#E5A323]" /> for passionate readers.
              </p>
              <div className="flex gap-4">
                 <Link to="/browse" className="text-[9px] font-bold text-stone-500 uppercase tracking-widest hover:text-primary-700 transition-colors">Browse Books</Link>
                 <Link to="/swaps" className="text-[9px] font-bold text-stone-500 uppercase tracking-widest hover:text-primary-700 transition-colors">Book Swaps</Link>
                 <Link to="/sell" className="text-[9px] font-bold text-stone-500 uppercase tracking-widest hover:text-primary-700 transition-colors">Sell Books</Link>
              </div>
           </div>
        </div>
      </div>
    </footer>
  );
};

const FooterLink = ({ to, children }) => (
  <li>
     <Link to={to} className="text-xs text-stone-600 font-medium hover:text-primary-600 transition-colors">
        {children}
     </Link>
  </li>
);

const SocialLink = ({ icon, label }) => (
  <button aria-label={label} className="w-8 h-8 rounded-lg bg-white border border-[#DCE2E8] text-stone-600 hover:text-primary-600 hover:border-primary-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs">
     {icon}
  </button>
);

export default Footer;
