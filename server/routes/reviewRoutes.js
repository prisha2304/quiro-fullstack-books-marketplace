const express = require('express');
const router = express.Router();
const { 
    createReview, 
    getBookReviews, 
    checkEligibility, 
    getSellerReviews, 
    markHelpful, 
    reportReview, 
    updateReview, 
    deleteReview 
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

// Public
router.get('/book/:bookId', getBookReviews);
router.get('/seller/:sellerId', getSellerReviews);

// Protected
router.get('/book/:bookId/can-review', protect, checkEligibility);
router.post('/', protect, createReview);
router.post('/:id/helpful', protect, markHelpful);
router.post('/:id/report', protect, reportReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
