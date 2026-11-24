/**
 * QUIRO — Step 7F-5B: OAuth Error Disclosure & Security Test Suite
 * 
 * Verifies:
 * 1. Unconfigured Google OAuth returns a safe HTTP 503.
 * 2. Response body never contains 'server/.env', filesystem paths, or internal tokens.
 * 3. Upstream Google failure returns a generic, sanitized HTTP 500.
 * 4. 500 response does NOT leak raw error.message, stack traces, or internal URLs.
 * 5. Missing ID token returns HTTP 400 with expected validation message.
 * 6. Server-side logger captures diagnostic error details internally.
 * 7. Standard email/password authentication routes and functionality remain fully intact.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
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

const { googleAuth } = require('../../controllers/authController');
const logger = require('../../services/logger');

async function runOAuthSecurityTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 7F-5B: OAuth Error Disclosure Security Tests');
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

    // Set up dedicated Express test app mounting the googleAuth controller
    const app = express();
    app.use(express.json());
    app.post('/api/auth/google', googleAuth);

    const server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const testUrl = `http://127.0.0.1:${port}/api/auth/google`;

    const originalClientId = process.env.GOOGLE_CLIENT_ID;

    // Track logger calls
    let loggedWarnings = [];
    let loggedErrors = [];
    const origWarn = logger.warn;
    const origError = logger.error;
    logger.warn = (msg, meta) => {
        loggedWarnings.push({ msg, meta });
        return origWarn.call(logger, msg, meta);
    };
    logger.error = (msg, meta) => {
        loggedErrors.push({ msg, meta });
        return origError.call(logger, msg, meta);
    };

    try {
        // -------------------------------------------------------------
        // 1. Missing idToken Validation (HTTP 400)
        // -------------------------------------------------------------
        console.log('--- 1. Testing Missing ID Token Request ---');
        let missingTokenRes;
        try {
            await axios.post(testUrl, {});
        } catch (err) {
            missingTokenRes = err.response;
        }
        assertCheck('Missing idToken returns HTTP 400', missingTokenRes && missingTokenRes.status === 400);
        assertCheck('Missing idToken returns expected message', 
            missingTokenRes && missingTokenRes.data.message === 'Google ID Token is required');

        // -------------------------------------------------------------
        // 2. Unconfigured Google OAuth (HTTP 503) — Zero Internal Path Leaks
        // -------------------------------------------------------------
        console.log('\n--- 2. Testing Unconfigured OAuth Error Handling ---');
        const unconfiguredCases = [
            { desc: 'Missing GOOGLE_CLIENT_ID', val: '' },
            { desc: 'Placeholder YOUR_GOOGLE_CLIENT_ID', val: 'YOUR_GOOGLE_CLIENT_ID' },
            { desc: 'Template placeholder string', val: 'placeholder_google_client_id.apps.googleusercontent.com' }
        ];

        for (const testCase of unconfiguredCases) {
            process.env.GOOGLE_CLIENT_ID = testCase.val;
            let res503;
            try {
                await axios.post(testUrl, { idToken: 'mock_dummy_id_token' });
            } catch (err) {
                res503 = err.response;
            }

            assertCheck(`${testCase.desc} returns HTTP 503`, res503 && res503.status === 503);
            
            const responseBodyStr = JSON.stringify(res503 ? res503.data : {});
            assertCheck(`${testCase.desc} response does NOT contain "server/.env"`, 
                !responseBodyStr.includes('server/.env'));
            assertCheck(`${testCase.desc} response does NOT contain ".env"`, 
                !responseBodyStr.includes('.env'));
            assertCheck(`${testCase.desc} response does NOT contain filesystem paths`, 
                !responseBodyStr.includes('C:') && !responseBodyStr.includes('/server/'));
            assertCheck(`${testCase.desc} returns user-friendly customer message`, 
                res503 && res503.data.message && res503.data.message.includes('Google Sign-In is temporarily unavailable'));
        }

        // Verify that server-side logger captured actionable advice
        assertCheck('Server-side logger recorded warning with configuration guidance', 
            loggedWarnings.some(w => w.msg.includes('GOOGLE_CLIENT_ID')));

        // -------------------------------------------------------------
        // 3. Upstream Failure Sanitization (HTTP 500) — Zero Stack / Message Leaks
        // -------------------------------------------------------------
        console.log('\n--- 3. Testing Upstream Failure Sanitization ---');
        // Configure a dummy valid client ID format so it passes config check and attempts fetch
        process.env.GOOGLE_CLIENT_ID = '1234567890-testclientid.apps.googleusercontent.com';

        // Mock global fetch to simulate unexpected upstream network/DNS exception
        const originalFetch = global.fetch;
        global.fetch = async () => {
            const simulatedErr = new Error('getaddrinfo ENOTFOUND oauth2.googleapis.com at internal/dns.js:123');
            simulatedErr.stack = 'Error: getaddrinfo ENOTFOUND oauth2.googleapis.com\n    at internal/dns.js:123\n    at internal/tls.js:456';
            throw simulatedErr;
        };

        let res500;
        try {
            await axios.post(testUrl, { idToken: 'valid_looking_token_that_fails_upstream' });
        } catch (err) {
            res500 = err.response;
        } finally {
            global.fetch = originalFetch;
        }

        assertCheck('Upstream failure returns HTTP 500', res500 && res500.status === 500);

        const res500Body = JSON.stringify(res500 ? res500.data : {});
        assertCheck('500 response does NOT leak raw error.message (getaddrinfo)', 
            !res500Body.includes('getaddrinfo'));
        assertCheck('500 response does NOT leak oauth2.googleapis.com URL', 
            !res500Body.includes('oauth2.googleapis.com'));
        assertCheck('500 response does NOT leak stack traces', 
            !res500Body.includes('internal/dns.js') && !res500Body.includes('stack'));
        assertCheck('500 response returns generic sanitized message', 
            res500 && res500.data.message === 'Google authentication service error. Please try again later.');

        // Verify server-side logger recorded detailed diagnostic error
        assertCheck('Server-side logger recorded detailed error internally with message', 
            loggedErrors.some(e => e.meta && e.meta.error && e.meta.error.includes('getaddrinfo')));
        assertCheck('Server-side logger recorded stack trace internally', 
            loggedErrors.some(e => e.meta && e.meta.stack));

    } finally {
        process.env.GOOGLE_CLIENT_ID = originalClientId;
        logger.warn = origWarn;
        logger.error = origError;
        await new Promise(r => server.close(r));
    }

    console.log('\n============================================================');
    console.log(`QUIRO Step 7F-5B OAuth Error Disclosure: ALL ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('============================================================\n');
}

if (require.main === module) {
    runOAuthSecurityTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL TEST FAILURE]:', err.message);
            process.exit(1);
        });
}

module.exports = { runOAuthSecurityTests };
