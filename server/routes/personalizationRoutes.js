const express = require('express');
const router = express.Router();
const {
    createPriceAlert,
    removePriceAlert,
    subscribeStockAlert,
    removeStockAlert,
    trackRecentlyViewed,
    getRecentlyViewed,
    clearRecentlyViewed,
    recordSearch,
    getSearchHistory,
    deleteSearchItem,
    clearSearchHistory,
    followSeller,
    unfollowSeller,
    getFollowedSellers,
    getBookSocialProof,
    getUserReadingProfile,
    getUserAchievements,
    getPersonalizedHomepage
} = require('../controllers/personalizationController');
const { protect } = require('../middleware/authMiddleware');

// Public / Optional Auth
router.get('/homepage', (req, res, next) => {
    // Optional token handling
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
        return protect(req, res, next);
    }
    next();
}, getPersonalizedHomepage);

router.get('/books/:bookId/social-proof', getBookSocialProof);
router.post('/recently-viewed/:bookId', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
        return protect(req, res, next);
    }
    next();
}, trackRecentlyViewed);

// Authenticated Endpoints
router.use(protect);

// Price & Stock Alerts
router.post('/alerts/price', createPriceAlert);
router.delete('/alerts/price/:bookId', removePriceAlert);
router.post('/alerts/stock', subscribeStockAlert);
router.delete('/alerts/stock/:bookId', removeStockAlert);

// Recently Viewed
router.get('/recently-viewed', getRecentlyViewed);
router.delete('/recently-viewed', clearRecentlyViewed);

// Search History
router.get('/search/history', getSearchHistory);
router.post('/search/history', recordSearch);
router.delete('/search/history/:id', deleteSearchItem);
router.delete('/search/history', clearSearchHistory);

// Seller Follows
router.post('/follow/:sellerId', followSeller);
router.delete('/follow/:sellerId', unfollowSeller);
router.get('/following', getFollowedSellers);

// Reading Profile & Achievements
router.get('/profile/reading', getUserReadingProfile);
router.get('/profile/achievements', getUserAchievements);

module.exports = router;
