const express = require('express');
const router = express.Router();
const webhookService = require('../services/webhookService');

const handleWebhook = async (req, res, next) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length === 0) {
            const err = new Error('Malformed webhook request payload');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            err.isOperational = true;
            throw err;
        }

        const signature = req.headers['x-razorpay-signature'];
        const eventId = req.body.id || req.body.eventId || ('evt_' + Date.now());
        const eventType = req.body.event || req.body.eventType || 'payment.captured';
        const payload = req.body.payload || req.body;
        const rawBody = req.rawBody || null;

        const result = await webhookService.processPaymentWebhook({
            eventId,
            eventType,
            payload,
            signature,
            rawBody
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
