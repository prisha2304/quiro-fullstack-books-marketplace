const { pool } = require('./config/db');

async function migratePhase7() {
    console.log('--- Starting Phase 7 Database Migration ---');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Extend payments table
        console.log('1. Enhancing payments table...');
        
        // Check existing columns in payments
        const [paymentCols] = await connection.execute('DESCRIBE payments');
        const colNames = paymentCols.map(c => c.Field.toLowerCase());

        if (!colNames.includes('user_id')) {
            await connection.execute('ALTER TABLE payments ADD COLUMN user_id INT NULL AFTER order_id');
        }
        if (!colNames.includes('currency')) {
            await connection.execute("ALTER TABLE payments ADD COLUMN currency VARCHAR(10) DEFAULT 'INR' AFTER amount");
        }
        if (!colNames.includes('failure_reason')) {
            await connection.execute('ALTER TABLE payments ADD COLUMN failure_reason TEXT NULL AFTER method');
        }
        if (!colNames.includes('refund_amount')) {
            await connection.execute('ALTER TABLE payments ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0.00 AFTER failure_reason');
        }
        if (!colNames.includes('idempotency_key')) {
            await connection.execute('ALTER TABLE payments ADD COLUMN idempotency_key VARCHAR(128) NULL AFTER refund_amount');
        }
        if (!colNames.includes('metadata')) {
            await connection.execute('ALTER TABLE payments ADD COLUMN metadata JSON NULL AFTER idempotency_key');
        }
        if (!colNames.includes('updated_at')) {
            await connection.execute('ALTER TABLE payments ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
        }
        if (!colNames.includes('captured_at')) {
            await connection.execute('ALTER TABLE payments ADD COLUMN captured_at TIMESTAMP NULL AFTER updated_at');
        }
        if (!colNames.includes('refunded_at')) {
            await connection.execute('ALTER TABLE payments ADD COLUMN refunded_at TIMESTAMP NULL AFTER captured_at');
        }

        // Change status to VARCHAR(50) first so values can be mapped
        await connection.execute("ALTER TABLE payments MODIFY COLUMN status VARCHAR(50) DEFAULT 'PENDING'");
        await connection.execute("UPDATE payments SET status = 'CAPTURED' WHERE status IN ('paid', 'PAID')");
        await connection.execute("UPDATE payments SET status = 'FAILED' WHERE status IN ('failed', 'FAILED')");
        await connection.execute("UPDATE payments SET status = 'PENDING' WHERE status IN ('pending', 'PENDING')");

        // Enhance orders status to include partially_refunded
        await connection.execute("ALTER TABLE orders MODIFY COLUMN status ENUM('pending','confirmed','packed','shipped','out_for_delivery','delivered','cancelled','refunded','partially_refunded') DEFAULT 'pending'");

        // Index on payments
        try {
            await connection.execute('CREATE INDEX idx_payments_order_id ON payments (order_id)');
        } catch (e) { /* index may already exist */ }
        try {
            await connection.execute('CREATE INDEX idx_payments_user_id ON payments (user_id)');
        } catch (e) { /* index may already exist */ }
        try {
            await connection.execute('CREATE INDEX idx_payments_rzp_order ON payments (razorpay_order_id)');
        } catch (e) { /* index may already exist */ }
        try {
            await connection.execute('CREATE INDEX idx_payments_rzp_pay ON payments (razorpay_payment_id)');
        } catch (e) { /* index may already exist */ }
        try {
            await connection.execute('CREATE INDEX idx_payments_status ON payments (status)');
        } catch (e) { /* index may already exist */ }

        // 2. Create inventory_reservations table
        console.log('2. Creating inventory_reservations table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS inventory_reservations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                book_id INT NOT NULL,
                user_id INT NOT NULL,
                order_id INT NULL,
                quantity INT NOT NULL DEFAULT 1,
                status ENUM('RESERVED', 'FINALIZED', 'RELEASED', 'EXPIRED') DEFAULT 'RESERVED',
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_reservations_book_status (book_id, status, expires_at),
                INDEX idx_reservations_user_status (user_id, status),
                INDEX idx_reservations_order (order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 3. Create payment_idempotency table
        console.log('3. Creating payment_idempotency table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS payment_idempotency (
                id INT AUTO_INCREMENT PRIMARY KEY,
                idempotency_key VARCHAR(128) NOT NULL UNIQUE,
                user_id INT NOT NULL,
                request_path VARCHAR(255) NOT NULL,
                request_hash VARCHAR(64) NOT NULL,
                response_status INT NOT NULL,
                response_body LONGTEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NULL,
                INDEX idx_idempotency_user (user_id),
                INDEX idx_idempotency_key (idempotency_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 4. Create payment_refunds table
        console.log('4. Creating payment_refunds table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS payment_refunds (
                id INT AUTO_INCREMENT PRIMARY KEY,
                payment_id INT NOT NULL,
                order_id INT NOT NULL,
                user_id INT NOT NULL,
                dispute_id INT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'INR',
                reason TEXT NULL,
                status ENUM('REFUND_REQUESTED', 'REFUND_PROCESSING', 'REFUND_COMPLETED', 'REFUND_FAILED') DEFAULT 'REFUND_REQUESTED',
                razorpay_refund_id VARCHAR(128) NULL,
                idempotency_key VARCHAR(128) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP NULL,
                INDEX idx_refunds_payment (payment_id),
                INDEX idx_refunds_order (order_id),
                INDEX idx_refunds_user (user_id),
                INDEX idx_refunds_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 5. Create seller_payouts table
        console.log('5. Creating seller_payouts table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS seller_payouts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                seller_id INT NOT NULL,
                order_id INT NOT NULL,
                payment_id INT NULL,
                gross_amount DECIMAL(10,2) NOT NULL,
                platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                seller_amount DECIMAL(10,2) NOT NULL,
                payout_status ENUM('PENDING', 'ELIGIBLE', 'PROCESSING', 'PAID', 'ON_HOLD', 'REVERSED') DEFAULT 'PENDING',
                payout_reference VARCHAR(128) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP NULL,
                INDEX idx_payouts_seller (seller_id),
                INDEX idx_payouts_order (order_id),
                INDEX idx_payouts_status (payout_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 6. Create financial_ledger table (Append-Only)
        console.log('6. Creating financial_ledger table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS financial_ledger (
                id INT AUTO_INCREMENT PRIMARY KEY,
                transaction_id VARCHAR(64) NOT NULL UNIQUE,
                order_id INT NULL,
                payment_id INT NULL,
                seller_id INT NULL,
                user_id INT NULL,
                transaction_type ENUM('SALE', 'PAYMENT', 'REFUND', 'PLATFORM_FEE', 'SELLER_EARNING', 'PAYOUT', 'PAYOUT_REVERSAL', 'ADJUSTMENT') NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'INR',
                direction ENUM('CREDIT', 'DEBIT') NOT NULL,
                status ENUM('COMPLETED', 'PENDING', 'FAILED') DEFAULT 'COMPLETED',
                metadata JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ledger_tx (transaction_id),
                INDEX idx_ledger_order (order_id),
                INDEX idx_ledger_payment (payment_id),
                INDEX idx_ledger_seller (seller_id),
                INDEX idx_ledger_user (user_id),
                INDEX idx_ledger_type (transaction_type),
                INDEX idx_ledger_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.commit();
        console.log('✅ Phase 7 Database Migration completed successfully!');
    } catch (error) {
        await connection.rollback();
        console.error('❌ Phase 7 Database Migration failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

const migrate = migratePhase7;

if (require.main === module) {
    migratePhase7().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { migrate, migratePhase7 };
