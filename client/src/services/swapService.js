import api from './api';

const swapService = {
  getDiscoverSwapBooks: (params = {}) => api.get('/swaps/discover', { params }),
  getMyEligibleBooks: () => api.get('/swaps/my-eligible'),
  getMySwapListings: () => api.get('/swaps/my-listings'),
  getCompletedSwaps: () => api.get('/swaps/completed'),
  requestSwap: (data) => api.post('/swaps/request', data),
  getIncoming: () => api.get('/swaps/incoming'),
  getIncomingRequests: () => api.get('/swaps/incoming'),
  getReceivedRequests: () => api.get('/swaps/incoming'),
  getOutgoing: () => api.get('/swaps/outgoing'),
  getOutgoingRequests: () => api.get('/swaps/outgoing'),
  getHistory: () => api.get('/swaps/history'),
  acceptSwap: (id) => api.put(`/swaps/${id}/accept`),
  rejectSwap: (id) => api.put(`/swaps/${id}/reject`),
  cancelSwap: (id) => api.put(`/swaps/${id}/cancel`),
  completeSwap: (id) => api.post(`/swaps/${id}/confirm-completion`),
  confirmCompletion: (id) => api.post(`/swaps/${id}/confirm-completion`),
  respondSwap: (id, status) => {
    const action = status === 'accepted' ? 'accept' : status === 'rejected' ? 'reject' : status;
    return api.put(`/swaps/${id}/${action}`);
  },
  counterSwap: (id, offeredBookId) => api.put(`/swaps/${id}/counter`, { offered_book_id: offeredBookId }),
  
  // Extended Exchange Workflow & Configuration
  getSwapConfig: () => api.get('/swaps/config'),
  getSwapDetails: (id) => api.get(`/swaps/${id}/details`),
  selectExchangeMethod: (id, method) => api.post(`/swaps/${id}/select-method`, { method }),
  giveConsent: (id) => api.post(`/swaps/${id}/consent`),
  markArranged: (id) => api.post(`/swaps/${id}/arrange`),
  saveAddress: (id, addressData) => api.post(`/swaps/${id}/address`, addressData),
  createManagedPayment: (id) => api.post(`/swaps/${id}/create-payment`),
  verifyManagedPayment: (id, paymentData) => api.post(`/swaps/${id}/verify-payment`, paymentData),
  advanceCourier: (id, stage) => api.post(`/swaps/${id}/advance-courier`, { stage }),
  refundSwap: (id, reason) => api.post(`/swaps/${id}/refund`, { reason })
};

export default swapService;
