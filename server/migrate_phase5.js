const { pool } = require('./config/db');

async function migrate() {
    console.log('Creating Phase 5 tables...');
    
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            reporter_id INT NOT NULL,
            target_type ENUM('book', 'seller', 'buyer', 'review', 'order', 'swap') NOT NULL,
            target_id INT NOT NULL,
            reason VARCHAR(100) NOT NULL,
            description TEXT,
            status ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED') DEFAULT 'OPEN',
            priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
            evidence_url VARCHAR(500) DEFAULT NULL,
            resolved_by INT DEFAULT NULL,
            resolution_notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_reporter (reporter_id),
            INDEX idx_target (target_type, target_id),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS disputes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dispute_code VARCHAR(30) UNIQUE NOT NULL,
            initiator_id INT NOT NULL,
            respondent_id INT NOT NULL,
            entity_type ENUM('order', 'swap') NOT NULL,
            entity_id INT NOT NULL,
            reason VARCHAR(150) NOT NULL,
            description TEXT NOT NULL,
            status ENUM('OPEN', 'UNDER_REVIEW', 'WAITING_FOR_USER', 'WAITING_FOR_SELLER', 'RESOLVED', 'REJECTED', 'ESCALATED') DEFAULT 'OPEN',
            priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
            return_status ENUM('NONE', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPING', 'RETURN_RECEIVED', 'RETURN_REJECTED') DEFAULT 'NONE',
            refund_status ENUM('NONE', 'REFUND_REQUESTED', 'REFUND_PROCESSING', 'REFUNDED', 'REFUND_REJECTED') DEFAULT 'NONE',
            refund_amount DECIMAL(10, 2) DEFAULT 0.00,
            assigned_admin_id INT DEFAULT NULL,
            resolution_type VARCHAR(100) DEFAULT NULL,
            resolution_notes TEXT DEFAULT NULL,
            resolved_at TIMESTAMP DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (initiator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (respondent_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_initiator (initiator_id),
            INDEX idx_respondent (respondent_id),
            INDEX idx_entity (entity_type, entity_id),
            INDEX idx_status (status),
            INDEX idx_code (dispute_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS dispute_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dispute_id INT NOT NULL,
            sender_id INT NOT NULL,
            sender_role ENUM('USER', 'SELLER', 'ADMIN') NOT NULL,
            message TEXT NOT NULL,
            attachments JSON DEFAULT NULL,
            is_internal BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_dispute (dispute_id),
            INDEX idx_sender (sender_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS dispute_evidence (
            id INT AUTO_INCREMENT PRIMARY KEY,
            dispute_id INT NOT NULL,
            uploader_id INT NOT NULL,
            file_url VARCHAR(500) NOT NULL,
            file_type VARCHAR(50) DEFAULT 'image',
            caption VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE,
            FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_dispute (dispute_id),
            INDEX idx_uploader (uploader_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('Phase 5 tables created successfully!');
    process.exit(0);
}

migrate().catch(e => { console.error('Migration error:', e); process.exit(1); });
