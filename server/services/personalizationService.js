const { pool } = require('../config/db');
const { NotificationService, NOTIFICATION_TYPES } = require('./notificationService');
const socket = require('../socket');
const cache = require('../config/cache');

class PersonalizationService {
    /**
     * ==========================================
     * 1. WISHLIST ENRICHMENT & GUEST MERGE
     * ==========================================
     */
    static async mergeGuestWishlist(userId, bookIds = []) {
        if (!Array.isArray(bookIds) || bookIds.length === 0) return 0;
        let merged = 0;
        for (const rawId of bookIds) {
            const bookId = parseInt(rawId, 10);
            if (bookId && !isNaN(bookId)) {
                const [res] = await pool.query(
                    'INSERT IGNORE INTO wishlists (user_id, book_id) VALUES (?, ?)',
                    [userId, bookId]
                );
                if (res.affectedRows > 0) merged++;
            }
        }
        return merged;
    }

    static async getEnrichedWishlist(userId, sortBy = 'date') {
        let orderClause = 'ORDER BY w.created_at DESC';
        if (sortBy === 'price_asc') orderClause = 'ORDER BY b.price ASC';
        else if (sortBy === 'price_desc') orderClause = 'ORDER BY b.price DESC';
        else if (sortBy === 'rating') orderClause = 'ORDER BY b.rating DESC';

        const [rows] = await pool.query(`
            SELECT 
                w.id as wishlist_id,
                w.created_at as added_at,
                b.id as book_id,
                b.title,
                b.author,
                b.isbn,
                b.genre,
                b.price,
                b.original_price,
                b.condition,
                b.cover_image,
                b.status,
                b.rating,
                b.views,
                u.id as seller_id,
                u.full_name as seller_name,
                u.college as seller_college,
                (SELECT COUNT(*) FROM wishlists w2 WHERE w2.book_id = b.id) as total_wishlist_count,
                (SELECT active FROM price_alerts pa WHERE pa.user_id = w.user_id AND pa.book_id = b.id LIMIT 1) as price_alert_active
            FROM wishlists w
            JOIN books b ON w.book_id = b.id
            JOIN users u ON b.seller_id = u.id
            WHERE w.user_id = ?
            ${orderClause}
        `, [userId]);

        return rows.map(item => {
            const price = parseFloat(item.price || 0);
            const origPrice = parseFloat(item.original_price || price);
            const hasPriceDrop = origPrice > price;
            const discountPercent = hasPriceDrop ? Math.round(((origPrice - price) / origPrice) * 100) : 0;

            return {
                wishlistId: item.wishlist_id,
                bookId: item.book_id,
                title: item.title,
                author: item.author,
                isbn: item.isbn,
                genre: item.genre,
                price,
                originalPrice: origPrice,
                hasPriceDrop,
                discountPercent,
                condition: item.condition,
                coverImage: item.cover_image,
                status: item.status,
                isAvailable: item.status === 'available',
                rating: parseFloat(item.rating || 4.5),
                views: item.views,
                seller: {
                    id: item.seller_id,
                    name: item.seller_name,
                    college: item.seller_college
                },
                totalWishlistCount: item.total_wishlist_count,
                priceAlertActive: !!item.price_alert_active,
                addedAt: item.added_at
            };
        });
    }

    /**
     * ==========================================
     * 2. PRICE DROP ALERTS
     * ==========================================
     */
    static async createPriceAlert(userId, bookId, targetPrice = null) {
        const numericBookId = parseInt(bookId, 10);
        const [bookRows] = await pool.query('SELECT price FROM books WHERE id = ?', [numericBookId]);
        if (bookRows.length === 0) throw new Error('Book not found');

        const currentPrice = parseFloat(bookRows[0].price);
        const resolvedTarget = targetPrice ? parseFloat(targetPrice) : currentPrice * 0.9;

        await pool.query(`
            INSERT INTO price_alerts (user_id, book_id, initial_price, target_price, active)
            VALUES (?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE target_price = VALUES(target_price), active = 1
        `, [userId, numericBookId, currentPrice, resolvedTarget]);

        return { bookId: numericBookId, initialPrice: currentPrice, targetPrice: resolvedTarget, active: true };
    }

    static async removePriceAlert(userId, bookId) {
        await pool.query('DELETE FROM price_alerts WHERE user_id = ? AND book_id = ?', [userId, bookId]);
        return { success: true };
    }

