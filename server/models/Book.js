const { pool } = require('../config/db');

class Book {
    static async findAll(filters = {}, options = {}) {
        const { 
            search, genre, category, condition, language, priceMin, priceMax, minPrice, maxPrice,
            minRating, rating, sale_enabled, swap_enabled, availability, seller_id
        } = filters;
        
        const { sort = 'newest', limit = 12, page = 1 } = options;
        const safeLimit = Math.max(1, parseInt(limit, 10) || 12);
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (safePage - 1) * safeLimit;

        let whereClause = ' WHERE 1=1';
        const params = [];

        if (seller_id) {
            whereClause += ` AND b.seller_id = ?`;
            params.push(seller_id);
        }

        // Multi-field search across title, author, isbn, publisher, description, genre
        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            whereClause += ` AND (
                b.title LIKE ? OR 
                b.author LIKE ? OR 
                b.isbn LIKE ? OR 
                b.publisher LIKE ? OR 
                b.description LIKE ? OR 
                b.genre LIKE ? OR 
                u.full_name LIKE ?
            )`;
            params.push(term, term, term, term, term, term, term);
        }

        const targetGenre = genre || category;
        if (targetGenre && targetGenre !== 'All' && targetGenre !== 'all') {
            whereClause += ` AND (b.genre = ? OR b.genre IN (SELECT name FROM categories WHERE parent_category = ?))`;
            params.push(targetGenre, targetGenre);
        }

        if (condition && condition !== 'All' && condition !== 'all') {
            whereClause += ` AND b.condition = ?`;
            params.push(condition);
        }

        if (language) {
            whereClause += ` AND b.language = ?`;
            params.push(language);
        }

        const effectiveMinPrice = priceMin !== undefined ? priceMin : minPrice;
        if (effectiveMinPrice !== undefined && effectiveMinPrice !== null && effectiveMinPrice !== '' && !isNaN(effectiveMinPrice)) {
            whereClause += ` AND b.price >= ?`;
            params.push(parseFloat(effectiveMinPrice));
        }

        const effectiveMaxPrice = priceMax !== undefined ? priceMax : maxPrice;
        if (effectiveMaxPrice !== undefined && effectiveMaxPrice !== null && effectiveMaxPrice !== '' && !isNaN(effectiveMaxPrice)) {
            whereClause += ` AND b.price <= ?`;
            params.push(parseFloat(effectiveMaxPrice));
        }

        const effectiveRating = minRating !== undefined ? minRating : rating;
        if (effectiveRating !== undefined && effectiveRating !== null && effectiveRating !== '' && !isNaN(effectiveRating)) {
            whereClause += ` AND b.rating >= ?`;
            params.push(parseFloat(effectiveRating));
        }

        if (sale_enabled === 'true' || sale_enabled === true) {
            whereClause += ` AND b.sale_enabled = TRUE`;
        }

        if (swap_enabled === 'true' || swap_enabled === true) {
            whereClause += ` AND b.swap_enabled = TRUE`;
        }

        if (availability === 'available' || !availability) {
            whereClause += ` AND b.status = 'available'`;
        } else if (availability === 'swap_only') {
            whereClause += ` AND b.status = 'available' AND b.swap_enabled = TRUE`;
        } else if (availability === 'sale_only') {
            whereClause += ` AND b.status = 'available' AND b.sale_enabled = TRUE`;
        } else if (availability !== 'all') {
            whereClause += ` AND b.status = ?`;
            params.push(availability);
        }

        // Build SELECT and Sorting
        let selectFields = `
            b.*, 
            u.full_name as seller_name, 
            u.username as seller_username, 
            u.role as seller_role
        `;
        let joinClause = `
            FROM books b 
            JOIN users u ON b.seller_id = u.id
        `;

        let orderClause = ' ORDER BY b.created_at DESC';
        switch (sort) {
            case 'price_low':
            case 'price_asc':
                orderClause = ' ORDER BY b.price ASC';
                break;
            case 'price_high':
            case 'price_desc':
                orderClause = ' ORDER BY b.price DESC';
                break;
            case 'rating_desc':
            case 'highest_rated':
                orderClause = ' ORDER BY b.rating DESC, b.review_count DESC, b.created_at DESC';
                break;
            case 'views_desc':
            case 'most_viewed':
                orderClause = ' ORDER BY b.views DESC, b.created_at DESC';
                break;
            case 'best_selling':
                selectFields += `, COALESCE(sales.sold_qty, 0) as sales_count`;
                joinClause += ` LEFT JOIN (
                    SELECT book_id, COUNT(*) as sold_qty 
                    FROM order_items 
                    GROUP BY book_id
                ) sales ON b.id = sales.book_id`;
                orderClause = ' ORDER BY sales_count DESC, b.rating DESC, b.created_at DESC';
                break;
            case 'oldest':
                orderClause = ' ORDER BY b.created_at ASC';
                break;
            case 'alpha_asc':
                orderClause = ' ORDER BY b.title ASC';
                break;
            case 'alpha_desc':
                orderClause = ' ORDER BY b.title DESC';
                break;
            case 'newest':
            default:
                orderClause = ' ORDER BY b.created_at DESC';
                break;
        }

        const query = `SELECT ${selectFields} ${joinClause} ${whereClause} ${orderClause} LIMIT ${safeLimit} OFFSET ${offset}`;
        const countQuery = `SELECT COUNT(*) as total FROM books b JOIN users u ON b.seller_id = u.id ${whereClause}`;

        const [rows] = await pool.query(query, params);
        const [totalRows] = await pool.query(countQuery, params);
        const total = totalRows[0].total;

