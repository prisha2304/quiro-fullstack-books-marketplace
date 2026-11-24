/**
 * QUIRO — Step 7E: Webhook Route Integration Test Suite
 * 
 * Tests the complete end-to-end HTTP request path for Razorpay webhooks:
 * 1. HTTP POST to the actual Express route `POST /api/webhooks`.
 * 2. Express JSON middleware captures raw request body as Buffer.
 * 3. Valid Razorpay HMAC-SHA256 signature calculated from original raw bytes is accepted (HTTP 200).
 * 4. Modified request body with original signature is rejected (HTTP 500 / signature failure).
 * 5. Invalid signature hash is rejected.
 * 6. Replayed event returns HTTP 200 with IGNORED_DUPLICATE (idempotency preserved).
 * 7. Normal JSON parsing and routing for other endpoints remains completely functional.
 * 
 * SAFETY:
 * - Uses isolated local quiro_test database only.
 * - Cleanup cleans only test-created records.
 * - Zero connections to TiDB Cloud or production.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
axios.defaults.proxy = false;

const testEnvPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(testEnvPath)) {
    require('dotenv').config({ path: testEnvPath });
}
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'quiro_test';
process.env.TEST_DB_NAME = 'quiro_test';
process.env.DB_SSL = 'false';

// Set webhook secret for test verification
const TEST_WEBHOOK_SECRET = 'whsec_test_quiro_route_integration_32chars';
process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

const { pool } = require('../../config/db');
const { app } = require('../../index');

const TEST_PORT = 5099;
const WEBHOOK_URL = `http://127.0.0.1:${TEST_PORT}/api/webhooks`;
let serverInstance = null;

async function runRouteIntegrationTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 7E: Webhook Route HTTP Integration Tests');
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

    const createdEventIds = [];

    try {
        // Start actual Express app server on local test port
        await new Promise((resolve) => {
            serverInstance = app.listen(TEST_PORT, '127.0.0.1', () => {
                console.log(`Express test server running at http://127.0.0.1:${TEST_PORT}\n`);
                resolve();
            });
        });

        // -------------------------------------------------------------
        // TEST 1: Authentic Webhook with Raw Formatted JSON via HTTP POST
        // -------------------------------------------------------------
        console.log('--- 1. Testing Valid Signature on Actual Express Route (POST /api/webhooks) ---');

        const eventId1 = `evt_http_7e_${Date.now()}`;
        createdEventIds.push(eventId1);

        // Intentionally use pretty-printed JSON with multi-line indentation
        // This exercises raw-body capture (JSON.stringify would strip whitespace and fail)
        const rawPayloadString = JSON.stringify({
            id: eventId1,
            event: 'payment.captured',
            contains: ['payment'],
            payload: {
                payment: {
                    entity: {
                        id: `pay_http_${Date.now()}`,
                        order_id: `order_http_${Date.now()}`,
                        amount: 89900,
                        currency: 'INR',
                        status: 'captured'
                    }
                }
            }
        }, null, 2);

        const rawPayloadBuffer = Buffer.from(rawPayloadString, 'utf8');

        // Calculate authentic HMAC-SHA256 signature using the exact raw bytes
        const validSignature = crypto
            .createHmac('sha256', TEST_WEBHOOK_SECRET)
            .update(rawPayloadBuffer)
            .digest('hex');

        // Send HTTP POST to actual Express route
        const validResponse = await axios.post(WEBHOOK_URL, rawPayloadString, {
            headers: {
                'Content-Type': 'application/json',
                'x-razorpay-signature': validSignature
            }
        });

        assertCheck('Actual Express route returns HTTP 200 for valid raw-body signature', validResponse.status === 200);
        assertCheck('Response confirms event was processed', validResponse.data.success === true && validResponse.data.result.status === 'PROCESSED');
        assertCheck('Event ID matches test event ID', validResponse.data.result.eventId === eventId1);

        // -------------------------------------------------------------
        // TEST 2: Modified Body with Mismatched Signature Rejected
        // -------------------------------------------------------------
        console.log('\n--- 2. Testing Modified Body Rejection on Express Route ---');

        const eventId2 = `evt_http_7e_tampered_${Date.now()}`;
        createdEventIds.push(eventId2);

        // Original authentic payload
        const originalPayloadString = JSON.stringify({
            id: eventId2,
            event: 'payment.captured',
            contains: ['payment'],
            payload: {
                payment: {
                    entity: {
                        id: `pay_http_tamper_${Date.now()}`,
                        order_id: `order_http_tamper_${Date.now()}`,
                        amount: 89900,
                        currency: 'INR',
                        status: 'captured'
                    }
                }
            }
        }, null, 2);

        // Signature generated for original payload
        const originalSignature = crypto
            .createHmac('sha256', TEST_WEBHOOK_SECRET)
            .update(Buffer.from(originalPayloadString, 'utf8'))
            .digest('hex');

        // Tamper with the amount in the payload sent to the server (89900 -> 19900)
        const tamperedPayloadString = originalPayloadString.replace('89900', '19900');

        let tamperedError = null;
        try {
            await axios.post(WEBHOOK_URL, tamperedPayloadString, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-razorpay-signature': originalSignature // Mismatched signature
                }
            });
        } catch (err) {
            tamperedError = err.response;
        }

        assertCheck('Tampered body rejected by Express route (HTTP 401 error returned)', tamperedError && tamperedError.status === 401);
        assertCheck('Tampered body error indicates signature verification failure', 
            tamperedError && tamperedError.data && (
                tamperedError.data.message === 'Webhook signature verification failed' ||
                tamperedError.data.error?.message === 'Webhook signature verification failed'
            )
        );

        // -------------------------------------------------------------
        // TEST 3: Invalid Signature Hash Rejected
        // -------------------------------------------------------------
        console.log('\n--- 3. Testing Invalid Signature Hash Rejection on Express Route ---');

        const eventId3 = `evt_http_7e_bad_sig_${Date.now()}`;
        createdEventIds.push(eventId3);

        const badSigPayloadString = JSON.stringify({
            id: eventId3,
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: `pay_bad_sig_${Date.now()}`,
                        amount: 50000
                    }
                }
            }
        });

        const fakeSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        let invalidSigError = null;
        try {
            await axios.post(WEBHOOK_URL, badSigPayloadString, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-razorpay-signature': fakeSignature
                }
            });
        } catch (err) {
            invalidSigError = err.response;
        }

        assertCheck('Invalid signature rejected by Express route (HTTP 401 error returned)', invalidSigError && invalidSigError.status === 401);

        // -------------------------------------------------------------
        // TEST 3B: Missing Signature & Malformed Request Rejected (HTTP 400)
        // -------------------------------------------------------------
        console.log('\n--- 3B. Testing Missing Signature & Malformed Body Rejection (HTTP 400) ---');
        const eventId3b = `evt_http_7e_missing_sig_${Date.now()}`;
        createdEventIds.push(eventId3b);
        let missingSigErr = null;
        try {
            await axios.post(WEBHOOK_URL, JSON.stringify({ id: eventId3b, event: 'payment.captured' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            missingSigErr = err.response;
        }
        assertCheck('Missing signature rejected with HTTP 400', missingSigErr && missingSigErr.status === 400);

        let malformedErr = null;
        try {
            await axios.post(WEBHOOK_URL, '{}', {
                headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': fakeSignature }
            });
        } catch (err) {
            malformedErr = err.response;
        }
        assertCheck('Empty/malformed webhook body rejected with HTTP 400', malformedErr && malformedErr.status === 400);

        // -------------------------------------------------------------
        // TEST 3C: Missing rawBody in Production (HTTP 500)
        // -------------------------------------------------------------
        console.log('\n--- 3C. Testing Missing rawBody in Production (HTTP 500) ---');
        const webhookService = require('../../services/webhookService');
        const prevEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const eventId3c = `evt_http_7e_no_raw_${Date.now()}`;
        createdEventIds.push(eventId3c);
        let missingRawErr = null;
        try {
            await webhookService.processPaymentWebhook({
                eventId: eventId3c,
                eventType: 'payment.captured',
                payload: { payment: { entity: { id: 'pay_noraw' } } },
                signature: fakeSignature,
                rawBody: null
            });
        } catch (err) {
            missingRawErr = err;
        } finally {
            process.env.NODE_ENV = prevEnv;
        }
        assertCheck('Missing rawBody in production throws HTTP 500 error', missingRawErr && missingRawErr.statusCode === 500);

        // -------------------------------------------------------------
        // TEST 4: Replayed Event Returns IGNORED_DUPLICATE (Idempotency)
        // -------------------------------------------------------------
        console.log('\n--- 4. Testing Idempotent Replay on Express Route ---');

        // Send the exact same eventId1 again with valid signature
        const replayResponse = await axios.post(WEBHOOK_URL, rawPayloadString, {
            headers: {
                'Content-Type': 'application/json',
                'x-razorpay-signature': validSignature
            }
        });

        assertCheck('Replayed event returns HTTP 200', replayResponse.status === 200);
        assertCheck('Replayed event returns IGNORED_DUPLICATE status', replayResponse.data.success === true && replayResponse.data.result.status === 'IGNORED_DUPLICATE');

        // -------------------------------------------------------------
        // TEST 5: Verify Ordinary JSON API Endpoints Still Work Normally
        // -------------------------------------------------------------
        console.log('\n--- 5. Verifying Standard Express JSON Body Parsing Unaffected ---');

        // Probe standard API health route
        const healthResponse = await axios.get(`http://127.0.0.1:${TEST_PORT}/api/health/live`);
        assertCheck('Health check live endpoint returns HTTP 200', healthResponse.status === 200 && healthResponse.data.status === 'UP');

        // Probe root status endpoint
        const rootResponse = await axios.get(`http://127.0.0.1:${TEST_PORT}/`);
        assertCheck('Root endpoint returns HTTP 200 JSON', rootResponse.status === 200 && rootResponse.data.status === 'online');

        console.log(`\nAll ${totalChecks}/${totalChecks} HTTP route integration checks PASSED successfully!`);
        return true;
    } finally {
        if (serverInstance) {
            await new Promise((resolve) => serverInstance.close(resolve));
        }

        // Clean up test events from database
        if (createdEventIds.length > 0) {
            try {
                for (const eid of createdEventIds) {
                    await pool.execute('DELETE FROM payment_webhook_events WHERE event_id = ?', [eid]);
                }
            } catch (err) {
                console.warn('Test cleanup warning:', err.message);
            }
        }
        await pool.end();
    }
}

runRouteIntegrationTests().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error('Integration test failed:', err);
    process.exit(1);
});
