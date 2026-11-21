const { pool } = require('./config/db');

async function migratePhase10() {
    console.log('--- Starting Phase 10 Database Migration ---');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Create marketplace_experiments table
        console.log('1. Creating marketplace_experiments table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS marketplace_experiments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT NULL,
                status ENUM('DRAFT', 'RUNNING', 'PAUSED', 'CONCLUDED') DEFAULT 'DRAFT',
                variants JSON NOT NULL,
                allocation JSON NULL,
                target_metric VARCHAR(50) DEFAULT 'PURCHASE',
                start_date TIMESTAMP NULL,
                end_date TIMESTAMP NULL,
                winner_variant VARCHAR(50) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_exp_status (status),
                INDEX idx_exp_metric (target_metric)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 2. Create experiment_events table
        console.log('2. Creating experiment_events table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS experiment_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                experiment_id INT NOT NULL,
                variant VARCHAR(50) NOT NULL,
                user_id INT NULL,
                session_id VARCHAR(100) NULL,
                event_type ENUM('IMPRESSION', 'CLICK', 'WISHLIST', 'CART', 'CHECKOUT', 'PURCHASE') NOT NULL,
                metadata JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_event_exp (experiment_id, variant),
                INDEX idx_event_type (event_type),
                INDEX idx_event_user (user_id),
                INDEX idx_event_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 3. Create feature_flags table
        console.log('3. Creating feature_flags table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS feature_flags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                flag_key VARCHAR(100) NOT NULL UNIQUE,
                description TEXT NULL,
                enabled BOOLEAN DEFAULT FALSE,
                rollout_percentage INT DEFAULT 0,
                rules JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_flag_key (flag_key),
                INDEX idx_flag_enabled (enabled)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Seed default feature flags if not present
        await connection.execute(`
            INSERT IGNORE INTO feature_flags (flag_key, description, enabled, rollout_percentage) VALUES
            ('AI_SELLER_COPILOT', 'Enable AI Seller Copilot in seller studio', TRUE, 100),
            ('AI_PRICE_INSIGHTS', 'Enable competitive price recommendations', TRUE, 100),
            ('PERSONALIZED_HOMEPAGE', 'Dynamic personalized homepage sections', TRUE, 100),
            ('NEW_CHECKOUT', 'Optimized multi-step checkout workflow', TRUE, 100),
            ('EXPERIMENTAL_SEARCH', 'Semantic and intent-aware search ranking', TRUE, 50),
            ('SHIPMENT_TRACKING', 'Real-time carrier and manual shipment timeline', TRUE, 100)
        `);

        // 4. Create intelligence_reports table
        console.log('4. Creating intelligence_reports table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS intelligence_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                report_type ENUM('DAILY_MARKETPLACE', 'WEEKLY_MARKETPLACE', 'SELLER_OPERATIONS', 'CATALOG_HEALTH', 'SEARCH_TRENDS', 'FULFILLMENT_HEALTH', 'PAYMENT_HEALTH') NOT NULL,
                title VARCHAR(200) NOT NULL,
                period_start TIMESTAMP NOT NULL,
                period_end TIMESTAMP NOT NULL,
                metrics JSON NOT NULL,
                insights JSON NULL,
                generated_by_admin_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_rep_type (report_type),
                INDEX idx_rep_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 5. Create automation_jobs table
        console.log('5. Creating automation_jobs table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS automation_jobs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                job_key VARCHAR(100) NOT NULL UNIQUE,
                job_name VARCHAR(150) NOT NULL,
                description TEXT NULL,
                schedule VARCHAR(50) DEFAULT 'HOURLY',
                status ENUM('ACTIVE', 'PAUSED', 'RUNNING', 'FAILED') DEFAULT 'ACTIVE',
                last_run_at TIMESTAMP NULL,
                last_run_status VARCHAR(50) NULL,
                last_run_summary JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_job_key (job_key),
                INDEX idx_job_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Seed default automation jobs
        await connection.execute(`
            INSERT IGNORE INTO automation_jobs (job_key, job_name, description, schedule, status) VALUES
            ('EXPIRE_RESERVATIONS', 'Inventory Reservation Expiry', 'Releases expired cart and pending checkout reservations', 'EVERY_15_MIN', 'ACTIVE'),
            ('REFRESH_INTELLIGENCE_CACHE', 'Marketplace Intelligence Cache Refresh', 'Pre-aggregates hourly demand, catalog and funnel metrics', 'HOURLY', 'ACTIVE'),
            ('DETECT_STALE_LISTINGS', 'Stale Listing & Inventory Monitor', 'Flags listings with zero engagement over 60 days', 'DAILY', 'ACTIVE'),
            ('DETECT_CATALOG_GAPS', 'Catalog Gap & Search Coverage Monitor', 'Detects high-demand search queries lacking active supply', 'DAILY', 'ACTIVE'),
            ('SCAN_SLA_BREACH_RISKS', 'Fulfillment SLA Proactive Warning', 'Identifies orders approaching packing or shipping deadlines', 'EVERY_30_MIN', 'ACTIVE')
        `);

        // 6. Create marketplace_health_snapshots table
        console.log('6. Creating marketplace_health_snapshots table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS marketplace_health_snapshots (
                id INT AUTO_INCREMENT PRIMARY KEY,
                overall_status ENUM('HEALTHY', 'WATCH', 'ATTENTION_REQUIRED') DEFAULT 'HEALTHY',
                metrics JSON NOT NULL,
                active_anomalies_count INT DEFAULT 0,
                notes TEXT NULL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_health_status (overall_status),
                INDEX idx_health_recorded (recorded_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.commit();
        console.log('✅ Phase 10 Database Migration completed successfully!');
    } catch (error) {
        await connection.rollback();
        console.error('❌ Phase 10 Database Migration failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

const migrate = migratePhase10;

if (require.main === module) {
    migratePhase10().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migrate, migratePhase10 };
