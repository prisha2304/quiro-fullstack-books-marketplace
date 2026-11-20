import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Sparkles, Image as ImageIcon, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const AIBookImageSearch = ({ onSearchComplete, onClose }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedImage(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || uploading) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      const res = await api.post('/ai/visual-search', formData);
      onSearchComplete(res.data);
      handleRemoveImage();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Visual search failed. Try a clearer front cover.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 p-4 space-y-3 animate-in slide-in-from-top-2 duration-150 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
            <Camera size={14} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">
              📷 Visual Book Discovery
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">Upload or snap a textbook cover to search</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          aria-label="Close image search"
        >
          <X size={15} />
        </button>
      </div>

      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {/* Dropzone / Preview */}
      {!previewUrl ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center gap-2.5 ${
            dragActive ? 'border-primary-600 bg-primary-50/50' : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <ImageIcon size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">Drag and drop book cover here</p>
            <p className="text-[10px] text-slate-400 font-medium">JPG, PNG or WEBP up to 5MB</p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Upload size={12} />
              <span>Upload Image</span>
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Camera size={12} />
              <span>Take Photo</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 max-h-48 flex items-center justify-center">
            <img src={previewUrl} alt="Cover Preview" className="max-h-48 w-auto object-contain" />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-rose-600 text-white rounded-full transition-all cursor-pointer"
              title="Remove image"
            >
              <X size={13} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={uploading}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {uploading ? (
              <>
                <Sparkles size={13} className="animate-spin" />
                <span>Identifying book cover with AI...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Identify &amp; Find on QUIRO</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default AIBookImageSearch;
