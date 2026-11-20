const express = require('express');
const router = express.Router();
const { 
    createOrder, 
    getMyOrders, 
    getSellerOrders,
    getOrderById,
    updateOrderStatus,
    downloadInvoice,
    cancelOrder,
    requestRefund,
    getOrderRefundStatus
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/seller', getSellerOrders);
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);
router.post('/:id/cancel', cancelOrder);
router.get('/:id/invoice', downloadInvoice);
router.post('/:id/request-refund', requestRefund);
router.get('/:id/refund-status', getOrderRefundStatus);

module.exports = router;
