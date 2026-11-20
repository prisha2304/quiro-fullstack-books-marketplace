const { pool } = require('../config/db');

class BookSimilarityService {
    /**
     * Find similar books based on genre, author, and price range
     */
    static async getSimilarBooks(bookId, limit = 6) {
        const numericId = parseInt(bookId, 10);
        if (!numericId || isNaN(numericId)) return [];

        const [sourceRows] = await pool.query('SELECT * FROM books WHERE id = ?', [numericId]);
        if (sourceRows.length === 0) return [];
        const source = sourceRows[0];

        // Find books with same genre or author, ranked by rating and views
        const [similar] = await pool.query(`
            SELECT b.*, u.full_name as seller_name
            FROM books b
            JOIN users u ON b.seller_id = u.id
            WHERE b.id != ? AND (b.genre = ? OR b.author = ?)
            ORDER BY (CASE WHEN b.genre = ? THEN 2 ELSE 1 END) DESC, b.rating DESC, b.views DESC
            LIMIT ?
        `, [numericId, source.genre, source.author, source.genre, limit]);

        return similar.map(b => ({
            ...b,
            price: parseFloat(b.price),
            rating: parseFloat(b.rating || 4.5)
        }));
    }

    /**
     * Find cheaper alternative books in the same subject/genre
     */
    static async getCheaperAlternatives(bookId, limit = 4) {
        const numericId = parseInt(bookId, 10);
        if (!numericId || isNaN(numericId)) return [];

        const [sourceRows] = await pool.query('SELECT * FROM books WHERE id = ?', [numericId]);
        if (sourceRows.length === 0) return [];
        const source = sourceRows[0];

        const [cheaper] = await pool.query(`
            SELECT b.*, u.full_name as seller_name
            FROM books b
            JOIN users u ON b.seller_id = u.id
            WHERE b.id != ? AND b.genre = ? AND b.price < ? AND b.status = 'available'
            ORDER BY b.price ASC, b.rating DESC
            LIMIT ?
        `, [numericId, source.genre, source.price, limit]);

        return cheaper.map(b => ({
            ...b,
            price: parseFloat(b.price),
            rating: parseFloat(b.rating || 4.5),
            savings: parseFloat((parseFloat(source.price) - parseFloat(b.price)).toFixed(2))
        }));
    }
}

module.exports = BookSimilarityService;
