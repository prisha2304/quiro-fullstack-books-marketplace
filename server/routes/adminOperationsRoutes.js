const express = require('express');
const router = express.Router();
const SellerOperationsController = require('../controllers/sellerOperationsController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

// All endpoints in this router are protected + admin restricted
router.use(protect, admin);

router.get('/overview', SellerOperationsController.getAdminOperationsOverview);
router.get('/moderation', SellerOperationsController.getAdminModerationQueue);
router.post('/moderation/:id/action', SellerOperationsController.moderateListing);
router.get('/sellers', SellerOperationsController.getAdminSellers);
router.put('/onboarding/:id/review', SellerOperationsController.reviewSellerOnboarding);
router.get('/sla', SellerOperationsController.getAdminSLA);
router.get('/shipments', SellerOperationsController.getAdminShipments);

module.exports = router;
