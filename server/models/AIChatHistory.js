const { pool } = require('../config/db');

class AIChatHistory {
    static async create({ user_id = null, session_id = null, message, response, recommended_books = [] }) {
        const booksJson = JSON.stringify(recommended_books || []);
        const [result] = await pool.execute(
            'INSERT INTO ai_chat_history (user_id, session_id, message, response, recommended_books) VALUES (?, ?, ?, ?, ?)',
            [user_id || null, session_id || null, message, response, booksJson]
        );
        return result.insertId;
    }

    static async getHistory({ userId = null, sessionId = null, limit = 30 }) {
        let query = 'SELECT * FROM ai_chat_history WHERE ';
        const params = [];

        if (userId) {
            query += 'user_id = ?';
            params.push(userId);
        } else if (sessionId) {
            query += 'session_id = ?';
            params.push(sessionId);
        } else {
            return [];
        }

        query += ` ORDER BY created_at ASC LIMIT ${parseInt(limit, 10)}`;

        const [rows] = await pool.query(query, params);
        return rows.map(r => ({
            ...r,
            recommended_books: typeof r.recommended_books === 'string' ? JSON.parse(r.recommended_books) : (r.recommended_books || [])
        }));
    }

    static async clearHistory({ userId = null, sessionId = null }) {
        if (userId) {
            await pool.execute('DELETE FROM ai_chat_history WHERE user_id = ?', [userId]);
        } else if (sessionId) {
            await pool.execute('DELETE FROM ai_chat_history WHERE session_id = ?', [sessionId]);
        }
        return true;
    }
}

module.exports = AIChatHistory;
