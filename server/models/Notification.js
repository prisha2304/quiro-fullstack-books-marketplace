const { pool } = require('../config/db');

class Notification {
    static async create(notificationData) {
        const { user_id, type, title, message, entity_type, entity_id, action_url } = notificationData;
        const [result] = await pool.execute(
            `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, action_url, is_read) 
             VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
            [user_id, type, title, message, entity_type || null, entity_id || null, action_url || null]
        );
        return result.insertId;
    }

    static async createBulk(notificationsList) {
        if (!Array.isArray(notificationsList) || notificationsList.length === 0) return 0;

        const values = [];
        const placeholders = notificationsList.map(n => {
            values.push(
                n.user_id,
                n.type || 'SYSTEM_ANNOUNCEMENT',
                n.title,
                n.message,
                n.entity_type || null,
                n.entity_id || null,
                n.action_url || null
            );
            return '(?, ?, ?, ?, ?, ?, ?, FALSE)';
        }).join(', ');

        const [result] = await pool.execute(
            `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, action_url, is_read) 
             VALUES ${placeholders}`,
            values
        );
        return result.affectedRows;
    }

    static async findByUserId(userId, limit = 50, offset = 0, category = null) {
        let sql = 'SELECT * FROM notifications WHERE user_id = ?';
        const params = [userId];

        if (category && category !== 'ALL') {
            if (category === 'ORDERS') {
                sql += " AND type LIKE 'ORDER_%'";
            } else if (category === 'SWAPS') {
                sql += " AND type LIKE 'SWAP_%'";
            } else if (category === 'MESSAGES') {
                sql += " AND type LIKE '%MESSAGE%'";
            } else if (category === 'REVIEWS') {
                sql += " AND type LIKE '%REVIEW%'";
            } else if (category === 'MARKETPLACE' || category === 'WISHLIST') {
                sql += " AND (type LIKE 'BOOK_%' OR type LIKE 'WISHLIST_%' OR type LIKE 'PRICE_%')";
            } else if (category === 'SYSTEM') {
                sql += " AND (type LIKE 'ADMIN_%' OR type LIKE 'SYSTEM_%')";
            }
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit.toString(), offset.toString());

        const [rows] = await pool.execute(sql, params);
        return rows;
    }

    static async markAsRead(id, userId) {
        const [result] = await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        return result.affectedRows > 0;
    }

    static async markAllAsRead(userId) {
        const [result] = await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        return result.affectedRows;
    }

    static async delete(id, userId) {
        const [result] = await pool.execute(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        return result.affectedRows > 0;
    }

    static async clearRead(userId) {
        const [result] = await pool.execute(
            'DELETE FROM notifications WHERE user_id = ? AND is_read = TRUE',
            [userId]
        );
        return result.affectedRows;
    }

    static async getUnreadCount(userId) {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        return parseInt(rows[0]?.count || 0, 10);
    }
}

module.exports = Notification;
