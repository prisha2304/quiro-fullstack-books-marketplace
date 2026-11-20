import api from './api';

const messageService = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (conversationId, limit = 100, offset = 0) => 
    api.get(`/messages/${conversationId}`, { params: { limit, offset } }),
  sendMessage: (data) => api.post('/messages', data),
  markRead: (id) => api.put(`/messages/${id}/read`)
};

export default messageService;
export { messageService };
