import api from './api';

const disputeService = {
  // Reports
  createReport: (data) => api.post('/reports', data),
  getReports: (params) => api.get('/reports', { params }),
  resolveReport: (id, data) => api.put(`/reports/${id}/resolve`, data),

  // User Disputes
  createDispute: (data) => api.post('/disputes', data),
  getMyDisputes: (params) => api.get('/disputes/my', { params }),
  getDisputeById: (id) => api.get(`/disputes/${id}`),
  addMessage: (id, data) => api.post(`/disputes/${id}/messages`, data),
  addEvidence: (id, data) => api.post(`/disputes/${id}/evidence`, data),
  sellerRespond: (id, data) => api.post(`/disputes/${id}/seller-response`, data),
  getSellerTrustScore: (sellerId) => api.get(`/disputes/trust-score/${sellerId}`),

  // Admin Trust & Safety
  getAdminDisputes: (params) => api.get('/disputes/admin/all', { params }),
  updateDisputeStatus: (id, data) => api.put(`/disputes/admin/${id}/status`, data),
  getTrustSafetyStats: () => api.get('/disputes/admin/stats'),
  getSellerRisk: (sellerId) => api.get(`/disputes/admin/seller-risk/${sellerId}`)
};

export default disputeService;
