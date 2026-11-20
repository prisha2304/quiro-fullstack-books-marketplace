const { pool } = require('../config/db');

/**
 * Phase 11A: Fetch genre-based recommendations for a specific book.
 */
const getGenreRecommendations = async (bookId, limit = 6) => {
    const safeLimit = Math.max(1, parseInt(limit, 10) || 6);
    const numericBookId = parseInt(bookId, 10);

    if (isNaN(numericBookId)) {
        return null;
    }

    const [currentBookRows] = await pool.query(
        'SELECT id, genre FROM books WHERE id = ?',
        [numericBookId]
    );

    if (!currentBookRows || currentBookRows.length === 0) {
        return null;
    }

    const currentBook = currentBookRows[0];
    const genre = currentBook.genre;

    const [genreBooks] = await pool.query(`
        SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role 
        FROM books b 
        JOIN users u ON b.seller_id = u.id 
        WHERE b.genre = ? AND b.id != ? AND b.status = 'available'
        ORDER BY b.rating DESC, b.views DESC, b.created_at DESC
        LIMIT ${safeLimit}
    `, [genre, numericBookId]);

    if (genreBooks.length >= safeLimit) {
        return genreBooks.slice(0, safeLimit);
    }

    const needed = safeLimit - genreBooks.length;
    const excludedIds = [numericBookId, ...genreBooks.map(b => b.id)];
    const placeholders = excludedIds.map(() => '?').join(',');

    const [fallbackBooks] = await pool.query(`
        SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role 
        FROM books b 
        JOIN users u ON b.seller_id = u.id 
        WHERE b.id NOT IN (${placeholders}) AND b.status = 'available'
        ORDER BY b.rating DESC, b.views DESC, b.created_at DESC
        LIMIT ${needed}
    `, excludedIds);

    return [...genreBooks, ...fallbackBooks];
};

/**
 * Phase 11B: Fetch co-purchase recommendations ("Users Who Bought This Also Bought").
 */
const getCoPurchaseRecommendations = async (bookId, limit = 6) => {
    const safeLimit = Math.max(1, parseInt(limit, 10) || 6);
    const numericBookId = parseInt(bookId, 10);

    if (isNaN(numericBookId)) {
        return null;
    }

    const [currentBookRows] = await pool.query(
        'SELECT id, genre FROM books WHERE id = ?',
        [numericBookId]
    );

    if (!currentBookRows || currentBookRows.length === 0) {
        return null;
    }

    const currentBook = currentBookRows[0];
    const genre = currentBook.genre;

    const [coPurchasedBooks] = await pool.query(`
        SELECT 
            b.*, 
            u.full_name as seller_name, 
            u.username as seller_username, 
            u.role as seller_role,
            COUNT(DISTINCT o.id) as purchase_frequency
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN books b ON oi.book_id = b.id
        JOIN users u ON b.seller_id = u.id
        WHERE o.buyer_id IN (
            SELECT DISTINCT o2.buyer_id 
            FROM order_items oi2
            JOIN orders o2 ON oi2.order_id = o2.id
            WHERE oi2.book_id = ? AND o2.status IN ('completed', 'confirmed', 'pending')
        )
        AND b.id != ?
        AND b.status = 'available'
        AND o.status IN ('completed', 'confirmed', 'pending')
        GROUP BY b.id
        ORDER BY purchase_frequency DESC, b.rating DESC, b.views DESC
        LIMIT ${safeLimit}
    `, [numericBookId, numericBookId]);

    if (coPurchasedBooks.length >= safeLimit) {
        return coPurchasedBooks.slice(0, safeLimit);
    }

    const results = [...coPurchasedBooks];
    const excludedIds = [numericBookId, ...results.map(b => b.id)];

    const neededGenreSlots = safeLimit - results.length;
    if (neededGenreSlots > 0) {
        const placeholders = excludedIds.map(() => '?').join(',');
        const [genreFallback] = await pool.query(`
            SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role 
            FROM books b 
            JOIN users u ON b.seller_id = u.id 
            WHERE b.genre = ? AND b.id NOT IN (${placeholders}) AND b.status = 'available'
            ORDER BY b.rating DESC, b.views DESC, b.created_at DESC
            LIMIT ${neededGenreSlots}
        `, [genre, ...excludedIds]);

        results.push(...genreFallback);
        genreFallback.forEach(b => excludedIds.push(b.id));
    }

    const neededTrendingSlots = safeLimit - results.length;
    if (neededTrendingSlots > 0) {
        const placeholders = excludedIds.map(() => '?').join(',');
        const [trendingFallback] = await pool.query(`
            SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role 
            FROM books b 
            JOIN users u ON b.seller_id = u.id 
            WHERE b.id NOT IN (${placeholders}) AND b.status = 'available'
            ORDER BY b.rating DESC, b.views DESC, b.created_at DESC
            LIMIT ${neededTrendingSlots}
        `, excludedIds);

        results.push(...trendingFallback);
    }

    return results;
};

