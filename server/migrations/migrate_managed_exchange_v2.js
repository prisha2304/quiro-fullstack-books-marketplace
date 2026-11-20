
const { pool } = require('../config/db');

async function migrate() {
    let connection;

    try {
        console.log('--- Starting Managed Exchange v2 Migration ---');

        connection = await pool.getConnection();

        // Check that required tables exist.
        const [addressTables] = await connection.execute(
            "SHOW TABLES LIKE 'swap_addresses'"
        );

        const [requestTables] = await connection.execute(
            "SHOW TABLES LIKE 'swap_requests'"
        );

        if (addressTables.length === 0 || requestTables.length === 0) {
            throw new Error(
                'Required swap_addresses or swap_requests table is missing. Run earlier migrations first.'
            );
        }

        // 1. Inspect swap_addresses columns.
        const [addrCols] = await connection.execute(
            'DESCRIBE swap_addresses'
        );

        const addrColNames = new Set(
            addrCols.map(column => column.Field)
        );

        const addAddrColIfMissing = async (col, definition) => {
            if (!addrColNames.has(col)) {
                await connection.execute(
                    `ALTER TABLE swap_addresses ADD COLUMN ${col} ${definition}`
                );

                addrColNames.add(col);
                console.log(`Added ${col} to swap_addresses`);
            }
        };

        await addAddrColIfMissing('pickup_address', 'TEXT NULL');
        await addAddrColIfMissing('delivery_address', 'TEXT NULL');
        await addAddrColIfMissing('delivery_instructions', 'TEXT NULL');
        await addAddrColIfMissing('confirmed_at', 'DATETIME NULL');

        // Copy existing address data only if the legacy column exists.
        if (addrColNames.has('address_line1')) {
            await connection.execute(`
                UPDATE swap_addresses
                SET
                    pickup_address = COALESCE(pickup_address, address_line1),
                    delivery_address = COALESCE(delivery_address, address_line1)
                WHERE address_line1 IS NOT NULL
                  AND (
                    pickup_address IS NULL
                    OR delivery_address IS NULL
                  )
            `);
        }

        // 2. Inspect swap_requests columns.
        const [reqCols] = await connection.execute(
            'DESCRIBE swap_requests'
        );

        const reqColNames = new Set(
            reqCols.map(column => column.Field)
        );

        const addReqColIfMissing = async (col, definition) => {
            if (!reqColNames.has(col)) {
                await connection.execute(
                    `ALTER TABLE swap_requests ADD COLUMN ${col} ${definition}`
                );

                reqColNames.add(col);
                console.log(`Added ${col} to swap_requests`);
            }
        };

        await addReqColIfMissing('requester_confirmed_at', 'DATETIME NULL');
        await addReqColIfMissing('owner_confirmed_at', 'DATETIME NULL');
        await addReqColIfMissing('pickup_date', 'DATETIME NULL');
        await addReqColIfMissing('delivery_notes', 'TEXT NULL');

        console.log(
            '--- Managed Exchange v2 Migration completed successfully ---'
        );

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


