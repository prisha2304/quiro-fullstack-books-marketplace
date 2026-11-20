const { pool } = require('../config/db');

class Message {
    static async create({ conversation_id, sender_id, receiver_id, message }) {
        const [result] = await pool.execute(
            'INSERT INTO messages (conversation_id, sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, ?, FALSE)',
            [conversation_id, sender_id, receiver_id || null, message]
        );
        return result.insertId;
    }

    static async findByConversationId(conversationId, limit = 100, offset = 0) {
        const [rows] = await pool.execute(
            `SELECT m.*, u.full_name as sender_name, u.username as sender_username, u.profile_image as sender_image
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.conversation_id = ? 
             ORDER BY m.created_at ASC
             LIMIT ? OFFSET ?`,
            [conversationId, limit.toString(), offset.toString()]
        );
        return rows;
    }

    static async markAsRead(id, userId) {
        const [result] = await pool.execute(
            'UPDATE messages SET is_read = TRUE WHERE id = ? AND receiver_id = ?',
            [id, userId]
        );
        return result.affectedRows > 0;
    }

    static async markConversationAsRead(conversationId, userId) {
        const [result] = await pool.execute(
            'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND receiver_id = ? AND is_read = FALSE',
            [conversationId, userId]
        );
        return result.affectedRows;
    }

    static async getGlobalUnreadCount(userId) {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = FALSE',
            [userId]
        );
        return parseInt(rows[0]?.count || 0, 10);
    }
}

module.exports = Message;
