import api from './api';

const sellerOperationsService = {
  // Onboarding & Completeness
  getOnboarding: async () => {
    const res = await api.get('/seller/onboarding');
    return res.data;
  },

  submitOnboarding: async (data) => {
    const res = await api.post('/seller/onboarding', data);
    return res.data;
  },

  // Listing Quality & Duplicate Check
  getListingQuality: async (bookId) => {
    const res = await api.get(`/seller/listings/${bookId}/quality`);
    return res.data;
  },

  getAllListingsQuality: async () => {
    const res = await api.get('/seller/listings/quality');
    return res.data;
  },

  checkDuplicate: async (bookData, bookId = null) => {
    const url = bookId ? `/seller/listings/${bookId}/duplicate-check` : '/seller/listings/duplicate-check';
    const res = await api.post(url, bookData);
    return res.data;
  },

  // Fulfillment & Orders
  getFulfillmentOrders: async (status = null) => {
    const res = await api.get('/seller/fulfillment/orders', { params: status ? { status } : {} });
    return res.data;
  },

  updateFulfillmentStatus: async (orderId, { status, trackingNumber, carrier, notes }) => {
    const res = await api.put(`/seller/fulfillment/orders/${orderId}/status`, {
      status,
      trackingNumber,
      carrier,
      notes
    });
    return res.data;
  },

  bulkUpdateFulfillmentStatus: async ({ orderIds, nextStatus, notes }) => {
    const res = await api.post('/seller/fulfillment/orders/bulk-status', {
      orderIds,
      nextStatus,
      notes
    });
    return res.data;
  },

  getSellerSLA: async () => {
    const res = await api.get('/seller/fulfillment/sla');
    return res.data;
  },

  // Shipments
  createShipment: async (shipmentData) => {
    const res = await api.post('/shipments', shipmentData);
    return res.data;
  },

  getShipmentTimeline: async (orderId) => {
    const res = await api.get(`/shipments/${orderId}`);
    return res.data;
  },

  addShipmentEvent: async (shipmentId, eventData) => {
    const res = await api.post(`/shipments/${shipmentId}/events`, eventData);
    return res.data;
  },

  // Operations Intelligence
  getOperationsOverview: async () => {
    const res = await api.get('/seller/operations/overview');
    return res.data;
  },

  getInventoryIntelligence: async () => {
    const res = await api.get('/seller/operations/inventory');
    return res.data;
  },

  getOperationsInsights: async () => {
    const res = await api.get('/seller/operations/insights');
    return res.data;
  },

  getPublicSellerProfile: async (sellerId) => {
    const res = await api.get(`/seller/public-profile/${sellerId}`);
    return res.data;
  },

  // Admin Operations Center
  getAdminOperationsOverview: async () => {
    const res = await api.get('/admin/operations/overview');
    return res.data;
  },

  getAdminModerationQueue: async () => {
    const res = await api.get('/admin/operations/moderation');
    return res.data;
  },

  moderateListing: async (bookId, { decision, reason }) => {
    const res = await api.post(`/admin/operations/moderation/${bookId}/action`, {
      decision,
      reason
    });
    return res.data;
  },

  getAdminSellers: async () => {
    const res = await api.get('/admin/operations/sellers');
    return res.data;
  },

  reviewSellerOnboarding: async (sellerId, { decision, rejectionReason }) => {
    const res = await api.put(`/admin/operations/onboarding/${sellerId}/review`, {
      decision,
      rejectionReason
    });
    return res.data;
  },

  getAdminSLA: async () => {
    const res = await api.get('/admin/operations/sla');
    return res.data;
  },

  getAdminShipments: async () => {
    const res = await api.get('/admin/operations/shipments');
    return res.data;
  }
};

export default sellerOperationsService;