    static async checkAndTriggerPriceDrops(bookId, newPrice, oldPrice) {
        if (!newPrice || !oldPrice || newPrice >= oldPrice) return 0;

        const [alerts] = await pool.query(`
            SELECT pa.id, pa.user_id, pa.target_price, b.title 
            FROM price_alerts pa
            JOIN books b ON pa.book_id = b.id
            WHERE pa.book_id = ? AND pa.active = 1 AND ? <= pa.initial_price
        `, [bookId, newPrice]);

        let notifiedCount = 0;
        for (const alert of alerts) {
            await NotificationService.send({
                user_id: alert.user_id,
                type: NOTIFICATION_TYPES.PRICE_DROP,
                title: '📉 Price Drop Alert!',
                message: `"${alert.title}" is now available at ₹${newPrice} (was ₹${oldPrice})!`,
                entity_type: 'book',
                entity_id: bookId,
                action_url: `/book/${bookId}`
            });

            // Mark alert deactivated after successful delivery
            await pool.query('UPDATE price_alerts SET active = 0 WHERE id = ?', [alert.id]);
            notifiedCount++;
        }

        return notifiedCount;
    }

    /**
     * ==========================================
     * 3. BACK IN STOCK ALERTS
     * ==========================================
     */
    static async subscribeStockAlert(userId, bookId) {
        const numericBookId = parseInt(bookId, 10);
        const [bookRows] = await pool.query('SELECT status FROM books WHERE id = ?', [numericBookId]);
        if (bookRows.length === 0) throw new Error('Book not found');

        await pool.query(`
            INSERT INTO stock_alerts (user_id, book_id, status)
            VALUES (?, ?, 'pending')
            ON DUPLICATE KEY UPDATE status = 'pending'
        `, [userId, numericBookId]);

        return { bookId: numericBookId, status: 'pending' };
    }

    static async removeStockAlert(userId, bookId) {
        await pool.query('DELETE FROM stock_alerts WHERE user_id = ? AND book_id = ?', [userId, bookId]);
        return { success: true };
    }

    static async triggerBackInStock(bookId) {
        const [alerts] = await pool.query(`
            SELECT sa.id, sa.user_id, b.title 
            FROM stock_alerts sa
            JOIN books b ON sa.book_id = b.id
            WHERE sa.book_id = ? AND sa.status = 'pending'
        `, [bookId]);

        let notifiedCount = 0;
        for (const alert of alerts) {
            await NotificationService.send({
                user_id: alert.user_id,
                type: NOTIFICATION_TYPES.WISHLIST_RESTOCK,
                title: '📦 Back in Stock!',
                message: `"${alert.title}" is now available on BookNest. Grab it before it sells out!`,
                entity_type: 'book',
                entity_id: bookId,
                action_url: `/book/${bookId}`
            });

            await pool.query("UPDATE stock_alerts SET status = 'notified' WHERE id = ?", [alert.id]);
            notifiedCount++;
        }

        return notifiedCount;
    }

    /**
     * ==========================================
     * 4. RECENTLY VIEWED BOOKS (MAX 20)
     * ==========================================
     */
    static async trackRecentlyViewed(userId, bookId) {
        const numericBookId = parseInt(bookId, 10);
        if (!numericBookId || isNaN(numericBookId)) return;

        // Increment overall view counter on book
        await pool.query('UPDATE books SET views = views + 1 WHERE id = ?', [numericBookId]);

        if (userId) {
            // Persist view event
            await pool.query(`
                INSERT INTO user_activity (user_id, activity_type, reference_id)
                VALUES (?, 'view', ?)
            `, [userId, numericBookId]);
        }
    }

    static async getRecentlyViewed(userId, limit = 20) {
        if (!userId) return [];
        const safeLimit = Math.min(20, Math.max(1, parseInt(limit, 10) || 20));

        const [rows] = await pool.query(`
            SELECT b.*, u.full_name as seller_name,
                   MAX(ua.created_at) as last_viewed_at
            FROM user_activity ua
            JOIN books b ON ua.reference_id = b.id
            JOIN users u ON b.seller_id = u.id
            WHERE ua.user_id = ? AND ua.activity_type = 'view'
            GROUP BY b.id, u.full_name
            ORDER BY last_viewed_at DESC
            LIMIT ?
        `, [userId, safeLimit]);

        return rows;
    }

    /**
     * ==========================================
     * 5. SMART SEARCH HISTORY
     * ==========================================
     */
    static async recordSearch(userId, query) {
        const cleanQuery = (query || '').trim();
        if (!userId || !cleanQuery || cleanQuery.length < 2) return;

        await pool.query(`
            INSERT INTO search_history (user_id, query)
            VALUES (?, ?)
        `, [userId, cleanQuery]);

        // Keep at most 30 search items per user
        await pool.query(`
            DELETE FROM search_history 
            WHERE user_id = ? AND id NOT IN (
                SELECT id FROM (
                    SELECT id FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
                ) temp
            )
        `, [userId, userId]);
    }

