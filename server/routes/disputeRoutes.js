const express = require('express');
const router = express.Router();
const {
    createDispute,
    getMyDisputes,
    getDisputeById,
    addDisputeMessage,
    addDisputeEvidence,
    sellerRespond,
    getSellerTrustScore,
    getAdminDisputes,
    updateDisputeStatus,
    getTrustSafetyStats,
    getSellerRisk
} = require('../controllers/disputeController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

// All dispute routes require authentication
router.use(protect);

// User & Seller Dispute Endpoints
router.post('/', createDispute);
router.get('/my', getMyDisputes);
router.get('/trust-score/:sellerId', getSellerTrustScore);
router.get('/:id', getDisputeById);
router.post('/:id/messages', addDisputeMessage);
router.post('/:id/evidence', addDisputeEvidence);
router.post('/:id/seller-response', sellerRespond);

// Admin Trust & Safety Endpoints
router.get('/admin/all', admin, getAdminDisputes);
router.put('/admin/:id/status', admin, updateDisputeStatus);
router.get('/admin/stats', admin, getTrustSafetyStats);
router.get('/admin/seller-risk/:sellerId', admin, getSellerRisk);

module.exports = router;
