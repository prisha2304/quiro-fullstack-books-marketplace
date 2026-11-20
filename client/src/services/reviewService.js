import api from './api';

const reviewService = {
  getBookReviews: (bookId, sort = 'recent') => api.get(`/reviews/book/${bookId}?sort=${sort}`),
  checkEligibility: (bookId) => api.get(`/reviews/book/${bookId}/can-review`),
  getSellerReviews: (sellerId) => api.get(`/reviews/seller/${sellerId}`),
  createReview: (data) => api.post('/reviews', data),
  markHelpful: (id) => api.post(`/reviews/${id}/helpful`),
  reportReview: (id) => api.post(`/reviews/${id}/report`),
  updateReview: (id, data) => api.put(`/reviews/${id}`, data),
  deleteReview: (id) => api.delete(`/reviews/${id}`)
};

export default reviewService;
