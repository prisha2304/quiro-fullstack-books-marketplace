const FinancialService = require('../services/financialService');

// Seller Endpoints
const getSellerOverview = async (req, res) => {
    try {
        const overview = await FinancialService.getSellerFinancialOverview(req.user.id);
        res.json(overview);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getSellerTransactions = async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;
        const transactions = await FinancialService.getSellerTransactions(req.user.id, limit, offset);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin Endpoints
const getAdminOverview = async (req, res) => {
    try {
        const overview = await FinancialService.getAdminFinancialOverview();
        res.json(overview);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAdminLedger = async (req, res) => {
    try {
        const { transactionType, limit = 50, offset = 0 } = req.query;
        const ledger = await FinancialService.getFinancialLedger({ transactionType, limit, offset });
        res.json(ledger);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updatePayoutStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, referenceNumber } = req.body;
        const result = await FinancialService.updateSellerPayoutStatus(id, {
            status,
            referenceNumber,
            adminId: req.user.id
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getSellerOverview,
    getSellerTransactions,
    getAdminOverview,
    getAdminLedger,
    updatePayoutStatus
};
