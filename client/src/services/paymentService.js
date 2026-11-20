import api from './api';

export const getPaymentConfig = async () => {
    const res = await api.get('/payments/config');
    return res.data;
};

export const createPaymentOrder = async (orderData) => {
    const headers = {};
    if (orderData.idempotencyKey) {
        headers['Idempotency-Key'] = orderData.idempotencyKey;
    }
    const res = await api.post('/payments/create-order', orderData, { headers });
    return res.data;
};

export const verifyPayment = async (paymentData) => {
    const res = await api.post('/payments/verify', paymentData);
    return res.data;
};

export const reportPaymentFailure = async (paymentId, reason) => {
    const res = await api.post('/payments/failure', { paymentId, reason });
    return res.data;
};

export const retryPayment = async (paymentId) => {
    const res = await api.post(`/payments/${paymentId}/retry`);
    return res.data;
};

export const processRefund = async (refundData) => {
    const headers = {};
    if (refundData.idempotencyKey) {
        headers['Idempotency-Key'] = refundData.idempotencyKey;
    }
    const res = await api.post('/payments/refund', refundData, { headers });
    return res.data;
};

export const getMyPaymentHistory = async (limit = 20, offset = 0) => {
    const res = await api.get(`/payments/history/my?limit=${limit}&offset=${offset}`);
    return res.data;
};
