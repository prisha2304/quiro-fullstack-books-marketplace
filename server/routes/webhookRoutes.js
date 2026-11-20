const express = require('express');
const router = express.Router();
const webhookService = require('../services/webhookService');

const handleWebhook = async (req, res, next) => {
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
};

router.post('/', handleWebhook);
router.post('/payment', handleWebhook);
router.post('/razorpay', handleWebhook);

module.exports = router;
