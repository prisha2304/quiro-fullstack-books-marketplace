const aiMarketplaceOperationsService = require('../services/aiMarketplaceOperationsService');

exports.sellerCopilot = async (req, res) => {
    try {
        const sellerId = req.user?.id;
        if (!sellerId) return res.status(401).json({ message: 'Seller authentication required' });

        const { prompt } = req.body;
        const response = await aiMarketplaceOperationsService.getSellerCopilotResponse(sellerId, prompt);
        return res.json(response);
    } catch (error) {
        console.error('[AICheckout/Copilot] Error:', error);
        return res.status(500).json({
            message: 'AI Copilot temporary error. Please try again later.',
            error: error.message,
            fallback: 'Service operational metrics are available in your Seller Dashboard.'
        });
    }
};

exports.optimizeListing = async (req, res) => {
    try {
        const sellerId = req.user?.id;
        if (!sellerId) return res.status(401).json({ message: 'Authentication required' });

        const bookData = req.body;
        const result = await aiMarketplaceOperationsService.optimizeListing(sellerId, bookData);
        return res.json(result);
    } catch (error) {
        console.error('[AIListingOptimizer] Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to optimize listing' });
    }
};

exports.priceInsight = async (req, res) => {
    try {
        const sellerId = req.user?.id || null;
        const { bookId, category, condition, currentPrice, title } = req.body;
        const result = await aiMarketplaceOperationsService.getPriceInsight(sellerId, { bookId, category, condition, currentPrice, title });
        return res.json(result);
    } catch (error) {
        console.error('[AIPricingInsight] Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to generate pricing insight' });
    }
};

exports.inventoryForecast = async (req, res) => {
    try {
        const sellerId = req.user?.id;
        if (!sellerId) return res.status(401).json({ message: 'Seller authentication required' });

        const { bookId, category } = req.body;
        const result = await aiMarketplaceOperationsService.getInventoryForecast(sellerId, { bookId, category });
        return res.json(result);
    } catch (error) {
        console.error('[AIInventoryForecast] Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to generate inventory forecast' });
    }
};

exports.fulfillmentInsight = async (req, res) => {
    try {
        const sellerId = req.user?.id;
        if (!sellerId) return res.status(401).json({ message: 'Seller authentication required' });

        const result = await aiMarketplaceOperationsService.getFulfillmentInsights(sellerId);
        return res.json(result);
    } catch (error) {
        console.error('[AIFulfillmentInsight] Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to generate fulfillment insight' });
    }
};

exports.reviewSummary = async (req, res) => {
    try {
        const { bookId } = req.params;
        if (!bookId) return res.status(400).json({ message: 'Book ID is required' });

        const result = await aiMarketplaceOperationsService.summarizeReviews({ bookId });
        return res.json(result);
    } catch (error) {
        console.error('[AIReviewSummary] Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to generate review summary' });
    }
};

exports.sellerReviewSummary = async (req, res) => {
    try {
        const sellerId = req.user?.id;
        if (!sellerId) return res.status(401).json({ message: 'Seller authentication required' });

        const result = await aiMarketplaceOperationsService.summarizeReviews({ sellerId });
        return res.json(result);
    } catch (error) {
        console.error('[AISellerReviewSummary] Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to generate seller review summary' });
    }
};

exports.supportAssistant = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Authentication required for AI Support' });

        const { userPrompt, orderId, bookId } = req.body;
        const result = await aiMarketplaceOperationsService.handleCustomerSupport(userId, { userPrompt, orderId, bookId });
        return res.json(result);
    } catch (error) {
        console.error('[AISupportAssistant] Error:', error);
        return res.status(500).json({ message: error.message || 'Support assistant error' });
    }
};

exports.adminOperations = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId || req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }

        const { query } = req.body;
        const result = await aiMarketplaceOperationsService.getAdminOperationsAssistant(adminId, { query });
        return res.json(result);
    } catch (error) {
        console.error('[AIAdminOperations] Error:', error);
        return res.status(500).json({ message: error.message || 'Admin assistant error' });
    }
};

exports.marketplaceHealth = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId || req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }

        const { timeRange } = req.query;
        const result = await aiMarketplaceOperationsService.getMarketplaceHealthReport(adminId, { timeRange });
        return res.json(result);
    } catch (error) {
        console.error('[AIMarketplaceHealth] Error:', error);
        return res.status(500).json({ message: error.message || 'Health report error' });
    }
};

exports.getAnomalies = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId || req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }

        const { status, severity } = req.query;
        const anomalies = await aiMarketplaceOperationsService.getMarketplaceAnomalies({ status, severity });
        return res.json(anomalies);
    } catch (error) {
        console.error('[AIGetAnomalies] Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to get anomalies' });
    }
};

exports.scanAnomalies = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId || req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }

        const result = await aiMarketplaceOperationsService.scanMarketplaceAnomalies();
        return res.json({ scanned: true, anomaliesDetected: result.length, anomalies: result });
    } catch (error) {
        console.error('[AIScanAnomalies] Error:', error);
        return res.status(500).json({ message: error.message || 'Anomaly scan error' });
    }
};

exports.applyAction = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Authentication required' });

        const { actionType, entityId, payload } = req.body;
        const result = await aiMarketplaceOperationsService.applyHumanAction(userId, { actionType, entityId, payload });
        return res.json(result);
    } catch (error) {
        console.error('[AIApplyAction] Error:', error);
        return res.status(400).json({ message: error.message || 'Action could not be applied' });
    }
};

exports.getActivityLogs = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: 'Authentication required' });

        const isAdmin = user.role === 'ADMIN';
        const filter = isAdmin ? {} : { userId: user.id };
        if (req.query.limit) filter.limit = req.query.limit;

        const logs = await aiMarketplaceOperationsService.getActivityLogs(filter);
        return res.json(logs);
    } catch (error) {
        console.error('[AIGetActivityLogs] Error:', error);
        return res.status(500).json({ message: error.message || 'Failed to fetch activity logs' });
    }
};
