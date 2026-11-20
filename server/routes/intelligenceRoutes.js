const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const {
    getDemand,
    getCategories,
    getCatalog,
    getSearch,
    getFunnel,
    getBuyers,
    getSellers,
    getSellerOpportunities,
    getRecommendations,
    getExperiments,
    createExperiment,
    recordExperimentEvent,
    getFeatureFlags,
    updateFeatureFlag,
    evaluateFeatureFlag,
    runAutomation,
    generateReport,
    getHealth
} = require('../controllers/intelligenceController');

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = decoded;
        } catch (e) {
            req.user = null;
        }
    }
    next();
};

router.use(optionalAuth);

// Intelligence Analytics & Discovery
router.get('/demand', getDemand);
router.get('/categories', getCategories);
router.get('/catalog', getCatalog);
router.get('/search', getSearch);
router.get('/funnel', getFunnel);
router.get('/buyers', getBuyers);
router.get('/sellers', getSellers);
router.get('/seller/opportunities', getSellerOpportunities);
router.get('/recommendations', getRecommendations);

// Experiments
router.get('/experiments', getExperiments);
router.post('/experiments', createExperiment);
router.post('/experiments/event', recordExperimentEvent);

// Feature Flags
router.get('/feature-flags', getFeatureFlags);
router.put('/feature-flags/:flagKey', updateFeatureFlag);
router.post('/feature-flags/evaluate', evaluateFeatureFlag);

// Automation & Reports
router.post('/automation/run', runAutomation);
router.post('/reports/generate', generateReport);
router.get('/marketplace-health', getHealth);

module.exports = router;
