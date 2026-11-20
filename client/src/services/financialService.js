import api from './api';

export const getSellerFinancialOverview = async () => {
    const res = await api.get('/financials/seller/overview');
    return res.data;
};

export const getSellerTransactions = async (limit = 20, offset = 0) => {
    const res = await api.get(`/financials/seller/transactions?limit=${limit}&offset=${offset}`);
    return res.data;
};

export const getAdminFinancialOverview = async () => {
    const res = await api.get('/financials/admin/overview');
    return res.data;
};

export const getAdminFinancialLedger = async (transactionType = '', limit = 50, offset = 0) => {
    const query = transactionType ? `?transactionType=${transactionType}&limit=${limit}&offset=${offset}` : `?limit=${limit}&offset=${offset}`;
    const res = await api.get(`/financials/admin/ledger${query}`);
    return res.data;
};

export const updateSellerPayoutStatus = async (payoutId, status, referenceNumber = '') => {
    const res = await api.put(`/financials/admin/payouts/${payoutId}`, { status, referenceNumber });
    return res.data;
};
