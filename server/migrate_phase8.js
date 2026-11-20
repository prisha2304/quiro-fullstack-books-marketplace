const { pool } = require('./config/db');

async function migratePhase8() {
    console.log('--- Starting Phase 8 Database Migration ---');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Create seller_onboarding table
        console.log('1. Creating seller_onboarding table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS seller_onboarding (
                id INT AUTO_INCREMENT PRIMARY KEY,
                seller_id INT NOT NULL UNIQUE,
                seller_status ENUM('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED') DEFAULT 'NOT_STARTED',
                seller_display_name VARCHAR(150) NULL,
                seller_bio TEXT NULL,
                seller_phone_verified BOOLEAN DEFAULT FALSE,
                seller_email_verified BOOLEAN DEFAULT TRUE,
                campus_department VARCHAR(100) NULL,
                profile_completion_percentage INT DEFAULT 0,
                verification_submitted_at TIMESTAMP NULL,
                verification_reviewed_at TIMESTAMP NULL,
                onboarding_completed_at TIMESTAMP NULL,
                rejection_reason TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_onboarding_seller (seller_id),
                INDEX idx_onboarding_status (seller_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 2. Create listing_moderation table
        console.log('2. Creating listing_moderation table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS listing_moderation (
                id INT AUTO_INCREMENT PRIMARY KEY,
                book_id INT NOT NULL UNIQUE,
                seller_id INT NOT NULL,
                quality_score INT DEFAULT 50,
                quality_status ENUM('EXCELLENT', 'GOOD', 'NEEDS_IMPROVEMENT', 'INCOMPLETE') DEFAULT 'GOOD',
                quality_issues JSON NULL,
                quality_suggestions JSON NULL,
                moderation_status ENUM('ACTIVE', 'PENDING_REVIEW', 'FLAGGED', 'REJECTED', 'SUSPENDED') DEFAULT 'ACTIVE',
                is_duplicate_suspect BOOLEAN DEFAULT FALSE,
                duplicate_matched_book_id INT NULL,
                flagged_reason TEXT NULL,
                moderated_by_admin_id INT NULL,
                moderated_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_mod_book (book_id),
                INDEX idx_mod_seller (seller_id),
                INDEX idx_mod_status (moderation_status),
                INDEX idx_mod_quality (quality_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 3. Create shipments table
        console.log('3. Creating shipments table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS shipments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                seller_id INT NOT NULL,
                tracking_number VARCHAR(100) NOT NULL UNIQUE,
                carrier VARCHAR(100) DEFAULT 'CampusExpress',
                mode ENUM('MANUAL', 'COURIER_API', 'MOCK') DEFAULT 'MOCK',
                status ENUM('LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED') DEFAULT 'LABEL_CREATED',
                shipped_at TIMESTAMP NULL,
                estimated_delivery TIMESTAMP NULL,
                delivered_at TIMESTAMP NULL,
                tracking_url VARCHAR(255) NULL,
                metadata JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ship_order (order_id),
                INDEX idx_ship_seller (seller_id),
                INDEX idx_ship_tracking (tracking_number),
                INDEX idx_ship_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 4. Create shipment_events table
        console.log('4. Creating shipment_events table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS shipment_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shipment_id INT NOT NULL,
                status VARCHAR(50) NOT NULL,
                location VARCHAR(150) NULL,
                description TEXT NOT NULL,
                event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_event_shipment (shipment_id),
                INDEX idx_event_time (event_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 5. Create seller_sla_events table
        console.log('5. Creating seller_sla_events table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS seller_sla_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                seller_id INT NOT NULL,
                sla_type ENUM('PROCESSING', 'PACKING', 'SHIPPING', 'DELIVERY') NOT NULL,
                target_deadline TIMESTAMP NOT NULL,
                completed_at TIMESTAMP NULL,
                sla_status ENUM('ON_TIME', 'AT_RISK', 'BREACHED') DEFAULT 'ON_TIME',
                breach_duration_hours INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_sla_seller (seller_id, sla_status),
                INDEX idx_sla_order (order_id, sla_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 6. Enhance orders status column with all fulfillment workflow states
        console.log('6. Enhancing orders status column for fulfillment workflow...');
        await connection.execute(`
            ALTER TABLE orders MODIFY COLUMN status 
            ENUM('pending', 'confirmed', 'processing', 'ready_to_pack', 'packed', 'ready_to_ship', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'partially_refunded') 
            DEFAULT 'pending'
        `);

        await connection.commit();
        console.log('✅ Phase 8 Database Migration completed successfully!');
    } catch (error) {
        await connection.rollback();
        console.error('❌ Phase 8 Database Migration failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

if (require.main === module) {
    migratePhase8().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migratePhase8 };
