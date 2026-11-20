import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { motion } from 'framer-motion';

const NotFound = () => {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <div className="text-center">
        <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           className="mb-8"
        >
          <h1 className="text-9xl font-black text-slate-200">404</h1>
          <p className="text-2xl font-bold text-slate-900 -mt-12">Oops! Book not found.</p>
        </motion.div>
        
        <p className="text-slate-500 mb-10 max-w-md mx-auto">
          The page you are looking for might have been moved, deleted, or never existed in our library.
        </p>

        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <Link to="/" className="btn-primary flex items-center justify-center px-8 py-3">
            <Home className="w-5 h-5 mr-2" /> Back to Home
          </Link>
          <Link to="/browse" className="btn-secondary flex items-center justify-center px-8 py-3">
            <Search className="w-5 h-5 mr-2" /> Search Books
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
