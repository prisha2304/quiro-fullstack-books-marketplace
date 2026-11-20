const { pool } = require('../config/db');
const Book = require('../models/Book');
const AIShoppingService = require('./aiShoppingService');
const AIService = require('./aiService');

class AIInsightService {
    /**
     * Get proactive insights for authenticated user
     */
    static async getUserInsights(userId) {
        if (!userId) return { insights: [], summary: { count: 0, potentialSavings: 0 } };
        if (typeof userId === 'string' && !/^\d+$/.test(userId.trim())) {
            return { insights: [], summary: { count: 0, potentialSavings: 0 } };
        }
        const numericId = parseInt(userId, 10);
        if (!numericId || isNaN(numericId) || numericId <= 0) {
            return { insights: [], summary: { count: 0, potentialSavings: 0 } };
        }

        const insights = [];
        let totalPotentialSavings = 0;

        try {
            // 1. Wishlist Price Drops & Restocks
            const [wishlistRows] = await pool.query(`
                SELECT w.id as wishlist_id, b.id as book_id, b.title, b.author, b.genre, 
                       b.price, b.condition, b.cover_image, b.rating, b.status
                FROM wishlists w
                JOIN books b ON w.book_id = b.id
                WHERE w.user_id = ?
            `, [numericId]);

            for (const item of wishlistRows) {
                // Check if available
                if (item.status === 'available') {
                    insights.push({
                        id: `restock_${item.book_id}`,
                        type: 'RESTOCK_ALERT',
                        category: 'WISHLIST',
                        title: '📚 Back in Stock',
                        message: `"${item.title}" on your wishlist is available right now for ₹${item.price}.`,
                        book: item,
                        confidence: 95,
                        action: { label: 'View Book', url: `/book/${item.book_id}` }
                    });
                }

                // Check for cheaper alternatives in same genre
                const cheaperAlts = await AIShoppingService.getAlternativeBooks(item.book_id, 'CHEAPER');
                if (cheaperAlts.length > 0) {
                    const bestAlt = cheaperAlts[0];
                    const savings = parseFloat(item.price) - parseFloat(bestAlt.price);
                    if (savings >= 20) {
                        totalPotentialSavings += savings;
                        insights.push({
                            id: `deal_${item.book_id}_${bestAlt.id}`,
                            type: 'PRICE_DROP_ALERT',
                            category: 'DEALS',
                            title: '💰 Cheaper Alternative Available',
                            message: `Found "${bestAlt.title}" in ${bestAlt.condition || 'Like New'} condition for ₹${bestAlt.price} (Save ₹${Math.round(savings)} vs wishlist item).`,
                            book: bestAlt,
                            originalBook: item,
                            savings: Math.round(savings),
                            confidence: 90,
                            action: { label: 'View Deal', url: `/book/${bestAlt.id}` }
                        });
                    }
                }
            }

            // 2. Cart Guardian & Budget Analysis
            const cart = await AIShoppingService.getCartContext(numericId);
            const userPrefs = await AIService.getUserPreferences(numericId);
            const userAvgBudget = userPrefs?.averageBudget || 500;

            if (cart.items.length > 0) {
                if (cart.subtotal > (userAvgBudget * 1.5)) {
                    insights.push({
                        id: 'cart_budget_warning',
                        type: 'CART_GUARDIAN',
                        category: 'CART',
                        title: '🛡️ Cart Budget Guardian',
                        message: `Your active cart total (₹${cart.subtotal}) exceeds your average order spend (₹${userAvgBudget}). NestAI can help optimize item costs.`,
                        cartSubtotal: cart.subtotal,
                        averageBudget: userAvgBudget,
                        confidence: 85,
                        action: { label: 'Optimize Cart', url: '/cart' }
                    });
                }

                // Check for condition upgrades at similar prices
                for (const cItem of cart.items) {
                    if (cItem.condition === 'Fair' || cItem.condition === 'Good') {
                        const [betterConditionRows] = await pool.query(`
                            SELECT b.*, u.full_name as seller_name
                            FROM books b
                            JOIN users u ON b.seller_id = u.id
                            WHERE b.genre = ? AND b.condition IN ('Like New', 'New') 
                              AND b.price <= ? AND b.id != ? AND b.status = 'available'
                            LIMIT 1
                        `, [cItem.genre, cItem.price * 1.05, cItem.bookId]);

                        if (betterConditionRows.length > 0) {
                            const upgraded = betterConditionRows[0];
                            insights.push({
                                id: `condition_upgrade_${cItem.bookId}_${upgraded.id}`,
                                type: 'CONDITION_UPGRADE',
                                category: 'QUALITY',
                                title: '✨ Superior Condition Available',
                                message: `Replace "${cItem.title}" with a ${upgraded.condition} copy for ₹${upgraded.price}.`,
                                book: upgraded,
                                confidence: 88,
                                action: { label: 'View Upgrade', url: `/book/${upgraded.id}` }
                            });
                        }
                    }
                }
            }

            // 3. Personalized Discovery for recurring interests
            if (userPrefs && userPrefs.favoriteGenres.length > 0) {
                const favGenre = userPrefs.favoriteGenres[0];
                const ownedSet = new Set(userPrefs.ownedBookIds || []);

                const [recentListings] = await pool.query(`
                    SELECT b.*, u.full_name as seller_name, u.role as seller_role
                    FROM books b
                    JOIN users u ON b.seller_id = u.id
                    WHERE b.genre = ? AND b.status = 'available'
                    ORDER BY b.id DESC
                    LIMIT 4
                `, [favGenre]);

                const newDiscoveries = recentListings.filter(b => !ownedSet.has(b.id));
                if (newDiscoveries.length > 0) {
                    const topDiscovery = newDiscoveries[0];
                    insights.push({
                        id: `discovery_${topDiscovery.id}`,
                        type: 'PERSONALIZED_DISCOVERY',
                        category: 'RECOMMENDED',
                        title: `🎯 New in ${favGenre}`,
                        message: `Recently listed: "${topDiscovery.title}" by ${topDiscovery.author} (₹${topDiscovery.price}, ${topDiscovery.condition || 'Like New'}).`,
                        book: topDiscovery,
                        confidence: 92,
                        action: { label: 'Explore Book', url: `/book/${topDiscovery.id}` }
                    });
                }
            }

        } catch (err) {
            console.error('Error generating user insights:', err.message);
        }

        return {
            insights,
            summary: {
                count: insights.length,
                potentialSavings: totalPotentialSavings
            }
        };
    }

