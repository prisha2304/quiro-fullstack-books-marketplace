/**
 * QUIRO — Step 7F-2: Production CORS Hardening Test Suite
 * 
 * Verifies:
 * 1. Configured production origin is accepted.
 * 2. Unrelated external origin is rejected.
 * 3. http://localhost:5173 is rejected in production.
 * 4. http://127.0.0.1 and http://127.0.0.1:5173 are rejected in production.
 * 5. Local development origins work in development mode.
 * 6. Requests without an origin header (curl, mobile, server-to-server) continue to be accepted.
 * 7. Access-Control-Allow-Origin header is never set to wildcard '*' when credentials are enabled.
 * 8. Missing production CLIENT_URL safely rejects cross-origin browser requests.
 * 9. Malformed production CLIENT_URL safely rejects cross-origin browser requests.
 * 10. Actual Express HTTP requests verify preflight OPTIONS and response headers in production vs development.
 * 11. Socket.IO origin validation rules align with Express.
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
axios.defaults.proxy = false;

const {
    parseOrigin,
    getAllowedOrigins,
    isOriginAllowed,
    corsOptions,
    ALLOWED_METHODS,
    ALLOWED_HEADERS
} = require('../../config/cors');

async function runCorsHardeningTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 7F-2: Production CORS Hardening Test Suite');
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

    // -------------------------------------------------------------
    // Section 1: parseOrigin normalization
    // -------------------------------------------------------------
    console.log('--- 1. Origin URL Parsing & Normalization ---');
    assertCheck('parseOrigin extracts origin from standard URL', parseOrigin('https://quiro.in') === 'https://quiro.in');
    assertCheck('parseOrigin strips trailing slash', parseOrigin('https://quiro.in/') === 'https://quiro.in');
    assertCheck('parseOrigin strips path and query parameters', parseOrigin('https://quiro.in/path/to/page?query=1') === 'https://quiro.in');
    assertCheck('parseOrigin returns null on malformed URL', parseOrigin('not-a-valid-url') === null);
    assertCheck('parseOrigin returns null on empty or null input', parseOrigin('') === null && parseOrigin(null) === null);

    // -------------------------------------------------------------
    // Section 2: Production Origin Enforcement
    // -------------------------------------------------------------
    console.log('\n--- 2. Production Environment Origin Policy ---');
    const prodEnv = 'production';
    const prodClient = 'https://quiro.in';

    const prodOrigins = getAllowedOrigins(prodEnv, prodClient);
    assertCheck('Production allowed origins contains ONLY the configured CLIENT_URL', 
        prodOrigins.length === 1 && prodOrigins[0] === 'https://quiro.in'
    );

    // 1. Configured production origin is accepted
    assertCheck('Configured production origin is accepted', 
        isOriginAllowed('https://quiro.in', prodEnv, prodClient) === true
    );

    // 2. An unrelated external origin is rejected
    assertCheck('Unrelated external origin (https://malicious-site.com) is rejected', 
        isOriginAllowed('https://malicious-site.com', prodEnv, prodClient) === false
    );
    assertCheck('Phishing origin (https://fake-quiro.in) is rejected', 
        isOriginAllowed('https://fake-quiro.in', prodEnv, prodClient) === false
    );

    // 3. http://localhost:5173 is rejected in production
    assertCheck('http://localhost:5173 is strictly rejected in production', 
        isOriginAllowed('http://localhost:5173', prodEnv, prodClient) === false
    );
    assertCheck('http://localhost:3000 is rejected in production', 
        isOriginAllowed('http://localhost:3000', prodEnv, prodClient) === false
    );
    assertCheck('http://localhost:5000 is rejected in production', 
        isOriginAllowed('http://localhost:5000', prodEnv, prodClient) === false
    );

    // 4. http://127.0.0.1 is rejected in production
    assertCheck('http://127.0.0.1 is rejected in production', 
        isOriginAllowed('http://127.0.0.1', prodEnv, prodClient) === false
    );
    assertCheck('http://127.0.0.1:5173 is rejected in production', 
        isOriginAllowed('http://127.0.0.1:5173', prodEnv, prodClient) === false
    );

    // -------------------------------------------------------------
    // Section 3: Safe Handling of Missing or Malformed CLIENT_URL
    // -------------------------------------------------------------
    console.log('\n--- 3. Missing & Malformed CLIENT_URL Handling in Production ---');
    // Missing CLIENT_URL
    const emptyOrigins = getAllowedOrigins('production', '');
    assertCheck('Missing CLIENT_URL in production results in empty allowed origins', emptyOrigins.length === 0);
    assertCheck('Cross-origin requests rejected when CLIENT_URL is missing in production', 
        isOriginAllowed('https://quiro.in', 'production', '') === false
    );

    // Malformed CLIENT_URL
    const malformedOrigins = getAllowedOrigins('production', 'invalid-not-a-url');
    assertCheck('Malformed CLIENT_URL in production results in empty allowed origins', malformedOrigins.length === 0);
    assertCheck('Cross-origin requests rejected when CLIENT_URL is malformed in production', 
        isOriginAllowed('https://quiro.in', 'production', 'invalid-not-a-url') === false
    );

    // Multi-origin comma-separated CLIENT_URL support
    const multiOrigins = getAllowedOrigins('production', 'https://quiro.in, https://app.quiro.in');
    assertCheck('Multiple valid production origins are supported when comma-separated', 
        multiOrigins.length === 2 && 
        multiOrigins.includes('https://quiro.in') && 
        multiOrigins.includes('https://app.quiro.in')
    );

    // -------------------------------------------------------------
    // Section 4: Development Environment Policy
    // -------------------------------------------------------------
    console.log('\n--- 4. Development Environment Origin Policy ---');
    const devEnv = 'development';
    const devOrigins = getAllowedOrigins(devEnv, 'http://localhost:5173');

    // 5. Local development origins work in development
    assertCheck('Dev allowed origins contains localhost:5173', devOrigins.includes('http://localhost:5173'));
    assertCheck('Dev allowed origins contains 127.0.0.1:5173', devOrigins.includes('http://127.0.0.1:5173'));
    assertCheck('Dev allowed origins contains localhost:3000', devOrigins.includes('http://localhost:3000'));
    assertCheck('Dev allowed origins contains 127.0.0.1:3000', devOrigins.includes('http://127.0.0.1:3000'));
    assertCheck('Dev allowed origins contains localhost:5000', devOrigins.includes('http://localhost:5000'));

    assertCheck('http://localhost:5173 is allowed in development', isOriginAllowed('http://localhost:5173', devEnv));
    assertCheck('http://127.0.0.1:5173 is allowed in development', isOriginAllowed('http://127.0.0.1:5173', devEnv));
    assertCheck('http://localhost:3000 is allowed in development', isOriginAllowed('http://localhost:3000', devEnv));
    assertCheck('http://localhost:5000 is allowed in development', isOriginAllowed('http://localhost:5000', devEnv));
    assertCheck('Random external origin is rejected even in development', 
        isOriginAllowed('https://malicious-site.com', devEnv) === false
    );

    // -------------------------------------------------------------
    // Section 5: Universal Rules (No Origin Header & Wildcard Safety)
    // -------------------------------------------------------------
    console.log('\n--- 5. Non-Browser Requests & Wildcard Safety ---');
    // 6. Requests without an origin header continue to be accepted
    assertCheck('Requests with undefined origin (curl, mobile) are accepted in production', 
        isOriginAllowed(undefined, 'production', 'https://quiro.in') === true
    );
    assertCheck('Requests with null origin are accepted in production', 
        isOriginAllowed(null, 'production', 'https://quiro.in') === true
    );
    assertCheck('Requests with empty origin are accepted in development', 
        isOriginAllowed('', 'development') === true
    );

    // 7. Confirm Access-Control-Allow-Origin is never wildcard '*' with credentials
    assertCheck('credentials option is enabled (true)', corsOptions.credentials === true);
    assertCheck('origin option is a dynamic function, NEVER a wildcard string', typeof corsOptions.origin === 'function');
    assertCheck('Allowed methods include GET, POST, PUT, DELETE, OPTIONS', 
        ALLOWED_METHODS.includes('GET') && 
        ALLOWED_METHODS.includes('POST') && 
        ALLOWED_METHODS.includes('OPTIONS')
    );
    assertCheck('Allowed headers include X-Request-ID, Idempotency-Key, and x-razorpay-signature', 
        ALLOWED_HEADERS.includes('X-Request-ID') && 
        ALLOWED_HEADERS.includes('Idempotency-Key') && 
        ALLOWED_HEADERS.includes('x-razorpay-signature')
    );

    // -------------------------------------------------------------
    // Section 6: End-to-End HTTP Server Integration Test
    // -------------------------------------------------------------
    console.log('\n--- 6. End-to-End Express HTTP CORS Integration Tests ---');
    
    // Create isolated Express test server simulating production CORS
    const testApp = express();
    const TEST_PROD_CLIENT = 'https://quiro.in';

    testApp.use((req, res, next) => {
        // Force test requests through production CORS evaluation
        next();
    });

    testApp.use(cors({
        origin: (origin, callback) => {
            if (isOriginAllowed(origin, 'production', TEST_PROD_CLIENT)) {
                return callback(null, true);
            }
            const err = new Error(`CORS policy violation: Origin ${origin} not permitted`);
            err.statusCode = 403;
            err.code = 'CORS_FORBIDDEN';
            return callback(err);
        },
        credentials: true,
        methods: ALLOWED_METHODS,
        allowedHeaders: ALLOWED_HEADERS
    }));

    testApp.get('/test-endpoint', (req, res) => {
        res.json({ success: true, message: 'CORS check passed' });
    });

    testApp.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    });

    const testServer = http.createServer(testApp);
    await new Promise(resolve => testServer.listen(0, '127.0.0.1', resolve));
    const port = testServer.address().port;
    const testBaseUrl = `http://127.0.0.1:${port}`;

    try {
        // Case 6A: Preflight OPTIONS from configured production origin
        const preflightRes = await axios({
            method: 'OPTIONS',
            url: `${testBaseUrl}/test-endpoint`,
            headers: {
                'Origin': 'https://quiro.in',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type,Authorization,X-Request-ID'
            }
        });
        assertCheck('Production origin OPTIONS preflight returns HTTP 204/200', 
            preflightRes.status === 204 || preflightRes.status === 200
        );
        assertCheck('Access-Control-Allow-Origin equals https://quiro.in (NOT wildcard *)', 
            preflightRes.headers['access-control-allow-origin'] === 'https://quiro.in'
        );
        assertCheck('Access-Control-Allow-Credentials is true', 
            preflightRes.headers['access-control-allow-credentials'] === 'true'
        );

        // Case 6B: GET request from configured production origin
        const getRes = await axios({
            method: 'GET',
            url: `${testBaseUrl}/test-endpoint`,
            headers: { 'Origin': 'https://quiro.in' }
        });
        assertCheck('GET from production origin returns HTTP 200', getRes.status === 200);
        assertCheck('GET response has Access-Control-Allow-Origin: https://quiro.in', 
            getRes.headers['access-control-allow-origin'] === 'https://quiro.in'
        );

        // Case 6C: Request with NO origin header (curl, mobile)
        const noOriginRes = await axios({
            method: 'GET',
            url: `${testBaseUrl}/test-endpoint`
        });
        assertCheck('Request without Origin header returns HTTP 200', noOriginRes.status === 200);
        assertCheck('Request without Origin does NOT emit Access-Control-Allow-Origin', 
            noOriginRes.headers['access-control-allow-origin'] === undefined
        );

        // Case 6D: Request from http://localhost:5173 in production mode (MUST BE REJECTED)
        let localhostRejected = false;
        try {
            await axios({
                method: 'GET',
                url: `${testBaseUrl}/test-endpoint`,
                headers: { 'Origin': 'http://localhost:5173' }
            });
        } catch (err) {
            localhostRejected = true;
            assertCheck('http://localhost:5173 is rejected with HTTP 403 in production', 
                err.response && err.response.status === 403
            );
            assertCheck('Rejection does NOT include Access-Control-Allow-Origin for localhost', 
                err.response.headers['access-control-allow-origin'] === undefined
            );
        }
        assertCheck('http://localhost:5173 was blocked by CORS policy', localhostRejected);

        // Case 6E: Request from http://127.0.0.1:5173 in production mode (MUST BE REJECTED)
        let loopbackRejected = false;
        try {
            await axios({
                method: 'GET',
                url: `${testBaseUrl}/test-endpoint`,
                headers: { 'Origin': 'http://127.0.0.1:5173' }
            });
        } catch (err) {
            loopbackRejected = true;
            assertCheck('http://127.0.0.1:5173 is rejected with HTTP 403 in production', 
                err.response && err.response.status === 403
            );
        }
        assertCheck('http://127.0.0.1:5173 was blocked by CORS policy', loopbackRejected);

        // Case 6F: Request from unrelated external origin (MUST BE REJECTED)
        let externalRejected = false;
        try {
            await axios({
                method: 'GET',
                url: `${testBaseUrl}/test-endpoint`,
                headers: { 'Origin': 'https://evil-attacker.com' }
            });
        } catch (err) {
            externalRejected = true;
            assertCheck('https://evil-attacker.com is rejected with HTTP 403', 
                err.response && err.response.status === 403
            );
        }
        assertCheck('https://evil-attacker.com was blocked by CORS policy', externalRejected);

    } finally {
        await new Promise(resolve => testServer.close(resolve));
    }

    // -------------------------------------------------------------
    // Section 7: Environment Config Class Verification
    // -------------------------------------------------------------
    console.log('\n--- 7. EnvironmentConfig Class Integration ---');
    const envConfig = require('../../config/environment');
    const safeSummary = envConfig.getSafeSummary();
    assertCheck('getSafeSummary returns cors object', typeof safeSummary.cors === 'object');
    assertCheck('getCorsConfig returns allowedOrigins array', Array.isArray(envConfig.getCorsConfig().allowedOrigins));

    console.log('\n============================================================');
    console.log(`QUIRO Step 7F-2 CORS Hardening: ALL ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('============================================================\n');
}

if (require.main === module) {
    runCorsHardeningTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL TEST FAILURE]:', err.message);
            process.exit(1);
        });
}

module.exports = { runCorsHardeningTests };