    static async getSearchHistory(userId, limit = 10) {
        if (!userId) return [];
        const [rows] = await pool.query(`
            SELECT query, MAX(id) as id, MAX(created_at) as searched_at
            FROM search_history
            WHERE user_id = ?
            GROUP BY query
            ORDER BY searched_at DESC
            LIMIT ?
        `, [userId, parseInt(limit, 10) || 10]);

        return rows;
    }

    static async deleteSearchItem(userId, id) {
        await pool.query('DELETE FROM search_history WHERE user_id = ? AND id = ?', [userId, id]);
        return { success: true };
    }

    static async clearSearchHistory(userId) {
        await pool.query('DELETE FROM search_history WHERE user_id = ?', [userId]);
        return { success: true };
    }

    /**
     * ==========================================
     * 6. SELLER FOLLOWING & SOCIAL PROOF
     * ==========================================
     */
    static async followSeller(followerId, sellerId) {
        const numericSeller = parseInt(sellerId, 10);
        if (followerId === numericSeller) throw new Error('Cannot follow yourself');

        await pool.query(`
            INSERT IGNORE INTO seller_follows (follower_id, seller_id)
            VALUES (?, ?)
        `, [followerId, numericSeller]);

        return { sellerId: numericSeller, following: true };
    }

    static async unfollowSeller(followerId, sellerId) {
        await pool.query('DELETE FROM seller_follows WHERE follower_id = ? AND seller_id = ?', [followerId, sellerId]);
        return { sellerId, following: false };
    }

    static async getFollowedSellers(userId) {
        const [rows] = await pool.query(`
            SELECT u.id, u.full_name, u.username, u.college, u.status,
                   COUNT(b.id) as listings_count,
                   COALESCE(AVG(b.rating), 4.8) as avg_rating
            FROM seller_follows sf
            JOIN users u ON sf.seller_id = u.id
            LEFT JOIN books b ON u.id = b.seller_id
            WHERE sf.follower_id = ?
            GROUP BY u.id
        `, [userId]);

        return rows;
    }

    static async getBookSocialProof(bookId) {
        const numericBookId = parseInt(bookId, 10);
        const [rows] = await pool.query(`
            SELECT 
                b.views,
                b.rating,
                b.review_count,
                b.stock,
                (SELECT COUNT(*) FROM wishlists w WHERE w.book_id = b.id) as wishlist_count,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.book_id = b.id) as order_count,
                (SELECT COUNT(*) FROM user_activity ua WHERE ua.reference_id = b.id AND ua.activity_type = 'view' AND ua.created_at >= CURDATE()) as views_today
            FROM books b
            WHERE b.id = ?
        `, [numericBookId]);

        if (rows.length === 0) return null;
        const b = rows[0];

        const proofSignals = [];
        const viewsToday = parseInt(b.views_today || 0, 10);
        const wishlistCount = parseInt(b.wishlist_count || 0, 10);
        const orderCount = parseInt(b.order_count || 0, 10);

        if (viewsToday >= 3) {
            proofSignals.push({ icon: 'Eye', text: `${viewsToday} students viewed today`, highlight: 'text-blue-600' });
        }
        if (wishlistCount >= 2) {
            proofSignals.push({ icon: 'Heart', text: `${wishlistCount} in student wishlists`, highlight: 'text-rose-600' });
        }
        if (orderCount >= 3) {
            proofSignals.push({ icon: 'TrendingUp', text: 'Fast-moving campus textbook', highlight: 'text-emerald-600' });
        }
        if (parseInt(b.stock, 10) === 1) {
            proofSignals.push({ icon: 'Clock', text: 'Only 1 available from this student', highlight: 'text-amber-600' });
        }

        return {
            viewsToday,
            wishlistCount,
            orderCount,
            proofSignals
        };
    }

