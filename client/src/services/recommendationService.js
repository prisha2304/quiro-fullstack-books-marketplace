import api from './api';

const recommendationService = {
  getGenreRecommendations: (bookId) => api.get(`/recommendations/genre/${bookId}`),
  getCoPurchaseRecommendations: (bookId) => api.get(`/recommendations/co-purchase/${bookId}`),
  getPersonalizedRecommendations: (limit = 8) => {
    let viewedBookIds = '';
    try {
      const stored = JSON.parse(localStorage.getItem('booknest_viewed_books') || '[]');
      if (Array.isArray(stored)) {
        viewedBookIds = stored.slice(-15).join(',');
      }
    } catch (e) {}

    return api.get('/recommendations/personalized', {
      params: { 
        limit,
        viewedBookIds: viewedBookIds || undefined
      }
    });
  },
  getUserProfile: () => api.get('/recommendations/profile'),
  getSuggestions: (query) => api.get('/recommendations/suggestions', { params: { query } }),
  getRecentActivity: () => api.get('/recommendations/recent')
};

export default recommendationService;
