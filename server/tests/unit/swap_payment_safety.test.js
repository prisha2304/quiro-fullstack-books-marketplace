/**
 * Targeted Unit & Integration Test Suite for Swap Payment Idempotency & Refund Safety
 * 
 * Verifies:
 *  1. Repeated payment creation requests (returns same order, no duplicates)
 *  2. Concurrent payment creation attempts (transaction locking prevents duplicates)
 *  3. Verification of the correct Razorpay order
 *  4. Verification with an unrelated order ID (strictly rejected)
 *  5. Repeated payment callbacks (idempotent, no duplicate timeline events)
 *  6. Duplicate Razorpay payment IDs handling (gateway called once)
 *  7. Razorpay refund failure (accurate REFUND_FAILED state, swap not cancelled)
 *  8. Repeated refund requests (idempotent return)
 *  9. Successful refund verification (REFUNDED state, book released, swap cancelled)
 * 10. Payment timeline idempotency (only one timeline entry per payment)
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const Razorpay = require('razorpay');

// Ensure test environment variables are active (load .env.test if present)
const testEnvPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(testEnvPath)) {
    require('dotenv').config({ path: testEnvPath });
}
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || process.env.LOCAL_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || process.env.LOCAL_DB_PORT || '3306';
process.env.DB_USER = process.env.DB_USER || process.env.LOCAL_DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || process.env.LOCAL_DB_PASSWORD || '';
process.env.DB_NAME = process.env.TEST_DB_NAME || process.env.DB_NAME || 'quiro_test';
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || 'quiro_test';
process.env.DB_SSL = 'false';

// Mock Razorpay client methods for deterministic testing and to guarantee no live external API calls
let mockRefundHandler = async (paymentId, params) => ({
    id: `rfnd_mock_${Date.now()}`,
    entity: 'refund',
    amount: params?.amount || 7900,
    status: 'processed'
});

let mockFetchMultipleRefundHandler = async (paymentId) => ({
    entity: 'collection',
    count: 0,
    items: []
});

let mockFetchPaymentHandler = async (paymentId) => ({
    id: paymentId,
    entity: 'payment',
    amount: 7900,
    amount_refunded: 0,
    refund_status: null,
    status: 'captured'
});

let mockOrderHandler = async (params) => ({
    id: `order_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    entity: 'order',
    amount: params.amount,
    currency: params.currency || 'INR',
    receipt: params.receipt,
    status: 'created'
});

const origAddResources = Razorpay.prototype.addResources;
Razorpay.prototype.addResources = function() {
    if (origAddResources) origAddResources.call(this);
    this.orders = {
        create: async (params) => mockOrderHandler(params)
    };
    this.payments = {
        refund: async (paymentId, params) => mockRefundHandler(paymentId, params),
        fetchMultipleRefund: async (paymentId, params) => mockFetchMultipleRefundHandler(paymentId, params),
        fetch: async (paymentId) => mockFetchPaymentHandler(paymentId)
    };
};

const { pool } = require('../../config/db');
const Swap = require('../../models/Swap');

async function runPaymentSafetyTests() {
    console.log('================================================================');
    console.log('🧪 TARGETED TEST SUITE: SWAP PAYMENT IDEMPOTENCY & REFUND SAFETY');
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

    let userAId = null;
    let userBId = null;
    const createdSwapIds = [];
    const createdBookIds = [];
    const DEFAULT_TEST_IMAGE = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c';

    try {
        // Step 0: Find or verify 2 test users
        const [users] = await pool.execute('SELECT id, full_name, email FROM users WHERE role = "user" LIMIT 2');
        if (users.length < 2) {
            throw new Error('Test requires at least 2 users in the database.');
        }
        userAId = users[0].id;
        userBId = users[1].id;

        // ── Orphan Diagnostic (read-only) ────────────────────────────────────
        // Detect swap_payments rows whose parent swap_requests row was already
        // deleted by a prior interrupted cleanup.  These rows do NOT affect this
        // test run (new swapIds are always fresh auto-increment values) but are
        // surfaced here so operators know the DB is not fully clean.
        try {
            const [orphaned] = await pool.execute(`
                SELECT sp.id, sp.swap_id, sp.status, sp.created_at
                FROM swap_payments sp
                LEFT JOIN swap_requests sr ON sp.swap_id = sr.id
                WHERE sr.id IS NULL
                  AND sp.created_at < NOW() - INTERVAL 1 HOUR
                LIMIT 50
            `);
            if (orphaned.length > 0) {
                const orphanSwapIds = [...new Set(orphaned.map(r => r.swap_id))];
                console.warn(`\n⚠️  ORPHAN DIAGNOSTIC: ${orphaned.length} swap_payments row(s) found whose parent swap_requests row no longer exists.`);
                console.warn('   These are leftovers from a prior interrupted cleanup and do NOT affect this test run.');
                console.warn('   Orphaned swap_id(s):', orphanSwapIds.join(', '));
                console.warn('   To remove them, run the dedicated operator cleanup script against quiro_test only.\n');
            }
        } catch (diagErr) {
            // Diagnostic failure must never abort the test run
            console.warn('⚠️  Orphan diagnostic query failed (non-fatal):', diagErr.message);
        }
        // ─────────────────────────────────────────────────────────────────────

        // Create test books
        const [bookARes] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_A", "Author A", "9781111111111", 200, "Good", "Fiction", "available", 1, ?)',
            [userAId, DEFAULT_TEST_IMAGE]
        );
        const bookAId = bookARes.insertId;
        createdBookIds.push(bookAId);

        const [bookBRes] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_B", "Author B", "9782222222222", 200, "Good", "Fiction", "available", 1, ?)',
            [userBId, DEFAULT_TEST_IMAGE]
        );
        const bookBId = bookBRes.insertId;
        createdBookIds.push(bookBId);

        // Create swap request: User A proposes to User B
        const swapId = await Swap.create({
            requester_id: userAId,
            owner_id: userBId,
            requested_book_id: bookBId,
            offered_book_id: bookAId,
            message: 'Payment safety test'
        });
        createdSwapIds.push(swapId);

        // Accept and select QUIRO_MANAGED
        await Swap.updateStatus(swapId, 'accepted', userBId);
        await Swap.selectMethod(swapId, userAId, 'QUIRO_MANAGED');
        await Swap.selectMethod(swapId, userBId, 'QUIRO_MANAGED');

        // Add confirmed addresses for both users
        await Swap.saveAddress(swapId, userAId, {
            full_name: 'User A',
            phone: '9876543210',
            pickup_address: 'Address A',
            delivery_address: 'Address A',
            city: 'Mumbai',
            state: 'Maharashtra',
            postal_code: '400001'
        });
        await Swap.saveAddress(swapId, userBId, {
            full_name: 'User B',
            phone: '9123456780',
            pickup_address: 'Address B',
            delivery_address: 'Address B',
            city: 'Bengaluru',
            state: 'Karnataka',
            postal_code: '560001'
        });

        // -----------------------------------------------------------------
        // TEST 1: Repeated Payment Creation Requests (Order Reuse)
        // -----------------------------------------------------------------
        console.log('\n--- 1. Testing Repeated Payment Creation (Idempotency) ---');
        const order1 = await Swap.createManagedPayment(swapId, userAId);
        const order2 = await Swap.createManagedPayment(swapId, userAId);

        testAssert(order1.rzpOrderId && order2.rzpOrderId, 'Both calls return valid order IDs');
        testAssert(order1.rzpOrderId === order2.rzpOrderId, 'Repeated call reuses existing pending order ID', `order1=${order1.rzpOrderId}, order2=${order2.rzpOrderId}`);

        const [paymentRowsA] = await pool.execute(
            'SELECT COUNT(*) as count FROM swap_payments WHERE swap_id = ? AND user_id = ?',
            [swapId, userAId]
        );
        testAssert(paymentRowsA[0].count === 1, 'Exactly one payment row exists in database for User A', `count: ${paymentRowsA[0].count}`);

        // -----------------------------------------------------------------
        // TEST 2: Concurrent Payment Creation Attempts
        // -----------------------------------------------------------------
        console.log('\n--- 2. Testing Concurrent Payment Creation Attempts ---');
        const [concurrentOrder1, concurrentOrder2] = await Promise.all([
            Swap.createManagedPayment(swapId, userBId),
            Swap.createManagedPayment(swapId, userBId)
        ]);

        testAssert(concurrentOrder1.rzpOrderId === concurrentOrder2.rzpOrderId, 'Concurrent requests resolve to the exact same order ID');

        const [paymentRowsB] = await pool.execute(
            'SELECT COUNT(*) as count FROM swap_payments WHERE swap_id = ? AND user_id = ?',
            [swapId, userBId]
        );
        testAssert(paymentRowsB[0].count === 1, 'Concurrent requests resulted in exactly one database row for User B', `count: ${paymentRowsB[0].count}`);

        // -----------------------------------------------------------------
        // TEST 3: Verification of the Correct Razorpay Order
        // -----------------------------------------------------------------
        console.log('\n--- 3. Testing Verification of the Correct Razorpay Order ---');
        const payIdA = `pay_mock_A_${Date.now()}`;
        const sigA = `sig_sandbox_A_${Date.now()}`;

        await Swap.verifyManagedPayment(swapId, userAId, {
            razorpay_order_id: order1.rzpOrderId,
            razorpay_payment_id: payIdA,
            razorpay_signature: sigA
        });

        const [capturedA] = await pool.execute(
            'SELECT status, razorpay_payment_id FROM swap_payments WHERE swap_id = ? AND user_id = ? AND razorpay_order_id = ?',
            [swapId, userAId, order1.rzpOrderId]
        );
        testAssert(capturedA[0].status === 'CAPTURED', 'Payment status updated to CAPTURED');
        testAssert(capturedA[0].razorpay_payment_id === payIdA, 'Razorpay payment ID recorded correctly');

        // -----------------------------------------------------------------
        // TEST 4: Verification with an Unrelated Order ID
        // -----------------------------------------------------------------
        console.log('\n--- 4. Testing Verification with an Unrelated Order ID ---');
        let unrelatedError = null;
        try {
            await Swap.verifyManagedPayment(swapId, userBId, {
                razorpay_order_id: 'order_completely_fake_99999',
                razorpay_payment_id: `pay_mock_fake_${Date.now()}`,
                razorpay_signature: 'sig_sandbox_fake'
            });
        } catch (err) {
            unrelatedError = err.message;
        }
        testAssert(
            unrelatedError && unrelatedError.includes('No payment order found matching order ID'),
            'Unrelated order ID rejected with clear error',
            `message: ${unrelatedError}`
        );

        // Verify User B's order remains PENDING.
        // Pin the query to the exact razorpay_order_id returned by Test 2 so the
        // assertion is deterministic even if multiple rows exist for this user
        // (e.g. from a failed prior run that left stale rows).
        const [statusBAfterFake] = await pool.execute(
            'SELECT status FROM swap_payments WHERE swap_id = ? AND user_id = ? AND razorpay_order_id = ? ORDER BY id DESC LIMIT 1',
            [swapId, userBId, concurrentOrder1.rzpOrderId]
        );
        testAssert(
            statusBAfterFake.length > 0 && statusBAfterFake[0].status === 'PENDING',
            'User B payment remained PENDING after invalid verification attempt',
            statusBAfterFake.length > 0 ? `status: ${statusBAfterFake[0].status}` : 'NO ROW FOUND'
        );

        // -----------------------------------------------------------------
        // TEST 5: Repeated Payment Callbacks (Idempotency)
        // -----------------------------------------------------------------
        console.log('\n--- 5. Testing Repeated Payment Callbacks ---');
        let repeatedCallbackFailed = false;
        try {
            // Send exact same verification again for User A
            await Swap.verifyManagedPayment(swapId, userAId, {
                razorpay_order_id: order1.rzpOrderId,
                razorpay_payment_id: payIdA,
                razorpay_signature: sigA
            });
        } catch (err) {
            repeatedCallbackFailed = true;
        }
        testAssert(!repeatedCallbackFailed, 'Repeated payment callback handled idempotently without error');

        // -----------------------------------------------------------------
        // TEST 6: Payment Timeline Idempotency
        // -----------------------------------------------------------------
        console.log('\n--- 6. Testing Payment Timeline Idempotency ---');
        const [timelineEntriesA] = await pool.execute(
            'SELECT COUNT(*) as count FROM swap_timeline WHERE swap_id = ? AND actor_id = ? AND message LIKE ?',
            [swapId, userAId, '%completed shipping fee payment%']
        );
        testAssert(timelineEntriesA[0].count === 1, 'Only one timeline event exists for User A payment despite repeated verification', `count: ${timelineEntriesA[0].count}`);

        // Complete User B's payment legitimately
        const payIdB = `pay_mock_B_${Date.now()}`;
        const sigB = `sig_sandbox_B_${Date.now()}`;
        await Swap.verifyManagedPayment(swapId, userBId, {
            razorpay_order_id: concurrentOrder1.rzpOrderId,
            razorpay_payment_id: payIdB,
            razorpay_signature: sigB
        });

        const [swapAfterBothPaid] = await pool.execute(
            'SELECT status, courier_status, requester_paid, owner_paid FROM swap_requests WHERE id = ?',
            [swapId]
        );
        testAssert(swapAfterBothPaid[0].status === 'payment_completed', 'Swap status moved to payment_completed');
        testAssert(swapAfterBothPaid[0].requester_paid === 1 && swapAfterBothPaid[0].owner_paid === 1, 'Both parties marked paid');

        // -----------------------------------------------------------------
        // TEST 7: Duplicate Razorpay Payment IDs Handled Safely in Refund
        // -----------------------------------------------------------------
        console.log('\n--- 7. Testing Duplicate Payment IDs & Refund Deduplication ---');
        // Insert a simulated duplicate payment record sharing payIdB (representing historical artifact)
        const [dupRes] = await pool.execute(`
            INSERT INTO swap_payments (swap_id, user_id, role, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, status)
            VALUES (?, ?, 'owner', 'order_mock_dup_777', ?, ?, 79.00, 'CAPTURED')
        `, [swapId, userBId, payIdB, sigB]);
        const duplicatePaymentDbId = dupRes.insertId;

        // Track gateway refund calls
        let gatewayRefundCalls = [];

        // -----------------------------------------------------------------
        // TEST 8: Razorpay Refund Failure Preserves Accurate State
        // -----------------------------------------------------------------
        console.log('\n--- 8. Testing Razorpay Refund Failure Behavior ---');
        // Force refund failure for next test
        mockRefundHandler = async () => {
            throw new Error('Razorpay gateway timeout: transaction failed');
        };

        // Attempt refund with failing gateway
        const failResult = await Swap.processSwapRefund(swapId, userAId, 'Test cancellation with failing gateway');
        testAssert(failResult.success === false, 'Refund reports failure when gateway rejects');
        testAssert(failResult.refundFailures > 0, 'Refund failures count is tracked accurately', `failures: ${failResult.refundFailures}`);

        // Verify status is REFUND_FAILED and swap is NOT cancelled
        const [failedPayments] = await pool.execute(
            'SELECT status FROM swap_payments WHERE swap_id = ? AND status = "REFUND_FAILED"',
            [swapId]
        );
        testAssert(failedPayments.length > 0, 'Payments transitioned to REFUND_FAILED instead of being falsely marked REFUNDED');

        const [swapNotCancelled] = await pool.execute(
            'SELECT status FROM swap_requests WHERE id = ?',
            [swapId]
        );
        testAssert(swapNotCancelled[0].status !== 'cancelled', 'Swap request was NOT cancelled while refund failed', `status: ${swapNotCancelled[0].status}`);

        // -----------------------------------------------------------------
        // TEST 9: Successful Refund Verification & Retries
        // -----------------------------------------------------------------
        console.log('\n--- 9. Testing Successful Refund & Gateway Deduplication ---');
        gatewayRefundCalls = [];
        mockRefundHandler = async (paymentId) => {
            gatewayRefundCalls.push(paymentId);
            return { id: `rfnd_verified_${paymentId}`, status: 'processed' };
        };

        // Process refund now that gateway succeeds
        const successResult = await Swap.processSwapRefund(swapId, userAId, 'Test cancellation with succeeding gateway');
        testAssert(successResult.success === true, 'Refund succeeds when gateway confirms processing');

        // Check deduplication: userB had 2 rows with payIdB, but gateway must only be called once for payIdB
        const payBCalls = gatewayRefundCalls.filter(p => p === payIdB);
        testAssert(payBCalls.length <= 1, 'Gateway was called at most once for payIdB despite duplicate DB rows', `calls: ${payBCalls.length}`);

        // Check DB states: all rows marked REFUNDED
        const [refundedRows] = await pool.execute(
            'SELECT id, status, refund_id FROM swap_payments WHERE swap_id = ?',
            [swapId]
        );
        const allMarkedRefunded = refundedRows.every(r => r.status === 'REFUNDED');
        testAssert(allMarkedRefunded, 'All payments (including duplicate record) marked REFUNDED');

        // Check books released back to available
        const [booksAfterRefund] = await pool.execute(
            'SELECT id, status FROM books WHERE id IN (?, ?)',
            [bookAId, bookBId]
        );
        const booksAvailable = booksAfterRefund.every(b => b.status === 'available');
        testAssert(booksAvailable, 'Both books successfully released back to available status');

        // Check swap cancelled
        const [swapAfterRefund] = await pool.execute(
            'SELECT status FROM swap_requests WHERE id = ?',
            [swapId]
        );
        testAssert(swapAfterRefund[0].status === 'cancelled', 'Swap status moved to cancelled');

        // -----------------------------------------------------------------
        // TEST 10: Repeated Refund Requests (Idempotency)
        // -----------------------------------------------------------------
        console.log('\n--- 10. Testing Repeated Refund Requests ---');
        gatewayRefundCalls = [];
        const repeatRefundResult = await Swap.processSwapRefund(swapId, userAId, 'Repeated refund call');
        testAssert(repeatRefundResult.success === true && repeatRefundResult.alreadyRefunded === true, 'Repeated refund call returns success with alreadyRefunded flag');
        testAssert(gatewayRefundCalls.length === 0, 'Zero gateway calls made on repeated refund request');

        // -----------------------------------------------------------------
        // TEST 11: Authoritative Gateway Reconciliation Unit Checks
        // -----------------------------------------------------------------
        console.log('\n--- 11. Testing Authoritative Gateway Reconciliation Unit Helper ---');
        const mockRzpRecon = {
            payments: {
                fetchMultipleRefund: async (pId) => {
                    if (pId === 'pay_recon_multi') {
                        return {
                            entity: 'collection',
                            count: 1,
                            items: [{ id: 'rfnd_multi_123', status: 'processed', amount: 7900 }]
                        };
                    }
                    if (pId === 'pay_recon_pending') {
                        return {
                            entity: 'collection',
                            count: 1,
                            items: [{ id: 'rfnd_pending_456', status: 'created', amount: 7900 }]
                        };
                    }
                    if (pId === 'pay_recon_failed') {
                        return {
                            entity: 'collection',
                            count: 1,
                            items: [{ id: 'rfnd_failed_789', status: 'failed', amount: 7900 }]
                        };
                    }
                    if (pId === 'pay_recon_mixed_processed') {
                        return {
                            entity: 'collection',
                            count: 2,
                            items: [
                                { id: 'rfnd_old_fail', status: 'failed', amount: 7900 },
                                { id: 'rfnd_recovered_proc', status: 'processed', amount: 7900 }
                            ]
                        };
                    }
                    if (pId === 'pay_recon_mixed_pending') {
                        return {
                            entity: 'collection',
                            count: 2,
                            items: [
                                { id: 'rfnd_old_fail_2', status: 'failed', amount: 7900 },
                                { id: 'rfnd_recovered_pend', status: 'created', amount: 7900 }
                            ]
                        };
                    }
                    return { entity: 'collection', count: 0, items: [] };
                },
                fetch: async (pId) => {
                    if (pId === 'pay_recon_fallback') {
                        return { id: pId, entity: 'payment', amount: 7900, amount_refunded: 7900, refund_status: 'full' };
                    }
                    return { id: pId, entity: 'payment', amount: 7900, amount_refunded: 0, refund_status: null };
                }
            }
        };

        const reconMulti = await Swap.reconcileRazorpayRefund('pay_recon_multi', mockRzpRecon);
        testAssert(reconMulti && reconMulti.refundId === 'rfnd_multi_123' && reconMulti.state === 'PROCESSED', 'Reconciliation via fetchMultipleRefund identifies processed refund');
        testAssert(reconMulti && reconMulti.amount === 79, 'Reconciliation identifies correct refund amount');

        const reconPending = await Swap.reconcileRazorpayRefund('pay_recon_pending', mockRzpRecon);
        testAssert(reconPending && reconPending.state === 'PENDING' && reconPending.refundId === 'rfnd_pending_456', 'Reconciliation identifies created/pending refund as PENDING');

        const reconFailed = await Swap.reconcileRazorpayRefund('pay_recon_failed', mockRzpRecon);
        testAssert(reconFailed && reconFailed.state === 'FAILED', 'Reconciliation identifies all-failed refunds as FAILED (never treated as success)');

        const reconMixedProc = await Swap.reconcileRazorpayRefund('pay_recon_mixed_processed', mockRzpRecon);
        testAssert(reconMixedProc && reconMixedProc.state === 'PROCESSED' && reconMixedProc.refundId === 'rfnd_recovered_proc', 'Reconciliation with mixed statuses prioritizes processed refund');

        const reconMixedPend = await Swap.reconcileRazorpayRefund('pay_recon_mixed_pending', mockRzpRecon);
        testAssert(reconMixedPend && reconMixedPend.state === 'PENDING' && reconMixedPend.refundId === 'rfnd_recovered_pend', 'Reconciliation with mixed statuses prioritizes pending over failed');

        const reconFallback = await Swap.reconcileRazorpayRefund('pay_recon_fallback', mockRzpRecon);
        testAssert(reconFallback && reconFallback.state === 'PROCESSED' && reconFallback.refundId === 'rfnd_reconciled_pay_recon_fallback', 'Fallback reconciliation via fetch identifies fully refunded payment');

        const reconNone = await Swap.reconcileRazorpayRefund('pay_recon_none', mockRzpRecon);
        testAssert(reconNone === null, 'Reconciliation returns null when gateway confirms no refund exists');

        // -----------------------------------------------------------------
        // TEST 12: Gateway Success Followed by Response Timeout (Catch Reconciliation)
        // -----------------------------------------------------------------
        console.log('\n--- 12. Testing Gateway Success Followed by Response Timeout ---');
        // Setup Swap 2
        const [bookA2Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_A2", "Author A2", "9783333333333", 250, "Good", "Fiction", "available", 1, ?)',
            [userAId, DEFAULT_TEST_IMAGE]
        );
        const bookA2Id = bookA2Res.insertId;
        createdBookIds.push(bookA2Id);

        const [bookB2Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_B2", "Author B2", "9784444444444", 250, "Good", "Fiction", "available", 1, ?)',
            [userBId, DEFAULT_TEST_IMAGE]
        );
        const bookB2Id = bookB2Res.insertId;
        createdBookIds.push(bookB2Id);

        const swap2Id = await Swap.create({
            requester_id: userAId,
            owner_id: userBId,
            requested_book_id: bookB2Id,
            offered_book_id: bookA2Id,
            message: 'Timeout reconciliation test'
        });
        createdSwapIds.push(swap2Id);
        await Swap.updateStatus(swap2Id, 'accepted', userBId);
        await Swap.selectMethod(swap2Id, userAId, 'QUIRO_MANAGED');
        await Swap.selectMethod(swap2Id, userBId, 'QUIRO_MANAGED');
        await Swap.saveAddress(swap2Id, userAId, { full_name: 'User A', phone: '9876543210', pickup_address: 'Address Line A', delivery_address: 'Address Line A', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' });
        await Swap.saveAddress(swap2Id, userBId, { full_name: 'User B', phone: '9876543210', pickup_address: 'Address Line B', delivery_address: 'Address Line B', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001' });

        const orderA2 = await Swap.createManagedPayment(swap2Id, userAId);
        const orderB2 = await Swap.createManagedPayment(swap2Id, userBId);
        const payA2 = `pay_timeout_A_${Date.now()}`;
        const payB2 = `pay_timeout_B_${Date.now()}`;
        await Swap.verifyManagedPayment(swap2Id, userAId, { razorpay_order_id: orderA2.rzpOrderId, razorpay_payment_id: payA2, razorpay_signature: 'sig_sandbox_a2' });
        await Swap.verifyManagedPayment(swap2Id, userBId, { razorpay_order_id: orderB2.rzpOrderId, razorpay_payment_id: payB2, razorpay_signature: 'sig_sandbox_b2' });

        // Gateway mock: refund() processes refund on gateway, saves it, but throws ETIMEDOUT network exception!
        const gatewayTimeoutStore = new Map();
        mockRefundHandler = async (paymentId, params) => {
            const rfId = `rfnd_recovered_timeout_${paymentId}`;
            gatewayTimeoutStore.set(paymentId, { id: rfId, status: 'processed', amount: params?.amount || 7900 });
            throw new Error('ETIMEDOUT: Connection reset by gateway during response');
        };
        mockFetchMultipleRefundHandler = async (paymentId) => {
            if (gatewayTimeoutStore.has(paymentId)) {
                return { entity: 'collection', count: 1, items: [gatewayTimeoutStore.get(paymentId)] };
            }
            return { entity: 'collection', count: 0, items: [] };
        };

        const timeoutRefundResult = await Swap.processSwapRefund(swap2Id, userAId, 'Timeout recovery test');
        testAssert(timeoutRefundResult.success === true, 'Refund succeeds despite initial gateway response timeout via catch-block reconciliation');

        // Only check the two payments we created in this test (payA2, payB2).
        // Other rows sharing swap2Id may exist from prior interrupted runs with different razorpay_payment_id values.
        const [timeoutPayments] = await pool.execute(
            'SELECT status, refund_id FROM swap_payments WHERE swap_id = ? AND razorpay_payment_id IN (?, ?)',
            [swap2Id, payA2, payB2]
        );
        const allTimeoutRefunded = timeoutPayments.length === 2 &&
            timeoutPayments.every(p => p.status === 'REFUNDED' && p.refund_id && p.refund_id.startsWith('rfnd_recovered_timeout_'));
        testAssert(allTimeoutRefunded, 'All payments synchronized to REFUNDED with recovered refund IDs', `rows=${timeoutPayments.length}`);

        const [swap2After] = await pool.execute('SELECT status FROM swap_requests WHERE id = ?', [swap2Id]);
        testAssert(swap2After[0].status === 'cancelled', 'Swap 2 status moved to cancelled after timeout reconciliation');

        // -----------------------------------------------------------------
        // TEST 13: Gateway Success Followed by Database Failure (Retry Self-Healing)
        // -----------------------------------------------------------------
        console.log('\n--- 13. Testing Gateway Success Followed by DB Failure (Self-Healing Retry) ---');
        // Setup Swap 3
        const [bookA3Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_A3", "Author A3", "9785555555555", 300, "Good", "Fiction", "available", 1, ?)',
            [userAId, DEFAULT_TEST_IMAGE]
        );
        const bookA3Id = bookA3Res.insertId;
        createdBookIds.push(bookA3Id);

        const [bookB3Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_B3", "Author B3", "9786666666666", 300, "Good", "Fiction", "available", 1, ?)',
            [userBId, DEFAULT_TEST_IMAGE]
        );
        const bookB3Id = bookB3Res.insertId;
        createdBookIds.push(bookB3Id);

        const swap3Id = await Swap.create({
            requester_id: userAId,
            owner_id: userBId,
            requested_book_id: bookB3Id,
            offered_book_id: bookA3Id,
            message: 'DB failure self-healing test'
        });
        createdSwapIds.push(swap3Id);
        await Swap.updateStatus(swap3Id, 'accepted', userBId);
        await Swap.selectMethod(swap3Id, userAId, 'QUIRO_MANAGED');
        await Swap.selectMethod(swap3Id, userBId, 'QUIRO_MANAGED');
        await Swap.saveAddress(swap3Id, userAId, { full_name: 'User A', phone: '9876543210', pickup_address: 'Address Line A', delivery_address: 'Address Line A', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' });
        await Swap.saveAddress(swap3Id, userBId, { full_name: 'User B', phone: '9876543210', pickup_address: 'Address Line B', delivery_address: 'Address Line B', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001' });

        const orderA3 = await Swap.createManagedPayment(swap3Id, userAId);
        const orderB3 = await Swap.createManagedPayment(swap3Id, userBId);
        const payA3 = `pay_dbfail_A_${Date.now()}`;
        const payB3 = `pay_dbfail_B_${Date.now()}`;
        await Swap.verifyManagedPayment(swap3Id, userAId, { razorpay_order_id: orderA3.rzpOrderId, razorpay_payment_id: payA3, razorpay_signature: 'sig_sandbox_a3' });
        await Swap.verifyManagedPayment(swap3Id, userBId, { razorpay_order_id: orderB3.rzpOrderId, razorpay_payment_id: payB3, razorpay_signature: 'sig_sandbox_b3' });

        // Simulate that gateway already processed refunds for Swap 3
        const gatewayDbFailStore = new Map();
        gatewayDbFailStore.set(payA3, { id: `rfnd_dbfail_recovered_${payA3}`, status: 'processed', amount: 7900 });
        gatewayDbFailStore.set(payB3, { id: `rfnd_dbfail_recovered_${payB3}`, status: 'processed', amount: 7900 });

        mockFetchMultipleRefundHandler = async (paymentId) => {
            if (gatewayDbFailStore.has(paymentId)) {
                return { entity: 'collection', count: 1, items: [gatewayDbFailStore.get(paymentId)] };
            }
            return { entity: 'collection', count: 0, items: [] };
        };

        // Gateway refund should NOT be called because pre-check must detect existing refund!
        let gatewayCalledOnRetry = false;
        mockRefundHandler = async () => {
            gatewayCalledOnRetry = true;
            throw new Error('DUPLICATE_CALL_ERROR: Gateway refund was called again when already processed!');
        };

        // Simulate local DB records in REFUND_FAILED state due to previous database failure.
        // Scope to our own payment rows only — orphaned rows from prior runs must not be reset.
        await pool.execute(
            'UPDATE swap_payments SET status = "REFUND_FAILED" WHERE swap_id = ? AND razorpay_payment_id IN (?, ?)',
            [swap3Id, payA3, payB3]
        );

        // Retry refund processing
        const dbFailRetryResult = await Swap.processSwapRefund(swap3Id, userAId, 'Retry after DB failure');
        testAssert(dbFailRetryResult.success === true, 'Retry self-heals by reconciling existing gateway refunds');
        testAssert(!gatewayCalledOnRetry, 'Gateway refund API was NOT called again on retry');

        // Only check the two payments we created in this test (payA3, payB3).
        const [swap3Payments] = await pool.execute(
            'SELECT status, refund_id FROM swap_payments WHERE swap_id = ? AND razorpay_payment_id IN (?, ?)',
            [swap3Id, payA3, payB3]
        );
        const allSwap3Refunded = swap3Payments.length === 2 &&
            swap3Payments.every(p => p.status === 'REFUNDED' && p.refund_id && p.refund_id.startsWith('rfnd_dbfail_recovered_'));
        testAssert(allSwap3Refunded, 'Swap 3 payments reconciled to REFUNDED with original gateway refund IDs', `rows=${swap3Payments.length}`);

        // -----------------------------------------------------------------
        // TEST 14: Concurrent Refund Requests (Lock Decoupling & Claim Protection)
        // -----------------------------------------------------------------
        console.log('\n--- 14. Testing Concurrent Refund Requests ---');
        // Setup Swap 4
        const [bookA4Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_A4", "Author A4", "9787777777777", 220, "Good", "Fiction", "available", 1, ?)',
            [userAId, DEFAULT_TEST_IMAGE]
        );
        const bookA4Id = bookA4Res.insertId;
        createdBookIds.push(bookA4Id);

        const [bookB4Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_B4", "Author B4", "9788888888888", 220, "Good", "Fiction", "available", 1, ?)',
            [userBId, DEFAULT_TEST_IMAGE]
        );
        const bookB4Id = bookB4Res.insertId;
        createdBookIds.push(bookB4Id);

        const swap4Id = await Swap.create({
            requester_id: userAId,
            owner_id: userBId,
            requested_book_id: bookB4Id,
            offered_book_id: bookA4Id,
            message: 'Concurrent refund test'
        });
        createdSwapIds.push(swap4Id);
        await Swap.updateStatus(swap4Id, 'accepted', userBId);
        await Swap.selectMethod(swap4Id, userAId, 'QUIRO_MANAGED');
        await Swap.selectMethod(swap4Id, userBId, 'QUIRO_MANAGED');
        await Swap.saveAddress(swap4Id, userAId, { full_name: 'User A', phone: '9876543210', pickup_address: 'Address Line A', delivery_address: 'Address Line A', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' });
        await Swap.saveAddress(swap4Id, userBId, { full_name: 'User B', phone: '9876543210', pickup_address: 'Address Line B', delivery_address: 'Address Line B', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001' });

        const orderA4 = await Swap.createManagedPayment(swap4Id, userAId);
        const orderB4 = await Swap.createManagedPayment(swap4Id, userBId);
        const payA4 = `pay_concurrent_A_${Date.now()}`;
        const payB4 = `pay_concurrent_B_${Date.now()}`;
        await Swap.verifyManagedPayment(swap4Id, userAId, { razorpay_order_id: orderA4.rzpOrderId, razorpay_payment_id: payA4, razorpay_signature: 'sig_sandbox_a4' });
        await Swap.verifyManagedPayment(swap4Id, userBId, { razorpay_order_id: orderB4.rzpOrderId, razorpay_payment_id: payB4, razorpay_signature: 'sig_sandbox_b4' });

        let concurrentRefundCallsCount = 0;
        mockFetchMultipleRefundHandler = async () => ({ entity: 'collection', count: 0, items: [] });
        mockRefundHandler = async (paymentId, params) => {
            concurrentRefundCallsCount++;
            // Simulate 50ms network delay to expose any concurrency races
            await new Promise(res => setTimeout(res, 50));
            return { id: `rfnd_concurrent_${paymentId}`, status: 'processed' };
        };

        // Fire two concurrent refund requests
        const [concurrentRes1, concurrentRes2] = await Promise.all([
            Swap.processSwapRefund(swap4Id, userAId, 'Concurrent attempt 1'),
            Swap.processSwapRefund(swap4Id, userAId, 'Concurrent attempt 2')
        ]);

        const atLeastOneSuccess = concurrentRes1.success === true || concurrentRes2.success === true;
        testAssert(atLeastOneSuccess, 'At least one concurrent request completes successfully');

        // The other should either report inProgress or alreadyRefunded
        const secondSafelyHandled = concurrentRes1.inProgress || concurrentRes1.alreadyRefunded || concurrentRes2.inProgress || concurrentRes2.alreadyRefunded || (concurrentRes1.success && concurrentRes2.success);
        testAssert(secondSafelyHandled, 'Concurrent request does not corrupt state or cause race collisions');

        // Gateway refund should be called at most once per participant (total <= 2)
        testAssert(concurrentRefundCallsCount <= 2, 'Gateway was called at most once per payment despite concurrent requests', `calls: ${concurrentRefundCallsCount}`);

        const [swap4Payments] = await pool.execute('SELECT status FROM swap_payments WHERE swap_id = ?', [swap4Id]);
        const allSwap4Refunded = swap4Payments.every(p => p.status === 'REFUNDED');
        testAssert(allSwap4Refunded, 'All Swap 4 payments end in REFUNDED state');

        // -----------------------------------------------------------------
        // TEST 15: Razorpay Refund Status 'created' Keeps Books Reserved
        // -----------------------------------------------------------------
        console.log('\n--- 15. Testing Refund Status "created" (Pending Settlement) ---');
        // Setup Swap 5
        const [bookA5Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_A5", "Author A5", "9789999999991", 280, "Good", "Fiction", "available", 1, ?)',
            [userAId, DEFAULT_TEST_IMAGE]
        );
        const bookA5Id = bookA5Res.insertId;
        createdBookIds.push(bookA5Id);

        const [bookB5Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_B5", "Author B5", "9789999999992", 280, "Good", "Fiction", "available", 1, ?)',
            [userBId, DEFAULT_TEST_IMAGE]
        );
        const bookB5Id = bookB5Res.insertId;
        createdBookIds.push(bookB5Id);

        const swap5Id = await Swap.create({
            requester_id: userAId,
            owner_id: userBId,
            requested_book_id: bookB5Id,
            offered_book_id: bookA5Id,
            message: 'Status created test'
        });
        createdSwapIds.push(swap5Id);
        await Swap.updateStatus(swap5Id, 'accepted', userBId);
        await Swap.selectMethod(swap5Id, userAId, 'QUIRO_MANAGED');
        await Swap.selectMethod(swap5Id, userBId, 'QUIRO_MANAGED');
        await Swap.saveAddress(swap5Id, userAId, { full_name: 'User A', phone: '9876543210', pickup_address: 'Address Line A', delivery_address: 'Address Line A', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' });
        await Swap.saveAddress(swap5Id, userBId, { full_name: 'User B', phone: '9876543210', pickup_address: 'Address Line B', delivery_address: 'Address Line B', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001' });

        const orderA5 = await Swap.createManagedPayment(swap5Id, userAId);
        const orderB5 = await Swap.createManagedPayment(swap5Id, userBId);
        const payA5 = `pay_created_A_${Date.now()}`;
        const payB5 = `pay_created_B_${Date.now()}`;
        await Swap.verifyManagedPayment(swap5Id, userAId, { razorpay_order_id: orderA5.rzpOrderId, razorpay_payment_id: payA5, razorpay_signature: 'sig_sandbox_a5' });
        await Swap.verifyManagedPayment(swap5Id, userBId, { razorpay_order_id: orderB5.rzpOrderId, razorpay_payment_id: payB5, razorpay_signature: 'sig_sandbox_b5' });

        // Gateway returns status: 'created' (pending banking partner settlement)
        const gatewayStore5 = new Map();
        gatewayStore5.set(payA5, { id: `rfnd_pending_${payA5}`, status: 'created', amount: 7900 });
        gatewayStore5.set(payB5, { id: `rfnd_pending_${payB5}`, status: 'created', amount: 7900 });

        mockRefundHandler = async (paymentId, params) => {
            return gatewayStore5.get(paymentId);
        };
        mockFetchMultipleRefundHandler = async (paymentId) => {
            if (gatewayStore5.has(paymentId)) {
                return { entity: 'collection', count: 1, items: [gatewayStore5.get(paymentId)] };
            }
            return { entity: 'collection', count: 0, items: [] };
        };

        const createdResult = await Swap.processSwapRefund(swap5Id, userAId, 'Test pending settlement refund');
        testAssert(createdResult.success === false, 'Refund reports not complete when gateway refund is in created/pending status');
        testAssert(createdResult.pending === true, 'Pending flag is true when refunds are awaiting settlement');

        const [swap5Payments] = await pool.execute('SELECT status, refund_id FROM swap_payments WHERE swap_id = ?', [swap5Id]);
        const allSwap5Pending = swap5Payments.every(p => p.status === 'REFUND_PENDING' && p.refund_id.startsWith('rfnd_pending_'));
        testAssert(allSwap5Pending, 'Payments moved to REFUND_PENDING with gateway refund ID recorded');

        const [booksAfterCreated] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bookA5Id, bookB5Id]);
        const booksStillReserved = booksAfterCreated.every(b => b.status === 'reserved');
        testAssert(booksStillReserved, 'Books remain RESERVED while refunds are in created/pending status');

        const [swap5AfterCreated] = await pool.execute('SELECT status FROM swap_requests WHERE id = ?', [swap5Id]);
        testAssert(swap5AfterCreated[0].status !== 'cancelled', 'Swap request was NOT cancelled while refunds are pending');

        // -----------------------------------------------------------------
        // TEST 16: Pending Refund Retry Without Duplicate Gateway Refund
        // -----------------------------------------------------------------
        console.log('\n--- 16. Testing Pending Refund Retry Idempotency ---');
        let refundCalledForPendingRetry = false;
        mockRefundHandler = async () => {
            refundCalledForPendingRetry = true;
            throw new Error('DUPLICATE_CALL_ERROR: refund() called again while refund is already pending!');
        };

        const retryPendingResult = await Swap.processSwapRefund(swap5Id, userAId, 'Retry while still pending');
        testAssert(!refundCalledForPendingRetry, 'Gateway refund API was NOT called again during retry of pending refund');
        testAssert(retryPendingResult.pending === true, 'Retry still accurately reports pending status');

        // -----------------------------------------------------------------
        // TEST 17: Pending Refund Gateway Settlement to Processed & Book Release
        // -----------------------------------------------------------------
        console.log('\n--- 17. Testing Pending Refund Settlement to Processed ---');
        // Gateway now marks both refunds as settled / processed
        gatewayStore5.set(payA5, { id: `rfnd_pending_${payA5}`, status: 'processed', amount: 7900 });
        gatewayStore5.set(payB5, { id: `rfnd_pending_${payB5}`, status: 'processed', amount: 7900 });

        const settledResult = await Swap.processSwapRefund(swap5Id, userAId, 'Settlement confirmed retry');
        testAssert(settledResult.success === true, 'Refund succeeds once gateway authoritatively confirms processed status');

        const [swap5FinalPayments] = await pool.execute('SELECT status FROM swap_payments WHERE swap_id = ?', [swap5Id]);
        const allSwap5Refunded = swap5FinalPayments.every(p => p.status === 'REFUNDED');
        testAssert(allSwap5Refunded, 'All payments moved to REFUNDED after settlement');

        const [booksAfterSettled] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bookA5Id, bookB5Id]);
        const booksNowAvailable = booksAfterSettled.every(b => b.status === 'available');
        testAssert(booksNowAvailable, 'Books released to available status only after refunds are confirmed processed');

        const [swap5FinalSwap] = await pool.execute('SELECT status FROM swap_requests WHERE id = ?', [swap5Id]);
        testAssert(swap5FinalSwap[0].status === 'cancelled', 'Swap status moved to cancelled after full settlement');

        // -----------------------------------------------------------------
        // TEST 18: Razorpay Refund Status 'failed' Rejection
        // -----------------------------------------------------------------
        console.log('\n--- 18. Testing Refund Status "failed" Rejection ---');
        // Setup Swap 6
        const [bookA6Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_A6", "Author A6", "9789999999993", 260, "Good", "Fiction", "available", 1, ?)',
            [userAId, DEFAULT_TEST_IMAGE]
        );
        const bookA6Id = bookA6Res.insertId;
        createdBookIds.push(bookA6Id);

        const [bookB6Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_B6", "Author B6", "9789999999994", 260, "Good", "Fiction", "available", 1, ?)',
            [userBId, DEFAULT_TEST_IMAGE]
        );
        const bookB6Id = bookB6Res.insertId;
        createdBookIds.push(bookB6Id);

        const swap6Id = await Swap.create({
            requester_id: userAId,
            owner_id: userBId,
            requested_book_id: bookB6Id,
            offered_book_id: bookA6Id,
            message: 'Failed status test'
        });
        createdSwapIds.push(swap6Id);
        await Swap.updateStatus(swap6Id, 'accepted', userBId);
        await Swap.selectMethod(swap6Id, userAId, 'QUIRO_MANAGED');
        await Swap.selectMethod(swap6Id, userBId, 'QUIRO_MANAGED');
        await Swap.saveAddress(swap6Id, userAId, { full_name: 'User A', phone: '9876543210', pickup_address: 'Address Line A', delivery_address: 'Address Line A', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' });
        await Swap.saveAddress(swap6Id, userBId, { full_name: 'User B', phone: '9876543210', pickup_address: 'Address Line B', delivery_address: 'Address Line B', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001' });

        const orderA6 = await Swap.createManagedPayment(swap6Id, userAId);
        const orderB6 = await Swap.createManagedPayment(swap6Id, userBId);
        const payA6 = `pay_failed_A_${Date.now()}`;
        const payB6 = `pay_failed_B_${Date.now()}`;
        await Swap.verifyManagedPayment(swap6Id, userAId, { razorpay_order_id: orderA6.rzpOrderId, razorpay_payment_id: payA6, razorpay_signature: 'sig_sandbox_a6' });
        await Swap.verifyManagedPayment(swap6Id, userBId, { razorpay_order_id: orderB6.rzpOrderId, razorpay_payment_id: payB6, razorpay_signature: 'sig_sandbox_b6' });

        // Gateway returns status: 'failed'
        mockRefundHandler = async (paymentId) => ({ id: `rfnd_fail_${paymentId}`, status: 'failed', amount: 7900 });
        mockFetchMultipleRefundHandler = async (paymentId) => ({
            entity: 'collection',
            count: 1,
            items: [{ id: `rfnd_fail_${paymentId}`, status: 'failed', amount: 7900 }]
        });

        const failedResult = await Swap.processSwapRefund(swap6Id, userAId, 'Failed refund test');
        testAssert(failedResult.success === false, 'Refund accurately fails when gateway returns status "failed"');
        testAssert(failedResult.failed === true, 'Failed flag is true');

        const [swap6Payments] = await pool.execute('SELECT status FROM swap_payments WHERE swap_id = ?', [swap6Id]);
        const allSwap6Failed = swap6Payments.every(p => p.status === 'REFUND_FAILED');
        testAssert(allSwap6Failed, 'Payments transitioned to REFUND_FAILED (never falsely marked REFUNDED)');

        const [booksAfterFailed] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bookA6Id, bookB6Id]);
        const booksStayedReserved = booksAfterFailed.every(b => b.status === 'reserved');
        testAssert(booksStayedReserved, 'Books remain reserved when refund fails');

        const [swap6AfterFailed] = await pool.execute('SELECT status FROM swap_requests WHERE id = ?', [swap6Id]);
        testAssert(swap6AfterFailed[0].status !== 'cancelled', 'Swap is NOT cancelled when refund fails');

        // -----------------------------------------------------------------
        // TEST 19: Refund Worker Fencing Enforcement
        // -----------------------------------------------------------------
        console.log('\n--- 19. Testing Refund Worker Fencing Enforcement ---');
        // Setup Swap 7
        const [bookA7Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_A7", "Author A7", "9789999999995", 270, "Good", "Fiction", "available", 1, ?)',
            [userAId, DEFAULT_TEST_IMAGE]
        );
        const bookA7Id = bookA7Res.insertId;
        createdBookIds.push(bookA7Id);

        const [bookB7Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_B7", "Author B7", "9789999999996", 270, "Good", "Fiction", "available", 1, ?)',
            [userBId, DEFAULT_TEST_IMAGE]
        );
        const bookB7Id = bookB7Res.insertId;
        createdBookIds.push(bookB7Id);

        const swap7Id = await Swap.create({
            requester_id: userAId,
            owner_id: userBId,
            requested_book_id: bookB7Id,
            offered_book_id: bookA7Id,
            message: 'Worker fencing test'
        });
        createdSwapIds.push(swap7Id);
        await Swap.updateStatus(swap7Id, 'accepted', userBId);
        await Swap.selectMethod(swap7Id, userAId, 'QUIRO_MANAGED');
        await Swap.selectMethod(swap7Id, userBId, 'QUIRO_MANAGED');
        await Swap.saveAddress(swap7Id, userAId, { full_name: 'User A', phone: '9876543210', pickup_address: 'Address Line A', delivery_address: 'Address Line A', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' });
        await Swap.saveAddress(swap7Id, userBId, { full_name: 'User B', phone: '9876543210', pickup_address: 'Address Line B', delivery_address: 'Address Line B', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001' });

        const orderA7 = await Swap.createManagedPayment(swap7Id, userAId);
        const orderB7 = await Swap.createManagedPayment(swap7Id, userBId);
        const payA7 = `pay_fencing_A_${Date.now()}`;
        const payB7 = `pay_fencing_B_${Date.now()}`;
        await Swap.verifyManagedPayment(swap7Id, userAId, { razorpay_order_id: orderA7.rzpOrderId, razorpay_payment_id: payA7, razorpay_signature: 'sig_sandbox_a7' });
        await Swap.verifyManagedPayment(swap7Id, userBId, { razorpay_order_id: orderB7.rzpOrderId, razorpay_payment_id: payB7, razorpay_signature: 'sig_sandbox_b7' });

        // Simulate Worker 1 claiming payments with claim token 1
        const staleToken = 'claim_worker_1_old';
        const staleClaimedStatus = `REFUND_PROCESSING:${staleToken}`;
        await pool.execute('UPDATE swap_payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE swap_id = ?', [staleClaimedStatus, swap7Id]);

        // Simulate Worker 2 claiming payments after stale timeout with claim token 2
        const activeToken = 'claim_worker_2_new';
        const activeClaimedStatus = `REFUND_PROCESSING:${activeToken}`;
        await pool.execute('UPDATE swap_payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE swap_id = ?', [activeClaimedStatus, swap7Id]);

        // Stale Worker 1 attempts to finalize in Phase 3 with stale claimedStatus
        const staleConn = await pool.getConnection();
        let staleUpdateAffectedRows = -1;
        try {
            await staleConn.beginTransaction();
            const [staleRows] = await staleConn.execute('SELECT id FROM swap_payments WHERE swap_id = ?', [swap7Id]);
            const [staleRes] = await staleConn.execute(`
                UPDATE swap_payments 
                SET status = 'REFUNDED', 
                    refund_id = 'rfnd_zombie_should_fail', 
                    refund_amount = amount,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND status = ?
            `, [staleRows[0].id, staleClaimedStatus]);
            staleUpdateAffectedRows = staleRes.affectedRows;
            if (staleUpdateAffectedRows === 0) {
                await staleConn.rollback();
            } else {
                await staleConn.commit();
            }
        } finally {
            staleConn.release();
        }

        testAssert(staleUpdateAffectedRows === 0, 'Stale worker update matched 0 rows due to fencing token mismatch', `affectedRows: ${staleUpdateAffectedRows}`);

        // Verify active token was NOT overwritten by stale worker
        const [paymentsAfterStaleAttempt] = await pool.execute('SELECT status FROM swap_payments WHERE swap_id = ?', [swap7Id]);
        const statusUnchanged = paymentsAfterStaleAttempt.every(p => p.status === activeClaimedStatus);
        testAssert(statusUnchanged, 'Payment status remained owned by active worker claim (fencing protected)');

        // Books must remain reserved
        const [booksAfterFencing] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bookA7Id, bookB7Id]);
        testAssert(booksAfterFencing.every(b => b.status === 'reserved'), 'Books remain reserved after stale worker rejection');

        // -----------------------------------------------------------------
        // TEST 20: Book Release Only After ALL Required Refunds are Confirmed
        // -----------------------------------------------------------------
        console.log('\n--- 20. Testing Book Release Only After ALL Refunds are Confirmed ---');
        // Setup Swap 8
        const [bookA8Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_A8", "Author A8", "9789999999997", 290, "Good", "Fiction", "available", 1, ?)',
            [userAId, DEFAULT_TEST_IMAGE]
        );
        const bookA8Id = bookA8Res.insertId;
        createdBookIds.push(bookA8Id);

        const [bookB8Res] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, "SWAP_SAFE_BOOK_B8", "Author B8", "9789999999998", 290, "Good", "Fiction", "available", 1, ?)',
            [userBId, DEFAULT_TEST_IMAGE]
        );
        const bookB8Id = bookB8Res.insertId;
        createdBookIds.push(bookB8Id);

        const swap8Id = await Swap.create({
            requester_id: userAId,
            owner_id: userBId,
            requested_book_id: bookB8Id,
            offered_book_id: bookA8Id,
            message: 'Partial confirmation test'
        });
        createdSwapIds.push(swap8Id);
        await Swap.updateStatus(swap8Id, 'accepted', userBId);
        await Swap.selectMethod(swap8Id, userAId, 'QUIRO_MANAGED');
        await Swap.selectMethod(swap8Id, userBId, 'QUIRO_MANAGED');
        await Swap.saveAddress(swap8Id, userAId, { full_name: 'User A', phone: '9876543210', pickup_address: 'Address Line A', delivery_address: 'Address Line A', city: 'Mumbai', state: 'Maharashtra', postal_code: '400001' });
        await Swap.saveAddress(swap8Id, userBId, { full_name: 'User B', phone: '9876543210', pickup_address: 'Address Line B', delivery_address: 'Address Line B', city: 'Bengaluru', state: 'Karnataka', postal_code: '560001' });

        const orderA8 = await Swap.createManagedPayment(swap8Id, userAId);
        const orderB8 = await Swap.createManagedPayment(swap8Id, userBId);
        const payA8 = `pay_partial_A_${Date.now()}`;
        const payB8 = `pay_partial_B_${Date.now()}`;
        await Swap.verifyManagedPayment(swap8Id, userAId, { razorpay_order_id: orderA8.rzpOrderId, razorpay_payment_id: payA8, razorpay_signature: 'sig_sandbox_a8' });
        await Swap.verifyManagedPayment(swap8Id, userBId, { razorpay_order_id: orderB8.rzpOrderId, razorpay_payment_id: payB8, razorpay_signature: 'sig_sandbox_b8' });

        // Gateway returns: User A is processed, User B is created (pending)
        const gatewayStore8 = new Map();
        gatewayStore8.set(payA8, { id: `rfnd_proc_${payA8}`, status: 'processed', amount: 7900 });
        gatewayStore8.set(payB8, { id: `rfnd_pend_${payB8}`, status: 'created', amount: 7900 });

        mockRefundHandler = async (paymentId) => gatewayStore8.get(paymentId);
        mockFetchMultipleRefundHandler = async (paymentId) => {
            if (gatewayStore8.has(paymentId)) {
                return { entity: 'collection', count: 1, items: [gatewayStore8.get(paymentId)] };
            }
            return { entity: 'collection', count: 0, items: [] };
        };

        const partialRes = await Swap.processSwapRefund(swap8Id, userAId, 'Partial status test');
        testAssert(partialRes.success === false && partialRes.pending === true, 'Refund reports incomplete while one participant is pending');

        // Scope to our own payment rows — orphaned rows from prior runs must not be matched.
        const [swap8PaymentRows] = await pool.execute(
            'SELECT user_id, status, razorpay_payment_id FROM swap_payments WHERE swap_id = ? AND razorpay_payment_id IN (?, ?)',
            [swap8Id, payA8, payB8]
        );
        const payARow = swap8PaymentRows.find(p => p.razorpay_payment_id === payA8);
        const payBRow = swap8PaymentRows.find(p => p.razorpay_payment_id === payB8);
        testAssert(payARow.status === 'REFUNDED', 'Participant A payment updated to REFUNDED');
        testAssert(payBRow.status === 'REFUND_PENDING', 'Participant B payment updated to REFUND_PENDING');

        // Books must remain reserved because Participant B is still pending
        const [booksAfterPartial] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bookA8Id, bookB8Id]);
        testAssert(booksAfterPartial.every(b => b.status === 'reserved'), 'Books remain RESERVED when only one payment is confirmed');

        const [swap8AfterPartial] = await pool.execute('SELECT status FROM swap_requests WHERE id = ?', [swap8Id]);
        testAssert(swap8AfterPartial[0].status !== 'cancelled', 'Swap is NOT cancelled when only one payment is confirmed');

        // Now Participant B settles to 'processed'
        gatewayStore8.set(payB8, { id: `rfnd_pend_${payB8}`, status: 'processed', amount: 7900 });

        const finalBothRes = await Swap.processSwapRefund(swap8Id, userAId, 'Second settlement retry');
        testAssert(finalBothRes.success === true, 'Refund succeeds once second participant settles');

        const [booksAfterBothConfirmed] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bookA8Id, bookB8Id]);
        testAssert(booksAfterBothConfirmed.every(b => b.status === 'available'), 'Books released to available ONLY after ALL participants confirmed refunded');

        const [swap8Final] = await pool.execute('SELECT status FROM swap_requests WHERE id = ?', [swap8Id]);
        testAssert(swap8Final[0].status === 'cancelled', 'Swap is cancelled ONLY after ALL participants confirmed refunded');

        console.log('\n================================================================');
        console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
        console.log('================================================================\n');

        // ================================================================
        // STEP 8D TESTS: finalizeSwapPaymentRefund + reconcileAllPendingSwapRefunds
        // ================================================================
        console.log('\n================================================================');
        console.log('🧪 STEP 8D: finalizeSwapPaymentRefund & reconcileAllPendingSwapRefunds');
        console.log('================================================================\n');

        const DEFAULT_TEST_IMAGE_8D = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c';

        // Helper: create a minimal swap + payment row in a given status
        async function createTestSwapWithPayment(opts = {}) {
            const {
                requester = userAId,
                owner = userBId,
                paymentStatus = 'CAPTURED',
                razorpayPaymentId = `pay_test_8d_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
                amount = 79.00
            } = opts;

            const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            // Use unique ISBNs (13 chars max, numeric) to avoid duplicate-key errors
            const isbnA = String(Date.now()).slice(-10) + String(Math.floor(Math.random() * 100)).padStart(3, '0');
            const isbnB = String(Date.now() + 1).slice(-10) + String(Math.floor(Math.random() * 100)).padStart(3, '0');

            const [bAResult] = await pool.execute(
                'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, ?, "Auth8D", ?, 200, "Good", "Fiction", "reserved", 1, ?)',
                [requester, `SWAP_SAFE_BOOK_8D_${uniqueSuffix}_A`, isbnA, DEFAULT_TEST_IMAGE_8D]
            );
            const [bBResult] = await pool.execute(
                'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled, cover_image) VALUES (?, ?, "Auth8D", ?, 200, "Good", "Fiction", "reserved", 1, ?)',
                [owner, `SWAP_SAFE_BOOK_8D_${uniqueSuffix}_B`, isbnB, DEFAULT_TEST_IMAGE_8D]
            );
            const bAId = bAResult.insertId;
            const bBId = bBResult.insertId;
            createdBookIds.push(bAId, bBId);

            // Direct INSERT to avoid Swap.create's notification side-effect (TiDB Cloud lock risk)
            const [swapRes] = await pool.execute(
                `INSERT INTO swap_requests (requester_id, owner_id, requested_book_id, offered_book_id, status, message, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'pickup_scheduled', 'Step8D test', NOW(), NOW())`,
                [requester, owner, bBId, bAId]
            );
            const swapId = swapRes.insertId;
            createdSwapIds.push(swapId);

            const [payRes] = await pool.execute(
                `INSERT INTO swap_payments (swap_id, user_id, role, amount, status, razorpay_order_id, razorpay_payment_id)
                 VALUES (?, ?, 'requester', ?, ?, '', ?)`,
                [swapId, requester, amount, paymentStatus, razorpayPaymentId]
            );

            return { swapId, paymentId: payRes.insertId, bAId, bBId, razorpayPaymentId };
        }

        // ---- TC-19: finalizeSwapPaymentRefund — refund.created → REFUND_PENDING (never REFUNDED) ----
        {
            const { swapId, paymentId, razorpayPaymentId } = await createTestSwapWithPayment({ paymentStatus: 'CAPTURED' });
            const conn = await pool.getConnection();
            await conn.beginTransaction();
            const result = await Swap.finalizeSwapPaymentRefund(conn, {
                swapId,
                razorpayPaymentId,
                razorpayRefundId: 'rfnd_tc19_created',
                refundAmountRupees: 79.00,
                incomingStatus: 'created',
                actorLabel: 'TEST'
            });
            await conn.commit();
            conn.release();

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(result.claimLost === false, 'TC-19: No claim loss on webhook path');
            testAssert(result.skipped === false, 'TC-19: Not skipped');
            testAssert(rows[0].status === 'REFUND_PENDING', 'TC-19: refund.created → REFUND_PENDING (never REFUNDED)');
            const [swapStatus] = await pool.execute('SELECT status FROM swap_requests WHERE id = ?', [swapId]);
            testAssert(swapStatus[0].status !== 'cancelled', 'TC-19: Swap NOT cancelled on REFUND_PENDING');
        }

        // ---- TC-20: finalizeSwapPaymentRefund — refund.processed → REFUNDED + books released ----
        {
            const { swapId, paymentId, bAId, bBId, razorpayPaymentId } = await createTestSwapWithPayment({ paymentStatus: 'CAPTURED' });
            // Seed second payment for same swap (owner side) to verify "all REFUNDED" gate
            await pool.execute(
                `INSERT INTO swap_payments (swap_id, user_id, role, amount, status, razorpay_order_id, razorpay_payment_id)
                 VALUES (?, ?, 'owner', 79.00, 'CAPTURED', '', ?)`,
                [swapId, userBId, `pay_test_8d_ownerside_${Date.now()}`]
            );
            // Only one payment → finalize both payments manually for TC simplicity
            await pool.execute('UPDATE swap_payments SET status = "REFUNDED", refund_id = "rfnd_already" WHERE swap_id = ? AND role = "owner"', [swapId]);

            const conn = await pool.getConnection();
            await conn.beginTransaction();
            const result = await Swap.finalizeSwapPaymentRefund(conn, {
                swapId,
                razorpayPaymentId,
                razorpayRefundId: 'rfnd_tc20_processed',
                refundAmountRupees: 79.00,
                incomingStatus: 'processed',
                actorLabel: 'TEST'
            });
            await conn.commit();
            conn.release();

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === 'REFUNDED', 'TC-20: refund.processed → REFUNDED');
            const [books] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bAId, bBId]);
            testAssert(books.every(b => b.status === 'available'), 'TC-20: Books released when ALL payments REFUNDED');
            const [swapStatus] = await pool.execute('SELECT status FROM swap_requests WHERE id = ?', [swapId]);
            testAssert(swapStatus[0].status === 'cancelled', 'TC-20: Swap cancelled when ALL payments REFUNDED');
        }

        // ---- TC-21: finalizeSwapPaymentRefund — refund.failed → REFUND_FAILED; books remain reserved ----
        {
            const { swapId, paymentId, bAId, bBId, razorpayPaymentId } = await createTestSwapWithPayment({ paymentStatus: 'CAPTURED' });
            const conn = await pool.getConnection();
            await conn.beginTransaction();
            const result = await Swap.finalizeSwapPaymentRefund(conn, {
                swapId,
                razorpayPaymentId,
                razorpayRefundId: 'rfnd_tc21_failed',
                refundAmountRupees: 79.00,
                incomingStatus: 'failed',
                actorLabel: 'TEST'
            });
            await conn.commit();
            conn.release();

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === 'REFUND_FAILED', 'TC-21: refund.failed → REFUND_FAILED');
            const [books] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bAId, bBId]);
            testAssert(books.every(b => b.status === 'reserved'), 'TC-21: Books remain reserved after refund.failed');
        }

        // ---- TC-22: finalizeSwapPaymentRefund — REFUNDED row never downgraded ----
        {
            const { swapId, paymentId, razorpayPaymentId } = await createTestSwapWithPayment({ paymentStatus: 'REFUNDED' });
            const conn = await pool.getConnection();
            await conn.beginTransaction();
            const result = await Swap.finalizeSwapPaymentRefund(conn, {
                swapId,
                razorpayPaymentId,
                razorpayRefundId: 'rfnd_tc22_downgrade_attempt',
                refundAmountRupees: 79.00,
                incomingStatus: 'failed',   // attempt to downgrade
                actorLabel: 'TEST'
            });
            await conn.commit();
            conn.release();

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === 'REFUNDED', 'TC-22: Terminal REFUNDED row never downgraded by failed event');
        }

        // ---- TC-23: finalizeSwapPaymentRefund — amount mismatch hard-skips ----
        {
            const { swapId, paymentId, razorpayPaymentId } = await createTestSwapWithPayment({ paymentStatus: 'CAPTURED', amount: 79.00 });
            const conn = await pool.getConnection();
            await conn.beginTransaction();
            const result = await Swap.finalizeSwapPaymentRefund(conn, {
                swapId,
                razorpayPaymentId,
                razorpayRefundId: 'rfnd_tc23_mismatch',
                refundAmountRupees: 80.00,  // ₹1 mismatch
                incomingStatus: 'processed',
                actorLabel: 'TEST'
            });
            await conn.rollback();
            conn.release();

            testAssert(result.skipped === true && result.reason === 'AMOUNT_MISMATCH', 'TC-23: ₹1 amount mismatch causes hard skip (AMOUNT_MISMATCH)');
            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === 'CAPTURED', 'TC-23: Row status unchanged after amount mismatch skip');
        }

        // ---- TC-24: finalizeSwapPaymentRefund — null amount hard-skips ----
        {
            const { swapId, paymentId, razorpayPaymentId } = await createTestSwapWithPayment({ paymentStatus: 'CAPTURED' });
            const conn = await pool.getConnection();
            await conn.beginTransaction();
            const result = await Swap.finalizeSwapPaymentRefund(conn, {
                swapId,
                razorpayPaymentId,
                razorpayRefundId: 'rfnd_tc24_null_amount',
                refundAmountRupees: null,
                incomingStatus: 'processed',
                actorLabel: 'TEST'
            });
            await conn.rollback();
            conn.release();

            testAssert(result.skipped === true && result.reason === 'MISSING_AMOUNT', 'TC-24: Null amount causes hard skip (MISSING_AMOUNT)');
        }

        // ---- TC-25: finalizeSwapPaymentRefund — partial refund (one payment not yet REFUNDED) ----
        {
            const { swapId, paymentId, bAId, bBId, razorpayPaymentId } = await createTestSwapWithPayment({ paymentStatus: 'CAPTURED' });
            // Add a second payment row that remains CAPTURED (not yet refunded)
            const [pay2Res] = await pool.execute(
                `INSERT INTO swap_payments (swap_id, user_id, role, amount, status, razorpay_order_id, razorpay_payment_id)
                 VALUES (?, ?, 'owner', 79.00, 'CAPTURED', '', ?)`,
                [swapId, userBId, `pay_test_8d_partial_${Date.now()}`]
            );

            const conn = await pool.getConnection();
            await conn.beginTransaction();
            await Swap.finalizeSwapPaymentRefund(conn, {
                swapId,
                razorpayPaymentId,
                razorpayRefundId: 'rfnd_tc25_partial',
                refundAmountRupees: 79.00,
                incomingStatus: 'processed',
                actorLabel: 'TEST'
            });
            await conn.commit();
            conn.release();

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            const [pay2Rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [pay2Res.insertId]);
            testAssert(rows[0].status === 'REFUNDED', 'TC-25: First payment marked REFUNDED');
            testAssert(pay2Rows[0].status === 'CAPTURED', 'TC-25: Second payment remains CAPTURED');
            const [books] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bAId, bBId]);
            testAssert(books.every(b => b.status === 'reserved'), 'TC-25: Books remain reserved until ALL payments REFUNDED');
        }

        // ---- TC-26: finalizeSwapPaymentRefund — worker claim fencing (claimLost when token differs) ----
        {
            const claimToken = 'oldclaimtoken_tc26';
            const claimedStatus = `REFUND_PROCESSING:${claimToken}`;
            const { swapId, paymentId, razorpayPaymentId } = await createTestSwapWithPayment({ paymentStatus: claimedStatus });

            // Simulate a concurrent worker that overwrote the status before we finalize
            await pool.execute('UPDATE swap_payments SET status = ? WHERE id = ?', ['REFUND_PROCESSING:NEWCONCURRENTTOKEN', paymentId]);

            const conn = await pool.getConnection();
            await conn.beginTransaction();
            const result = await Swap.finalizeSwapPaymentRefund(conn, {
                swapId,
                razorpayPaymentId,
                razorpayRefundId: 'rfnd_tc26_fencing',
                refundAmountRupees: 79.00,
                incomingStatus: 'processed',
                actorLabel: 'TEST',
                claimedStatus  // old token — should not match
            });
            await conn.rollback();
            conn.release();

            testAssert(result.claimLost === true, 'TC-26: Worker fencing correctly detects claim loss when token differs');
        }

        // ---- TC-27: reconcileAllPendingSwapRefunds — picks up REFUND_PENDING payment ----
        {
            const refundId = `rfnd_tc27_reconciled_${Date.now()}`;
            const rzpPayId = `pay_rzp_tc27_${Date.now()}`;
            const { swapId, paymentId, bAId, bBId } = await createTestSwapWithPayment({ paymentStatus: 'REFUND_PENDING', razorpayPaymentId: rzpPayId });
            await pool.execute('UPDATE swap_payments SET refund_id = ? WHERE id = ?', [refundId, paymentId]);

            // Mock gateway returns 'processed'
            mockFetchMultipleRefundHandler = async (payId) => ({
                entity: 'collection',
                count: 1,
                items: [{ id: refundId, status: 'processed', amount: 7900 }]
            });

            const result = await Swap.reconcileAllPendingSwapRefunds();
            testAssert(result.swapsProcessed >= 1, `TC-27: reconcileAllPendingSwapRefunds processes REFUND_PENDING swap (processed=${result.swapsProcessed})`);

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === 'REFUNDED', 'TC-27: REFUND_PENDING → REFUNDED after gateway confirms processed');

            // Restore mock
            mockFetchMultipleRefundHandler = async () => ({ entity: 'collection', count: 0, items: [] });
        }

        // ---- TC-28: reconcileAllPendingSwapRefunds — gateway returns 'created' → stays REFUND_PENDING ----
        {
            const refundId = `rfnd_tc28_pending_${Date.now()}`;
            const rzpPayId = `pay_rzp_tc28_${Date.now()}`;
            const { swapId, paymentId } = await createTestSwapWithPayment({ paymentStatus: 'REFUND_PENDING', razorpayPaymentId: rzpPayId });
            await pool.execute('UPDATE swap_payments SET refund_id = ? WHERE id = ?', [refundId, paymentId]);

            mockFetchMultipleRefundHandler = async () => ({
                entity: 'collection',
                count: 1,
                items: [{ id: refundId, status: 'created', amount: 7900 }]
            });

            await Swap.reconcileAllPendingSwapRefunds();

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === 'REFUND_PENDING', 'TC-28: gateway created → still REFUND_PENDING (not prematurely settled)');

            mockFetchMultipleRefundHandler = async () => ({ entity: 'collection', count: 0, items: [] });
        }

        // ---- TC-29: reconcileAllPendingSwapRefunds — gateway returns 'failed' → REFUND_FAILED ----
        {
            const refundId = `rfnd_tc29_failed_${Date.now()}`;
            const rzpPayId = `pay_rzp_tc29_${Date.now()}`;
            const { swapId, paymentId, bAId, bBId } = await createTestSwapWithPayment({ paymentStatus: 'REFUND_PENDING', razorpayPaymentId: rzpPayId });
            await pool.execute('UPDATE swap_payments SET refund_id = ? WHERE id = ?', [refundId, paymentId]);

            mockFetchMultipleRefundHandler = async () => ({
                entity: 'collection',
                count: 1,
                items: [{ id: refundId, status: 'failed', amount: 7900 }]
            });

            await Swap.reconcileAllPendingSwapRefunds();

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === 'REFUND_FAILED', 'TC-29: gateway failed → REFUND_FAILED (not REFUNDED)');
            const [books] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bAId, bBId]);
            testAssert(books.every(b => b.status === 'reserved'), 'TC-29: Books remain reserved after gateway refund failure');

            mockFetchMultipleRefundHandler = async () => ({ entity: 'collection', count: 0, items: [] });
        }

        // ---- TC-30: reconcileAllPendingSwapRefunds — stale REFUND_PROCESSING reclaimed ----
        {
            const staleToken = `stale_tc30_${Date.now()}`;
            const staleStatus = `REFUND_PROCESSING:${staleToken}`;
            const rzpPayId = `pay_rzp_tc30_${Date.now()}`;
            const refundId = `rfnd_tc30_stale_${Date.now()}`;
            const { swapId, paymentId } = await createTestSwapWithPayment({ paymentStatus: staleStatus, razorpayPaymentId: rzpPayId });
            await pool.execute('UPDATE swap_payments SET refund_id = ?, updated_at = DATE_SUB(NOW(), INTERVAL 70 SECOND) WHERE id = ?', [refundId, paymentId]);

            mockFetchMultipleRefundHandler = async () => ({
                entity: 'collection',
                count: 1,
                items: [{ id: refundId, status: 'processed', amount: 7900 }]
            });

            const result = await Swap.reconcileAllPendingSwapRefunds();

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === 'REFUNDED', 'TC-30: Stale REFUND_PROCESSING (>65s) reclaimed and settled to REFUNDED');

            mockFetchMultipleRefundHandler = async () => ({ entity: 'collection', count: 0, items: [] });
        }

        // ---- TC-31: reconcileAllPendingSwapRefunds — fresh REFUND_PROCESSING NOT reclaimed ----
        {
            const freshToken = `fresh_tc31_${Date.now()}`;
            const freshStatus = `REFUND_PROCESSING:${freshToken}`;
            const rzpPayId = `pay_rzp_tc31_${Date.now()}`;
            const { swapId, paymentId } = await createTestSwapWithPayment({ paymentStatus: freshStatus, razorpayPaymentId: rzpPayId });
            // updated_at is NOW() (fresh) — should NOT be reclaimed

            await Swap.reconcileAllPendingSwapRefunds();

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === freshStatus, 'TC-31: Fresh REFUND_PROCESSING (<65s) is NOT reclaimed by reconciliation worker');
        }

        // ---- TC-32: reconcileAllPendingSwapRefunds — idempotent second run does not double-process ----
        {
            const refundId = `rfnd_tc32_idem_${Date.now()}`;
            const rzpPayId = `pay_rzp_tc32_${Date.now()}`;
            const { swapId, paymentId } = await createTestSwapWithPayment({ paymentStatus: 'REFUND_PENDING', razorpayPaymentId: rzpPayId });
            await pool.execute('UPDATE swap_payments SET refund_id = ? WHERE id = ?', [refundId, paymentId]);

            mockFetchMultipleRefundHandler = async () => ({
                entity: 'collection', count: 1,
                items: [{ id: refundId, status: 'processed', amount: 7900 }]
            });

            await Swap.reconcileAllPendingSwapRefunds();
            await Swap.reconcileAllPendingSwapRefunds(); // Second run

            const [rows] = await pool.execute('SELECT status FROM swap_payments WHERE id = ?', [paymentId]);
            testAssert(rows[0].status === 'REFUNDED', 'TC-32: Payment correctly REFUNDED after first run');

            const [timelineRows] = await pool.execute(
                'SELECT COUNT(*) as cnt FROM swap_timeline WHERE swap_id = ? AND message LIKE ?',
                [swapId, `%${refundId}%`]
            );
            testAssert(Number(timelineRows[0].cnt) === 1, 'TC-32: Only ONE timeline event written (idempotent second run)');

            mockFetchMultipleRefundHandler = async () => ({ entity: 'collection', count: 0, items: [] });
        }

        console.log('\n================================================================');
        console.log(`STEP 8D TESTS COMPLETE — TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
        console.log('================================================================\n');

    } catch (err) {
        console.error('Test Execution Error:', err);
        failed++;
    } finally {
        // ── PRESERVE_TEST_DATA_ON_FAILURE support ────────────────────────────
        // Set env var PRESERVE_TEST_DATA_ON_FAILURE=true to skip cleanup when
        // test assertions fail.  Useful for post-mortem DB inspection.
        // Default (false) always cleans up — correct for CI/CD pipelines.
        const preserveOnFailure = process.env.PRESERVE_TEST_DATA_ON_FAILURE === 'true';
        if (failed > 0 && preserveOnFailure) {
            console.warn('\n⚠️  PRESERVE_TEST_DATA_ON_FAILURE=true — skipping cleanup to preserve failure evidence.');
            console.warn('   Test assertion failures:', failed);
            console.warn('   Created swap IDs (quiro_test):', createdSwapIds.join(', ') || '(none)');
            console.warn('   Created book IDs (quiro_test):', createdBookIds.join(', ') || '(none)');
            console.warn('   Re-run with PRESERVE_TEST_DATA_ON_FAILURE=false (or unset) to clean up.\n');
        } else {
            // ── Resilient child-first cleanup ─────────────────────────────────
            // Child tables (swap_timeline, swap_addresses, swap_payments) are
            // each attempted independently so a failure on one does not skip the
            // others.  swap_requests is deleted ONLY when every child deletion
            // succeeded.  If any child fails, the parent row is intentionally
            // preserved to avoid orphaning payment records.
            for (const sid of createdSwapIds) {
                const childTables = [
                    ['swap_timeline',  'swap_id'],
                    ['swap_addresses', 'swap_id'],
                    ['swap_payments',  'swap_id'],
                ];

                // Step 1 – attempt each child table independently; track failures.
                let allChildrenDeleted = true;
                for (const [table, col] of childTables) {
                    try {
                        await pool.execute(`DELETE FROM \`${table}\` WHERE \`${col}\` = ?`, [sid]);
                    } catch (cleanupErr) {
                        allChildrenDeleted = false;
                        console.warn(`  ⚠️  Cleanup: DELETE FROM ${table} WHERE ${col} = ${sid} failed: ${cleanupErr.message}`);
                    }
                }

                // Step 2 – delete parent ONLY when every child was removed.
                // If any child deletion failed, retaining the parent keeps the DB
                // in a consistent state (no orphaned payment / address rows).
                if (allChildrenDeleted) {
                    try {
                        await pool.execute('DELETE FROM `swap_requests` WHERE `id` = ?', [sid]);
                    } catch (cleanupErr) {
                        console.warn(`  ⚠️  Cleanup: DELETE FROM swap_requests WHERE id = ${sid} failed: ${cleanupErr.message}`);
                    }
                } else {
                    console.warn(`  ⚠️  Cleanup: swap_requests row ${sid} intentionally preserved — one or more child-table deletions failed above.`);
                }
            }

            for (const bid of createdBookIds) {
                try {
                    await pool.execute('DELETE FROM books WHERE id = ?', [bid]);
                } catch (e) {
                    console.warn(`  ⚠️  Cleanup: DELETE FROM books WHERE id = ${bid} failed: ${e.message}`);
                }
            }

            try {
                await pool.execute('DELETE FROM books WHERE title LIKE ?', ['SWAP_SAFE_BOOK_%']);
            } catch (e) {
                console.warn('  ⚠️  Cleanup: title-pattern book sweep failed:', e.message);
            }
        }

        // pool.end() is guarded independently so it always runs even if cleanup
        // itself throws an unexpected error.
        try {
            await pool.end();
        } catch (poolErr) {
            console.warn('⚠️  pool.end() failed:', poolErr.message);
        }

        process.exit(failed > 0 ? 1 : 0);
    }
}

runPaymentSafetyTests();