/**
 * Phase 11C: Calculate User Affinity Scores & Profiles
 * Weights:
 * - Purchase = +10
 * - Wishlist = +5
 * - Cart = +4
 * - View = +2
 * - Search = +1
 */
const calculateUserAffinity = async (userId) => {
    const affinityScores = {};
    const sourcesCount = {
        purchasesCount: 0,
        wishlistCount: 0,
        cartCount: 0,
        viewsCount: 0,
        searchesCount: 0
    };

    const numericUserId = parseInt(userId, 10);
    if (isNaN(numericUserId) || numericUserId <= 0) {
        return {
            topGenres: [],
            affinityScores: {},
            recommendationSources: sourcesCount
        };
    }

    // 1. Purchases (+10 pts)
    const [purchases] = await pool.query(`
        SELECT b.genre, COUNT(*) as qty
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN books b ON oi.book_id = b.id
        WHERE o.buyer_id = ? AND o.status IN ('completed', 'confirmed', 'pending', 'paid')
        GROUP BY b.genre
    `, [numericUserId]);

    purchases.forEach(row => {
        if (row.genre) {
            affinityScores[row.genre] = (affinityScores[row.genre] || 0) + (row.qty * 10);
            sourcesCount.purchasesCount += Number(row.qty);
        }
    });

    // 2. Wishlist (+6 pts)
    const [wishlists] = await pool.query(`
        SELECT b.genre, COUNT(*) as qty
        FROM wishlists w
        JOIN books b ON w.book_id = b.id
        WHERE w.user_id = ?
        GROUP BY b.genre
    `, [numericUserId]);

    wishlists.forEach(row => {
        if (row.genre) {
            affinityScores[row.genre] = (affinityScores[row.genre] || 0) + (row.qty * 6);
            sourcesCount.wishlistCount += Number(row.qty);
        }
    });

    // 3. Cart Items (+5 pts)
    const [cartItems] = await pool.query(`
        SELECT b.genre, COUNT(*) as qty
        FROM cart_items c
        JOIN books b ON c.book_id = b.id
        WHERE c.user_id = ?
        GROUP BY b.genre
    `, [numericUserId]);

    cartItems.forEach(row => {
        if (row.genre) {
            affinityScores[row.genre] = (affinityScores[row.genre] || 0) + (row.qty * 5);
            sourcesCount.cartCount += Number(row.qty);
        }
    });

    // 4. Views (+4 pts for recent < 24h, +2 pts older)
    const [views] = await pool.query(`
        SELECT b.genre, 
               SUM(CASE WHEN ua.created_at >= NOW() - INTERVAL 24 HOUR THEN 4 ELSE 2 END) as score,
               COUNT(*) as qty
        FROM user_activity ua
        JOIN books b ON ua.reference_id = b.id
        WHERE ua.user_id = ? AND ua.activity_type = 'view'
        GROUP BY b.genre
    `, [numericUserId]);

    views.forEach(row => {
        if (row.genre) {
            affinityScores[row.genre] = (affinityScores[row.genre] || 0) + Number(row.score);
            sourcesCount.viewsCount += Number(row.qty);
        }
    });

    // 5. Searches (+2 pts)
    const [searches] = await pool.query(`
        SELECT search_query, COUNT(*) as qty
        FROM user_activity
        WHERE user_id = ? AND activity_type = 'search' AND search_query IS NOT NULL
        GROUP BY search_query
    `, [numericUserId]);

    // Check all known categories/genres for keyword matches in search
    const [allCategories] = await pool.query('SELECT DISTINCT genre FROM books WHERE genre IS NOT NULL');
    const knownGenres = allCategories.map(c => c.genre);

    searches.forEach(row => {
        const query = (row.search_query || '').toLowerCase();
        sourcesCount.searchesCount += Number(row.qty);
        knownGenres.forEach(g => {
            if (g && (query.includes(g.toLowerCase()) || g.toLowerCase().includes(query))) {
                affinityScores[g] = (affinityScores[g] || 0) + (row.qty * 2);
            }
        });
    });

    // Sort genres by score descending
    const topGenres = Object.entries(affinityScores)
        .map(([genre, score]) => ({ genre, score }))
        .sort((a, b) => b.score - a.score);

    return {
        topGenres,
        affinityScores,
        recommendationSources: sourcesCount
    };
};

