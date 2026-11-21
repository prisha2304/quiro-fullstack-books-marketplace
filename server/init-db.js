const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const initDB = async () => {
    const host = process.env.DB_HOST || 'localhost';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    let port = 3306;
    if (!isLocalhost) {
        port = parseInt(process.env.DB_PORT || '4000', 10);
    } else if (process.env.DB_PORT && process.env.DB_PORT !== '4000') {
        port = parseInt(process.env.DB_PORT, 10);
    }

    const dbName = process.env.DB_NAME || 'quiro';

    const connection = await mysql.createConnection({
        host,
        port,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true
    });

    try {
        console.log(`Creating database '${dbName}' if not exists...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await connection.query(`USE \`${dbName}\``);

        console.log('Reading schema.sql...');
        const schemaPath = path.resolve(__dirname, '../schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Applying base schema to database...');
        await connection.query(schema);

        // Ensure notifications table has entity_type, entity_id, action_url if pre-existing
        const [notifCols] = await connection.query('DESCRIBE notifications');
        const notifColNames = notifCols.map(c => c.Field);
        if (!notifColNames.includes('entity_type')) {
            await connection.query('ALTER TABLE notifications ADD COLUMN entity_type VARCHAR(50) NULL AFTER message');
        }
        if (!notifColNames.includes('entity_id')) {
            await connection.query('ALTER TABLE notifications ADD COLUMN entity_id INT NULL AFTER entity_type');
        }
        if (!notifColNames.includes('action_url')) {
            await connection.query('ALTER TABLE notifications ADD COLUMN action_url VARCHAR(255) NULL AFTER entity_id');
        }

        console.log(`Database '${dbName}' initialized successfully with base schema!`);
    } catch (error) {
        console.error('Error initializing database:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
};

if (require.main === module) {
    initDB()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Database initialization failed:', err);
            process.exit(1);
        });
}

module.exports = { initDB };
