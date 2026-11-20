import api from './api';

const wishlistService = {
  getWishlist: () => api.get('/wishlist'),
  addToWishlist: (bookId) => api.post(`/wishlist/${bookId}`),
  removeFromWishlist: (bookId) => api.delete(`/wishlist/${bookId}`)
};

export default wishlistService;