/**
 * Phase 11C / Phase 16: Personalized Recommendations Engine
 * Limit: 8 books
 * Returns tailored recommendations based on user affinity, with fallback to trending/top-rated.
 */
const getPersonalizedRecommendations = async (userId, limit = 8, guestBookIds = []) => {
    const safeLimit = Math.max(1, parseInt(limit, 10) || 8);
    const numericUserId = parseInt(userId, 10);
    const validUserId = (!isNaN(numericUserId) && numericUserId > 0) ? numericUserId : null;

    // Get purchased book IDs to strictly exclude from recommendations
    let purchasedBookIds = [];
    if (validUserId) {
        const [purchasedRows] = await pool.query(`
            SELECT DISTINCT oi.book_id
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.buyer_id = ? AND o.status IN ('completed', 'confirmed', 'pending', 'paid')
        `, [validUserId]);
        purchasedBookIds = purchasedRows.map(r => r.book_id);
    }

    const excludedIds = [...purchasedBookIds];
    const results = [];

    // Calculate user affinity or guest browsing affinity
    let topGenres = [];
    if (validUserId) {
        const affinity = await calculateUserAffinity(validUserId);
        topGenres = affinity.topGenres || [];
    } else if (Array.isArray(guestBookIds) && guestBookIds.length > 0) {
        const cleanIds = guestBookIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0).slice(0, 20);
        if (cleanIds.length > 0) {
            const [guestRows] = await pool.query(
                `SELECT genre, COUNT(*) as qty FROM books WHERE id IN (${cleanIds.map(() => '?').join(',')}) AND genre IS NOT NULL AND genre != '' GROUP BY genre ORDER BY qty DESC`,
                cleanIds
            );
            topGenres = guestRows.map(r => ({ genre: r.genre, score: r.qty * 4 }));
        }
    }

    // Primary: Query from Top Affinity Genres
    if (topGenres.length > 0) {
        const topGenreNames = topGenres.slice(0, 4).map(g => g.genre);
        const genrePlaceholders = topGenreNames.map(() => '?').join(',');
        
        let query = `
            SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role
            FROM books b
            JOIN users u ON b.seller_id = u.id
            WHERE b.genre IN (${genrePlaceholders})
              AND (? IS NULL OR b.seller_id != ?)
              AND b.status = 'available'
        `;
        const params = [...topGenreNames, validUserId, validUserId];

        if (excludedIds.length > 0) {
            query += ` AND b.id NOT IN (${excludedIds.map(() => '?').join(',')})`;
            params.push(...excludedIds);
        }

        // Order by matched genre priority (FIELD) and rating/views
        const fieldOrder = topGenreNames.map(() => '?').join(',');
        query += ` ORDER BY FIELD(b.genre, ${fieldOrder}), b.rating DESC, b.views DESC LIMIT ${safeLimit}`;
        params.push(...topGenreNames);

        const [affinityBooks] = await pool.query(query, params);
        affinityBooks.forEach(b => {
            b.is_personalized = true;
            b.recommendation_reason = 'Because you explored ' + (b.genre || 'this topic');
            results.push(b);
            excludedIds.push(b.id);
        });
    }

    // Secondary: Books similar to purchased authors if slots remaining
    const neededSecondary = safeLimit - results.length;
    if (neededSecondary > 0 && purchasedBookIds.length > 0 && validUserId) {
        const [purchasedAuthors] = await pool.query(`
            SELECT DISTINCT b.author 
            FROM books b 
            WHERE b.id IN (${purchasedBookIds.map(() => '?').join(',')})
        `, purchasedBookIds);

        const authorNames = purchasedAuthors.map(a => a.author).filter(Boolean);
        if (authorNames.length > 0) {
            const authorPlaceholders = authorNames.map(() => '?').join(',');
            let query = `
                SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role
                FROM books b
                JOIN users u ON b.seller_id = u.id
                WHERE b.author IN (${authorPlaceholders})
                  AND (? IS NULL OR b.seller_id != ?)
                  AND b.status = 'available'
            `;
            const params = [...authorNames, validUserId, validUserId];

            if (excludedIds.length > 0) {
                query += ` AND b.id NOT IN (${excludedIds.map(() => '?').join(',')})`;
                params.push(...excludedIds);
            }

            query += ` ORDER BY b.rating DESC, b.views DESC LIMIT ${neededSecondary}`;

            const [authorBooks] = await pool.query(query, params);
            authorBooks.forEach(b => {
                b.is_personalized = true;
                b.recommendation_reason = 'Because you read books by ' + (b.author || 'this author');
                results.push(b);
                excludedIds.push(b.id);
            });
        }
    }

    // Fallback & Cold Start: Top-Rated, Most Wishlisted, Trending Books
    const neededFallback = safeLimit - results.length;
    if (neededFallback > 0) {
        let query = `
            SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role
            FROM books b
            JOIN users u ON b.seller_id = u.id
            WHERE (? IS NULL OR b.seller_id != ?)
              AND b.status = 'available'
        `;
        const params = [validUserId, validUserId];

        if (excludedIds.length > 0) {
            query += ` AND b.id NOT IN (${excludedIds.map(() => '?').join(',')})`;
            params.push(...excludedIds);
        }

        query += ` ORDER BY b.rating DESC, b.views DESC, b.created_at DESC LIMIT ${neededFallback}`;

        const [fallbackBooks] = await pool.query(query, params);
        fallbackBooks.forEach(b => {
            b.is_personalized = false;
            b.recommendation_reason = 'Trending & Highly Rated on BookNest';
            results.push(b);
        });
    }

    return results;
};

