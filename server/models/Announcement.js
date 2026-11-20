const { pool } = require('../config/db');

class Announcement {
    static async create({ title, message, category = 'GENERAL', created_by = null }) {
        const [result] = await pool.execute(
            'INSERT INTO announcements (title, message, category, created_by, is_active) VALUES (?, ?, ?, ?, TRUE)',
            [title, message, category, created_by]
        );
        return result.insertId;
    }

    static async findAll(limit = 50, offset = 0) {
        const [rows] = await pool.execute(
            `SELECT a.*, u.full_name as author_name, u.email as author_email
             FROM announcements a
             LEFT JOIN users u ON a.created_by = u.id
             ORDER BY a.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit.toString(), offset.toString()]
        );
        return rows;
    }

    static async findActive(limit = 20) {
        const [rows] = await pool.execute(
            `SELECT a.*, u.full_name as author_name
             FROM announcements a
             LEFT JOIN users u ON a.created_by = u.id
             WHERE a.is_active = TRUE
             ORDER BY a.created_at DESC
             LIMIT ?`,
            [limit.toString()]
        );
        return rows;
    }

    static async delete(id) {
        const [result] = await pool.execute('DELETE FROM announcements WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

module.exports = Announcement;
