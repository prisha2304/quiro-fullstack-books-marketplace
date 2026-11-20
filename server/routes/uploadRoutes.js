const express = require('express');
const router = express.Router();
const { upload, isCloudinaryConfigured } = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, (req, res) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const urls = req.files.map(file => {
        if (isCloudinaryConfigured) {
          return file.path;
        } else {
          return `http://localhost:5000/uploads/${file.filename}`;
        }
      });
      res.json({ urls });
    } catch (error) {
      res.status(500).json({ message: 'Upload failed', error: error.message });
    }
  });
});

module.exports = router;
