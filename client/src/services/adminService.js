import api from './api';

const adminService = {
  getDashboardStats: () => api.get('/admin/dashboard'),
  
  // User management
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),

  // Book management
  getBooks: (params) => api.get('/admin/books', { params }),
  updateBook: (id, data) => api.put(`/admin/books/${id}`, data),

  // Category management
  getCategories: () => api.get('/admin/categories'),
  createCategory: (data) => api.post('/admin/categories', data),

  // Order management
  getOrders: (params) => api.get('/admin/orders', { params }),
  updateOrder: (id, data) => api.put(`/admin/orders/${id}`, data),

  // Swap management
  getSwaps: (params) => api.get('/admin/swaps', { params }),
  updateSwap: (id, data) => api.put(`/admin/swaps/${id}`, data),

  // Review management
  getReviews: (params) => api.get('/admin/reviews', { params }),
  deleteReview: (id) => api.delete(`/admin/reviews/${id}`),

  // Coupon management
  getCoupons: () => api.get('/admin/coupons'),
  createCoupon: (data) => api.post('/admin/coupons', data),
  toggleCoupon: (id, active) => api.put(`/admin/coupons/${id}`, { active }),
  deleteCoupon: (id) => api.delete(`/admin/coupons/${id}`),

  // Refund management
  getRefunds: (params) => api.get('/admin/refunds', { params }),
  processOrderRefund: (orderId, data) => api.post(`/admin/orders/${orderId}/process-refund`, data)
};

export default adminService;
