
const { pool } = require('../config/db');

async function migrate() {
    let connection;

    try {
        console.log('--- Starting Swap Exchange Methods Migration ---');

        connection = await pool.getConnection();

        // Verify the base table exists.
        const [tables] = await connection.execute(
            "SHOW TABLES LIKE 'swap_requests'"
        );

        if (tables.length === 0) {
            throw new Error(
                'swap_requests table does not exist. Run base schema first.'
            );
        }

        // Inspect existing columns.
        const [existingColumns] = await connection.execute(
            'DESCRIBE swap_requests'
        );

        const colNames = new Set(
            existingColumns.map(column => column.Field)
        );

        // Change status to VARCHAR.
        await connection.execute(`
            ALTER TABLE swap_requests
            MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'
        `);

        // Add columns only when missing.
        const addColumnIfMissing = async (name, definition) => {
            if (!colNames.has(name)) {
                await connection.execute(
                    `ALTER TABLE swap_requests ADD COLUMN ${name} ${definition}`
                );

                colNames.add(name);
                console.log(`Added column: ${name}`);
            }
        };

        await addColumnIfMissing('exchange_method', 'VARCHAR(50) NULL');
        await addColumnIfMissing('requester_method', 'VARCHAR(50) NULL');
        await addColumnIfMissing('owner_method', 'VARCHAR(50) NULL');
        await addColumnIfMissing('method_agreed', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('requester_consent', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('owner_consent', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('shipping_fee_per_user', 'DECIMAL(10,2) DEFAULT 79.00');
        await addColumnIfMissing('requester_paid', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('owner_paid', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('collection_date', 'DATETIME NULL');
        await addColumnIfMissing('delivery_date', 'DATETIME NULL');
        await addColumnIfMissing('courier_tracking', 'VARCHAR(100) NULL');
        await addColumnIfMissing('courier_status', 'VARCHAR(50) NULL');
        await addColumnIfMissing('requester_confirmed', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('owner_confirmed', 'TINYINT(1) DEFAULT 0');

        // Create supporting tables if they don't exist.
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS swap_addresses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                swap_id INT NOT NULL,
                user_id INT NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                address_line1 TEXT NOT NULL,
                city VARCHAR(100) NOT NULL,
                state VARCHAR(100) NOT NULL,
                postal_code VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_swap_user (swap_id, user_id),
                INDEX idx_swap_id (swap_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS swap_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                swap_id INT NOT NULL,
                user_id INT NOT NULL,
                role VARCHAR(20) NOT NULL,
                razorpay_order_id VARCHAR(100) NOT NULL,
                razorpay_payment_id VARCHAR(100) NULL,
                razorpay_signature VARCHAR(255) NULL,
                amount DECIMAL(10,2) NOT NULL DEFAULT 79.00,
                status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                refund_id VARCHAR(100) NULL,
                refund_amount DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_swap_payment (swap_id, user_id),
                INDEX idx_razorpay_order (razorpay_order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS swap_timeline (
                id INT AUTO_INCREMENT PRIMARY KEY,
                swap_id INT NOT NULL,
                status VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                actor_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_timeline_swap (swap_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('--- Swap Exchange Methods Migration completed ---');

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = { migrate };

if (require.main === module) {
    migrate()
        .then(() => {
            console.log('Migration successful');
            process.exitCode = 0;
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exitCode = 1;
        });
}
