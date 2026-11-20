const express = require('express');
const router = express.Router();
const SellerOperationsController = require('../controllers/sellerOperationsController');
const { protect } = require('../middleware/authMiddleware');

// Onboarding
router.get('/onboarding', protect, SellerOperationsController.getOnboarding);
router.post('/onboarding', protect, SellerOperationsController.submitOnboarding);
router.put('/onboarding', protect, SellerOperationsController.submitOnboarding);

// Listing Quality & Duplicate Check
router.get('/listings/quality', protect, SellerOperationsController.getAllSellerListingsQuality);
router.get('/listings/:id/quality', protect, SellerOperationsController.getListingQuality);
router.post('/listings/duplicate-check', protect, SellerOperationsController.checkDuplicate);
router.post('/listings/:id/duplicate-check', protect, SellerOperationsController.checkDuplicate);

// Fulfillment & SLAs
router.get('/fulfillment/orders', protect, SellerOperationsController.getFulfillmentOrders);
router.put('/fulfillment/orders/:id/status', protect, SellerOperationsController.updateFulfillmentStatus);
router.post('/fulfillment/orders/bulk-status', protect, SellerOperationsController.bulkUpdateFulfillmentStatus);
router.get('/fulfillment/sla', protect, SellerOperationsController.getSellerSLA);

// Operations Overview & Intelligence
router.get('/operations/overview', protect, SellerOperationsController.getOperationsOverview);
router.get('/operations/inventory', protect, SellerOperationsController.getInventoryIntelligence);
router.get('/operations/insights', protect, SellerOperationsController.getOperationsInsights);
router.get('/operations/profile-completeness', protect, SellerOperationsController.getOnboarding);

// Public seller profile (buyer-safe, optional auth)
router.get('/public-profile/:sellerId', SellerOperationsController.getPublicSellerProfile);

module.exports = router;
