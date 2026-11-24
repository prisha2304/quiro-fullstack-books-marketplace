/**
 * QUIRO — Step 7E: Critical Security and Webhook Reliability Fixes Test Suite
 * 
 * Verifies:
 * 1. Valid Razorpay signatures using exact raw request body are accepted.
 * 2. Modified request bodies are rejected.
 * 3. Invalid signatures are rejected.
 * 4. Different JSON whitespace or formatting does not break verification when original signed bytes are preserved.
 * 5. Existing webhook idempotency behavior remains intact.
 * 6. Rate limiting / IP resolution distinguishes requests from different client IPs behind trusted proxy.
 * 7. Untrusted forwarded headers cannot spoof client IP.
 * 
 * SAFETY:
 * - Uses isolated local quiro_test database only.
 * - Cleaned up properly in finally block.
 * - No connections to TiDB Cloud or production.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const rateLimit = require('express-rate-limit');
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

const { pool } = require('../../config/db');
const webhookService = require('../../services/webhookService');
const { app } = require('../../index');

const TEST_SECRET = 'rzp_test_webhook_secret_for_quiro_testing_32chars';
const TEST_PORT = 5098;
let testServer = null;

async function runTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 7E: Security & Webhook Reliability Tests');
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
        // -------------------------------------------------------------
        // PART 1: Webhook Raw-Body Signature Verification
        // -------------------------------------------------------------
        console.log('--- Testing Razorpay Raw-Body Signature Verification ---');

        const rawJsonString = '{\n  "entity": "event",\n  "event": "payment.captured",\n  "contains": ["payment"],\n  "payload": {\n    "payment": {\n      "entity": {\n        "id": "pay_test_7e_001",\n        "amount": 50000,\n        "status": "captured"\n      }\n    }\n  }\n}';
        const rawBuffer = Buffer.from(rawJsonString, 'utf8');

        // Generate authentic signature over the raw bytes
        const validSignature = crypto
            .createHmac('sha256', TEST_SECRET)
            .update(rawBuffer)
            .digest('hex');

        // Check 1: Valid signature using exact raw request body buffer is accepted
        const parsedPayload = JSON.parse(rawJsonString);
        const check1 = webhookService.verifySignature(parsedPayload, validSignature, TEST_SECRET, rawBuffer);
        assertCheck('Valid signature with raw body Buffer is accepted', check1 === true);

        // Check 2: Modified request body buffer is rejected
        const tamperedBuffer = Buffer.from(rawJsonString.replace('50000', '99999'), 'utf8');
        const check2 = webhookService.verifySignature(parsedPayload, validSignature, TEST_SECRET, tamperedBuffer);
        assertCheck('Modified request body Buffer is rejected', check2 === false);

        // Check 3: Invalid signature hash is rejected
        const fakeSignature = 'a'.repeat(64);
        const check3 = webhookService.verifySignature(parsedPayload, fakeSignature, TEST_SECRET, rawBuffer);
        assertCheck('Invalid signature hash is rejected', check3 === false);

        // Check 4: Different JSON whitespace/formatting does NOT break verification when original signed bytes are preserved
        // Note: JSON.stringify(parsedPayload) strips all line breaks and indentation
        const reSerialized = JSON.stringify(parsedPayload);
        const naiveSignature = crypto.createHmac('sha256', TEST_SECRET).update(reSerialized).digest('hex');
        assertCheck('Confirmed naive JSON.stringify signature differs from original formatted raw bytes', naiveSignature !== validSignature);

        // But verifySignature with rawBuffer succeeds regardless of how the payload was parsed
        const check4 = webhookService.verifySignature(parsedPayload, validSignature, TEST_SECRET, rawBuffer);
        assertCheck('verifySignature succeeds on rawBuffer despite whitespace differences in parsed payload', check4 === true);

        // -------------------------------------------------------------
        // PART 2: Webhook Idempotency Processing
        // -------------------------------------------------------------
        console.log('\n--- Testing Webhook Idempotency ---');
        const testEventId = `evt_test_7e_${Date.now()}`;
        createdEventIds.push(testEventId);

        const eventPayload = {
            id: testEventId,
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: `pay_test_${Date.now()}`,
                        order_id: `order_test_${Date.now()}`,
                        amount: 45000,
                        status: 'captured'
                    }
                }
            }
        };

        const eventRawBuffer = Buffer.from(JSON.stringify(eventPayload), 'utf8');
        const eventSig = crypto.createHmac('sha256', TEST_SECRET).update(eventRawBuffer).digest('hex');

        // First execution -> processes and marks PROCESSED
        const firstResult = await webhookService.processPaymentWebhook({
            eventId: testEventId,
            eventType: 'payment.captured',
            payload: eventPayload,
            signature: eventSig,
            secret: TEST_SECRET,
            rawBody: eventRawBuffer
        });
        assertCheck('First webhook execution completes successfully', firstResult && firstResult.status === 'PROCESSED');

        // Second execution with same eventId -> returns IGNORED_DUPLICATE
        const replayResult = await webhookService.processPaymentWebhook({
            eventId: testEventId,
            eventType: 'payment.captured',
            payload: eventPayload,
            signature: eventSig,
            secret: TEST_SECRET,
            rawBody: eventRawBuffer
        });
        assertCheck('Replayed webhook event is detected and returns IGNORED_DUPLICATE', replayResult && replayResult.status === 'IGNORED_DUPLICATE');

        // -------------------------------------------------------------
        // PART 3: Express Trust Proxy & Rate Limiting Verification
        // -------------------------------------------------------------
        console.log('\n--- Testing Express Trust Proxy & IP Resolution ---');

        // Spin up a test Express app with the exact trust proxy configuration
        const proxyTestApp = express();
        
        // Exact configuration implemented in server/index.js
        proxyTestApp.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

        // Rate limiter tracking req.ip
        const ipTestLimiter = rateLimit({
            windowMs: 60 * 1000,
            max: 2, // limit to 2 requests per IP
            standardHeaders: true,
            legacyHeaders: false,
            message: { error: 'Rate limit exceeded' }
        });

        const capturedIps = [];
        proxyTestApp.get('/test-ip', ipTestLimiter, (req, res) => {
            capturedIps.push(req.ip);
            res.json({ ip: req.ip });
        });

        await new Promise((resolve) => {
            testServer = proxyTestApp.listen(TEST_PORT, '127.0.0.1', () => {
                resolve();
            });
        });

        // Test 6: Requests from different client IPs forwarded through trusted proxy (127.0.0.1)
        // Request from Client A (203.0.113.10)
        const resClientA1 = await axios.get(`http://127.0.0.1:${TEST_PORT}/test-ip`, {
            headers: { 'X-Forwarded-For': '203.0.113.10' }
        });
        assertCheck('Request through trusted proxy resolves to Client A IP', resClientA1.data.ip === '203.0.113.10');

        const resClientA2 = await axios.get(`http://127.0.0.1:${TEST_PORT}/test-ip`, {
            headers: { 'X-Forwarded-For': '203.0.113.10' }
        });
        assertCheck('Second request from Client A resolves to same IP', resClientA2.data.ip === '203.0.113.10');

        // Third request from Client A should be rate-limited (HTTP 429)
        let clientARateLimited = false;
        try {
            await axios.get(`http://127.0.0.1:${TEST_PORT}/test-ip`, {
                headers: { 'X-Forwarded-For': '203.0.113.10' }
            });
        } catch (err) {
            clientARateLimited = err.response && err.response.status === 429;
        }
        assertCheck('Client A reaches rate limit and receives 429', clientARateLimited === true);

        // Request from Client B (198.51.100.20) through same proxy should NOT be rate-limited
        const resClientB = await axios.get(`http://127.0.0.1:${TEST_PORT}/test-ip`, {
            headers: { 'X-Forwarded-For': '198.51.100.20' }
        });
        assertCheck('Client B is not rate-limited and resolves to Client B IP', resClientB.status === 200 && resClientB.data.ip === '198.51.100.20');

        // Check 7: Multiple X-Forwarded-For entries (client sent spoofed header, proxy appended real IP)
        // Header: '1.2.3.4, 203.0.113.50' -> Express should take rightmost untrusted entry (203.0.113.50)
        const resSpoofedThroughProxy = await axios.get(`http://127.0.0.1:${TEST_PORT}/test-ip`, {
            headers: { 'X-Forwarded-For': '1.2.3.4, 203.0.113.50' }
        });
        assertCheck('Forwarded header spoofing blocked: resolves to actual client IP (203.0.113.50)', resSpoofedThroughProxy.data.ip === '203.0.113.50');

        console.log(`\nAll ${totalChecks}/${totalChecks} checks PASSED successfully!`);
        return true;
    } finally {
        if (testServer) {
            await new Promise((resolve) => testServer.close(resolve));
        }

        // Clean up test events
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

runTests().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
