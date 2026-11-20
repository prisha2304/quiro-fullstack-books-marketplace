const express = require('express');
const router = express.Router();
const { 
    getGenreRecommendations,
    getCoPurchaseRecommendations,
    getPersonalizedRecommendations,
    getUserProfileAnalytics,
    getSuggestions, 
    getRecentActivity,
    mergeGuestHistory
} = require('../controllers/recommendationController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

// Public & hybrid recommendation endpoints
router.get('/genre/:bookId', getGenreRecommendations);
router.get('/co-purchase/:bookId', getCoPurchaseRecommendations);
router.get('/suggestions', getSuggestions);
router.get('/personalized', optionalAuth, getPersonalizedRecommendations);

// Authenticated personalized endpoints
router.get('/profile', protect, getUserProfileAnalytics);
router.get('/recent', protect, getRecentActivity);
router.post('/merge-guest-history', protect, mergeGuestHistory);

module.exports = router;
