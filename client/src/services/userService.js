import api from './api';

const userService = {
  getPublicProfile: (id) => api.get(`/users/${id}/public`),
  getDashboardStats: () => api.get('/users/dashboard/stats'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/change-password', data),
};

export default userService;
