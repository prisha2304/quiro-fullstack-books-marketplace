const express = require('express');
const router = express.Router();
const SellerOperationsController = require('../controllers/sellerOperationsController');
const { protect } = require('../middleware/authMiddleware');

// Create shipment (seller protected)
router.post('/', protect, SellerOperationsController.createShipment);

// Get shipment tracking & timeline by order ID (buyer/seller protected or public if authenticated)
router.get('/:orderId', protect, SellerOperationsController.getShipmentTimeline);

// Add shipment event
router.post('/:id/events', protect, SellerOperationsController.addShipmentEvent);

module.exports = router;
