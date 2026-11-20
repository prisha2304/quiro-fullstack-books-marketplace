import api from './api';

const intelligenceService = {
  getDemandForecast: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await api.get(`/intelligence/demand${query ? `?${query}` : ''}`);
    return res.data;
  },

  getCategoryIntelligence: async () => {
    const res = await api.get('/intelligence/categories');
    return res.data;
  },

  getCatalogGaps: async () => {
    const res = await api.get('/intelligence/catalog');
    return res.data;
  },

  getSearchIntelligence: async () => {
    const res = await api.get('/intelligence/search');
    return res.data;
  },

  getConversionFunnel: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await api.get(`/intelligence/funnel${query ? `?${query}` : ''}`);
    return res.data;
  },

  getBuyerLifecycle: async () => {
    const res = await api.get('/intelligence/buyers');
    return res.data;
  },

  getSellerLifecycle: async () => {
    const res = await api.get('/intelligence/sellers');
    return res.data;
  },

  getSellerOpportunities: async () => {
    const res = await api.get('/intelligence/seller/opportunities');
    return res.data;
  },

  getOrchestratedRecommendations: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await api.get(`/intelligence/recommendations${query ? `?${query}` : ''}`);
    return res.data;
  },

  getExperiments: async () => {
    const res = await api.get('/intelligence/experiments');
    return res.data;
  },

  createExperiment: async (data) => {
    const res = await api.post('/intelligence/experiments', data);
    return res.data;
  },

  recordExperimentEvent: async (data) => {
    const res = await api.post('/intelligence/experiments/event', data);
    return res.data;
  },

  getFeatureFlags: async () => {
    const res = await api.get('/intelligence/feature-flags');
    return res.data;
  },

  updateFeatureFlag: async (flagKey, data) => {
    const res = await api.put(`/intelligence/feature-flags/${flagKey}`, data);
    return res.data;
  },

  evaluateFeatureFlag: async (flagKey) => {
    const res = await api.post('/intelligence/feature-flags/evaluate', { flagKey });
    return res.data;
  },

  runAutomationJob: async (jobKey) => {
    const res = await api.post('/intelligence/automation/run', { jobKey });
    return res.data;
  },

  generateReport: async (reportType) => {
    const res = await api.post('/intelligence/reports/generate', { reportType });
    return res.data;
  },

  getMarketplaceHealth: async () => {
    const res = await api.get('/intelligence/marketplace-health');
    return res.data;
  }
};

export default intelligenceService;
