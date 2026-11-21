const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

function getDbConfig() {
    const host = process.env.DB_HOST || 'localhost';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';

    // Support TiDB Cloud (typically port 4000 with SSL enabled) and local MySQL (typically port 3306)
    let port = 3306;
    if (!isLocalhost) {
        port = parseInt(process.env.DB_PORT || '4000', 10);
    } else if (process.env.DB_PORT && process.env.DB_PORT !== '4000') {
        port = parseInt(process.env.DB_PORT, 10);
    }

    const ssl = (!isLocalhost && process.env.DB_SSL === 'true')
        ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
        : undefined;

    // Default to configured DB_NAME, or fallback to quiro
    const database = process.env.DB_NAME || 'quiro';

    return {
        host,
        port,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database,
        ssl,
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '10', 10),
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
    };
}

const pool = mysql.createPool(getDbConfig());

const connectDB = async () => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT DATABASE() as db, VERSION() as version');
        console.log(`MySQL Connected... Database: ${rows[0]?.db} (${rows[0]?.version})`);
        connection.release();
    } catch (error) {
        console.error('MySQL connection error:', error.message);
        // Do not call process.exit(1) synchronously so health checks or pool reconnects can handle transient restarts
        throw error;
    }
};

module.exports = { pool, connectDB, getDbConfig };
