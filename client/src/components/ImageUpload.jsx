import { useState, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ImageUpload = ({ onUpload, initialImages = [] }) => {
  const [images, setImages] = useState(initialImages);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (images.length + files.length > 5) {
      toast.error('You can only upload up to 5 images');
      return;
    }

    // Validation
    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    setIsUploading(true);
    const formData = new FormData();
    validFiles.forEach(file => formData.append('images', file));

    try {
      const { data } = await api.post('/upload', formData);
      const newImages = [...images, ...data.urls];
      setImages(newImages);
      onUpload(newImages);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload images. Check console for details.');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (indexToRemove) => {
    const newImages = images.filter((_, index) => index !== indexToRemove);
    setImages(newImages);
    onUpload(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {images.map((url, index) => (
          <div key={index} className="relative aspect-square card overflow-hidden group">
            <img src={url} alt={`Upload ${index}`} className="w-full h-full object-cover" />
            <button
              onClick={() => removeImage(index)}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
            {index === 0 && (
              <span className="absolute bottom-0 left-0 right-0 bg-primary-600/80 text-white text-[10px] font-bold py-1 text-center">
                COVER IMAGE
              </span>
            )}
          </div>
        ))}

        {images.length < 5 && (
          <label className="relative aspect-square card border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all group">
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-300 group-hover:text-primary-600" />
                <span className="text-xs text-slate-400 mt-2 font-medium">Add Images</span>
              </>
            )}
          </label>
        )}
      </div>
      <p className="text-xs text-slate-400">
        You can upload up to 5 images. The first image will be used as the cover. Max 5MB each.
      </p>
    </div>
  );
};

export default ImageUpload;
