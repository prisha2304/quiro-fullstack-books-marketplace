
const { pool } = require('../config/db');
const logger = require('../services/logger');
const metricsService = require('../services/metricsService');

/**
 * Executes an action inside an explicit MySQL database transaction with auto-rollback,
 * connection release, and deadlock retry support.
 */
async function withTransaction(action, { maxRetries = 2, requestId = null } = {}) {
    let attempt = 0;
    while (attempt <= maxRetries) {
        let connection;
        const startTime = Date.now();
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();

            const result = await action(connection);

            await connection.commit();
            const duration = Date.now() - startTime;
            metricsService.recordDbQuery(duration, true);

            return result;
        } catch (err) {
            const duration = Date.now() - startTime;
            metricsService.recordDbQuery(duration, false);

            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackErr) {
                    logger.error('Transaction rollback failed', { error: rollbackErr.message, requestId });
                }
            }

            // Deadlock or lock wait timeout retry
            const isDeadlock = err.code === 'ER_LOCK_DEADLOCK' || err.code === 'ER_LOCK_WAIT_TIMEOUT';
            if (isDeadlock && attempt < maxRetries) {
                attempt++;
                logger.warn(`Transaction deadlock encountered. Retrying attempt ${attempt}/${maxRetries}...`, { requestId });
                await new Promise(r => setTimeout(r, 50 * attempt));
                continue;
            }

            logger.error('Transaction failed and was rolled back', { error: err.message, code: err.code, requestId });
            throw err;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
}

module.exports = { withTransaction };
