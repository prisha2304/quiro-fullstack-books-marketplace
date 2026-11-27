const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { upload, cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');
const logger = require('../services/logger');

// Streams a file buffer to Cloudinary and resolves with the secure URL.
// Mirrors the established pattern in mediaStorageService.js.
function uploadToCloudinary(buffer, originalname) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'booknest',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
        resource_type: 'image'
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// Saves a buffer to local disk and returns a relative URL.
// Used when Cloudinary is not configured (local development).
function saveToLocalDisk(buffer, originalname) {
  const uploadDir = path.join(__dirname, '../public/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const ext = path.extname(originalname) || '.jpg';
  const uniqueName = `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const localPath = path.join(uploadDir, uniqueName);
  fs.writeFileSync(localPath, buffer);
  return `/uploads/${uniqueName}`;
}

// POST /api/upload
// Accepts up to 5 images (multipart/form-data, field name: "images").
// Returns { urls: string[] } matching the contract expected by ImageUpload.jsx.
router.post('/', protect, (req, res) => {
  upload.array('images', 5)(req, res, async (err) => {
    if (err) {
      // Covers multer file-type/size rejections (MulterError) and fileFilter errors
      logger.warn('Upload rejected by multer', { message: err.message });
      return res.status(400).json({ message: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    try {
      // Process all files concurrently. Each file.buffer is populated by memoryStorage.
      const urls = await Promise.all(
        req.files.map(file =>
          isCloudinaryConfigured
            ? uploadToCloudinary(file.buffer, file.originalname)
            : saveToLocalDisk(file.buffer, file.originalname)
        )
      );
      res.json({ urls });
    } catch (error) {
      // Cloudinary credential/network errors arrive here.
      // Log the message only — never log the secret or full config object.
      logger.error('Upload failed after multer parse', { message: error.message });
      res.status(500).json({ message: 'Upload failed. Please try again.' });
    }
  });
});

module.exports = router;
