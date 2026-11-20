const intelligenceService = require('../services/marketplaceIntelligenceService');

// Demand Forecast
exports.getDemand = async (req, res) => {
    try {
        const { timeRange } = req.query;
        const result = await intelligenceService.getDemandForecast({ timeRange });
        return res.json(result);
    } catch (e) {
        console.error('[IntelligenceController] getDemand error:', e);
        return res.status(500).json({ message: e.message || 'Failed to fetch demand forecast' });
    }
};

// Category Intelligence
exports.getCategories = async (req, res) => {
    try {
        const result = await intelligenceService.getCategoryIntelligence();
        return res.json(result);
    } catch (e) {
        console.error('[IntelligenceController] getCategories error:', e);
        return res.status(500).json({ message: e.message || 'Failed to fetch category intelligence' });
    }
};

// Catalog Gaps
exports.getCatalog = async (req, res) => {
    try {
        const result = await intelligenceService.getCatalogGaps();
        return res.json(result);
    } catch (e) {
        console.error('[IntelligenceController] getCatalog error:', e);
        return res.status(500).json({ message: e.message || 'Failed to fetch catalog gaps' });
    }
};

// Search Intelligence
exports.getSearch = async (req, res) => {
    try {
        const result = await intelligenceService.getSearchIntelligence();
        return res.json(result);
    } catch (e) {
        console.error('[IntelligenceController] getSearch error:', e);
        return res.status(500).json({ message: e.message || 'Failed to fetch search intelligence' });
    }
};

// Conversion Funnel
exports.getFunnel = async (req, res) => {
    try {
        const { category, sellerId } = req.query;
        const result = await intelligenceService.getConversionFunnel({ category, sellerId });
        return res.json(result);
    } catch (e) {
        console.error('[IntelligenceController] getFunnel error:', e);
        return res.status(500).json({ message: e.message || 'Failed to fetch funnel intelligence' });
    }
};

// Buyer Lifecycle
exports.getBuyers = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }
        const result = await intelligenceService.getBuyerLifecycleAnalytics();
        return res.json(result);
    } catch (e) {
        console.error('[IntelligenceController] getBuyers error:', e);
        return res.status(500).json({ message: e.message || 'Failed to fetch buyer lifecycle' });
    }
};

// Seller Lifecycle
exports.getSellers = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }
        const result = await intelligenceService.getSellerLifecycleAnalytics();
        return res.json(result);
    } catch (e) {
        console.error('[IntelligenceController] getSellers error:', e);
        return res.status(500).json({ message: e.message || 'Failed to fetch seller lifecycle' });
    }
};

// Seller Opportunities
exports.getSellerOpportunities = async (req, res) => {
    try {
        const sellerId = req.user?.id;
        if (!sellerId) return res.status(401).json({ message: 'Seller authentication required' });
        const result = await intelligenceService.getSellerGrowthOpportunities(sellerId);
        return res.json(result);
    } catch (e) {
        console.error('[IntelligenceController] getSellerOpportunities error:', e);
        return res.status(500).json({ message: e.message || 'Failed to fetch seller opportunities' });
    }
};

// Recommendations Orchestration
exports.getRecommendations = async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const { limit, maxPerSeller, maxPerCategory } = req.query;
        const result = await intelligenceService.getOrchestratedRecommendations({
            userId,
            limit: Number(limit) || 8,
            diversityParams: {
                maxPerSeller: Number(maxPerSeller) || 2,
                maxPerCategory: Number(maxPerCategory) || 3
            }
        });
        return res.json(result);
    } catch (e) {
        console.error('[IntelligenceController] getRecommendations error:', e);
        return res.status(500).json({ message: e.message || 'Failed to fetch recommendations' });
    }
};

// Experiments
exports.getExperiments = async (req, res) => {
    try {
        const result = await intelligenceService.getExperiments();
        return res.json(result);
    } catch (e) {
        return res.status(500).json({ message: e.message || 'Failed to fetch experiments' });
    }
};

exports.createExperiment = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }
        const result = await intelligenceService.createExperiment(req.body);
        return res.json(result);
    } catch (e) {
        return res.status(400).json({ message: e.message || 'Failed to create experiment' });
    }
};

exports.recordExperimentEvent = async (req, res) => {
    try {
        const result = await intelligenceService.recordExperimentEvent({
            ...req.body,
            userId: req.user?.id || null
        });
        return res.json(result);
    } catch (e) {
        return res.status(400).json({ message: e.message || 'Failed to record event' });
    }
};

// Feature Flags
exports.getFeatureFlags = async (req, res) => {
    try {
        const result = await intelligenceService.getFeatureFlags();
        return res.json(result);
    } catch (e) {
        return res.status(500).json({ message: e.message || 'Failed to fetch feature flags' });
    }
};

exports.updateFeatureFlag = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }
        const { flagKey } = req.params;
        const result = await intelligenceService.updateFeatureFlag(flagKey, req.body);
        return res.json(result);
    } catch (e) {
        return res.status(400).json({ message: e.message || 'Failed to update feature flag' });
    }
};

exports.evaluateFeatureFlag = async (req, res) => {
    try {
        const { flagKey } = req.body;
        const enabled = await intelligenceService.evaluateFeatureFlag(flagKey, { userId: req.user?.id });
        return res.json({ flagKey, enabled });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
};

// Automation Jobs
exports.runAutomation = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }
        const { jobKey } = req.body;
        const result = await intelligenceService.runAutomationJob(jobKey);
        return res.json(result);
    } catch (e) {
        return res.status(400).json({ message: e.message || 'Automation job execution failed' });
    }
};

// Reports
exports.generateReport = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }
        const { reportType } = req.body;
        const result = await intelligenceService.generateIntelligenceReport(reportType, req.user?.id);
        return res.json(result);
    } catch (e) {
        return res.status(400).json({ message: e.message || 'Report generation failed' });
    }
};

// Health
exports.getHealth = async (req, res) => {
    try {
        const result = await intelligenceService.getMarketplaceHealthStatus();
        return res.json(result);
    } catch (e) {
        return res.status(500).json({ message: e.message || 'Health status calculation failed' });
    }
};