        return {
            books: rows,
            pagination: {
                total,
                page: safePage,
                limit: safeLimit,
                pages: Math.ceil(total / safeLimit) || 1
            }
        };
    }

    static async findFeatured() {
        const [rows] = await pool.execute(`
            SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role
            FROM books b 
            JOIN users u ON b.seller_id = u.id 
            WHERE b.status = 'available'
            ORDER BY b.created_at DESC
            LIMIT 8
        `);
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.execute(`
            SELECT b.*, u.full_name as seller_name, u.profile_image as seller_image, u.created_at as seller_since, u.username as seller_username, u.role as seller_role
            FROM books b 
            JOIN users u ON b.seller_id = u.id 
            WHERE b.id = ?
        `, [id]);
        return rows[0];
    }

    static async findRelated(id) {
        const book = await this.findById(id);
        if (!book) return [];

        const [rows] = await pool.execute(`
            SELECT b.*, u.full_name as seller_name, u.username as seller_username, u.role as seller_role 
            FROM books b 
            JOIN users u ON b.seller_id = u.id 
            WHERE b.id != ? AND (b.genre = ? OR b.author = ?) AND b.status = 'available'
            LIMIT 4
        `, [id, book.genre, book.author]);
        return rows;
    }

    static async findByUserId(userId) {
        const [rows] = await pool.execute(`
            SELECT * FROM books WHERE seller_id = ? ORDER BY created_at DESC
        `, [userId]);
        return rows;
    }

    static async create(bookData) {
        const { 
            seller_id, title, author, isbn, description, genre, 
            language, publication_year, publisher, price, original_price, condition, 
            cover_image, additional_images, sale_enabled, swap_enabled,
            preferred_book, preferred_genre, accept_any_book
        } = bookData;

        const [result] = await pool.execute(`
            INSERT INTO books (
                seller_id, title, author, isbn, description, genre, 
                language, publication_year, publisher, price, original_price, \`condition\`, 
                cover_image, additional_images, sale_enabled, swap_enabled,
                preferred_book, preferred_genre, accept_any_book
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            seller_id, 
            title, 
            author, 
            isbn || null, 
            description || null, 
            genre, 
            language || 'English', 
            (publication_year && publication_year !== '') ? parseInt(publication_year) : null, 
            publisher || null, 
            (price && price !== '') ? parseFloat(price) : 0.00, 
            (original_price && original_price !== '') ? parseFloat(original_price) : null, 
            condition, 
            cover_image || null, 
            JSON.stringify(additional_images || []), 
            sale_enabled === true || sale_enabled === 'true' || sale_enabled === 1 || sale_enabled === '1', 
            swap_enabled === true || swap_enabled === 'true' || swap_enabled === 1 || swap_enabled === '1', 
            preferred_book || null, 
            preferred_genre || null, 
            accept_any_book === true || accept_any_book === 'true' || accept_any_book === 1 || accept_any_book === '1'
        ]);

        return result.insertId;
    }

    static async update(id, bookData) {
        const { 
            title, author, isbn, description, genre, 
            language, publication_year, publisher, price, original_price, condition, 
            cover_image, additional_images, sale_enabled, swap_enabled,
            preferred_book, preferred_genre, accept_any_book, status
        } = bookData;

        await pool.execute(`
            UPDATE books SET 
                title = ?, author = ?, isbn = ?, description = ?, genre = ?, 
                language = ?, publication_year = ?, publisher = ?, price = ?, original_price = ?, \`condition\` = ?, 
                cover_image = ?, additional_images = ?, sale_enabled = ?, swap_enabled = ?,
                preferred_book = ?, preferred_genre = ?, accept_any_book = ?, status = ?
            WHERE id = ?
        `, [
            title, 
            author, 
            isbn || null, 
            description || null, 
            genre, 
            language || 'English', 
            (publication_year && publication_year !== '') ? parseInt(publication_year) : null, 
            publisher || null, 
            (price && price !== '') ? parseFloat(price) : 0.00, 
            (original_price && original_price !== '') ? parseFloat(original_price) : null, 
            condition, 
            cover_image || null, 
            JSON.stringify(additional_images || []), 
            sale_enabled === true || sale_enabled === 'true' || sale_enabled === 1 || sale_enabled === '1', 
            swap_enabled === true || swap_enabled === 'true' || swap_enabled === 1 || swap_enabled === '1', 
            preferred_book || null, 
            preferred_genre || null, 
            accept_any_book === true || accept_any_book === 'true' || accept_any_book === 1 || accept_any_book === '1',
            status,
            id
        ]);
        
        return true;
    }

    static async delete(id) {
        await pool.execute('DELETE FROM books WHERE id = ?', [id]);
        return true;
    }

    static async getSuggestions(q) {
        const popular = ['Programming', 'UPSC', 'NCERT', 'Fiction', 'Engineering', 'Finance', 'Medical', 'Manga'];
        
        if (!q || !q.trim()) {
            return {
                titles: [],
                authors: [],
                genres: [],
                popular
            };
        }

        const term = `%${q.trim()}%`;

        const [matchingBooks] = await pool.query(
            "SELECT id, title, author, genre, price, cover_image FROM books WHERE status = 'available' AND title LIKE ? ORDER BY rating DESC, views DESC LIMIT 4", 
            [term]
        );

        const [matchingAuthors] = await pool.query(
            "SELECT DISTINCT author FROM books WHERE status = 'available' AND author LIKE ? LIMIT 3", 
            [term]
        );

        const [matchingGenres] = await pool.query(
            "SELECT DISTINCT genre FROM books WHERE status = 'available' AND genre LIKE ? LIMIT 3", 
            [term]
        );

        return {
            titles: matchingBooks,
            authors: matchingAuthors.map(a => a.author),
            genres: matchingGenres.map(g => g.genre),
            popular
        };
    }
}

module.exports = Book;

