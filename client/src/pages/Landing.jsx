import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ShieldCheck, Zap, Star } from 'lucide-react';
import { motion } from 'framer-motion';

const Landing = () => {
  return (
    <div className="relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      
      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm font-semibold mb-6 inline-block">
              QUIRO — Your Next Chapter Could Be Someone's First.
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 tracking-tight">
              Borrow, Swap & <br/> 
              <span className="gradient-text">Own Your Library</span>
            </h1>
            <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
              Join thousands of book lovers in the ultimate marketplace for new and pre-loved books. 
              Buy at great prices, sell your collection, or swap with fellow readers.
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link to="/register" className="btn-primary text-lg px-8 py-3 flex items-center justify-center">
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link to="/browse" className="btn-secondary text-lg px-8 py-3 flex items-center justify-center">
                Browse Collection
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <FeatureCard 
              icon={<Zap className="w-8 h-8 text-amber-500" />}
              title="Fast Selling"
              description="List your books in seconds using our automated ISBN lookup and get discovered by buyers instantly."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-8 h-8 text-green-500" />}
              title="Secure Swaps"
              description="Our verified swap system ensures you get exactly what you requested with full tracking and trust."
            />
            <FeatureCard 
              icon={<BookOpen className="w-8 h-8 text-primary-600" />}
              title="Infinite Library"
              description="Access a diverse collection of genres from local sellers. Your next favorite book is just a click away."
            />
          </div>
        </div>
      </section>

      {/* Stats/Social Proof */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <StatItem value="10k+" label="Books Listed" />
          <StatItem value="5k+" label="Happy Readers" />
          <StatItem value="2k+" label="Daily Swaps" />
          <StatItem value="4.9/5" label="User Rating" />
        </div>
      </section>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }) => (
  <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
    <div className="mb-6 p-3 bg-white w-fit rounded-2xl shadow-sm">{icon}</div>
    <h3 className="text-xl font-bold mb-4 text-slate-900">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

const StatItem = ({ value, label }) => (
  <div>
    <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
    <div className="text-slate-500 font-medium">{label}</div>
  </div>
);

export default Landing;
