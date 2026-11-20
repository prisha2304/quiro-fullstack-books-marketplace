import api from './api';

const orderService = {
  createOrder: (orderData) => api.post('/orders', orderData),
  getMyOrders: () => api.get('/orders/my'),
  getSellerOrders: () => api.get('/orders/seller'),
  getOrderById: (id) => api.get(`/orders/${id}`),
  updateOrderStatus: (id, status, tracking_number) => api.put(`/orders/${id}/status`, { status, tracking_number }),
  cancelOrder: (id) => api.post(`/orders/${id}/cancel`),
  downloadInvoice: (id) => api.get(`/orders/${id}/invoice`, { responseType: 'blob' }),
  requestRefund: (id, data) => api.post(`/orders/${id}/request-refund`, data),
  getRefundStatus: (id) => api.get(`/orders/${id}/refund-status`)
};

export default orderService;
