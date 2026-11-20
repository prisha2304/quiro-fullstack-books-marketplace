const { pool } = require('../config/db');

class Wishlist {
    static async findByUserId(userId) {
        const [rows] = await pool.execute(`
            SELECT w.id as wishlist_id, b.*, u.full_name as seller_name
            FROM wishlists w
            JOIN books b ON w.book_id = b.id
            JOIN users u ON b.seller_id = u.id
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC
        `, [userId]);
        return rows;
    }

    static async add(userId, bookId) {
        const [result] = await pool.execute(
            'INSERT IGNORE INTO wishlists (user_id, book_id) VALUES (?, ?)',
            [userId, bookId]
        );
        return result.affectedRows > 0;
    }

    static async remove(userId, bookId) {
        await pool.execute(
            'DELETE FROM wishlists WHERE user_id = ? AND book_id = ?',
            [userId, bookId]
        );
        return true;
    }

    static async getIdsForUser(userId) {
        const [rows] = await pool.execute(
            'SELECT book_id FROM wishlists WHERE user_id = ?',
            [userId]
        );
        return rows.map(r => r.book_id);
    }
}

module.exports = Wishlist;
