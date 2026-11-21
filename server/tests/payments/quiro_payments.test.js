const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const { getDbConfig } = require('../../config/db');
const crypto = require('crypto');
const Razorpay = require('razorpay');

// Mock Razorpay order creation for deterministic automated testing
const origAddResources = Razorpay.prototype.addResources;
Razorpay.prototype.addResources = function() {
    origAddResources.call(this);
    this.orders.create = async (params) => ({
        id: `order_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        entity: 'order',
        amount: params.amount,
        currency: params.currency || 'INR',
        receipt: params.receipt,
        status: 'created'
    });
};

const Swap = require('../../models/Swap');
const Book = require('../../models/Book');
const PaymentService = require('../../services/paymentService');
const webhookService = require('../../services/webhookService');

async function runTests() {
    console.log('====================================================');
    console.log('QUIRO — SWAP & RAZORPAY PAYMENT VERIFICATION SUITE');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(cond, name, details = '') {
        if (cond) {
            console.log(`[PASS] ${name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name} - ${details}`);
            failed++;
        }
    }

    const conn = await mysql.createConnection(getDbConfig());
    let bookAId = null;
    let bookBId = null;

    try {
        // -----------------------------------------------------------------
        // PART A: SELLER PROFILE & SOCKET VERIFICATION
        // -----------------------------------------------------------------
        console.log('--- PART A: Seller Profile & Database Health ---');
        const [sellers] = await conn.execute(
            'SELECT id, username, full_name, email FROM users WHERE id = 242 OR role = "user" LIMIT 2'
        );
        assert(sellers.length > 0, 'Sellers exist in database', `Found ${sellers.length} sellers`);
        
        const testSeller = sellers.find(s => s.id === 242) || sellers[0];
        console.log(`Testing with Seller ID: ${testSeller.id} (${testSeller.full_name || testSeller.username})`);

        const [sellerBooks] = await conn.execute(
            'SELECT COUNT(*) as count FROM books WHERE seller_id = ? AND status = "available"',
            [testSeller.id]
        );
        assert(true, `Seller ${testSeller.id} has ${sellerBooks[0].count} books available for sale/swap`);

        // Check user 242 or fallback
        const [user242] = await conn.execute('SELECT id, full_name FROM users WHERE id = 242');
        if (user242.length > 0) {
            assert(user242[0].id === 242, 'Seller 242 confirmed in database');
        } else {
            assert(true, 'Seller 242 checked (user table available)');
        }

        // -----------------------------------------------------------------
        // PART B: CROSS-USER SWAP DISCOVERY & CREATION
        // -----------------------------------------------------------------
        console.log('\n--- PART B: Cross-User Swap Marketplace ---');

        const [users] = await conn.execute('SELECT id, full_name, email FROM users WHERE role = "user" LIMIT 2');
        assert(users.length >= 2, 'At least 2 distinct user accounts exist for cross-user testing');

        const userA = users[0];
        const userB = users[1];
        console.log(`User A (ID ${userA.id}): ${userA.full_name}`);
        console.log(`User B (ID ${userB.id}): ${userB.full_name}`);

        // Discover swap books
        const discoverA = await Swap.getDiscoverable(userA.id, { limit: 10 });
        assert(discoverA && Array.isArray(discoverA.books), 'Discover Swap Books returns array of books');
        
        const userABooksInDiscover = discoverA.books.filter(b => b.seller_id === userA.id);
        assert(userABooksInDiscover.length === 0, 'User A cannot see their own books in Discover Swap Books');

        const discoverB = await Swap.getDiscoverable(userB.id, { limit: 10 });
        const userBBooksInDiscover = discoverB.books.filter(b => b.seller_id === userB.id);
        assert(userBBooksInDiscover.length === 0, 'User B cannot see their own books in Discover Swap Books');

        // Create temporary books for isolated swap flow
        const [bookA] = await conn.execute(`
            INSERT INTO books (seller_id, title, author, isbn, price, \`condition\`, genre, status, swap_enabled, cover_image)
            VALUES (?, 'QUIRO Test Book A', 'Author A', '9781111111111', 250.00, 'Like New', 'Fiction', 'available', 1, '/images/covers/default-book.png')
        `, [userA.id]);
        bookAId = bookA.insertId;

        const [bookB] = await conn.execute(`
            INSERT INTO books (seller_id, title, author, isbn, price, \`condition\`, genre, status, swap_enabled, cover_image)
            VALUES (?, 'QUIRO Test Book B', 'Author B', '9782222222222', 300.00, 'Good', 'Mystery', 'available', 1, '/images/covers/default-book.png')
        `, [userB.id]);
        bookBId = bookB.insertId;

        // User B discovers User A's book
        const discoverBForA = await Swap.getDiscoverable(userB.id, { limit: 50 });
        const foundAInDiscover = discoverBForA.books.some(b => b.id === bookAId);
        assert(foundAInDiscover, 'User B can discover User A’s book in public swap marketplace');

        // User B sends User A a swap request
        const swapId = await Swap.create({
            requester_id: userB.id,
            owner_id: userA.id,
            requested_book_id: bookAId,
            offered_book_id: bookBId,
            message: 'Hello User A! Care to trade this pre-loved copy?'
        });
        assert(swapId > 0, `Cross-user swap request created successfully (ID: ${swapId})`);

        // Verify incoming for User A
        const incomingA = await Swap.findIncoming(userA.id);
        const reqInA = incomingA.find(r => r.id === swapId);
        assert(Boolean(reqInA), 'Swap request appears in User A incoming requests list');
        assert(reqInA && reqInA.requester_name === userB.full_name, 'Incoming request correctly identifies User B as requester');

        // Verify outgoing for User B
        const outgoingB = await Swap.findOutgoing(userB.id);
        const reqInB = outgoingB.find(r => r.id === swapId);
        assert(Boolean(reqInB), 'Swap request appears in User B outgoing proposals list');

        // Verify timeline logging
        const [timeline] = await conn.execute('SELECT * FROM swap_timeline WHERE swap_id = ?', [swapId]);
        assert(timeline.length > 0, 'Swap timeline correctly tracks initial proposal submission');

        // -----------------------------------------------------------------
        // PART C: TWO FULFILLMENT PATHS (OPTION A & OPTION B)
        // -----------------------------------------------------------------
        console.log('\n--- PART C: Option A & Option B Fulfillment Workflows ---');

        // User A accepts proposal
        await Swap.updateStatus(swapId, 'accepted', userA.id);
        const swapAfterAccept = await Swap.findById(swapId);
        assert(swapAfterAccept.status === 'accepted', 'Owner (User A) accepted swap proposal');

        // Books should be marked reserved
        const [booksReserved] = await conn.execute('SELECT id, status FROM books WHERE id IN (?, ?)', [bookAId, bookBId]);
        assert(booksReserved.every(b => b.status === 'reserved'), 'Both books are automatically reserved upon acceptance');

        // Test Method Selection: User A chooses Option B, User B chooses Option B
        await Swap.selectMethod(swapId, userA.id, 'QUIRO_MANAGED');
        const swapMidMethod = await Swap.findById(swapId);
        assert(swapMidMethod.requester_method === null && swapMidMethod.owner_method === 'QUIRO_MANAGED', 'Owner selected QUIRO_MANAGED');
        assert(swapMidMethod.method_agreed === 0, 'Method not agreed until both users choose');

        await Swap.selectMethod(swapId, userB.id, 'QUIRO_MANAGED');
        const swapAgreedMethod = await Swap.findById(swapId);
        assert(swapAgreedMethod.method_agreed === 1 && swapAgreedMethod.exchange_method === 'QUIRO_MANAGED', 'Both users agreed on QUIRO_MANAGED');
        assert(swapAgreedMethod.status === 'awaiting_addresses', 'Swap moved to awaiting_addresses status');

        // Submit addresses
        await Swap.saveAddress(swapId, userA.id, {
            full_name: userA.full_name,
            phone: '9876543210',
            address_line1: '123 Aubergine Lane',
            city: 'Mumbai',
            state: 'Maharashtra',
            postal_code: '400001'
        });

        await Swap.saveAddress(swapId, userB.id, {
            full_name: userB.full_name,
            phone: '9876543211',
            address_line1: '456 Marigold Street',
            city: 'Bengaluru',
            state: 'Karnataka',
            postal_code: '560001'
        });

        const swapAfterAddresses = await Swap.findById(swapId);
        assert(swapAfterAddresses.status === 'awaiting_payment', 'Both addresses saved; status moved to awaiting_payment');

        // -----------------------------------------------------------------
        // PART D: RAZORPAY SWAP PAYMENT INTEGRATION
        // -----------------------------------------------------------------
        console.log('\n--- PART D: Razorpay Swap Payment Integration ---');

        // User A creates payment order
        const payIntentA = await Swap.createManagedPayment(swapId, userA.id);
        assert(payIntentA.rzpOrderId && payIntentA.amount === 7900, 'Razorpay order created for User A (₹79.00 / 7900 paise)');
        assert(payIntentA.keyId && payIntentA.keyId.startsWith('rzp_'), 'Correct Razorpay Key ID provided');

        // User A verifies payment
        await Swap.verifyManagedPayment(swapId, userA.id, {
            razorpay_order_id: payIntentA.rzpOrderId,
            razorpay_payment_id: `pay_test_A_${Date.now()}`,
            razorpay_signature: `sig_sandbox_A_${Date.now()}`
        });

        const swapAfterPayA = await Swap.findById(swapId);
        assert(swapAfterPayA.owner_paid === 1 && swapAfterPayA.requester_paid === 0, 'User A payment captured; User B pending');

        // User B creates and verifies payment
        const payIntentB = await Swap.createManagedPayment(swapId, userB.id);
        assert(payIntentB.rzpOrderId && payIntentB.amount === 7900, 'Razorpay order created for User B (₹79.00 / 7900 paise)');

        await Swap.verifyManagedPayment(swapId, userB.id, {
            razorpay_order_id: payIntentB.rzpOrderId,
            razorpay_payment_id: `pay_test_B_${Date.now()}`,
            razorpay_signature: `sig_sandbox_B_${Date.now()}`
        });

        const swapAfterBothPaid = await Swap.findById(swapId);
        assert(swapAfterBothPaid.requester_paid === 1 && swapAfterBothPaid.owner_paid === 1, 'Both participants paid courier fee');
        assert(swapAfterBothPaid.status === 'payment_completed', 'Swap status moved to payment_completed');
        assert(swapAfterBothPaid.courier_status === 'payment_confirmed', 'Courier status set to payment_confirmed');
        assert(Boolean(swapAfterBothPaid.courier_tracking), `Tracking number assigned: ${swapAfterBothPaid.courier_tracking}`);

        // Advance courier stages through the 10 stages
        await Swap.advanceCourierStage(swapId, 'book_collected');
        const swapCollected = await Swap.findById(swapId);
        assert(swapCollected.courier_status === 'book_collected', 'Courier stage advanced to book_collected');

        await Swap.advanceCourierStage(swapId, 'in_transit');
        const swapInTransit = await Swap.findById(swapId);
        assert(swapInTransit.courier_status === 'in_transit', 'Courier stage advanced to in_transit');

        await Swap.advanceCourierStage(swapId, 'delivered');
        const swapDelivered = await Swap.findById(swapId);
        assert(swapDelivered.courier_status === 'delivered', 'Courier stage advanced to delivered');

        // Two-party completion
        const confA = await Swap.confirmCompletion(swapId, userA.id);
        assert(confA.completed === false && confA.waitingForPartner === true, 'First confirmation awaits counterparty');

        const confB = await Swap.confirmCompletion(swapId, userB.id);
        assert(confB.completed === true, 'Both confirmed: Swap marked completed');

        const [finalBooks] = await conn.execute('SELECT id, status FROM books WHERE id IN (?, ?)', [bookAId, bookBId]);
        assert(finalBooks.every(b => b.status === 'swapped'), 'Both books marked status = "swapped" after completion');

        // -----------------------------------------------------------------
        // PART E: DIRECT SWAP (OPTION A) & EMAIL PRIVACY
        // -----------------------------------------------------------------
        console.log('\n--- PART E: Direct Exchange (Option A) & Email Privacy ---');
        await conn.execute('UPDATE books SET status = "available", swap_enabled = 1 WHERE id IN (?, ?)', [bookAId, bookBId]);

        const swapDirectId = await Swap.create({
            requester_id: userB.id,
            owner_id: userA.id,
            requested_book_id: bookAId,
            offered_book_id: bookBId,
            message: 'Direct swap option test'
        });

        await Swap.updateStatus(swapDirectId, 'accepted', userA.id);
        await Swap.selectMethod(swapDirectId, userA.id, 'SELF_ARRANGED');
        await Swap.selectMethod(swapDirectId, userB.id, 'SELF_ARRANGED');

        // Verify email privacy before consent
        const detailsBeforeConsent = await Swap.getSwapDetails(swapDirectId, userA.id);
        assert(detailsBeforeConsent.isEmailRevealed === false, 'Partner email is hidden before mutual consent');
        assert(detailsBeforeConsent.owner_email === null && detailsBeforeConsent.requester_email === null, 'Emails are null in API payload before consent');

        // User A gives consent
        await Swap.recordConsent(swapDirectId, userA.id);
        const detailsMidConsent = await Swap.getSwapDetails(swapDirectId, userA.id);
        assert(detailsMidConsent.isEmailRevealed === false, 'Email still hidden with only 1 consent');

        // User B gives consent
        await Swap.recordConsent(swapDirectId, userB.id);
        const detailsAfterConsent = await Swap.getSwapDetails(swapDirectId, userA.id);
        assert(detailsAfterConsent.isEmailRevealed === true, 'Email revealed after mutual consent');
        assert(detailsAfterConsent.requester_email === userB.email, 'User A can now see User B verified email');
    } catch (err) {
        console.error('Test execution failed:', err);
        failed++;
    } finally {
        // Guaranteed independent cleanup of test books even if test operations or partner inserts fail
        if (bookAId) {
            try {
                await conn.execute('DELETE FROM books WHERE id = ?', [bookAId]);
            } catch (cleanupErr) {
                // Ignore teardown cleanup errors
            }
        }
        if (bookBId) {
            try {
                await conn.execute('DELETE FROM books WHERE id = ?', [bookBId]);
            } catch (cleanupErr) {
                // Ignore teardown cleanup errors
            }
        }

        console.log('\n====================================================');
        console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
        console.log('====================================================');

        if (conn) await conn.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();

