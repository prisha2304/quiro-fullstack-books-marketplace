const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { 
    chat, 
    visualSearch, 
    handleAction, 
    compare, 
    getInsights, 
    getSellerInsights, 
    getProactiveTip, 
    dismissAlert, 
    getHistory, 
    clearHistory 
} = require('../controllers/aiController');

const {
    sellerCopilot,
    optimizeListing,
    priceInsight,
    inventoryForecast,
    fulfillmentInsight,
    reviewSummary,
    sellerReviewSummary,
    supportAssistant,
    adminOperations,
    marketplaceHealth,
    getAnomalies,
    scanAnomalies,
    applyAction,
    getActivityLogs
} = require('../controllers/aiMarketplaceOperationsController');

// Multer memory storage with 5MB cap & MIME validation
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid image type. Only JPG, PNG, and WEBP are supported.'));
        }
    }
});

// Optional authentication middleware that extracts user info
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = decoded;
        } catch (e) {
            req.user = null;
        }
    }
    next();
};

router.use(optionalAuth);

// Existing NestAI endpoints (Preserved)
router.post('/chat', chat);
router.post('/visual-search', upload.single('image'), visualSearch);
router.post('/action', handleAction);
router.post('/compare', compare);
router.get('/insights', getInsights);
router.get('/seller-insights', getSellerInsights);
router.get('/proactive-tip', getProactiveTip);
router.post('/alerts/dismiss', dismissAlert);
router.get('/history', getHistory);
router.delete('/history', clearHistory);

// Phase 9: AI Marketplace Operations Endpoints
router.post('/seller/copilot', sellerCopilot);
router.post('/listing/optimize', optimizeListing);
router.post('/pricing/insight', priceInsight);
router.post('/inventory/forecast', inventoryForecast);
router.post('/fulfillment/insight', fulfillmentInsight);
router.get('/reviews/summary/:bookId', reviewSummary);
router.get('/seller/reviews/summary', sellerReviewSummary);
router.post('/support', supportAssistant);
router.post('/admin/operations', adminOperations);
router.get('/marketplace-health', marketplaceHealth);
router.get('/anomalies', getAnomalies);
router.post('/anomalies/scan', scanAnomalies);
router.post('/action/apply', applyAction);
router.get('/activity', getActivityLogs);

module.exports = router;
