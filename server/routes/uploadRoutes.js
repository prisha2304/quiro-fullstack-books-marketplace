const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { upload, cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');
const logger = require('../services/logger');

const CLOUDINARY_UPLOAD_OPTIONS = {
  folder: 'booknest',
  allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
  resource_type: 'image'
};

// 1x1 transparent PNG used only for the 403 diagnostic probe (never user file contents).
const DIAGNOSTIC_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function sanitizeDiagnosticSnippet(rawBody, contentType) {
  if (!rawBody) return '';
  let text = String(rawBody);
  if (contentType && contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) {
        text = String(parsed.error.message);
      }
    } catch {
      // Fall back to truncated raw text
    }
  }
  const cfg = cloudinary.config();
  for (const secretVal of [cfg.api_secret, cfg.api_key]) {
    if (secretVal && typeof secretVal === 'string') {
      text = text.split(secretVal).join('[REDACTED]');
    }
  }
  text = text.replace(/(api_secret|api_key|signature|token|authorization)=([^\s&"']+)/gi, '$1=[REDACTED]');
  return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}

// Captures the actual HTTP response body from Cloudinary's upload endpoint when
// cloudinary.uploader.upload_stream discards it on HTTP 403 (UnexpectedResponse).
async function probeCloudinaryUpload403() {
  const uploadUrl = cloudinary.utils.api_url('upload', { resource_type: 'image' });
  const signedParams = cloudinary.utils.sign_request(
    cloudinary.utils.build_upload_params(CLOUDINARY_UPLOAD_OPTIONS),
    {}
  );

  const form = new FormData();
  for (const [key, value] of Object.entries(signedParams)) {
    if (value != null) form.append(key, String(value));
  }
  const pngBuffer = Buffer.from(DIAGNOSTIC_PNG_BASE64, 'base64');
  form.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'diagnostic.png');

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(8000)
  });

  const contentType = response.headers.get('content-type') || undefined;
  const xCldError = response.headers.get('x-cld-error') || undefined;
  const rawBody = await response.text();

  logger.error('Cloudinary upload endpoint 403 diagnostic', {
    status: response.status,
    contentType,
    xCldError,
    bodySnippet: sanitizeDiagnosticSnippet(rawBody, contentType)
  });
}

// Streams a file buffer to Cloudinary and resolves with the secure URL.
// Mirrors the established pattern in mediaStorageService.js.
function uploadToCloudinary(buffer, originalname) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      CLOUDINARY_UPLOAD_OPTIONS,
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
      // Log safe diagnostic fields only — never log secrets, credentials, file contents, or tokens.
      logger.error('Upload failed after multer parse', {
        name: error?.name,
        errorMessage: error?.message,
        http_code: error?.http_code,
        error: typeof error?.error === 'string'
          ? error.error
          : error?.error?.message || undefined
      });

      if (error?.http_code === 403 && isCloudinaryConfigured) {
        try {
          await probeCloudinaryUpload403();
        } catch (probeErr) {
          logger.error('Cloudinary upload endpoint 403 diagnostic failed', {
            name: probeErr?.name,
            errorMessage: probeErr?.message
          });
        }
      }

      res.status(500).json({ message: 'Upload failed. Please try again.' });
    }
  });
});

module.exports = router;