    /**
     * ==========================================
     * 7. USER READING & BUYING PROFILE
     * ==========================================
     */
    static async getUserReadingProfile(userId) {
        const [categoryActivity] = await pool.query(`
            SELECT b.genre, COUNT(*) as interaction_count
            FROM user_activity ua
            JOIN books b ON ua.reference_id = b.id
            WHERE ua.user_id = ? AND b.genre IS NOT NULL AND b.genre != ''
            GROUP BY b.genre
            ORDER BY interaction_count DESC
            LIMIT 5
        `, [userId]);

        const [purchaseStats] = await pool.query(`
            SELECT 
                COUNT(DISTINCT o.id) as total_purchases,
                COALESCE(AVG(o.total_price), 0) as avg_order_spend,
                COALESCE(MIN(oi.price), 0) as min_price,
                COALESCE(MAX(oi.price), 0) as max_price
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.buyer_id = ? AND o.status != 'cancelled'
        `, [userId]);

        const [reviewStats] = await pool.query(`
            SELECT COUNT(*) as review_count, COALESCE(AVG(rating), 5) as avg_rating_given
            FROM reviews
            WHERE reviewer_id = ?
        `, [userId]);

        const [wishlistGenres] = await pool.query(`
            SELECT b.genre, COUNT(*) as count
            FROM wishlists w
            JOIN books b ON w.book_id = b.id
            WHERE w.user_id = ?
            GROUP BY b.genre
            ORDER BY count DESC
            LIMIT 3
        `, [userId]);

        const p = purchaseStats[0] || {};
        const r = reviewStats[0] || {};

        const topCategories = categoryActivity.map(c => c.genre);
        if (topCategories.length === 0) {
            topCategories.push('Computer Science', 'Mathematics', 'Competitive Exams');
        }

        const minSpend = Math.max(100, Math.round(parseFloat(p.min_price || 200)));
        const maxSpend = Math.max(minSpend + 200, Math.round(parseFloat(p.max_price || 650)));

        return {
            userId,
            topCategories,
            favoriteGenres: wishlistGenres.map(g => g.genre),
            typicalPriceRange: `₹${minSpend} – ₹${maxSpend}`,
            preferredCondition: 'Like New / Good',
            totalPurchases: parseInt(p.total_purchases || 0, 10),
            booksReviewed: parseInt(r.review_count || 0, 10),
            averageRatingGiven: parseFloat(parseFloat(r.avg_rating_given || 5).toFixed(1))
        };
    }

