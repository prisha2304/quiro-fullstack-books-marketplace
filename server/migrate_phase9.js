const { pool } = require('./config/db');

async function migratePhase9() {
    console.log('--- Starting Phase 9 Database Migration ---');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Create ai_activity_logs table
        console.log('1. Creating ai_activity_logs table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS ai_activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                seller_id INT NULL,
                ai_feature VARCHAR(100) NOT NULL,
                request_type VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50) NULL,
                entity_id INT NULL,
                prompt_snippet TEXT NULL,
                recommendation TEXT NULL,
                evidence JSON NULL,
                user_action ENUM('NONE', 'VIEWED', 'APPLIED', 'DISMISSED', 'REJECTED') DEFAULT 'NONE',
                action_result TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ai_log_user (user_id),
                INDEX idx_ai_log_seller (seller_id),
                INDEX idx_ai_log_entity (entity_type, entity_id),
                INDEX idx_ai_log_feature (ai_feature),
                INDEX idx_ai_log_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 2. Create ai_anomalies table
        console.log('2. Creating ai_anomalies table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS ai_anomalies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                anomaly_type VARCHAR(100) NOT NULL,
                severity ENUM('INFO', 'LOW', 'MEDIUM', 'HIGH') DEFAULT 'LOW',
                affected_entity_type VARCHAR(50) NOT NULL,
                affected_entity_id INT NULL,
                confidence DECIMAL(5,2) DEFAULT 80.00,
                evidence JSON NULL,
                status ENUM('ACTIVE', 'INVESTIGATING', 'RESOLVED', 'DISMISSED') DEFAULT 'ACTIVE',
                resolution_notes TEXT NULL,
                resolved_by_admin_id INT NULL,
                detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_anomaly_type (anomaly_type),
                INDEX idx_anomaly_severity (severity),
                INDEX idx_anomaly_status (status),
                INDEX idx_anomaly_entity (affected_entity_type, affected_entity_id),
                INDEX idx_anomaly_detected (detected_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 3. Create ai_cached_insights table
        console.log('3. Creating ai_cached_insights table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS ai_cached_insights (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cache_key VARCHAR(255) NOT NULL UNIQUE,
                category VARCHAR(50) NOT NULL,
                user_id INT NULL,
                seller_id INT NULL,
                book_id INT NULL,
                time_range VARCHAR(50) DEFAULT '30d',
                insight_data JSON NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cache_key (cache_key),
                INDEX idx_cache_expiry (expires_at),
                INDEX idx_cache_seller (seller_id),
                INDEX idx_cache_book (book_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.commit();
        console.log('✅ Phase 9 Database Migration completed successfully!');
    } catch (error) {
        await connection.rollback();
        console.error('❌ Phase 9 Database Migration failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

if (require.main === module) {
    migratePhase9().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migratePhase9 };
