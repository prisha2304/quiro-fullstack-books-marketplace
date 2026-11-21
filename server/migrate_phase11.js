
const { pool } = require('./config/db');

async function migratePhase11() {
    console.log('--- Starting Phase 11 Database Migration (Observability & Reliability) ---');

    try {
        // 1. payment_webhook_events
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS payment_webhook_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_id VARCHAR(100) UNIQUE NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                status ENUM('RECEIVED', 'VERIFIED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED_DUPLICATE') DEFAULT 'RECEIVED',
                payload JSON NULL,
                processed_at DATETIME NULL,
                error_reason TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_webhook_status (status),
                INDEX idx_webhook_type (event_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✔ payment_webhook_events table ready');

        // 2. job_executions
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS job_executions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                job_key VARCHAR(100) NOT NULL,
                idempotency_key VARCHAR(150) UNIQUE NOT NULL,
                status ENUM('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'RETRYING', 'CANCELLED') DEFAULT 'QUEUED',
                attempt_number INT DEFAULT 1,
                max_attempts INT DEFAULT 3,
                started_at DATETIME NULL,
                completed_at DATETIME NULL,
                duration_ms INT NULL,
                summary JSON NULL,
                error_reason TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_job_key (job_key),
                INDEX idx_job_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✔ job_executions table ready');

        // 3. security_events
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS security_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_type VARCHAR(100) NOT NULL,
                severity ENUM('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'INFO',
                ip_address VARCHAR(50) NULL,
                user_id INT NULL,
                request_id VARCHAR(100) NULL,
                details JSON NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_sec_type (event_type),
                INDEX idx_sec_severity (severity)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✔ security_events table ready');

        console.log('--- Phase 11 Migration Completed Successfully ---');
    } catch (err) {
        console.error('❌ Phase 11 Migration Failed:', err);
        throw err;
    }
}

const migrate = migratePhase11;

module.exports = { migrate, migratePhase11 };

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('❌ Phase 11 Migration Failed:', err);
            process.exit(1);
        });
}
