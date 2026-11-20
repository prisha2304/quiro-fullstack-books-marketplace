import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OptimizedImage from './OptimizedImage';

const ImageGallery = ({ images = [] }) => {
  const validImages = images.filter(Boolean);
  const [activeImage, setActiveImage] = useState(validImages[0] || '');

  if (validImages.length === 0) return (
    <div className="card aspect-[3/4] bg-slate-100 flex items-center justify-center rounded-[32px] overflow-hidden p-6">
       <OptimizedImage src="" alt="Book Cover" className="w-full h-full object-contain" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="card aspect-[3/4] overflow-hidden rounded-[32px] shadow-2xl shadow-primary-100 group relative bg-slate-50 flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeImage || 'default'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full flex items-center justify-center"
          >
            <OptimizedImage 
              src={activeImage} 
              alt="Book Cover"
              className="w-full h-full object-contain"
            />
          </motion.div>
        </AnimatePresence>
      </div>
      
      {validImages.length > 1 && (
        <div className="flex flex-wrap gap-4">
          {validImages.map((img, i) => (
            <button 
              key={i}
              onClick={() => setActiveImage(img)}
              className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all p-1 bg-white cursor-pointer ${
                activeImage === img ? 'border-primary-600 scale-105 shadow-lg' : 'border-slate-100 opacity-60 hover:opacity-100'
              }`}
            >
              <OptimizedImage src={img} alt="" className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
