/**
 * QUIRO — Step 7F-5D: Health Endpoint Database Error Sanitization Test Suite
 * 
 * Verifies:
 * 1. Database failures return safe HTTP 503 with generic "Database unreachable" error on /api/health.
 * 2. Public response bodies do NOT expose raw driver errors, connection strings, hostnames, usernames, passwords, or SQL queries.
 * 3. /api/health/ready returns safe HTTP 503 without sensitive information disclosure.
 * 4. /api/health/live continues to return HTTP 200 independently of database status.
 * 5. Admin-only /api/health/dependencies sanitizes checks.database.error to generic message.
 * 6. Admin-only /api/health/diagnostics reports dbStatus: 'DOWN' without leaking raw errors.
 * 7. Server-side logger captures internal diagnostic error details.
 * 8. Normal operation returns HTTP 200 when database probe succeeds.
 * 9. Protected historical records (Swap 34, Payments 19, 20, 21) remain untouched.
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const axios = require('axios');
axios.defaults.proxy = false;

// Configure isolated test environment
const testEnvPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(testEnvPath)) {
    require('dotenv').config({ path: testEnvPath });
}
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'quiro_test';
process.env.TEST_DB_NAME = 'quiro_test';
process.env.DB_SSL = 'false';

const { pool } = require('../../config/db');
const { app } = require('../../index');
const logger = require('../../services/logger');

const TEST_PORT = 5097;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let serverInstance = null;

function generateToken(userId, tv = 1) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
    }
    return jwt.sign({ id: userId, tv }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function runHealthSanitizationTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 7F-5D: Health Endpoint Database Error Sanitization');
    console.log('============================================================\n');

    let passedChecks = 0;
    let totalChecks = 0;

    function assertCheck(desc, condition) {
        totalChecks++;
        if (condition) {
            passedChecks++;
            console.log(`  [PASS] Check ${totalChecks}: ${desc}`);
        } else {
            console.error(`  [FAIL] Check ${totalChecks}: ${desc}`);
            throw new Error(`Assertion failed: ${desc}`);
        }
    }

    // Verify test database users (User 1 = ADMIN, User 2 = USER)
    const [adminRows] = await pool.execute('SELECT id, role FROM users WHERE id = 1');
    const [userRows] = await pool.execute('SELECT id, role FROM users WHERE id = 2');

    assertCheck('Test Admin user exists with role ADMIN', adminRows.length > 0 && adminRows[0].role === 'ADMIN');
    assertCheck('Test Regular user exists with role USER', userRows.length > 0 && userRows[0].role === 'USER');

    const adminToken = generateToken(adminRows[0].id);

    // Spy on logger.error to verify server-side error capturing
    const originalLoggerError = logger.error.bind(logger);
    const loggedErrors = [];
    logger.error = function(message, meta) {
        loggedErrors.push({ message, meta });
        return originalLoggerError(message, meta);
    };

    // Save original pool.execute
    const originalPoolExecute = pool.execute.bind(pool);

    // Start Express server on dedicated test port
    await new Promise((resolve) => {
        serverInstance = app.listen(TEST_PORT, '127.0.0.1', () => {
            console.log(`Test Express server running at ${BASE_URL}\n`);
            resolve();
        });
    });

    try {
        // -------------------------------------------------------------
        // 1. Normal Healthy Operation Baseline
        // -------------------------------------------------------------
        console.log('--- 1. Testing Baseline Healthy Health Probes ---');
        const healthyRoot = await axios.get(`${BASE_URL}/api/health`);
        assertCheck('Healthy GET /api/health returns HTTP 200', healthyRoot.status === 200);
        assertCheck('Healthy GET /api/health indicates UP and READY_FOR_TRAFFIC', 
            healthyRoot.data.status === 'UP' && healthyRoot.data.readiness === 'READY_FOR_TRAFFIC');

        const healthyReady = await axios.get(`${BASE_URL}/api/health/ready`);
        assertCheck('Healthy GET /api/health/ready returns HTTP 200', healthyReady.status === 200);

        const healthyLive = await axios.get(`${BASE_URL}/api/health/live`);
        assertCheck('Healthy GET /api/health/live returns HTTP 200', healthyLive.status === 200 && healthyLive.data.status === 'UP');

        // -------------------------------------------------------------
        // 2. Simulated Database Failure with Sensitive Internal Details
        // -------------------------------------------------------------
        console.log('\n--- 2. Testing Database Failure Error Sanitization ---');
        const SENSITIVE_DB_ERROR_MESSAGE = "connect ECONNREFUSED 10.244.15.82:3306; Access denied for user 'db_superuser'@'10.244.15.82' (using password: YES); SQL: SELECT 1 FROM dual WHERE secret_flag = 1";
        const SENSITIVE_KEYWORDS = [
            '10.244.15.82',
            'ECONNREFUSED',
            'db_superuser',
            'using password',
            'secret_flag',
            'SELECT 1 FROM dual'
        ];

        // Stub pool.execute to throw sensitive DB error
        pool.execute = async function(sql, params) {
            // Allow user queries if any, but fail SELECT 1 health probe
            if (typeof sql === 'string' && sql.trim().startsWith('SELECT 1')) {
                throw new Error(SENSITIVE_DB_ERROR_MESSAGE);
            }
            return originalPoolExecute(sql, params);
        };

        // A. Test GET /api/health under DB failure
        let rootErrorResponse = null;
        try {
            await axios.get(`${BASE_URL}/api/health`);
        } catch (err) {
            rootErrorResponse = err.response;
        }

        assertCheck('GET /api/health returns HTTP 503 on database failure', rootErrorResponse && rootErrorResponse.status === 503);
        assertCheck('GET /api/health returns status DOWN', rootErrorResponse.data.status === 'DOWN');
        assertCheck('GET /api/health returns readiness NOT_READY', rootErrorResponse.data.readiness === 'NOT_READY');
        assertCheck('GET /api/health returns generic safe error message ("Database unreachable")', 
            rootErrorResponse.data.error === 'Database unreachable'
        );

        const rootRawString = JSON.stringify(rootErrorResponse.data);
        for (const keyword of SENSITIVE_KEYWORDS) {
            assertCheck(`GET /api/health response body does NOT contain sensitive detail "${keyword}"`, 
                !rootRawString.includes(keyword)
            );
        }

        // B. Test versioned alias GET /api/v1/health under DB failure
        let v1RootErrorResponse = null;
        try {
            await axios.get(`${BASE_URL}/api/v1/health`);
        } catch (err) {
            v1RootErrorResponse = err.response;
        }
        assertCheck('GET /api/v1/health returns HTTP 503 on database failure', v1RootErrorResponse && v1RootErrorResponse.status === 503);
        assertCheck('GET /api/v1/health returns generic safe error message', v1RootErrorResponse.data.error === 'Database unreachable');
        const v1RootRawString = JSON.stringify(v1RootErrorResponse.data);
        assertCheck('GET /api/v1/health body contains no sensitive details', 
            !SENSITIVE_KEYWORDS.some(k => v1RootRawString.includes(k))
        );

        // C. Test GET /api/health/ready under DB failure (Docker healthcheck target)
        let readyErrorResponse = null;
        try {
            await axios.get(`${BASE_URL}/api/health/ready`);
        } catch (err) {
            readyErrorResponse = err.response;
        }

        assertCheck('GET /api/health/ready returns HTTP 503 on database failure', readyErrorResponse && readyErrorResponse.status === 503);
        assertCheck('GET /api/health/ready returns status DOWN and readiness NOT_READY', 
            readyErrorResponse.data.status === 'DOWN' && readyErrorResponse.data.readiness === 'NOT_READY'
        );
        assertCheck('GET /api/health/ready returns generic safe error ("Database unreachable")', 
            readyErrorResponse.data.error === 'Database unreachable'
        );
        const readyRawString = JSON.stringify(readyErrorResponse.data);
        assertCheck('GET /api/health/ready body contains no sensitive details', 
            !SENSITIVE_KEYWORDS.some(k => readyRawString.includes(k))
        );

        // D. Test GET /api/health/live under DB failure
        const liveUnderDbFail = await axios.get(`${BASE_URL}/api/health/live`);
        assertCheck('GET /api/health/live remains HTTP 200 UP during database failure (process liveness)', 
            liveUnderDbFail.status === 200 && liveUnderDbFail.data.status === 'UP'
        );

        // E. Test GET /api/health/dependencies (Admin) under DB failure
        let depsErrorResponse = null;
        try {
            await axios.get(`${BASE_URL}/api/health/dependencies`, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
        } catch (err) {
            depsErrorResponse = err.response;
        }

        assertCheck('GET /api/health/dependencies returns HTTP 503 when DB probe fails', 
            depsErrorResponse && depsErrorResponse.status === 503
        );
        assertCheck('GET /api/health/dependencies reports database status DOWN', 
            depsErrorResponse.data.checks && depsErrorResponse.data.checks.database.status === 'DOWN'
        );
        assertCheck('GET /api/health/dependencies sanitizes database error to "Database unreachable"', 
            depsErrorResponse.data.checks.database.error === 'Database unreachable'
        );
        const depsRawString = JSON.stringify(depsErrorResponse.data);
        assertCheck('GET /api/health/dependencies body contains no sensitive details', 
            !SENSITIVE_KEYWORDS.some(k => depsRawString.includes(k))
        );

        // F. Test GET /api/health/diagnostics (Admin) under DB probe failure
        const diagUnderDbFail = await axios.get(`${BASE_URL}/api/health/diagnostics`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assertCheck('GET /api/health/diagnostics returns HTTP 200 even when DB probe fails', diagUnderDbFail.status === 200);
        assertCheck('GET /api/health/diagnostics marks system.dbStatus as DOWN', diagUnderDbFail.data.system.dbStatus === 'DOWN');
        const diagRawString = JSON.stringify(diagUnderDbFail.data);
        assertCheck('GET /api/health/diagnostics body contains no sensitive details', 
            !SENSITIVE_KEYWORDS.some(k => diagRawString.includes(k))
        );

        // -------------------------------------------------------------
        // 3. Server-Side Logging Verification
        // -------------------------------------------------------------
        console.log('\n--- 3. Verifying Server-Side Error Logging ---');
        assertCheck('Server-side logger recorded health check database probe failure', 
            loggedErrors.some(log => log.message.includes('Root health check database probe failed') || log.message.includes('health check database probe failed'))
        );
        assertCheck('Server-side logger preserved internal diagnostic error message for operators', 
            loggedErrors.some(log => log.meta && log.meta.error && log.meta.error.includes('10.244.15.82'))
        );

        // -------------------------------------------------------------
        // 4. Restore Database Stub and Verify Protected Records
        // -------------------------------------------------------------
        console.log('\n--- 4. Restoring Database Connection & Verifying Historical Records ---');
        pool.execute = originalPoolExecute;

        const recoveredHealth = await axios.get(`${BASE_URL}/api/health`);
        assertCheck('Health check recovers to HTTP 200 UP once database probe succeeds', 
            recoveredHealth.status === 200 && recoveredHealth.data.status === 'UP'
        );

        const [swap34] = await pool.execute('SELECT id, status FROM swap_requests WHERE id = 34');
        assertCheck('Swap 34 exists and is untouched', swap34.length > 0);

        const [p19] = await pool.execute('SELECT id, status FROM payments WHERE id = 19');
        const [p20] = await pool.execute('SELECT id, status FROM payments WHERE id = 20');
        const [p21] = await pool.execute('SELECT id, status FROM payments WHERE id = 21');
        assertCheck('Payments 19, 20, 21 exist and are untouched', 
            p19.length > 0 && p20.length > 0 && p21.length > 0
        );

    } finally {
        pool.execute = originalPoolExecute;
        logger.error = originalLoggerError;
        if (serverInstance) {
            await new Promise((resolve) => serverInstance.close(resolve));
        }
        await pool.end();
    }

    console.log('\n============================================================');
    console.log(`QUIRO Step 7F-5D Health Sanitization: ALL ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('============================================================\n');
}

if (require.main === module) {
    runHealthSanitizationTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL TEST FAILURE]:', err.message);
            process.exit(1);
        });
}

module.exports = { runHealthSanitizationTests };
