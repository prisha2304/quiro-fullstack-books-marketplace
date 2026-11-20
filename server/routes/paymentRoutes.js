const express = require('express');
const router = express.Router();
const { 
    getPaymentConfig, 
    createPaymentOrder, 
    verifyPayment,
    handlePaymentFailure,
    retryPayment,
    processRefund,
    getMyPaymentHistory
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const webhookService = require('../services/webhookService');

// Public / Unauthenticated routes
router.get('/config', getPaymentConfig);

// Direct Razorpay Webhook endpoint (unauthenticated)
router.post('/webhook', async (req, res, next) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const eventId = req.body?.id || req.body?.eventId || ('evt_' + Date.now());
        const eventType = req.body?.event || req.body?.eventType || 'payment.captured';
        const payload = req.body?.payload || req.body;

        const result = await webhookService.processPaymentWebhook({
            eventId,
            eventType,
            payload,
            signature
        });

        return res.status(200).json({ success: true, result });
    } catch (err) {
        next(err);
    }
});

// Protected routes (require user login)
router.use(protect);

router.post('/create-order', createPaymentOrder);
router.post('/verify', verifyPayment);
router.post('/failure', handlePaymentFailure);
router.post('/:id/retry', retryPayment);
router.post('/refund', processRefund);
router.get('/history/my', getMyPaymentHistory);

module.exports = router;
