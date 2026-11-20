const express = require('express');
const router = express.Router();
const { 
    getSellerOverview, 
    getSellerTransactions, 
    getAdminOverview, 
    getAdminLedger, 
    updatePayoutStatus 
} = require('../controllers/financialController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

// Seller routes
router.get('/seller/overview', protect, getSellerOverview);
router.get('/seller/transactions', protect, getSellerTransactions);

// Admin routes
router.get('/admin/overview', protect, admin, getAdminOverview);
router.get('/admin/ledger', protect, admin, getAdminLedger);
router.put('/admin/payouts/:id', protect, admin, updatePayoutStatus);

module.exports = router;
