import api from './api';

const cartService = {
  getCart: () => api.get('/cart'),
  addToCart: (bookId) => api.post(`/cart/${bookId}`),
  removeFromCart: (bookId) => api.delete(`/cart/${bookId}`),
  clearCart: () => api.delete('/cart'),
  updateQuantity: (bookId, quantity) => api.put(`/cart/${bookId}`, { quantity }),
  validateCoupon: (code) => api.get(`/coupons/validate?code=${code}`)
};

export default cartService;
