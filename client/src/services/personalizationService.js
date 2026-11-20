import api from './api';

const personalizationService = {
  // Wishlist
  getWishlist: (sort = 'date') => api.get('/wishlist', { params: { sort } }),
  mergeWishlist: (bookIds) => api.post('/wishlist/merge', { bookIds }),
  addToWishlist: (bookId) => api.post(`/wishlist/${bookId}`),
  removeFromWishlist: (bookId) => api.delete(`/wishlist/${bookId}`),

  // Alerts
  createPriceAlert: (bookId, targetPrice) => api.post('/personalization/alerts/price', { bookId, targetPrice }),
  removePriceAlert: (bookId) => api.delete(`/personalization/alerts/price/${bookId}`),
  createStockAlert: (bookId) => api.post('/personalization/alerts/stock', { bookId }),
  removeStockAlert: (bookId) => api.delete(`/personalization/alerts/stock/${bookId}`),

  // Recently Viewed
  trackRecentlyViewed: (bookId) => api.post(`/personalization/recently-viewed/${bookId}`),
  getRecentlyViewed: (limit = 20) => api.get('/personalization/recently-viewed', { params: { limit } }),
  clearRecentlyViewed: () => api.delete('/personalization/recently-viewed'),

  // Search History
  getSearchHistory: (limit = 10) => api.get('/personalization/search/history', { params: { limit } }),
  recordSearch: (query) => api.post('/personalization/search/history', { query }),
  deleteSearchItem: (id) => api.delete(`/personalization/search/history/${id}`),
  clearSearchHistory: () => api.delete('/personalization/search/history'),

  // Seller Follows
  followSeller: (sellerId) => api.post(`/personalization/follow/${sellerId}`),
  unfollowSeller: (sellerId) => api.delete(`/personalization/follow/${sellerId}`),
  getFollowedSellers: () => api.get('/personalization/following'),

  // Social Proof & Profile
  getBookSocialProof: (bookId) => api.get(`/personalization/books/${bookId}/social-proof`),
  getUserReadingProfile: () => api.get('/personalization/profile/reading'),
  getUserAchievements: () => api.get('/personalization/profile/achievements'),

  // Homepage Personalization
  getPersonalizedHomepage: () => api.get('/personalization/homepage')
};

export default personalizationService;
