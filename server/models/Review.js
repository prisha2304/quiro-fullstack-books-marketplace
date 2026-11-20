const { pool } = require('../config/db');

class Review {
    static async create(reviewData) {
        const { reviewer_id, seller_id, book_id, rating, title, comment, is_verified_purchase = true } = reviewData;

        // Check for duplicate review
        if (book_id) {
            const [existing] = await pool.execute(
                'SELECT id FROM reviews WHERE reviewer_id = ? AND book_id = ?',
                [reviewer_id, book_id]
            );
            if (existing.length > 0) {
                throw new Error('You have already submitted a review for this book');
            }
        }

        const [result] = await pool.execute(
            'INSERT INTO reviews (reviewer_id, seller_id, book_id, rating, title, comment, is_verified_purchase) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [reviewer_id, seller_id, book_id || null, rating, title || null, comment, is_verified_purchase ? 1 : 0]
        );
        const reviewId = result.insertId;

        // Recalculate Book Rating if attached to a book
        if (book_id) {
            await Review.recalculateBookRating(book_id);
        }

        return reviewId;
    }

    static async checkUserEligibility(userId, bookId) {
        // 1. Check if user is admin
        const [userRows] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
        if (userRows.length > 0 && userRows[0].role === 'ADMIN') {
            return { canReview: true, isVerified: true, reason: 'Admin Privilege' };
        }

        // 2. Check if user already reviewed this book
        const [existing] = await pool.execute(
            'SELECT * FROM reviews WHERE reviewer_id = ? AND book_id = ?',
            [userId, bookId]
        );
        if (existing.length > 0) {
            return { canReview: false, hasReviewed: true, existingReview: existing[0] };
        }

        // 3. Check purchase history in orders
        const [orderRows] = await pool.execute(`
            SELECT o.id, o.status 
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.buyer_id = ? AND oi.book_id = ? AND o.status IN ('confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered')
        `, [userId, bookId]);

        if (orderRows.length > 0) {
            return { canReview: true, isVerified: true, orderId: orderRows[0].id };
        }

        // 4. Check completed swap history
        const [swapRows] = await pool.execute(`
            SELECT id FROM swap_requests 
            WHERE status = 'completed' AND (
                (requester_id = ? AND requested_book_id = ?) OR
                (owner_id = ? AND offered_book_id = ?)
            )
        `, [userId, bookId, userId, bookId]);

        if (swapRows.length > 0) {
            return { canReview: true, isVerified: true, swapId: swapRows[0].id };
        }

        return { 
            canReview: false, 
            isVerified: false, 
            message: 'Verified Purchase Required: Only students who have purchased or swapped this textbook edition can submit a review.' 
        };
    }

