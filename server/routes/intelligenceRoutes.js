const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authMiddleware');
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