    /**
     * ==========================================
     * 8. LIGHTWEIGHT GAMIFICATION & ACHIEVEMENTS
     * ==========================================
     */
    static async calculateAndAwardAchievements(userId) {
        if (!userId) return [];

        const [stats] = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM orders WHERE buyer_id = ? AND status != 'cancelled') as orders_count,
                (SELECT COUNT(*) FROM reviews WHERE reviewer_id = ?) as reviews_count,
                (SELECT COUNT(*) FROM wishlists WHERE user_id = ?) as wishlist_count,
                (SELECT COUNT(*) FROM books WHERE seller_id = ?) as listings_count,
                (SELECT COUNT(*) FROM order_items oi JOIN books b ON oi.book_id = b.id WHERE b.seller_id = ?) as sales_count
            FROM dual
        `, [userId, userId, userId, userId, userId]);

        const s = stats[0] || {};
        const orders = parseInt(s.orders_count || 0, 10);
        const reviews = parseInt(s.reviews_count || 0, 10);
        const wishlists = parseInt(s.wishlist_count || 0, 10);
        const listings = parseInt(s.listings_count || 0, 10);
        const sales = parseInt(s.sales_count || 0, 10);

        const possibleAchievements = [
            { key: 'FIRST_PURCHASE', title: 'First Read', desc: 'Placed your first textbook order on BookNest', condition: orders >= 1, icon: 'ShoppingBag' },
            { key: 'FIRST_REVIEW', title: 'Campus Voice', desc: 'Wrote your first book & seller review', condition: reviews >= 1, icon: 'Star' },
            { key: 'WISHLIST_BUILDER', title: 'Curator', desc: 'Saved 3 or more textbooks to your wishlist', condition: wishlists >= 3, icon: 'Heart' },
            { key: 'FREQUENT_BUYER', title: 'Scholar', desc: 'Completed 3 or more verified textbook orders', condition: orders >= 3, icon: 'BookOpen' },
            { key: 'SELLER_STARTER', title: 'Campus Merchant', desc: 'Listed your first textbook for student peer trade', condition: listings >= 1, icon: 'Package' },
            { key: 'TRUSTED_SELLER', title: 'Top Merchant', desc: 'Completed 5+ sales with exemplary fulfillment', condition: sales >= 5, icon: 'ShieldCheck' }
        ];

        for (const ach of possibleAchievements) {
            if (ach.condition) {
                await pool.query(`
                    INSERT INTO user_achievements (user_id, achievement_key, title, description, icon)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE unlocked_at = CURRENT_TIMESTAMP
                `, [userId, ach.key, ach.title, ach.desc, ach.icon]);
            }
        }

        const [unlocked] = await pool.query('SELECT * FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at DESC', [userId]);
        return unlocked;
    }

    /**
     * ==========================================
     * 9. UNIFIED PERSONALIZED HOMEPAGE ENGINE
     * ==========================================
     */
    static async getPersonalizedHomepage(userId = null) {
        // Exclude books already purchased by user
        let purchasedBookIds = [];
        if (userId) {
            const [purchased] = await pool.query(`
                SELECT DISTINCT oi.book_id 
                FROM order_items oi 
                JOIN orders o ON oi.order_id = o.id 
                WHERE o.buyer_id = ?
            `, [userId]);
            purchasedBookIds = purchased.map(p => p.book_id);
        }

        let excludeCondition = "b.status = 'available'";
        const excludeParams = [];

        if (purchasedBookIds.length > 0) {
            excludeCondition += ` AND b.id NOT IN (${purchasedBookIds.map(() => '?').join(',')})`;
            excludeParams.push(...purchasedBookIds);
        }
        if (userId) {
            excludeCondition += " AND b.seller_id != ?";
            excludeParams.push(userId);
        }

        // Section 1: Recently Viewed
        const recentlyViewed = userId ? await this.getRecentlyViewed(userId, 8) : [];

        // Section 2: For You (Personalized scored algorithm)
        let forYouBooks = [];
        let isColdStart = true;

        if (userId) {
            const [affinityRows] = await pool.query(`
                SELECT b.genre, COUNT(*) as weight
                FROM user_activity ua
                JOIN books b ON ua.reference_id = b.id
                WHERE ua.user_id = ?
                GROUP BY b.genre
                ORDER BY weight DESC
                LIMIT 3
            `, [userId]);

            if (affinityRows.length > 0) {
                isColdStart = false;
                const topGenres = affinityRows.map(a => a.genre);
                const genrePlaceholders = topGenres.map(() => '?').join(',');

                const [res] = await pool.query(`
                    SELECT b.*, u.full_name as seller_name, u.college as seller_college
                    FROM books b
                    JOIN users u ON b.seller_id = u.id
                    WHERE b.genre IN (${genrePlaceholders}) AND ${excludeCondition}
                    ORDER BY b.rating DESC, b.views DESC
                    LIMIT 8
                `, [...topGenres, ...excludeParams]);

                forYouBooks = res.map(b => ({
                    ...b,
                    recommendationReason: `Because you explored ${b.genre}`
                }));
            }
        }

        // Cold-Start Fallback if user is guest or has no interaction history
        if (forYouBooks.length === 0) {
            const [coldStartRows] = await pool.query(`
                SELECT b.*, u.full_name as seller_name, u.college as seller_college
                FROM books b
                JOIN users u ON b.seller_id = u.id
                WHERE ${excludeCondition}
                ORDER BY b.rating DESC, b.views DESC, b.created_at DESC
                LIMIT 8
            `, excludeParams);

            forYouBooks = coldStartRows.map(b => ({
                ...b,
                recommendationReason: 'Popular among university students'
            }));
        }

        // Section 3: Affordable Student Picks (Under ₹350)
        const [affordableRows] = await pool.query(`
            SELECT b.*, u.full_name as seller_name, u.college as seller_college
            FROM books b
            JOIN users u ON b.seller_id = u.id
            WHERE b.price <= 350 AND ${excludeCondition}
            ORDER BY b.rating DESC, b.views DESC
            LIMIT 6
        `, excludeParams);

        // Section 4: Trending on Campus
        const [trendingRows] = await pool.query(`
            SELECT b.*, u.full_name as seller_name, u.college as seller_college
            FROM books b
            JOIN users u ON b.seller_id = u.id
            WHERE ${excludeCondition}
            ORDER BY b.views DESC, b.review_count DESC
            LIMIT 6
        `, excludeParams);

        // Section 5: New from Followed Sellers
        let followedSellersBooks = [];
        if (userId) {
            const [followedRows] = await pool.query(`
                SELECT b.*, u.full_name as seller_name, u.college as seller_college
                FROM books b
                JOIN users u ON b.seller_id = u.id
                JOIN seller_follows sf ON b.seller_id = sf.seller_id
                WHERE sf.follower_id = ? AND ${excludeCondition}
                ORDER BY b.created_at DESC
                LIMIT 6
            `, [userId, ...excludeParams]);
            followedSellersBooks = followedRows;
        }

        return {
            isColdStart,
            forYou: forYouBooks,
            continueExploring: recentlyViewed,
            affordablePicks: affordableRows,
            trendingOnCampus: trendingRows,
            newFromFollowedSellers: followedSellersBooks
        };
    }
}

module.exports = PersonalizationService;