    static async findByBookId(bookId, sortBy = 'recent') {
        // 1. Get rating breakdown & aggregation
        const [statsRows] = await pool.execute(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as avg_rating,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as star5,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as star4,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as star3,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as star2,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as star1
            FROM reviews 
            WHERE book_id = ?
        `, [bookId]);

        const total = statsRows[0].total_reviews || 0;
        const avg = parseFloat(statsRows[0].avg_rating || 0).toFixed(1);

        const distribution = {
            5: { count: statsRows[0].star5 || 0, percentage: total > 0 ? Math.round((statsRows[0].star5 / total) * 100) : 0 },
            4: { count: statsRows[0].star4 || 0, percentage: total > 0 ? Math.round((statsRows[0].star4 / total) * 100) : 0 },
            3: { count: statsRows[0].star3 || 0, percentage: total > 0 ? Math.round((statsRows[0].star3 / total) * 100) : 0 },
            2: { count: statsRows[0].star2 || 0, percentage: total > 0 ? Math.round((statsRows[0].star2 / total) * 100) : 0 },
            1: { count: statsRows[0].star1 || 0, percentage: total > 0 ? Math.round((statsRows[0].star1 / total) * 100) : 0 }
        };

        // 2. Sorting Order
        let orderByClause = 'r.created_at DESC';
        if (sortBy === 'highest') orderByClause = 'r.rating DESC, r.created_at DESC';
        else if (sortBy === 'lowest') orderByClause = 'r.rating ASC, r.created_at DESC';
        else if (sortBy === 'helpful') orderByClause = 'r.helpful_count DESC, r.created_at DESC';

        // 3. Fetch all reviews for this book
        const [reviews] = await pool.execute(`
            SELECT r.*, u.full_name as reviewer_name, u.profile_image as reviewer_image, u.college as reviewer_college
            FROM reviews r
            JOIN users u ON r.reviewer_id = u.id
            WHERE r.book_id = ?
            ORDER BY ${orderByClause}
        `, [bookId]);

        // 4. Fetch Top Positive & Top Critical Reviews
        const [topPositive] = await pool.execute(`
            SELECT r.*, u.full_name as reviewer_name, u.profile_image as reviewer_image
            FROM reviews r
            JOIN users u ON r.reviewer_id = u.id
            WHERE r.book_id = ? AND r.rating >= 4
            ORDER BY r.helpful_count DESC, r.created_at DESC
            LIMIT 1
        `, [bookId]);

        const [topCritical] = await pool.execute(`
            SELECT r.*, u.full_name as reviewer_name, u.profile_image as reviewer_image
            FROM reviews r
            JOIN users u ON r.reviewer_id = u.id
            WHERE r.book_id = ? AND r.rating <= 3
            ORDER BY r.helpful_count DESC, r.created_at DESC
            LIMIT 1
        `, [bookId]);

        return {
            total_reviews: total,
            avg_rating: avg,
            distribution,
            top_positive: topPositive[0] || null,
            top_critical: topCritical[0] || null,
            reviews
        };
    }

    static async findBySellerId(sellerId) {
        const [rows] = await pool.execute(`
            SELECT r.*, u.full_name as reviewer_name, u.profile_image as reviewer_image, b.title as book_title
            FROM reviews r
            JOIN users u ON r.reviewer_id = u.id
            LEFT JOIN books b ON r.book_id = b.id
            WHERE r.seller_id = ?
            ORDER BY r.created_at DESC
        `, [sellerId]);
        return rows;
    }

    static async getSellerReputation(sellerId) {
        // Average rating & review count
        const [reviewStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as avg_rating,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_reviews
            FROM reviews 
            WHERE seller_id = ?
        `, [sellerId]);

        const totalRev = reviewStats[0].total_reviews || 0;
        const avg = parseFloat(reviewStats[0].avg_rating || 0).toFixed(1);
        const positiveRev = reviewStats[0].positive_reviews || 0;
        const satisfaction = totalRev > 0 ? `${Math.round((positiveRev / totalRev) * 100)}%` : '100%';

        // Successful deliveries
        const [deliveryStats] = await pool.execute(`
            SELECT COUNT(DISTINCT o.id) as delivered_count
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN books b ON oi.book_id = b.id
            WHERE b.seller_id = ? AND o.status = 'delivered'
        `, [sellerId]);

        // Successful swaps
        const [swapStats] = await pool.execute(`
            SELECT COUNT(*) as swapped_count
            FROM swap_requests
            WHERE (owner_id = ? OR requester_id = ?) AND status = 'completed'
        `, [sellerId, sellerId]);

        return {
            avg_rating: avg > 0 ? avg : '4.9',
            total_reviews: totalRev,
            successful_deliveries: deliveryStats[0].delivered_count || 0,
            successful_swaps: swapStats[0].swapped_count || 0,
            customer_satisfaction: satisfaction,
            response_time: '< 2 hours',
            verification_badge: 'Verified Student Seller'
        };
    }

    static async markHelpful(reviewId, userId) {
        const [existing] = await pool.execute(
            'SELECT id FROM review_helpful_votes WHERE review_id = ? AND user_id = ?',
            [reviewId, userId]
        );

        if (existing.length > 0) {
            // Unvote
            await pool.execute('DELETE FROM review_helpful_votes WHERE id = ?', [existing[0].id]);
            await pool.execute('UPDATE reviews SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = ?', [reviewId]);
            return { voted: false };
        } else {
            // Vote
            await pool.execute('INSERT INTO review_helpful_votes (review_id, user_id) VALUES (?, ?)', [reviewId, userId]);
            await pool.execute('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?', [reviewId]);
            return { voted: true };
        }
    }

    static async reportReview(reviewId) {
        await pool.execute('UPDATE reviews SET reported = TRUE WHERE id = ?', [reviewId]);
        return true;
    }

    static async update(id, reviewerId, reviewData) {
        const { rating, title, comment } = reviewData;
        const [result] = await pool.execute(
            'UPDATE reviews SET rating = ?, title = ?, comment = ? WHERE id = ? AND reviewer_id = ?',
            [rating, title || null, comment, id, reviewerId]
        );

        const [rev] = await pool.execute('SELECT book_id FROM reviews WHERE id = ?', [id]);
        if (rev.length > 0 && rev[0].book_id) {
            await Review.recalculateBookRating(rev[0].book_id);
        }

        return result.affectedRows > 0;
    }

    static async delete(id, reviewerId) {
        const [rev] = await pool.execute('SELECT book_id FROM reviews WHERE id = ?', [id]);
        const bookId = rev.length > 0 ? rev[0].book_id : null;

        const [result] = await pool.execute(
            'DELETE FROM reviews WHERE id = ? AND reviewer_id = ?',
            [id, reviewerId]
        );

        if (bookId) {
            await Review.recalculateBookRating(bookId);
        }

        return result.affectedRows > 0;
    }

    static async recalculateBookRating(bookId) {
        const [rows] = await pool.execute(`
            SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
            FROM reviews
            WHERE book_id = ?
        `, [bookId]);

        const avg = parseFloat(rows[0].avg_rating || 0).toFixed(2);
        const count = rows[0].review_count || 0;

        await pool.execute(
            'UPDATE books SET rating = ?, review_count = ? WHERE id = ?',
            [avg, count, bookId]
        );
    }
}

module.exports = Review;
