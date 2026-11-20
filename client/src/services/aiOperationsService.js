import api from './api';

const aiOperationsService = {
  // Seller Copilot
  getSellerCopilot: async (prompt) => {
    const response = await api.post('/ai/seller/copilot', { prompt });
    return response.data;
  },

  // Listing Optimizer
  optimizeListing: async (bookData) => {
    const response = await api.post('/ai/listing/optimize', bookData);
    return response.data;
  },

  // Price Insights
  getPriceInsight: async (data) => {
    const response = await api.post('/ai/pricing/insight', data);
    return response.data;
  },

  // Inventory Forecast
  getInventoryForecast: async (data = {}) => {
    const response = await api.post('/ai/inventory/forecast', data);
    return response.data;
  },

  // Fulfillment Insights
  getFulfillmentInsight: async () => {
    const response = await api.post('/ai/fulfillment/insight');
    return response.data;
  },

  // Review Summary
  getReviewSummary: async (bookId) => {
    const response = await api.get(`/ai/reviews/summary/${bookId}`);
    return response.data;
  },

  // Seller Review Summary
  getSellerReviewSummary: async () => {
    const response = await api.get('/ai/seller/reviews/summary');
    return response.data;
  },

  // Customer Support
  getSupportResponse: async (data) => {
    const response = await api.post('/ai/support', data);
    return response.data;
  },

  // Admin Operations
  getAdminOperations: async (query) => {
    const response = await api.post('/ai/admin/operations', { query });
    return response.data;
  },

  // Marketplace Health Report
  getMarketplaceHealth: async (timeRange = '30d') => {
    const response = await api.get(`/ai/marketplace-health?timeRange=${timeRange}`);
    return response.data;
  },

  // Anomalies
  getAnomalies: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await api.get(`/ai/anomalies${query ? `?${query}` : ''}`);
    return response.data;
  },

  scanAnomalies: async () => {
    const response = await api.post('/ai/anomalies/scan');
    return response.data;
  },

  // Human-in-the-loop action application
  applyAction: async (actionType, entityId, payload = {}) => {
    const response = await api.post('/ai/action/apply', { actionType, entityId, payload });
    return response.data;
  },

  // AI Activity Logs
  getActivityLogs: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await api.get(`/ai/activity${query ? `?${query}` : ''}`);
    return response.data;
  }
};

export default aiOperationsService;
