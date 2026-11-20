
const fs = require('fs');
const path = require('path');

try {
    require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });
} catch (e) {
    try { require('dotenv').config(); } catch (err) {}
}

const { pool } = require('../server/config/db');

async function restoreDatabase(backupFilePath) {
    if (!backupFilePath || !fs.existsSync(backupFilePath)) {
        throw new Error('Backup file does not exist: ' + backupFilePath);
    }

    console.log(`🔄 Initiating Database Restore Drill from ${backupFilePath}...`);
    const sqlContent = fs.readFileSync(backupFilePath, 'utf8');
    const statements = sqlContent
        .split(';\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Executing ${statements.length} SQL statements...`);

    // Execute in connection
    const connection = await pool.getConnection();
    try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        for (const stmt of statements) {
            try {
                await connection.query(stmt);
            } catch (err) {
                // Ignore drop non-existent table notices
                if (!err.message.includes('Unknown table')) {
                    throw err;
                }
            }
        }
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✔ Database restore completed successfully.');
        return { success: true, statementsExecuted: statements.length };
    } finally {
        connection.release();
    }
}

if (require.main === module) {
    const backupDir = path.join(__dirname, '../backups');
    if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'));
        if (files.length > 0) {
            const latest = path.join(backupDir, files[files.length - 1]);
            restoreDatabase(latest)
                .then(() => process.exit(0))
                .catch((e) => {
                    console.error('❌ Restore failed:', e.message);
                    process.exit(1);
                });
        } else {
            console.log('No backup file found in backups/');
            process.exit(1);
        }
    }
}

module.exports = { restoreDatabase };