    /**
     * Get proactive insights for marketplace sellers
     */
    static async getSellerInsights(sellerId) {
        const numericId = parseInt(sellerId, 10);
        if (!numericId || isNaN(numericId) || numericId <= 0) return { insights: [], totalCount: 0 };

        const insights = [];

        try {
            // 1. Pending Fulfillment Orders
            const [pendingOrders] = await pool.query(`
                SELECT oi.id, oi.order_id, oi.price, b.title, o.created_at
                FROM order_items oi
                JOIN books b ON oi.book_id = b.id
                JOIN orders o ON oi.order_id = o.id
                WHERE b.seller_id = ? AND o.status = 'pending'
                LIMIT 5
            `, [numericId]);

            if (pendingOrders.length > 0) {
                insights.push({
                    id: 'seller_pending_orders',
                    type: 'SELLER_ORDERS_ACTION',
                    category: 'ORDERS',
                    title: `📦 ${pendingOrders.length} Order(s) Awaiting Dispatch`,
                    message: `You have ${pendingOrders.length} pending student order(s) requiring shipment.`,
                    priority: 'HIGH',
                    action: { label: 'View Seller Orders', url: '/seller/orders' }
                });
            }

            // 2. Pending Swap Requests
            const [pendingSwaps] = await pool.query(`
                SELECT sr.id, sr.requested_book_id, sr.offered_book_id, b.title
                FROM swap_requests sr
                JOIN books b ON sr.requested_book_id = b.id
                WHERE b.seller_id = ? AND sr.status = 'pending'
                LIMIT 5
            `, [numericId]);

            if (pendingSwaps.length > 0) {
                insights.push({
                    id: 'seller_pending_swaps',
                    type: 'SELLER_SWAPS_ACTION',
                    category: 'SWAPS',
                    title: `🔄 ${pendingSwaps.length} Swap Proposal(s)`,
                    message: 'Students have proposed book exchanges on your listings.',
                    priority: 'MEDIUM',
                    action: { label: 'Review Swaps', url: '/swaps' }
                });
            }

            // 3. Slow-moving listings with high views but no orders
            const [slowListings] = await pool.query(`
                SELECT b.id, b.title, b.price, b.views, b.genre
                FROM books b
                LEFT JOIN order_items oi ON b.id = oi.book_id
                WHERE b.seller_id = ? AND b.status = 'available' AND b.views >= 5 AND oi.id IS NULL
                ORDER BY b.views DESC
                LIMIT 3
            `, [numericId]);

            for (const listing of slowListings) {
                const suggestedPrice = Math.max(99, Math.round(parseFloat(listing.price) * 0.88));
                insights.push({
                    id: `price_opt_${listing.id}`,
                    type: 'SELLER_PRICE_OPTIMIZATION',
                    category: 'PRICING',
                    title: `💡 Price Optimization: "${listing.title}"`,
                    message: `This listing has ${listing.views} student views. Lowering from ₹${listing.price} to ₹${suggestedPrice} could accelerate purchase.`,
                    bookId: listing.id,
                    currentPrice: listing.price,
                    suggestedPrice,
                    views: listing.views,
                    priority: 'LOW',
                    action: { label: 'Edit Price', url: `/sell/edit/${listing.id}` }
                });
            }

            // 4. High-demand subject opportunity
            insights.push({
                id: 'demand_dsa_opportunity',
                type: 'SELLER_DEMAND_OPPORTUNITY',
                category: 'OPPORTUNITY',
                title: '🔥 High Student Demand: Programming & DSA',
                message: 'Computer Science and Algorithm textbooks have the fastest average sales velocity on BookNest.',
                priority: 'LOW',
                action: { label: 'List a Book', url: '/sell' }
            });

        } catch (err) {
            console.error('Error generating seller insights:', err.message);
        }

        return {
            insights,
            totalCount: insights.length
        };
    }

    /**
     * Get proactive conversation tip on widget launch
     */
    static async getProactiveChatTip(userId) {
        if (!userId) {
            return {
                tip: '💡 Looking for semester study bundles? Ask NestAI: "Build a DSA bundle under ₹1500" or tap Identify Book to scan a cover!',
                suggestedQuery: 'Build a DSA study bundle under ₹1500'
            };
        }

        const userInsights = await this.getUserInsights(userId);
        if (userInsights.insights.length > 0) {
            const top = userInsights.insights[0];
            return {
                tip: `💡 ${top.title}: ${top.message}`,
                suggestedQuery: `Tell me more about ${top.book?.title || 'my recommendations'}`
            };
        }

        return {
            tip: '💡 NestAI can optimize your cart or find cheaper editions. Ask: "Can you optimize my cart?"',
            suggestedQuery: 'Can you optimize my cart?'
        };
    }
}

module.exports = AIInsightService;
