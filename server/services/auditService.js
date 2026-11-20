const { pool } = require('../config/db');

class AuditService {
    static async log(userId, action, entityType, entityId, details = {}, req = null) {
        try {
            const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';
            const detailsJson = JSON.stringify(details);

            await pool.execute(
                'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
                [userId || null, action, entityType, entityId || null, detailsJson, ipAddress]
            );
        } catch (error) {
            console.error('Failed to write audit log:', error.message);
        }
    }

    static async getLogs(limit = 50, offset = 0, entityType = null) {
        let query = `
            SELECT a.*, u.full_name as user_name, u.email as user_email, u.role as user_role
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
        `;
        const params = [];

        if (entityType) {
            query += ' WHERE a.entity_type = ?';
            params.push(entityType);
        }

        query += ` ORDER BY a.created_at DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;

        const [rows] = await pool.query(query, params);
        return rows;
    }
}

module.exports = AuditService;
