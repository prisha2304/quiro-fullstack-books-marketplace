import api from './api';

const notificationService = {
  getNotifications: (limit = 50, offset = 0, category = 'ALL') => 
    api.get('/notifications', { params: { limit, offset, category } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  clearRead: () => api.delete('/notifications/clear-read')
};

export default notificationService;
export { notificationService };
