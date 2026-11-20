import api from './api';

const analyticsService = {
  getOverview: (dateRange = '30d') => api.get('/analytics/overview', { params: { dateRange } }),
  getRevenueTrends: (range = '30d') => api.get('/analytics/revenue', { params: { range } }),
  getCategories: () => api.get('/analytics/categories'),
  getBooks: (limit = 20, sellerId = null) => api.get('/analytics/books', { params: { limit, sellerId } }),
  getSellers: (limit = 15) => api.get('/analytics/sellers', { params: { limit } }),
  getSellerAnalytics: () => api.get('/analytics/seller-analytics'),
  getInventoryHealth: (sellerId = null) => api.get('/analytics/inventory', { params: { sellerId } }),
  getFunnel: () => api.get('/analytics/funnel'),
  getCustomers: () => api.get('/analytics/customers'),
  exportReport: (type = 'revenue') => 
    api.get('/analytics/export', { params: { type }, responseType: 'blob' }),
  aiInterpret: (question) => api.post('/analytics/ai-interpret', { question })
};

export default analyticsService;
export { analyticsService };
