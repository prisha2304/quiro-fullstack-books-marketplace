import api from './api';

const searchService = {
  search: (params = {}) => api.get('/search', { params }),
  getSuggestions: (q, limit = 8) => api.get('/search/suggestions', { params: { q, limit } }),
  getTrending: () => api.get('/search/trending'),
  getSimilar: (id) => api.get(`/search/similar/${id}`),
  aiStructuredSearch: (naturalQuery) => api.post('/search/ai-structured', { naturalQuery })
};

export default searchService;
export { searchService };
