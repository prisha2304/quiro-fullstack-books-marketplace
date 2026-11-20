const PaymentService = require('../services/paymentService');

const getPaymentConfig = (req, res) => {
    res.json({
        keyId: PaymentService.isRazorpayConfigured() ? process.env.RAZORPAY_KEY_ID : 'rzp_test_booknest_sandbox',
        isConfigured: PaymentService.isRazorpayConfigured()
    });
};

const createPaymentOrder = async (req, res) => {
    try {
        const { shipping_address, couponCode, expectedSubtotal } = req.body;
        const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

        const result = await PaymentService.createPaymentIntent(req.user.id, {
            shipping_address,
            couponCode,
            expectedSubtotal,
            idempotencyKey
        }, req);

        res.json(result);
    } catch (error) {
        if (error.code === 'PRICE_CHANGED') {
            return res.status(409).json({
                error: 'PRICE_CHANGED',
                message: error.message,
                details: error.details
            });
        }
        res.status(400).json({ message: error.message || 'Checkout creation failed' });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature, method } = req.body;

        if (!orderId || !razorpay_order_id || !razorpay_payment_id) {
            return res.status(400).json({ message: 'Missing required payment verification identifiers' });
        }

        const result = await PaymentService.verifyAndCapturePayment(req.user.id, {
            orderId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            method
        }, req);

        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Payment verification failed' });
    }
};

const handlePaymentFailure = async (req, res) => {
    try {
        const { paymentId, reason } = req.body;
        const result = await PaymentService.handlePaymentFailure(req.user.id, paymentId, reason, req);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const retryPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await PaymentService.retryPayment(req.user.id, id, req);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const processRefund = async (req, res) => {
    try {
        const { paymentId, amount, reason, disputeId } = req.body;
        const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

        // Admin or initiator of dispute
        const result = await PaymentService.processRefund(req.user.id, {
            paymentId,
            amount,
            reason,
            disputeId,
            idempotencyKey
        }, req);

        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getMyPaymentHistory = async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const history = await PaymentService.getUserPaymentHistory(req.user.id, limit, offset);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPaymentConfig,
    createPaymentOrder,
    verifyPayment,
    handlePaymentFailure,
    retryPayment,
    processRefund,
    getMyPaymentHistory
};
