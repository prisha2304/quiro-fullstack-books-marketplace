const { pool } = require('../config/db');

class User {
    static async create(userData) {
        const { username, email, password, full_name, phone, role } = userData;
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, password, full_name || null, phone || null, role || 'USER']
        );
        return result.insertId;
    }

    static async findByUsernameOrEmail(identifier) {
        if (!identifier) return null;
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier]);
        return rows[0] || null;
    }

    static async findByEmail(email) {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    }

    static async findByGoogleId(googleId) {
        if (!googleId) return null;
        const [rows] = await pool.execute('SELECT * FROM users WHERE google_id = ?', [googleId]);
        return rows[0] || null;
    }

    static async linkGoogleAccount(id, googleId, profileImage = null) {
        if (profileImage) {
            await pool.execute(
                'UPDATE users SET google_id = ?, profile_image = COALESCE(profile_image, ?) WHERE id = ?',
                [googleId, profileImage, id]
            );
        } else {
            await pool.execute('UPDATE users SET google_id = ? WHERE id = ?', [googleId, id]);
        }
        return this.findById(id);
    }

    static async findByUsername(username) {
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await pool.execute(
            'SELECT id, username, email, full_name, role, phone, profile_image, college, bio, status, token_version, created_at, updated_at FROM users WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    static async updateProfile(id, updateData) {
        const { full_name, phone, college, bio, profile_image } = updateData;
        
        let query = 'UPDATE users SET ';
        const params = [];
        const updates = [];

        if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
        if (college !== undefined) { updates.push('college = ?'); params.push(college); }
        if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
        // address handled separately in user_addresses
        if (profile_image !== undefined) { updates.push('profile_image = ?'); params.push(profile_image); }

        if (updates.length === 0) return true;

        query += updates.join(', ') + ' WHERE id = ?';
        params.push(id);

        await pool.execute(query, params);
        return true;
    }

    static async updatePassword(id, hashedPassword) {
        const [result] = await pool.execute(
            'UPDATE users SET password = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?',
            [hashedPassword, id]
        );
        return result.affectedRows > 0;
    }

    static async incrementTokenVersion(id) {
        const [result] = await pool.execute(
            'UPDATE users SET token_version = COALESCE(token_version, 1) + 1 WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    static async getPublicProfile(id) {
        const [userRows] = await pool.execute(`
            SELECT id, full_name, username, role, profile_image, college, bio, created_at 
            FROM users WHERE id = ?
        `, [id]);
        
        if (userRows.length === 0) return null;

        const [bookStatsRows] = await pool.execute(`
            SELECT 
                COUNT(*) as listed_count,
                COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_count,
                COUNT(CASE WHEN status = 'swapped' THEN 1 END) as swapped_count
            FROM books WHERE seller_id = ?
        `, [id]);

        const [reviewStats] = await pool.execute(
            'SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews FROM reviews WHERE seller_id = ?',
            [id]
        );

        return {
            ...userRows[0],
            stats: {
                listed: bookStatsRows[0].listed_count || 0,
                sold: bookStatsRows[0].sold_count || 0,
                swapped: bookStatsRows[0].swapped_count || 0,
                avg_rating: parseFloat(reviewStats[0].avg_rating || 0).toFixed(1),
                total_reviews: reviewStats[0].total_reviews || 0
            }
        };
    }

    static async getDashboardStats(userId) {
        const stats = {};

        // 1. Overall Book Stats
        const [books] = await pool.execute(`
            SELECT 
                COUNT(*) as listed,
                COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold,
                COUNT(CASE WHEN status = 'swapped' THEN 1 END) as swapped,
                SUM(views) as total_views,
                SUM(wishlist_count) as total_wishlists,
                SUM(CASE WHEN status = 'sold' THEN price ELSE 0 END) as revenue
            FROM books WHERE seller_id = ?
        `, [userId]);

        stats.booksListed = books[0].listed || 0;
        stats.booksSold = books[0].sold || 0;
        stats.booksSwapped = books[0].swapped || 0;
        stats.totalViews = parseInt(books[0].total_views || 0, 10);
        stats.totalWishlists = parseInt(books[0].total_wishlists || 0, 10);
        stats.revenueEarned = parseFloat(books[0].revenue || 0).toFixed(2);

        // 2. Purchases by User
        const [purchased] = await pool.execute('SELECT COUNT(*) as count FROM orders WHERE buyer_id = ?', [userId]);
        stats.booksPurchased = purchased[0].count;

        // 3. Incoming Orders for Seller's Books
        const [sellerOrders] = await pool.execute(`
            SELECT 
                COUNT(DISTINCT o.id) as total_orders,
                COUNT(DISTINCT CASE WHEN DATE(o.created_at) = CURDATE() THEN o.id END) as orders_today,
                COUNT(DISTINCT CASE WHEN MONTH(o.created_at) = MONTH(CURDATE()) AND YEAR(o.created_at) = YEAR(CURDATE()) THEN o.id END) as orders_month,
                SUM(CASE WHEN DATE(o.created_at) = CURDATE() AND o.status != 'cancelled' THEN oi.price ELSE 0 END) as revenue_today,
                SUM(CASE WHEN MONTH(o.created_at) = MONTH(CURDATE()) AND YEAR(o.created_at) = YEAR(CURDATE()) AND o.status != 'cancelled' THEN oi.price ELSE 0 END) as revenue_month,
                COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) as pending_orders,
                COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as delivered_orders,
                COUNT(DISTINCT CASE WHEN o.status != 'cancelled' THEN o.id END) as non_cancelled_orders
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN books b ON oi.book_id = b.id
            WHERE b.seller_id = ?
        `, [userId]);

        const so = sellerOrders[0];
        stats.ordersToday = so.orders_today || 0;
        stats.ordersMonth = so.orders_month || 0;
        stats.revenueToday = parseFloat(so.revenue_today || 0).toFixed(2);
        stats.revenueMonth = parseFloat(so.revenue_month || 0).toFixed(2);
        stats.pendingOrders = so.pending_orders || 0;

        const totalValid = parseInt(so.non_cancelled_orders || 0, 10);
        const delivered = parseInt(so.delivered_orders || 0, 10);
        stats.deliverySuccessRate = totalValid > 0 ? `${((delivered / totalValid) * 100).toFixed(1)}%` : '100.0%';

        // 4. Pending Swaps
        const [pendingSwaps] = await pool.execute(
            "SELECT COUNT(*) as count FROM swap_requests WHERE owner_id = ? AND status = 'pending'",
            [userId]
        );
        stats.pendingSwaps = pendingSwaps[0].count;

        // 5. Wishlists
        const [wishlist] = await pool.execute('SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?', [userId]);
        stats.wishlistCount = wishlist[0].count;

        // 6. Review & Reputation Metrics
        const [revStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as avg_rating,
                COUNT(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 END) as reviews_month,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_reviews
            FROM reviews 
            WHERE seller_id = ?
        `, [userId]);

        const totalR = revStats[0].total_reviews || 0;
        stats.sellerAvgRating = parseFloat(revStats[0].avg_rating || 4.9).toFixed(1);
        stats.reviewsThisMonth = revStats[0].reviews_month || 0;
        stats.customerSatisfaction = totalR > 0 ? `${Math.round(((revStats[0].positive_reviews || 0) / totalR) * 100)}%` : '98.5%';

        // 7. Most Reviewed Book & Highest Rated Book
        const [mostRev] = await pool.execute(`
            SELECT title, review_count FROM books WHERE seller_id = ? ORDER BY review_count DESC, views DESC LIMIT 1
        `, [userId]);
        stats.mostReviewedBook = mostRev[0]?.title || 'Operating System Concepts';

        const [highRated] = await pool.execute(`
            SELECT title, rating FROM books WHERE seller_id = ? ORDER BY rating DESC, price DESC LIMIT 1
        `, [userId]);
        stats.highestRatedBook = highRated[0]?.title || 'Introduction to Algorithms';

        const [unreadMsg] = await pool.execute('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = FALSE', [userId]);
        stats.unreadMessages = unreadMsg[0]?.count || 0;
        stats.newReviews = stats.reviewsThisMonth || 0;

        return stats;
    }
}

module.exports = User;

