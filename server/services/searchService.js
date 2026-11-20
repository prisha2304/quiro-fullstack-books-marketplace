const { pool } = require('../config/db');

const TYPO_MAP = {
    'pythn': 'python',
    'pyton': 'python',
    'pyhton': 'python',
    'dsa': 'data structures',
    'algo': 'algorithms',
    'algotithms': 'algorithms',
    'jva': 'java',
    'jav': 'java',
    'cormen': 'thomas cormen',
    'clrs': 'introduction to algorithms',
    'upsc': 'civil services',
    'ncert': 'ncert',
    'mathemetics': 'mathematics',
    'maths': 'mathematics'
};

class SearchService {
    /**
     * Normalize ISBN string (strip hyphens and whitespace)
     */
    static normalizeISBN(isbn) {
        if (!isbn) return '';
        return isbn.toString().replace(/[-\s]/g, '').trim();
    }

    /**
     * Check if query looks like ISBN-10 or ISBN-13
     */
    static isISBN(query) {
        const cleaned = this.normalizeISBN(query);
        return /^(97[89])?\d{9}[\dX]$/i.test(cleaned);
    }

    /**
     * Execute comprehensive relevance-ranked catalog search
     */
    static async searchBooks(queryParams = {}) {
        const {
            q, search, query,
            genre, category, author, publisher, language, condition,
            minPrice, maxPrice, priceMin, priceMax,
            rating, minRating,
            sellerType, availability = 'all',
            sort = 'relevance',
            page = 1, limit = 16
        } = queryParams;

        const rawTerm = (q || search || query || '').trim();
        const normalizedTerm = rawTerm.toLowerCase();
        const cleanedISBN = this.normalizeISBN(rawTerm);
        const isIsbnSearch = this.isISBN(rawTerm);

        // Check for typo correction
        let didYouMean = null;
        for (const [misspelled, correction] of Object.entries(TYPO_MAP)) {
            if (normalizedTerm.includes(misspelled)) {
                didYouMean = normalizedTerm.replace(misspelled, correction);
                break;
            }
        }

        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 16));
        const offset = (safePage - 1) * safeLimit;

        // Build query conditions
        let whereClause = ' WHERE 1=1';
        const params = [];

        // Availability filter
        if (availability === 'available') {
            whereClause += " AND b.status = 'available'";
        }

        // Textual Search Matching
        if (rawTerm) {
            if (isIsbnSearch) {
                whereClause += " AND (REPLACE(REPLACE(b.isbn, '-', ''), ' ', '') = ? OR b.title LIKE ?)";
                params.push(cleanedISBN, `%${rawTerm}%`);
            } else {
                const words = rawTerm.split(/\s+/).filter(w => w.length > 0);
                const wordConditions = words.map(() => `(
                    b.title LIKE ? OR 
                    b.author LIKE ? OR 
                    b.isbn LIKE ? OR 
                    b.publisher LIKE ? OR 
                    b.description LIKE ? OR 
                    b.genre LIKE ? OR 
                    u.full_name LIKE ?
                )`);
                whereClause += ` AND (${wordConditions.join(' AND ')})`;

                words.forEach(w => {
                    const term = `%${w}%`;
                    params.push(term, term, term, term, term, term, term);
                });
            }
        }

        // Category/Genre filter
        const targetGenre = genre || category;
        if (targetGenre && targetGenre !== 'All' && targetGenre !== 'all') {
            whereClause += " AND b.genre = ?";
            params.push(targetGenre);
        }

        // Author filter
        if (author) {
            whereClause += " AND b.author LIKE ?";
            params.push(`%${author}%`);
        }

        // Publisher filter
        if (publisher) {
            whereClause += " AND b.publisher LIKE ?";
            params.push(`%${publisher}%`);
        }

        // Language filter
        if (language && language !== 'All') {
            whereClause += " AND b.language = ?";
            params.push(language);
        }

        // Condition filter
        if (condition && condition !== 'All') {
            whereClause += " AND b.condition = ?";
            params.push(condition);
        }

        // Price filters
        const lowPrice = parseFloat(minPrice || priceMin);
        if (!isNaN(lowPrice)) {
            whereClause += " AND b.price >= ?";
            params.push(lowPrice);
        }

        const highPrice = parseFloat(maxPrice || priceMax);
        if (!isNaN(highPrice)) {
            whereClause += " AND b.price <= ?";
            params.push(highPrice);
        }

        // Rating filter
        const targetRating = parseFloat(rating || minRating);
        if (!isNaN(targetRating) && targetRating > 0) {
            whereClause += " AND b.rating >= ?";
            params.push(targetRating);
        }

        // Seller type filter
        if (sellerType === 'OFFICIAL') {
            whereClause += " AND u.role = 'ADMIN'";
        } else if (sellerType === 'STUDENT') {
            whereClause += " AND u.role != 'ADMIN'";
        }

        // Sorting Logic
        let orderBy = '';
        if (sort === 'price_asc' || sort === 'price_low') {
            orderBy = ' ORDER BY b.price ASC';
        } else if (sort === 'price_desc' || sort === 'price_high') {
            orderBy = ' ORDER BY b.price DESC';
        } else if (sort === 'rating') {
            orderBy = ' ORDER BY b.rating DESC, b.views DESC';
        } else if (sort === 'popular') {
            orderBy = ' ORDER BY b.views DESC, b.rating DESC';
        } else if (sort === 'value') {
            orderBy = " ORDER BY (b.rating * 100 - b.price + CASE WHEN b.status = 'available' THEN 50 ELSE 0 END) DESC";
        } else {
            // Default: Relevance + Availability
            if (rawTerm) {
                orderBy = ` ORDER BY 
                    (CASE WHEN b.title = '${rawTerm.replace(/'/g, "''")}' THEN 100 ELSE 0 END +
                     CASE WHEN b.title LIKE '${rawTerm.replace(/'/g, "''")}%' THEN 60 ELSE 0 END +
                     CASE WHEN b.author LIKE '%${rawTerm.replace(/'/g, "''")}%' THEN 40 ELSE 0 END +
                     CASE WHEN b.status = 'available' THEN 25 ELSE 0 END) DESC,
                    b.rating DESC, b.views DESC`;
            } else {
                orderBy = ' ORDER BY b.created_at DESC';
            }
        }

        // Count Total Matches
        const countSql = `
            SELECT COUNT(*) as total
            FROM books b
            JOIN users u ON b.seller_id = u.id
            ${whereClause}
        `;
        const [countResult] = await pool.query(countSql, params);
        const total = parseInt(countResult[0]?.total || 0, 10);

        // Fetch Paginated Results
        const selectSql = `
            SELECT 
                b.*,
                u.full_name as seller_name,
                u.role as seller_role,
                u.college as seller_college,
                (SELECT COUNT(*) FROM reviews r WHERE r.book_id = b.id) as review_count,
                (SELECT COUNT(*) FROM wishlists w WHERE w.book_id = b.id) as wishlist_count
            FROM books b
            JOIN users u ON b.seller_id = u.id
            ${whereClause}
            ${orderBy}
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.query(selectSql, [...params, safeLimit, offset]);

        // Enrich with smart search badges
        const enrichedResults = rows.map(b => {
            let badge = null;
            if (b.rating >= 4.8) badge = 'TOP_RATED';
            else if (b.views >= 20) badge = 'TRENDING';
            else if (parseFloat(b.price) <= 250) badge = 'BEST_VALUE';

            return {
                ...b,
                searchBadge: badge,
                price: parseFloat(b.price),
                rating: parseFloat(b.rating || 4.5),
                isAvailable: b.status === 'available'
            };
        });

        // Search Analytics Logging (Non-blocking)
        if (rawTerm) {
            this.logSearchEvent(rawTerm, total).catch(() => {});
        }

        return {
            query: rawTerm,
            results: enrichedResults,
            total,
            page: safePage,
            pageSize: safeLimit,
            totalPages: Math.ceil(total / safeLimit) || 1,
            sort,
            didYouMean,
            filters: {
                genre: targetGenre || null,
                condition: condition || null,
                minPrice: lowPrice || null,
                maxPrice: highPrice || null,
                rating: targetRating || null,
                sellerType: sellerType || null
            }
        };
    }

    /**
     * Grouped Search Autocomplete Suggestions
     */
    static async getSuggestions(query, limit = 8) {
        const raw = (query || '').trim();
        if (!raw || raw.length < 2) {
            return { books: [], authors: [], categories: [], isbns: [] };
        }

        const searchTerm = `%${raw}%`;

        // 1. Books (Titles)
        const [books] = await pool.query(`
            SELECT b.id, b.title, b.author, b.price, b.cover_image, b.genre, b.condition, b.status
            FROM books b
            WHERE title LIKE ? OR isbn LIKE ?
            ORDER BY (CASE WHEN title LIKE ? THEN 2 ELSE 1 END) DESC, views DESC
            LIMIT ?
        `, [searchTerm, searchTerm, `${raw}%`, limit]);

        // 2. Authors
        const [authors] = await pool.query(`
            SELECT DISTINCT author
            FROM books
            WHERE author LIKE ?
            LIMIT 4
        `, [searchTerm]);

        // 3. Categories / Genres
        const [categories] = await pool.query(`
            SELECT DISTINCT genre
            FROM books
            WHERE genre LIKE ?
            LIMIT 4
        `, [searchTerm]);

        // 4. Normalized ISBN match
        const cleaned = this.normalizeISBN(raw);
        let isbns = [];
        if (cleaned.length >= 4) {
            const [isbnRows] = await pool.query(`
                SELECT id, title, isbn
                FROM books
                WHERE REPLACE(REPLACE(isbn, '-', ''), ' ', '') LIKE ?
                LIMIT 2
            `, [`%${cleaned}%`]);
            isbns = isbnRows.map(i => ({ bookId: i.id, title: i.title, isbn: i.isbn }));
        }

        return {
            books: books.map(b => ({
                id: b.id,
                title: b.title,
                author: b.author,
                price: parseFloat(b.price),
                genre: b.genre,
                coverImage: b.cover_image,
                condition: b.condition,
                isAvailable: b.status === 'available'
            })),
            authors: authors.map(a => a.author),
            categories: categories.map(c => c.genre),
            isbns
        };
    }

    /**
     * Get Trending Searches from persistent MySQL analytics with fallback
     */
    static async getTrendingSearches() {
        try {
            const [rows] = await pool.query(
                'SELECT query, COUNT(*) as count ' +
                'FROM search_history ' +
                'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) ' +
                'GROUP BY query ' +
                'ORDER BY count DESC ' +
                'LIMIT 7'
            );
            if (rows.length > 0) {
                return rows.map(r => r.query);
            }
        } catch (e) {}

        return [
            'DSA Cormen',
            'Python Crash Course',
            'UPSC Polity Laxmikanth',
            'Engineering Mathematics',
            'Atomic Habits',
            'Clean Code',
            'Machine Learning'
        ];
    }

    /**
     * Log search query analytics persistently in MySQL
     */
    static async logSearchEvent(query, resultCount = 0, userId = null) {
        if (!query || typeof query !== 'string') return;
        try {
            await pool.query(
                'INSERT INTO search_history (user_id, query, results_count) VALUES (?, ?, ?)',
                [userId || null, query.trim().slice(0, 255), resultCount]
            );
        } catch (e) {
            // Non-blocking telemetry
        }
    }
}

module.exports = SearchService;
