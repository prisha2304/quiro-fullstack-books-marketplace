const express = require('express');
const router = express.Router();
const { 
    getOverview, 
    getRevenueTrends, 
    getCategories, 
    getBooks, 
    getSellers, 
    getSellerAnalytics, 
    getInventoryHealth, 
    getFunnel, 
    getCustomers, 
    exportReport,
    aiInterpret
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

// Seller & Admin Protected
router.get('/seller-analytics', protect, getSellerAnalytics);
router.get('/inventory', protect, getInventoryHealth);
router.get('/books', protect, getBooks);
router.get('/export', protect, exportReport);

// Admin-Only Routes
router.get('/overview', protect, admin, getOverview);
router.get('/revenue', protect, admin, getRevenueTrends);
router.get('/categories', protect, admin, getCategories);
router.get('/sellers', protect, admin, getSellers);
router.get('/funnel', protect, admin, getFunnel);
router.get('/customers', protect, admin, getCustomers);
router.post('/ai-interpret', protect, admin, aiInterpret);

module.exports = router;
