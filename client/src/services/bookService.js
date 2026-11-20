import api from './api';

const bookService = {
  getBooks: (filters = {}) => api.get('/books', { params: filters }),
  getFeaturedBooks: () => api.get('/books/featured'),
  getBookById: (id) => api.get(`/books/${id}`),
  getRelatedBooks: (id) => api.get(`/books/related/${id}`),
  getMyBooks: () => api.get('/books/user/my'),
  
  createBook: (bookData) => api.post('/books', bookData),
  
  updateBook: (id, bookData) => api.put(`/books/${id}`, bookData),
  
  deleteBook: (id) => api.delete(`/books/${id}`),
  
  getCategories: () => api.get('/categories')
};

export default bookService;
