const { pool } = require('../config/db');

async function migrate() {
    let connection;
    try {
        console.log('--- Starting User Token Version Migration ---');
        connection = await pool.getConnection();

        const [tables] = await connection.execute("SHOW TABLES LIKE 'users'");
        if (tables.length === 0) {
            throw new Error('Required users table is missing.');
        }

        const [cols] = await connection.execute('DESCRIBE users');
        const colNames = new Set(cols.map(c => c.Field));

        if (!colNames.has('token_version')) {
            await connection.execute(
                'ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 1'
            );
            console.log('Added token_version column to users (default 1).');
        } else {
            console.log('token_version column already exists on users (no-op).');
        }

        await connection.execute(
            'UPDATE users SET token_version = 1 WHERE token_version IS NULL OR token_version < 1'
        );

        console.log('--- User Token Version Migration Complete ---');
    } finally {
        if (connection) connection.release();
    }
}

if (require.main === module) {
    migrate()
        .then(async () => {
            await pool.end();
            process.exit(0);
        })
        .catch(async (err) => {
            console.error('Migration failed:', err.message);
            try { await pool.end(); } catch (_) {}
            process.exit(1);
        });
}

module.exports = { migrate };
