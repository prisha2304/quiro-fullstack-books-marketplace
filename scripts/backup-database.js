
const fs = require('fs');
const path = require('path');

try {
    require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });
} catch (e) {
    try { require('dotenv').config(); } catch (err) {}
}

const { pool } = require('../server/config/db');

async function backupDatabase() {
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${process.env.DB_NAME || 'booknest'}_${timestamp}.sql`;
    const targetFile = path.join(backupDir, filename);

    console.log(`📦 Initiating database backup to ${filename}...`);

    try {
        const [tables] = await pool.execute('SHOW TABLES');
        let sqlDump = `-- BookNest Database Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

        for (const row of tables) {
            const tableName = Object.values(row)[0];
            const [createTable] = await pool.execute(`SHOW CREATE TABLE \`${tableName}\``);
            sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
            sqlDump += createTable[0]['Create Table'] + `;\n\n`;

            const [rows] = await pool.execute(`SELECT * FROM \`${tableName}\` LIMIT 1000`);
            if (rows.length > 0) {
                for (const r of rows) {
                    const keys = Object.keys(r).map(k => `\`${k}\``).join(', ');
                    const vals = Object.values(r).map(v => v === null ? 'NULL' : (typeof v === 'number' ? v : `'${String(v).replace(/'/g, "\\'")}'`)).join(', ');
                    sqlDump += `INSERT INTO \`${tableName}\` (${keys}) VALUES (${vals});\n`;
                }
                sqlDump += '\n';
            }
        }

        fs.writeFileSync(targetFile, sqlDump, 'utf8');
        console.log(`✔ Backup saved successfully: ${targetFile} (${fs.statSync(targetFile).size} bytes)`);
        return { success: true, targetFile, sizeBytes: fs.statSync(targetFile).size };
    } catch (e) {
        console.error('❌ Backup failed:', e.message);
        throw e;
    }
}

if (require.main === module) {
    backupDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { backupDatabase };