const mergeGuestHistory = async (userId, bookIds = []) => {
    if (!userId || !Array.isArray(bookIds) || bookIds.length === 0) return 0;
    let mergedCount = 0;
    for (const rawId of bookIds.slice(0, 30)) {
        const bookId = parseInt(rawId, 10);
        if (!isNaN(bookId) && bookId > 0) {
            try {
                const [existing] = await pool.query(
                    'SELECT id FROM user_activity WHERE user_id = ? AND activity_type = "view" AND reference_id = ?',
                    [userId, bookId]
                );
                if (existing.length === 0) {
                    await pool.execute(
                        'INSERT INTO user_activity (user_id, activity_type, reference_id) VALUES (?, "view", ?)',
                        [userId, bookId]
                    );
                    mergedCount++;
                }
            } catch (e) {
                // Ignore
            }
        }
    }
    return mergedCount;
};

const logActivity = async (userId, activityType, referenceId = null, metadata = {}) => {
    if (!userId || !activityType) return false;
    try {
        await pool.execute(
            'INSERT INTO user_activity (user_id, activity_type, reference_id, search_query) VALUES (?, ?, ?, ?)',
            [userId, activityType, referenceId, metadata.searchQuery || null]
        );
        return true;
    } catch (e) {
        console.warn('[recommendationService] logActivity error:', e.message);
        return false;
    }
};

module.exports = {
    getGenreRecommendations,
    getCoPurchaseRecommendations,
    calculateUserAffinity,
    getPersonalizedRecommendations,
    mergeGuestHistory,
    logActivity
};
