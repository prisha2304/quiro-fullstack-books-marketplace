
const fs = require('fs');
const path = require('path');
const cloudinary = require('../config/cloudinary');
const environment = require('../config/environment');
const logger = require('./logger');

class MediaStorageService {
    constructor() {
        this.uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    getStorageStatus() {
        return environment.getStorageConfig();
    }

    async uploadImage(fileBuffer, originalName, { folder = 'booknest_books' } = {}) {
        const storageConfig = this.getStorageStatus();

        // 1. Cloudinary Upload if configured
        if (storageConfig.isCloudinaryConfigured && cloudinary && cloudinary.uploader) {
            try {
                return await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        { folder, resource_type: 'image' },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve({
                                provider: 'CLOUDINARY',
                                url: result.secure_url,
                                publicId: result.public_id,
                                format: result.format
                            });
                        }
                    );
                    uploadStream.end(fileBuffer);
                });
            } catch (err) {
                logger.warn('Cloudinary upload failed, falling back to local disk storage', { error: err.message });
            }
        }

        // 2. Safe Local Storage Fallback
        const ext = path.extname(originalName) || '.jpg';
        const uniqueName = `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const localPath = path.join(this.uploadDir, uniqueName);
        fs.writeFileSync(localPath, fileBuffer);

        return {
            provider: 'LOCAL_DISK',
            url: `/uploads/${uniqueName}`,
            fileName: uniqueName,
            localPath
        };
    }

    async deleteImage(identifier) {
        const storageConfig = this.getStorageStatus();
        if (!identifier) return { deleted: false, reason: 'Empty identifier' };

        if (storageConfig.isCloudinaryConfigured && !identifier.startsWith('/uploads/')) {
            try {
                await cloudinary.uploader.destroy(identifier);
                return { deleted: true, provider: 'CLOUDINARY' };
            } catch (err) {
                logger.error('Failed to delete image from Cloudinary', { error: err.message });
            }
        }

        // Local deletion
        const baseName = path.basename(identifier);
        const localPath = path.join(this.uploadDir, baseName);
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            return { deleted: true, provider: 'LOCAL_DISK' };
        }

        return { deleted: false, reason: 'File not found on local disk' };
    }

    getImageUrl(storedPath) {
        if (!storedPath) return '/placeholder-book.png';
        if (storedPath.startsWith('http://') || storedPath.startsWith('https://')) {
            return storedPath;
        }
        return storedPath.startsWith('/') ? storedPath : `/${storedPath}`;
    }
}

module.exports = new MediaStorageService();
