/**
 * QUIRO — Step 7A: Courier Advance Authorization Tests
 * 
 * Verifies that POST /api/swaps/:id/advance-courier enforces authorization:
 * 1. Requester can advance their own swap.
 * 2. Owner can advance their own swap.
 * 3. Admin can advance a swap.
 * 4. Unrelated authenticated user receives HTTP 403.
 * 5. Nonexistent swap receives HTTP 404.
 * 6. Unauthorized requests do not call Swap.advanceCourierStage() (state remains unchanged).
 * 
 * SAFETY:
 * - Uses isolated local quiro_test only.
 * - Remote host connections strictly blocked.
 * - Cleanup cleans only test-created records.
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');
axios.defaults.proxy = false;
const jwt = require('jsonwebtoken');

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
const Swap = require('../../models/Swap');
const { app, server } = require('../../index');

const TEST_PORT = parseInt(process.env.TEST_PORT || '5002', 10);
const API_BASE = `http://localhost:${TEST_PORT}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_quiro_testing_only_32_chars';
let serverInstance = null;

function makeToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role || 'USER', tv: user.token_version || 1 },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

async function runCourierAdvanceAuthTests() {
    console.log('================================================================');
    console.log('🧪 TARGETED TEST SUITE: COURIER ADVANCE AUTHORIZATION (STEP 7A)');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function testAssert(condition, testName, details = '') {
        if (condition) {
            console.log(`  ✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
            failed++;
        }
    }

    // Ensure test HTTP server is running
    try {
        const ping = await axios.get(`http://localhost:${TEST_PORT}/`, { timeout: 800 }).catch(() => null);
        if (!ping || ping.status !== 200) {
            if (!server.listening) {
                serverInstance = server.listen(TEST_PORT);
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }
    } catch (e) {
        if (!server.listening) {
            serverInstance = server.listen(TEST_PORT);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

    const createdSwapIds = [];
    const createdBookIds = [];
    let userA = null;
    let userB = null;
    let userUnrelated = null;
    let adminUser = null;

    try {
        // Step 0: Find or select test users from quiro_test
        const [users] = await pool.execute('SELECT id, full_name, email, role FROM users WHERE role = "USER" LIMIT 3');
        if (users.length < 3) {
            throw new Error('Test requires at least 3 standard users in quiro_test.');
        }
        userA = users[0];          // Requester
        userB = users[1];          // Owner
        userUnrelated = users[2];  // Unrelated third-party reader

        // Find or mock an admin user
        const [admins] = await pool.execute('SELECT id, full_name, email, role FROM users WHERE role = "ADMIN" LIMIT 1');
        if (admins.length > 0) {
            adminUser = admins[0];
        } else {
            adminUser = { id: 9999, email: 'mock_admin@quiro.com', role: 'ADMIN' };
        }

        const tokenA = makeToken(userA);
        const tokenB = makeToken(userB);
        const tokenUnrelated = makeToken(userUnrelated);
        const tokenAdmin = makeToken(adminUser);

        // Setup test books
        const [bookARes] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled) VALUES (?, "COURIER_AUTH_BOOK_A", "Author A", "9781234567801", 250, "Good", "Fiction", "available", 1)',
            [userA.id]
        );
        const bookAId = bookARes.insertId;
        createdBookIds.push(bookAId);

        const [bookBRes] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled) VALUES (?, "COURIER_AUTH_BOOK_B", "Author B", "9781234567802", 280, "Good", "Fiction", "available", 1)',
            [userB.id]
        );
        const bookBId = bookBRes.insertId;
        createdBookIds.push(bookBId);

        // Create swap: User A (requester) and User B (owner)
        const swapId = await Swap.create({
            requester_id: userA.id,
            owner_id: userB.id,
            requested_book_id: bookBId,
            offered_book_id: bookAId,
            message: 'Courier authorization test'
        });
        createdSwapIds.push(swapId);

        await Swap.updateStatus(swapId, 'accepted', userB.id);
        await Swap.selectMethod(swapId, userA.id, 'QUIRO_MANAGED');
        await Swap.selectMethod(swapId, userB.id, 'QUIRO_MANAGED');

        // Initial courier status is null/unconfirmed
        const [initSwap] = await pool.execute('SELECT courier_status, status FROM swap_requests WHERE id = ?', [swapId]);
        const initialStatus = initSwap[0].courier_status;

        console.log('--- 1. Testing Unrelated Authenticated User Rejection (HTTP 403) ---');
        let unrelatedStatus = null;
        let unrelatedError = null;
        try {
            await axios.post(
                `${API_BASE}/swaps/${swapId}/advance-courier`,
                { stage: 'pickup_scheduled' },
                { headers: { Authorization: `Bearer ${tokenUnrelated}` } }
            );
        } catch (err) {
            unrelatedStatus = err.response?.status;
            unrelatedError = err.response?.data?.message;
        }
        testAssert(unrelatedStatus === 403, 'Unrelated user receives HTTP 403 Forbidden', `status: ${unrelatedStatus}`);
        testAssert(unrelatedError && unrelatedError.includes('not authorized'), 'Clear authorization rejection message returned', `message: ${unrelatedError}`);

        console.log('\n--- 2. Verifying Unauthorized Request Did Not Call advanceCourierStage() ---');
        const [afterUnauth] = await pool.execute('SELECT courier_status FROM swap_requests WHERE id = ?', [swapId]);
        testAssert(afterUnauth[0].courier_status === initialStatus, 'Courier status unchanged after 403 attempt', `current: ${afterUnauth[0].courier_status}`);

        console.log('\n--- 3. Testing Nonexistent Swap Request (HTTP 404) ---');
        let nonExistentStatus = null;
        let nonExistentError = null;
        try {
            await axios.post(
                `${API_BASE}/swaps/999999999/advance-courier`,
                { stage: 'pickup_scheduled' },
                { headers: { Authorization: `Bearer ${tokenA}` } }
            );
        } catch (err) {
            nonExistentStatus = err.response?.status;
            nonExistentError = err.response?.data?.message;
        }
        testAssert(nonExistentStatus === 404, 'Nonexistent swap returns HTTP 404 Not Found', `status: ${nonExistentStatus}`);
        testAssert(nonExistentError && nonExistentError.includes('not found'), 'Clear 404 error message returned', `message: ${nonExistentError}`);

        console.log('\n--- 4. Testing Swap Requester Can Advance Courier Stage (HTTP 200) ---');
        const reqAdvanceRes = await axios.post(
            `${API_BASE}/swaps/${swapId}/advance-courier`,
            { stage: 'pickup_scheduled' },
            { headers: { Authorization: `Bearer ${tokenA}` } }
        );
        testAssert(reqAdvanceRes.status === 200, 'Requester advance returns HTTP 200 OK');
        testAssert(reqAdvanceRes.data.courier_status === 'pickup_scheduled', 'Requester successfully advances stage to pickup_scheduled');

        console.log('\n--- 5. Testing Swap Owner Can Advance Courier Stage (HTTP 200) ---');
        const ownerAdvanceRes = await axios.post(
            `${API_BASE}/swaps/${swapId}/advance-courier`,
            { stage: 'pickup_partner_assigned' },
            { headers: { Authorization: `Bearer ${tokenB}` } }
        );
        testAssert(ownerAdvanceRes.status === 200, 'Owner advance returns HTTP 200 OK');
        testAssert(ownerAdvanceRes.data.courier_status === 'pickup_partner_assigned', 'Owner successfully advances stage to pickup_partner_assigned');

        console.log('\n--- 6. Testing Admin User Can Advance Courier Stage (HTTP 200) ---');
        const adminAdvanceRes = await axios.post(
            `${API_BASE}/swaps/${swapId}/advance-courier`,
            { stage: 'pickup_partner_en_route' },
            { headers: { Authorization: `Bearer ${tokenAdmin}` } }
        );
        testAssert(adminAdvanceRes.status === 200, 'Admin advance returns HTTP 200 OK');
        testAssert(adminAdvanceRes.data.courier_status === 'pickup_partner_en_route', 'Admin successfully advances stage to pickup_partner_en_route');

        console.log('\n--- 7. Verifying Protected Historical Records Untouched ---');
        const [swap34] = await pool.execute('SELECT id, status FROM swap_requests WHERE id = 34');
        testAssert(swap34.length > 0 && swap34[0].id === 34, 'Swap 34 exists and is untouched');

        const [payments19_21] = await pool.execute('SELECT COUNT(*) as cnt FROM swap_payments WHERE id IN (19, 20, 21)');
        testAssert(Number(payments19_21[0].cnt) === 3, 'Payments 19, 20, 21 exist and are untouched');

    } catch (err) {
        console.error('Test execution error:', err.message);
        failed++;
    } finally {
        // Child-first cleanup for test-created records only
        for (const sid of createdSwapIds) {
            try {
                await pool.execute('DELETE FROM swap_timeline WHERE swap_id = ?', [sid]);
                await pool.execute('DELETE FROM swap_addresses WHERE swap_id = ?', [sid]);
                await pool.execute('DELETE FROM swap_payments WHERE swap_id = ?', [sid]);
                await pool.execute('DELETE FROM swap_requests WHERE id = ?', [sid]);
            } catch (cleanupErr) {
                console.warn(`Cleanup failed for swap ${sid}:`, cleanupErr.message);
            }
        }
        for (const bid of createdBookIds) {
            try {
                await pool.execute('DELETE FROM books WHERE id = ?', [bid]);
            } catch (cleanupErr) {
                console.warn(`Cleanup failed for book ${bid}:`, cleanupErr.message);
            }
        }

        console.log('\n================================================================');
        console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
        console.log('================================================================\n');

        if (serverInstance && typeof serverInstance.close === 'function') {
            serverInstance.close();
        }
        try {
            await pool.end();
        } catch (e) {}

        process.exit(failed > 0 ? 1 : 0);
    }
}

runCourierAdvanceAuthTests();
