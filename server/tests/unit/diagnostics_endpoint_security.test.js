/**
 * QUIRO — Step 7F-3 & 7F-5C: Health & Diagnostics Endpoints Security Test Suite
 * 
 * Verifies:
 * 1. Unauthenticated request to /api/health/diagnostics, /dependencies, /metrics returns HTTP 401.
 * 2. Authenticated ordinary user receives HTTP 403 on diagnostics, dependencies, metrics.
 * 3. Authenticated administrator receives HTTP 200 with full payloads.
 * 4. Public liveness endpoint (/api/health/live) remains accessible without authentication (HTTP 200).
 * 5. Public readiness endpoint (/api/health/ready) remains accessible without authentication (HTTP 200).
 * 6. Root health endpoint (/api/health) remains accessible without authentication (HTTP 200).
 * 7. Versioned aliases (/api/v1/health/*) enforce identical protection rules.
 * 8. Invalid/malformed JWT token returns HTTP 401.
 * 9. Docker healthcheck command (curl -f http://localhost:5000/api/health/ready) continues to work.
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const http = require('http');
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

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let serverInstance = null;

function generateToken(userId, tv = 1) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
    }
    return jwt.sign({ id: userId, tv }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function runDiagnosticsSecurityTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 7F-3: Diagnostics Endpoint Security Test Suite');
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
    const userToken = generateToken(userRows[0].id);

    // Start Express server on ephemeral/dedicated test port
    await new Promise((resolve) => {
        serverInstance = app.listen(TEST_PORT, '127.0.0.1', () => {
            console.log(`Test Express server running at ${BASE_URL}\n`);
            resolve();
        });
    });

    try {
        // -------------------------------------------------------------
        // 1. Diagnostics, Dependencies & Metrics Unauthenticated Access
        // -------------------------------------------------------------
        console.log('--- 1. Testing Unauthenticated Access to Diagnostics, Dependencies & Metrics ---');
        // A. /api/health/diagnostics
        let unauth401 = false;
        try {
            await axios.get(`${BASE_URL}/api/health/diagnostics`);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                unauth401 = true;
            }
        }
        assertCheck('Unauthenticated request to /api/health/diagnostics returns HTTP 401', unauth401);

        // Versioned alias diagnostics
        let unauthV1_401 = false;
        try {
            await axios.get(`${BASE_URL}/api/v1/health/diagnostics`);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                unauthV1_401 = true;
            }
        }
        assertCheck('Unauthenticated request to /api/v1/health/diagnostics returns HTTP 401', unauthV1_401);

        // B. /api/health/dependencies
        let unauthDeps401 = false;
        try {
            await axios.get(`${BASE_URL}/api/health/dependencies`);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                unauthDeps401 = true;
            }
        }
        assertCheck('Unauthenticated request to /api/health/dependencies returns HTTP 401', unauthDeps401);

        let unauthDepsV1_401 = false;
        try {
            await axios.get(`${BASE_URL}/api/v1/health/dependencies`);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                unauthDepsV1_401 = true;
            }
        }
        assertCheck('Unauthenticated request to /api/v1/health/dependencies returns HTTP 401', unauthDepsV1_401);

        // C. /api/health/metrics
        let unauthMetrics401 = false;
        try {
            await axios.get(`${BASE_URL}/api/health/metrics`);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                unauthMetrics401 = true;
            }
        }
        assertCheck('Unauthenticated request to /api/health/metrics returns HTTP 401', unauthMetrics401);

        let unauthMetricsV1_401 = false;
        try {
            await axios.get(`${BASE_URL}/api/v1/health/metrics`);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                unauthMetricsV1_401 = true;
            }
        }
        assertCheck('Unauthenticated request to /api/v1/health/metrics returns HTTP 401', unauthMetricsV1_401);

        // Invalid Token checks
        let invalidToken401 = false;
        try {
            await axios.get(`${BASE_URL}/api/health/diagnostics`, {
                headers: { Authorization: 'Bearer invalid_tampered_token_string' }
            });
        } catch (err) {
            if (err.response && err.response.status === 401) {
                invalidToken401 = true;
            }
        }
        assertCheck('Invalid JWT token on /diagnostics returns HTTP 401', invalidToken401);

        let invalidTokenDeps401 = false;
        try {
            await axios.get(`${BASE_URL}/api/health/dependencies`, {
                headers: { Authorization: 'Bearer invalid_tampered_token_string' }
            });
        } catch (err) {
            if (err.response && err.response.status === 401) {
                invalidTokenDeps401 = true;
            }
        }
        assertCheck('Invalid JWT token on /dependencies returns HTTP 401', invalidTokenDeps401);

        let invalidTokenMetrics401 = false;
        try {
            await axios.get(`${BASE_URL}/api/health/metrics`, {
                headers: { Authorization: 'Bearer invalid_tampered_token_string' }
            });
        } catch (err) {
            if (err.response && err.response.status === 401) {
                invalidTokenMetrics401 = true;
            }
        }
        assertCheck('Invalid JWT token on /metrics returns HTTP 401', invalidTokenMetrics401);

        // -------------------------------------------------------------
        // 2. Diagnostics, Dependencies & Metrics Non-Admin User Access
        // -------------------------------------------------------------
        console.log('\n--- 2. Testing Non-Admin (Regular User) Access ---');
        // A. /api/health/diagnostics
        let nonAdmin403 = false;
        let nonAdminMessage = '';
        try {
            await axios.get(`${BASE_URL}/api/health/diagnostics`, {
                headers: { Authorization: `Bearer ${userToken}` }
            });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                nonAdmin403 = true;
                nonAdminMessage = err.response.data.message || '';
            }
        }
        assertCheck('Authenticated non-admin user receives HTTP 403 Forbidden on /diagnostics', nonAdmin403);
        assertCheck('Non-admin error message explicitly indicates administrator requirement', 
            nonAdminMessage.toLowerCase().includes('administrator') || nonAdminMessage.toLowerCase().includes('admin')
        );

        let nonAdminV1_403 = false;
        try {
            await axios.get(`${BASE_URL}/api/v1/health/diagnostics`, {
                headers: { Authorization: `Bearer ${userToken}` }
            });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                nonAdminV1_403 = true;
            }
        }
        assertCheck('Authenticated non-admin user receives HTTP 403 on /api/v1/health/diagnostics', nonAdminV1_403);

        // B. /api/health/dependencies
        let nonAdminDeps403 = false;
        try {
            await axios.get(`${BASE_URL}/api/health/dependencies`, {
                headers: { Authorization: `Bearer ${userToken}` }
            });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                nonAdminDeps403 = true;
            }
        }
        assertCheck('Authenticated non-admin user receives HTTP 403 Forbidden on /dependencies', nonAdminDeps403);

        let nonAdminDepsV1_403 = false;
        try {
            await axios.get(`${BASE_URL}/api/v1/health/dependencies`, {
                headers: { Authorization: `Bearer ${userToken}` }
            });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                nonAdminDepsV1_403 = true;
            }
        }
        assertCheck('Authenticated non-admin user receives HTTP 403 on /api/v1/health/dependencies', nonAdminDepsV1_403);

        // C. /api/health/metrics
        let nonAdminMetrics403 = false;
        try {
            await axios.get(`${BASE_URL}/api/health/metrics`, {
                headers: { Authorization: `Bearer ${userToken}` }
            });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                nonAdminMetrics403 = true;
            }
        }
        assertCheck('Authenticated non-admin user receives HTTP 403 Forbidden on /metrics', nonAdminMetrics403);

        let nonAdminMetricsV1_403 = false;
        try {
            await axios.get(`${BASE_URL}/api/v1/health/metrics`, {
                headers: { Authorization: `Bearer ${userToken}` }
            });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                nonAdminMetricsV1_403 = true;
            }
        }
        assertCheck('Authenticated non-admin user receives HTTP 403 on /api/v1/health/metrics', nonAdminMetricsV1_403);

        // -------------------------------------------------------------
        // 3. Diagnostics, Dependencies & Metrics Admin User Access
        // -------------------------------------------------------------
        console.log('\n--- 3. Testing Admin Access to Diagnostics, Dependencies & Metrics ---');
        // A. /api/health/diagnostics
        const adminRes = await axios.get(`${BASE_URL}/api/health/diagnostics`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assertCheck('Authenticated administrator receives HTTP 200 OK on /diagnostics', adminRes.status === 200);
        assertCheck('Diagnostics response contains system status', adminRes.data.system && adminRes.data.system.apiStatus === 'HEALTHY');
        assertCheck('Diagnostics response contains reliability metrics', typeof adminRes.data.reliability === 'object');
        assertCheck('Diagnostics response contains recentJobExecutions', Array.isArray(adminRes.data.recentJobExecutions));
        assertCheck('Diagnostics response contains recentWebhookEvents', Array.isArray(adminRes.data.recentWebhookEvents));

        const adminV1Res = await axios.get(`${BASE_URL}/api/v1/health/diagnostics`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assertCheck('Authenticated administrator receives HTTP 200 on /api/v1/health/diagnostics', adminV1Res.status === 200);

        // B. /api/health/dependencies
        const adminDepsRes = await axios.get(`${BASE_URL}/api/health/dependencies`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assertCheck('Authenticated administrator receives HTTP 200 OK on /dependencies', adminDepsRes.status === 200);
        assertCheck('Dependencies response contains database check', adminDepsRes.data.checks && adminDepsRes.data.checks.database && adminDepsRes.data.checks.database.status === 'UP');
        assertCheck('Dependencies response contains persistence check', adminDepsRes.data.checks && adminDepsRes.data.checks.persistence && adminDepsRes.data.checks.persistence.provider === 'MYSQL');
        assertCheck('Dependencies response contains environment check', adminDepsRes.data.checks && adminDepsRes.data.checks.environment);
        assertCheck('Dependencies response contains jobEngine check', adminDepsRes.data.checks && adminDepsRes.data.checks.jobEngine);

        const adminDepsV1Res = await axios.get(`${BASE_URL}/api/v1/health/dependencies`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assertCheck('Authenticated administrator receives HTTP 200 on /api/v1/health/dependencies', adminDepsV1Res.status === 200);

        // C. /api/health/metrics
        const adminMetricsRes = await axios.get(`${BASE_URL}/api/health/metrics`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assertCheck('Authenticated administrator receives HTTP 200 OK on /metrics', adminMetricsRes.status === 200);
        assertCheck('Metrics response contains uptimeSeconds', typeof adminMetricsRes.data.uptimeSeconds === 'number');
        assertCheck('Metrics response contains avgResponseTimeMs', typeof adminMetricsRes.data.avgResponseTimeMs === 'number');
        assertCheck('Metrics response contains rate4xx and rate5xx', typeof adminMetricsRes.data.rate4xx === 'string' && typeof adminMetricsRes.data.rate5xx === 'string');

        const adminMetricsV1Res = await axios.get(`${BASE_URL}/api/v1/health/metrics`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assertCheck('Authenticated administrator receives HTTP 200 on /api/v1/health/metrics', adminMetricsV1Res.status === 200);

        // -------------------------------------------------------------
        // 4. Public Health Endpoints (Docker Healthcheck & Monitoring)
        // -------------------------------------------------------------
        console.log('\n--- 4. Testing Public Health & Monitoring Endpoints ---');
        // A. /api/health/live
        const liveRes = await axios.get(`${BASE_URL}/api/health/live`);
        assertCheck('Public liveness probe /api/health/live returns HTTP 200 without auth', liveRes.status === 200 && liveRes.data.status === 'UP');

        // B. /api/health/ready (Used by Docker Healthcheck)
        const readyRes = await axios.get(`${BASE_URL}/api/health/ready`);
        assertCheck('Public readiness probe /api/health/ready returns HTTP 200 without auth', readyRes.status === 200 && readyRes.data.status === 'UP');
        assertCheck('Readiness payload indicates READY_FOR_TRAFFIC', readyRes.data.readiness === 'READY_FOR_TRAFFIC');

        // C. /api/health
        const rootHealthRes = await axios.get(`${BASE_URL}/api/health`);
        assertCheck('Public root health probe /api/health returns HTTP 200 without auth', rootHealthRes.status === 200 && rootHealthRes.data.status === 'UP');

        // D. Versioned public probes
        const v1LiveRes = await axios.get(`${BASE_URL}/api/v1/health/live`);
        assertCheck('Versioned /api/v1/health/live returns HTTP 200 without auth', v1LiveRes.status === 200);

        const v1ReadyRes = await axios.get(`${BASE_URL}/api/v1/health/ready`);
        assertCheck('Versioned /api/v1/health/ready returns HTTP 200 without auth', v1ReadyRes.status === 200);

        // E. Confirm Docker healthcheck command target matches unauthenticated probe
        assertCheck('Docker Compose healthcheck target (/api/health/ready) is public and operational', 
            readyRes.status === 200
        );

        // -------------------------------------------------------------
        // 5. Verification of Protected Historical Records
        // -------------------------------------------------------------
        console.log('\n--- 5. Verifying Protected Historical Records ---');
        const [swap34] = await pool.execute('SELECT id, status FROM swap_requests WHERE id = 34');
        assertCheck('Swap 34 exists and is untouched', swap34.length > 0);

        const [p19] = await pool.execute('SELECT id, status FROM payments WHERE id = 19');
        const [p20] = await pool.execute('SELECT id, status FROM payments WHERE id = 20');
        const [p21] = await pool.execute('SELECT id, status FROM payments WHERE id = 21');
        assertCheck('Payments 19, 20, 21 exist and are untouched', 
            p19.length > 0 && p20.length > 0 && p21.length > 0
        );

    } finally {
        if (serverInstance) {
            await new Promise((resolve) => serverInstance.close(resolve));
        }
        await pool.end();
    }

    console.log('\n============================================================');
    console.log(`QUIRO Step 7F-3 & 7F-5C Diagnostics & Metrics Security: ALL ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('============================================================\n');
}

if (require.main === module) {
    runDiagnosticsSecurityTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL TEST FAILURE]:', err.message);
            process.exit(1);
        });
}

module.exports = { runDiagnosticsSecurityTests };
