const express = require('express');
const router = express.Router();
const { 
    getDashboardStats, 
    getAuditLogs,
    getAnnouncements,
    createAnnouncement,
    deleteAnnouncement,
    getUsers, 
    updateUser, 
    deleteUser,
    getBooks,
    updateBook,
    getCategories,
    createCategory,
    getOrders,
    updateOrder,
    getSwaps,
    updateSwap,
    getReviews,
    deleteReview,
    getCoupons,
    createCoupon,
    toggleCouponStatus,
    deleteCoupon,
    getRefunds,
    processOrderRefund
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

router.use(protect);
router.use(admin);

router.get('/dashboard', getDashboardStats);
router.get('/audit-logs', getAuditLogs);
router.get('/refunds', getRefunds);

router.get('/announcements', getAnnouncements);
router.post('/announcements', createAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

router.get('/books', getBooks);
router.put('/books/:id', updateBook);

router.get('/categories', getCategories);
router.post('/categories', createCategory);

router.get('/orders', getOrders);
router.put('/orders/:id', updateOrder);
router.post('/orders/:id/process-refund', processOrderRefund);

router.get('/swaps', getSwaps);
router.put('/swaps/:id', updateSwap);

router.get('/reviews', getReviews);
router.delete('/reviews/:id', deleteReview);

router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', toggleCouponStatus);
router.delete('/coupons/:id', deleteCoupon);

module.exports = router;
