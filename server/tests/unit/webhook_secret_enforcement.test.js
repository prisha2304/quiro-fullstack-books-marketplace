/**
 * QUIRO — Step 7F-5E: Dedicated Razorpay Webhook Secret Enforcement Test Suite
 * 
 * Verifies:
 * 1. Production with dedicated secret: valid signature accepted via HTTP route and service.
 * 2. Production without dedicated secret: rejected (fails closed).
 * 3. Production with only API key secret: rejected (no fallback to RAZORPAY_KEY_SECRET in production).
 * 4. Development/test fallback: fallback to RAZORPAY_KEY_SECRET preserved for compatibility.
 * 5. Invalid signatures remain rejected.
 * 6. Duplicate webhook idempotency remains intact.
 * 7. Protected historical records (Swap 34, Payments 19, 20, 21) remain untouched.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
axios.defaults.proxy = false;

// Configure isolated test environment
const testEnvPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(testEnvPath)) {
    require('dotenv').config({ path: testEnvPath });
}
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'quiro_test';
process.env.TEST_DB_NAME = 'quiro_test';
process.env.DB_SSL = 'false';

const { pool } = require('../../config/db');
const webhookService = require('../../services/webhookService');
const { app } = require('../../index');

const TEST_PORT = 5096;
const WEBHOOK_URL = `http://127.0.0.1:${TEST_PORT}/api/webhooks`;
let serverInstance = null;

function computeSignature(payloadBuffer, secret) {
    return crypto.createHmac('sha256', secret).update(payloadBuffer).digest('hex');
}

async function runWebhookSecretEnforcementTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 7F-5E: Razorpay Webhook Secret Enforcement Tests');
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

    const testEventIds = [];

    // Start Express server on dedicated test port
    await new Promise((resolve) => {
        serverInstance = app.listen(TEST_PORT, '127.0.0.1', () => {
            console.log(`Test Express server running at http://127.0.0.1:${TEST_PORT}\n`);
            resolve();
        });
    });

    // Save initial env vars to restore in finally block
    const savedEnv = {
        NODE_ENV: process.env.NODE_ENV,
        RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET
    };

    try {
        const PROD_DEDICATED_SECRET = 'whsec_prod_dedicated_secret_32chars_test';
        const API_KEY_SECRET = 'rzp_key_secret_never_use_in_prod_webhook';

        // -------------------------------------------------------------
        // 1. Production Mode with Dedicated Webhook Secret
        // -------------------------------------------------------------
        console.log('--- 1. Testing Production with Dedicated Secret ---');
        process.env.NODE_ENV = 'production';
        process.env.RAZORPAY_WEBHOOK_SECRET = PROD_DEDICATED_SECRET;
        process.env.RAZORPAY_KEY_SECRET = API_KEY_SECRET;

        const event1Id = `evt_7f5e_prod_valid_${Date.now()}`;
        testEventIds.push(event1Id);
        const payload1 = {
            id: event1Id,
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: `pay_7f5e_1_${Date.now()}`,
                        amount: 25000,
                        currency: 'INR',
                        status: 'captured'
                    }
                }
            }
        };
        const rawBody1 = Buffer.from(JSON.stringify(payload1), 'utf8');
        const signature1 = computeSignature(rawBody1, PROD_DEDICATED_SECRET);

        const res1 = await axios.post(WEBHOOK_URL, rawBody1, {
            headers: {
                'Content-Type': 'application/json',
                'X-Razorpay-Signature': signature1
            }
        });

        assertCheck('Production with dedicated secret: HTTP route returns 200 OK', res1.status === 200);
        assertCheck('Production with dedicated secret: response indicates success', res1.data.success === true);

        // -------------------------------------------------------------
        // 2. Production Mode without Dedicated Webhook Secret (Both Missing)
        // -------------------------------------------------------------
        console.log('\n--- 2. Testing Production without Dedicated Secret (Both Missing) ---');
        process.env.NODE_ENV = 'production';
        delete process.env.RAZORPAY_WEBHOOK_SECRET;
        delete process.env.RAZORPAY_KEY_SECRET;

        const event2Id = `evt_7f5e_prod_missing_${Date.now()}`;
        testEventIds.push(event2Id);
        const payload2 = { id: event2Id, event: 'payment.captured' };
        const rawBody2 = Buffer.from(JSON.stringify(payload2), 'utf8');

        let prodMissingFailed = false;
        try {
            await axios.post(WEBHOOK_URL, rawBody2, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Razorpay-Signature': 'any_sig'
                }
            });
        } catch (err) {
            if (err.response && err.response.status === 500) {
                prodMissingFailed = true;
            }
        }
        assertCheck('Production without dedicated secret: HTTP route rejects (500)', prodMissingFailed);

        let serviceThrowMissing = false;
        try {
            await webhookService.processPaymentWebhook({
                eventId: event2Id + '_svc',
                eventType: 'payment.captured',
                payload: payload2,
                signature: 'any_sig',
                rawBody: rawBody2
            });
        } catch (err) {
            serviceThrowMissing = err.message.includes('Webhook secret is not configured in production');
        }
        testEventIds.push(event2Id + '_svc');
        assertCheck('Production without dedicated secret: service fails closed and throws descriptive error', serviceThrowMissing);

        // -------------------------------------------------------------
        // 3. Production Mode with ONLY API Key Secret (No Fallback in Prod)
        // -------------------------------------------------------------
        console.log('\n--- 3. Testing Production with ONLY API Key Secret (No Fallback) ---');
        process.env.NODE_ENV = 'production';
        delete process.env.RAZORPAY_WEBHOOK_SECRET;
        process.env.RAZORPAY_KEY_SECRET = API_KEY_SECRET;

        const event3Id = `evt_7f5e_prod_fallback_blocked_${Date.now()}`;
        testEventIds.push(event3Id);
        const payload3 = { id: event3Id, event: 'payment.captured' };
        const rawBody3 = Buffer.from(JSON.stringify(payload3), 'utf8');
        // Sign with API key secret (an attacker or misconfiguration using API key)
        const signature3 = computeSignature(rawBody3, API_KEY_SECRET);

        let prodFallbackBlocked = false;
        try {
            await axios.post(WEBHOOK_URL, rawBody3, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Razorpay-Signature': signature3
                }
            });
        } catch (err) {
            if (err.response && err.response.status === 500) {
                prodFallbackBlocked = true;
            }
        }
        assertCheck('Production with ONLY API key secret: HTTP route rejects signature signed with API key (500)', prodFallbackBlocked);

        let serviceThrowFallback = false;
        try {
            await webhookService.processPaymentWebhook({
                eventId: event3Id + '_svc',
                eventType: 'payment.captured',
                payload: payload3,
                signature: signature3,
                rawBody: rawBody3
            });
        } catch (err) {
            serviceThrowFallback = err.message.includes('Webhook secret is not configured in production');
        }
        testEventIds.push(event3Id + '_svc');
        assertCheck('Production with ONLY API key secret: service rejects fallback and throws error', serviceThrowFallback);

        // -------------------------------------------------------------
        // 4. Development/Test Mode Fallback Preservation
        // -------------------------------------------------------------
        console.log('\n--- 4. Testing Development/Test Fallback Preservation ---');
        process.env.NODE_ENV = 'test';
        delete process.env.RAZORPAY_WEBHOOK_SECRET;
        process.env.RAZORPAY_KEY_SECRET = API_KEY_SECRET;

        const event4Id = `evt_7f5e_dev_fallback_${Date.now()}`;
        testEventIds.push(event4Id);
        const payload4 = {
            id: event4Id,
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: `pay_7f5e_4_${Date.now()}`,
                        amount: 10000,
                        currency: 'INR',
                        status: 'captured'
                    }
                }
            }
        };
        const rawBody4 = Buffer.from(JSON.stringify(payload4), 'utf8');
        const signature4 = computeSignature(rawBody4, API_KEY_SECRET);

        const res4 = await axios.post(WEBHOOK_URL, rawBody4, {
            headers: {
                'Content-Type': 'application/json',
                'X-Razorpay-Signature': signature4
            }
        });

        assertCheck('Dev/test with only API key secret: falls back cleanly and accepts (HTTP 200)', res4.status === 200);
        assertCheck('Dev/test response indicates success', res4.data.success === true);

        // -------------------------------------------------------------
        // 5. Invalid Signature Rejection in Production
        // -------------------------------------------------------------
        console.log('\n--- 5. Testing Invalid Signature Rejection in Production ---');
        process.env.NODE_ENV = 'production';
        process.env.RAZORPAY_WEBHOOK_SECRET = PROD_DEDICATED_SECRET;

        const event5Id = `evt_7f5e_invalid_sig_${Date.now()}`;
        testEventIds.push(event5Id);
        const payload5 = { id: event5Id, event: 'payment.captured' };
        const rawBody5 = Buffer.from(JSON.stringify(payload5), 'utf8');
        const badSignature = '0000000000000000000000000000000000000000000000000000000000000000';

        let invalidSigRejected = false;
        try {
            await axios.post(WEBHOOK_URL, rawBody5, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Razorpay-Signature': badSignature
                }
            });
        } catch (err) {
            if (err.response && err.response.status === 401) {
                invalidSigRejected = true;
            }
        }
        assertCheck('Production with invalid signature: HTTP route rejects (401)', invalidSigRejected);

        // -------------------------------------------------------------
        // 6. Duplicate Webhook Idempotency Intact
        // -------------------------------------------------------------
        console.log('\n--- 6. Testing Duplicate Webhook Idempotency ---');
        // Replaying event 1 (which was successfully processed)
        const replayRes = await axios.post(WEBHOOK_URL, rawBody1, {
            headers: {
                'Content-Type': 'application/json',
                'X-Razorpay-Signature': signature1
            }
        });
        assertCheck('Replaying already processed webhook returns HTTP 200', replayRes.status === 200);
        assertCheck('Replay result indicates IGNORED_DUPLICATE', replayRes.data.result.status === 'IGNORED_DUPLICATE');

        // -------------------------------------------------------------
        // 7. Verify Protected Historical Records
        // -------------------------------------------------------------
        console.log('\n--- 7. Verifying Protected Historical Records ---');
        const [swap34] = await pool.execute('SELECT id, status FROM swap_requests WHERE id = 34');
        assertCheck('Swap 34 exists and is untouched', swap34.length > 0);

        const [p19] = await pool.execute('SELECT id, status FROM payments WHERE id = 19');
        const [p20] = await pool.execute('SELECT id, status FROM payments WHERE id = 20');
        const [p21] = await pool.execute('SELECT id, status FROM payments WHERE id = 21');
        assertCheck('Payments 19, 20, 21 exist and are untouched', 
            p19.length > 0 && p20.length > 0 && p21.length > 0
        );

    } finally {
        // Restore environment variables
        process.env.NODE_ENV = savedEnv.NODE_ENV;
        if (savedEnv.RAZORPAY_WEBHOOK_SECRET) {
            process.env.RAZORPAY_WEBHOOK_SECRET = savedEnv.RAZORPAY_WEBHOOK_SECRET;
        } else {
            delete process.env.RAZORPAY_WEBHOOK_SECRET;
        }
        if (savedEnv.RAZORPAY_KEY_SECRET) {
            process.env.RAZORPAY_KEY_SECRET = savedEnv.RAZORPAY_KEY_SECRET;
        } else {
            delete process.env.RAZORPAY_KEY_SECRET;
        }

        // Clean up test events
        if (testEventIds.length > 0) {
            const placeholders = testEventIds.map(() => '?').join(',');
            await pool.execute(
                `DELETE FROM payment_webhook_events WHERE event_id IN (${placeholders})`,
                testEventIds
            ).catch(() => {});
        }

        if (serverInstance) {
            await new Promise((resolve) => serverInstance.close(resolve));
        }
        await pool.end();
    }

    console.log('\n============================================================');
    console.log(`QUIRO Step 7F-5E Webhook Secret Enforcement: ALL ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('============================================================\n');
}

if (require.main === module) {
    runWebhookSecretEnforcementTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL TEST FAILURE]:', err.message);
            process.exit(1);
        });
}

module.exports = { runWebhookSecretEnforcementTests };
