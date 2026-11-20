const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Book = require('../models/Book');
const socket = require('../socket');

const createReview = async (req, res) => {
    try {
        const { seller_id, book_id, rating, title, comment } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5 stars' });
        }

        if (seller_id && seller_id === req.user.id) {
            return res.status(400).json({ message: 'You cannot review yourself or your own book' });
        }

        // Verified Purchase Check if reviewing a book
        let isVerifiedPurchase = true;
        if (book_id) {
            const eligibility = await Review.checkUserEligibility(req.user.id, book_id);
            if (!eligibility.canReview) {
                return res.status(403).json({ 
                    message: eligibility.message || 'Verified Purchase Required: Only verified buyers of this textbook can submit a review.',
                    hasReviewed: eligibility.hasReviewed
                });
            }
            isVerifiedPurchase = eligibility.isVerified;
        }

        // Auto-find seller_id if not provided
        let targetSellerId = seller_id;
        if (!targetSellerId && book_id) {
            const book = await Book.findById(book_id);
            if (book) targetSellerId = book.seller_id;
        }

        const reviewId = await Review.create({
            reviewer_id: req.user.id,
            seller_id: targetSellerId || req.user.id,
            book_id: book_id || null,
            rating: parseInt(rating, 10),
            title,
            comment,
            is_verified_purchase: isVerifiedPurchase
        });

        // Real-time Notification for seller
        if (targetSellerId && targetSellerId !== req.user.id) {
            await Notification.create({
                user_id: targetSellerId,
                title: 'New Customer Review',
                message: `${req.user.full_name || 'A student'} left a ${rating}-star review on your book listing.`,
                type: 'review',
                reference_id: reviewId
            });

            socket.sendNotification(targetSellerId, {
                type: 'NEW_REVIEW',
                title: 'New Customer Review',
                message: `${req.user.full_name || 'A student'} left a ${rating}-star review.`,
                reference_id: reviewId
            });
        }

        res.status(201).json({ message: 'Review submitted successfully', reviewId });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(400).json({ message: error.message || 'Error submitting review' });
    }
};

const getBookReviews = async (req, res) => {
    try {
        const { bookId } = req.params;
        const { sort = 'recent' } = req.query;

        const data = await Review.findByBookId(bookId, sort);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching book reviews', error: error.message });
    }
};

const checkEligibility = async (req, res) => {
    try {
        const { bookId } = req.params;
        const result = await Review.checkUserEligibility(req.user.id, bookId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error checking eligibility', error: error.message });
    }
};

const getSellerReviews = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const reviews = await Review.findBySellerId(sellerId);
        const reputation = await Review.getSellerReputation(sellerId);
        res.json({ reviews, reputation });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error: error.message });
    }
};

const markHelpful = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Review.markHelpful(id, req.user.id);
        res.json({ message: result.voted ? 'Marked as helpful' : 'Removed helpful vote', voted: result.voted });
    } catch (error) {
        res.status(500).json({ message: 'Error voting on review', error: error.message });
    }
};

const reportReview = async (req, res) => {
    try {
        const { id } = req.params;
        await Review.reportReview(id);
        res.json({ message: 'Review reported to moderators for quality inspection' });
    } catch (error) {
        res.status(500).json({ message: 'Error reporting review', error: error.message });
    }
};

const updateReview = async (req, res) => {
    try {
        const success = await Review.update(req.params.id, req.user.id, req.body);
        if (!success) return res.status(403).json({ message: 'Not authorized or review not found' });
        res.json({ message: 'Review updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating review', error: error.message });
    }
};

const deleteReview = async (req, res) => {
    try {
        const success = await Review.delete(req.params.id, req.user.id);
        if (!success) return res.status(403).json({ message: 'Not authorized or review not found' });
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting review', error: error.message });
    }
};

module.exports = {
    createReview,
    getBookReviews,
    checkEligibility,
    getSellerReviews,
    markHelpful,
    reportReview,
    updateReview,
    deleteReview
};
