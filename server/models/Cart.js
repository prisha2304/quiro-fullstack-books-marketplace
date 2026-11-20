const { pool } = require('../config/db');

class Cart {
    static async findByUserId(userId) {
        const [rows] = await pool.execute(`
            SELECT c.id as cart_item_id, c.quantity, b.*, u.full_name as seller_name
            FROM cart_items c
            JOIN books b ON c.book_id = b.id
            JOIN users u ON b.seller_id = u.id
            WHERE c.user_id = ?
            ORDER BY c.created_at DESC
        `, [userId]);
        return rows;
    }

    static async add(userId, bookId) {
        // First check if the book is available and for sale
        const [bookRows] = await pool.execute('SELECT * FROM books WHERE id = ?', [bookId]);
        if (!bookRows[0] || !bookRows[0].sale_enabled || bookRows[0].status !== 'available') {
            throw new Error('This book is not available for purchase');
        }

        // Check if already in cart
        const [existing] = await pool.execute(
            'SELECT * FROM cart_items WHERE user_id = ? AND book_id = ?',
            [userId, bookId]
        );

        if (existing.length > 0) {
            await pool.execute(
                'UPDATE cart_items SET quantity = quantity + 1 WHERE user_id = ? AND book_id = ?',
                [userId, bookId]
            );
            return true;
        }

        const [result] = await pool.execute(
            'INSERT INTO cart_items (user_id, book_id, quantity) VALUES (?, ?, 1)',
            [userId, bookId]
        );
        return result.affectedRows > 0;
    }

    static async remove(userId, bookId) {
        await pool.execute(
            'DELETE FROM cart_items WHERE user_id = ? AND book_id = ?',
            [userId, bookId]
        );
        return true;
    }

    static async updateQuantity(userId, bookId, quantity) {
        if (quantity < 1) {
            return await this.remove(userId, bookId);
        }
        await pool.execute(
            'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND book_id = ?',
            [quantity, userId, bookId]
        );
        return true;
    }

    static async clear(userId) {
        await pool.execute('DELETE FROM cart_items WHERE user_id = ?', [userId]);
        return true;
    }
}

module.exports = Cart;
