const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// -------------------------------------------------------------
// Test Execution Detection & Isolated Test Configuration Loading
// -------------------------------------------------------------
const isTestExecution = process.env.NODE_ENV === 'test' ||
    (process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('/tests/'));

if (isTestExecution) {
    // If executing in test mode, load .env.test without overriding explicit process.env overrides
    const testEnvPath = path.resolve(__dirname, '../.env.test');
    if (fs.existsSync(testEnvPath)) {
        require('dotenv').config({ path: testEnvPath, override: false });
    }
} else {
    require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
    require('dotenv').config();
}

function getSslConfig(hostOverride) {
    const host = hostOverride || process.env.DB_HOST || 'localhost';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';

    if (isLocalhost) {
        return undefined;
    }

    // In test execution, remote SSL connections are forbidden
    if (isTestExecution) {
        throw new Error(`[TEST ISOLATION SAFETY GUARD] FATAL: SSL requested for remote host '${host}' during test execution. Tests cannot connect to remote databases.`);
    }

    // Remote database connections must require TLS. Never silently fall back to an unencrypted connection.
    if (process.env.DB_SSL === 'false') {
        throw new Error('Remote database connections require TLS. Unencrypted connections are not permitted for security.');
    }

    const ssl = {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    };

    if (process.env.DB_CA_PATH) {
        const candidatePaths = [
            path.isAbsolute(process.env.DB_CA_PATH) ? process.env.DB_CA_PATH : null,
            path.resolve(process.cwd(), process.env.DB_CA_PATH),
            path.resolve(__dirname, '..', process.env.DB_CA_PATH),
            path.resolve(__dirname, '../..', process.env.DB_CA_PATH)
        ].filter(Boolean);

        let resolvedCaPath = null;
        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                resolvedCaPath = p;
                break;
            }
        }

        if (!resolvedCaPath) {
            throw new Error(`Configured DB_CA_PATH '${process.env.DB_CA_PATH}' was not found or is unreadable. TLS connection cannot proceed securely.`);
        }

        try {
            ssl.ca = fs.readFileSync(resolvedCaPath);
        } catch (readErr) {
            throw new Error(`Failed to read CA certificate from '${resolvedCaPath}': ${readErr.message}`);
        }
    }

    return ssl;
}

function getDbConfig() {
    const host = process.env.DB_HOST || 'localhost';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';

    // -------------------------------------------------------------
    // TEST ISOLATION SAFETY GUARD
    // Strictly enforces that test executions only connect to localhost quiro_test
    // -------------------------------------------------------------
    if (isTestExecution) {
        if (!isLocalhost) {
            throw new Error(
                `[TEST ISOLATION SAFETY GUARD] FATAL: Automated tests attempted to connect to remote host '${host}'. ` +
                `Tests are strictly prohibited from connecting to remote databases (including TiDB Cloud). Connection aborted.`
            );
        }

        const designatedTestDb = process.env.TEST_DB_NAME || 'quiro_test';
        const targetDb = process.env.DB_NAME || designatedTestDb;
        if (targetDb !== designatedTestDb) {
            throw new Error(
                `[TEST ISOLATION SAFETY GUARD] FATAL: Automated tests attempted to connect to database '${targetDb}'. ` +
                `Tests are strictly required to use the designated test database '${designatedTestDb}'. Connection aborted.`
            );
        }

        const port = parseInt(process.env.DB_PORT || '3306', 10);
        return {
            host: 'localhost',
            port,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: designatedTestDb,
            ssl: undefined, // Force NO SSL for local test database
            waitForConnections: true,
            connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '10', 10),
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000
        };
    }

    // Support TiDB Cloud (typically port 4000 with SSL enabled) and local MySQL (typically port 3306)
    let port = 3306;
    if (!isLocalhost) {
        port = parseInt(process.env.DB_PORT || '4000', 10);
    } else if (process.env.DB_PORT && process.env.DB_PORT !== '4000') {
        port = parseInt(process.env.DB_PORT, 10);
    }

    const ssl = getSslConfig(host);

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

module.exports = { pool, connectDB, getDbConfig, getSslConfig };
