const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { pool } = require('../../config/db');

// Start server in-process if not already listening
const { app, server } = require('../../index');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET;
let serverInstance = null;

function makeToken(user) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
    console.log('====================================================');
    console.log('QUIRO SWAP WORKFLOW & 10-STAGE COURIER TEST SUITE');
    console.log('====================================================');
    let passed = 0;
    let failed = 0;

    const assert = (condition, title) => {
        if (condition) {
            console.log(`  [PASS] ${title}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${title}`);
            failed++;
        }
    };

    // Ensure server is listening on port 5000
    try {
        const ping = await axios.get('http://localhost:5000/', { timeout: 800 }).catch(() => null);
        if (!ping || ping.status !== 200) {
            if (!server.listening) {
                serverInstance = server.listen(5000);
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }
    } catch (e) {
        if (!server.listening) {
            serverInstance = server.listen(5000);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

    try {
        // Find 2 distinct active users
        const [users] = await pool.execute('SELECT id, full_name, email, role FROM users WHERE role = "user" LIMIT 2');
        if (users.length < 2) {
            console.error('Need at least 2 users in database.');
            process.exit(1);
        }

        const userA = users[0];
        const userB = users[1];
        const tokenA = makeToken(userA);
        const tokenB = makeToken(userB);

        console.log(`User A: ID=${userA.id} (${userA.full_name})`);
        console.log(`User B: ID=${userB.id} (${userB.full_name})`);

        // ----------------------------------------------------
        // TEST 1: Config Endpoint
        // ----------------------------------------------------
        console.log('\n--- 1. Testing Exchange Configuration Endpoint ---');
        const configRes = await axios.get(`${API_BASE}/swaps/config`);
        assert(configRes.status === 200, 'GET /api/swaps/config returns 200 OK');
        assert(configRes.data.shippingFeePerUser === 79.00, 'Config returns ₹79.00 shipping fee');
        assert(configRes.data.breakdown?.baseShipping > 0, 'Config returns detailed fee breakdown');
        assert(Array.isArray(configRes.data.courierStages) && configRes.data.courierStages.length === 10, 'Config returns exact 10 courier stages');

        // Setup test books
        await pool.execute('DELETE FROM books WHERE title LIKE "QUIRO_TEST_BOOK_%"');
        const [bookA] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled) VALUES (?, "QUIRO_TEST_BOOK_A", "Author A", "9781111111111", 250, "Like New", "Fiction", "available", 1)',
            [userA.id]
        );
        const [bookB] = await pool.execute(
            'INSERT INTO books (seller_id, title, author, isbn, price, `condition`, genre, status, swap_enabled) VALUES (?, "QUIRO_TEST_BOOK_B", "Author B", "9782222222222", 300, "Good", "Mystery", "available", 1)',
            [userB.id]
        );
        const bookAId = bookA.insertId;
        const bookBId = bookB.insertId;

        // Propose swap: User A proposes to User B
        const swapCreate = await axios.post(`${API_BASE}/swaps/request`, {
            requested_book_id: bookBId,
            offered_book_id: bookAId,
            message: 'Proposing trade for automated test'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        const swapId = swapCreate.data.swapId;
        assert(swapId > 0, 'Swap proposal created successfully');

        // User B accepts
        await axios.put(`${API_BASE}/swaps/${swapId}/accept`, {}, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        const detailsAfterAccept = await axios.get(`${API_BASE}/swaps/${swapId}/details`, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        assert(detailsAfterAccept.data.status === 'accepted', 'Swap status moved to accepted');

        // ----------------------------------------------------
        // TEST 2: Managed Exchange Method Alignment
        // ----------------------------------------------------
        console.log('\n--- 2. Testing Method Alignment ---');
        // User A chooses QUIRO_MANAGED
        const selA = await axios.post(`${API_BASE}/swaps/${swapId}/select-method`, {
            method: 'QUIRO_MANAGED'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(selA.data.requester_method === 'QUIRO_MANAGED', 'User A selected QUIRO_MANAGED');
        assert(selA.data.method_agreed === 0, 'Method not agreed yet (awaiting User B)');

        // User B chooses QUIRO_MANAGED
        const selB = await axios.post(`${API_BASE}/swaps/${swapId}/select-method`, {
            method: 'QUIRO_MANAGED'
        }, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        assert(selB.data.method_agreed === 1, 'Both users agreed on QUIRO_MANAGED');
        assert(selB.data.status === 'awaiting_addresses', 'Status transitioned to awaiting_addresses');

        // ----------------------------------------------------
        // TEST 3: Full Address Collection & Validation
        // ----------------------------------------------------
        console.log('\n--- 3. Testing Address Collection & Validation ---');
        // Attempting payment before address collection should fail
        let paymentFailedPreAddress = false;
        try {
            await axios.post(`${API_BASE}/swaps/${swapId}/create-payment`, {}, {
                headers: { 'Authorization': `Bearer ${tokenA}` }
            });
        } catch (err) {
            paymentFailedPreAddress = err.response?.status === 400;
        }
        assert(paymentFailedPreAddress, 'Payment blocked before addresses are submitted');

        // User A submits address with pickup & delivery
        const addrA = await axios.post(`${API_BASE}/swaps/${swapId}/address`, {
            full_name: userA.full_name,
            phone: '9876543210',
            pickup_address: 'Flat 402, Lotus Orchid, Andheri West',
            delivery_address: 'Flat 402, Lotus Orchid, Andheri West',
            city: 'Mumbai',
            state: 'Maharashtra',
            postal_code: '400053',
            delivery_instructions: 'Leave with security if not home'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(addrA.data.status === 'awaiting_addresses', 'One address recorded; still awaiting partner address');

        // User B submits address
        const addrB = await axios.post(`${API_BASE}/swaps/${swapId}/address`, {
            full_name: userB.full_name,
            phone: '9123456780',
            pickup_address: '12-A, Green Glen Layout, Bellandur',
            delivery_address: '12-A, Green Glen Layout, Bellandur',
            city: 'Bengaluru',
            state: 'Karnataka',
            postal_code: '560103',
            delivery_instructions: 'Call before delivery'
        }, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        assert(addrB.data.status === 'awaiting_payment', 'Both addresses collected; status transitioned to awaiting_payment');

        // ----------------------------------------------------
        // TEST 4: Razorpay Test Payments (Both Users)
        // ----------------------------------------------------
        console.log('\n--- 4. Testing Managed Exchange Payments ---');
        const payOrderA = await axios.post(`${API_BASE}/swaps/${swapId}/create-payment`, {}, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert(payOrderA.data.amount === 7900 && payOrderA.data.rzpOrderId, 'Razorpay order created for ₹79.00 (7900 paise)');

        // User A verifies payment
        await axios.post(`${API_BASE}/swaps/${swapId}/verify-payment`, {
            razorpay_order_id: payOrderA.data.rzpOrderId,
            razorpay_payment_id: `pay_sandbox_A_${Date.now()}`,
            razorpay_signature: `sig_sandbox_A_${Date.now()}`
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });

        const checkMid = await axios.get(`${API_BASE}/swaps/${swapId}/details`, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert(checkMid.data.requester_paid === 1 && checkMid.data.owner_paid === 0, 'User A marked paid; User B pending');

        // User B pays
        const payOrderB = await axios.post(`${API_BASE}/swaps/${swapId}/create-payment`, {}, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        const payBRes = await axios.post(`${API_BASE}/swaps/${swapId}/verify-payment`, {
            razorpay_order_id: payOrderB.data.rzpOrderId,
            razorpay_payment_id: `pay_sandbox_B_${Date.now()}`,
            razorpay_signature: `sig_sandbox_B_${Date.now()}`
        }, { headers: { 'Authorization': `Bearer ${tokenB}` } });

        assert(payBRes.data.status === 'payment_completed', 'Both payments captured; status moved to payment_completed');
        assert(payBRes.data.courier_status === 'payment_confirmed', 'Courier status set to payment_confirmed');
        assert(payBRes.data.courier_tracking?.startsWith('QRO-'), `Tracking code generated: ${payBRes.data.courier_tracking}`);

        // ----------------------------------------------------
        // TEST 5: The 10-Stage Courier Progression
        // ----------------------------------------------------
        console.log('\n--- 5. Testing 10-Stage Courier Dispatch Progression ---');
        const progression = [
            'pickup_scheduled',
            'pickup_partner_assigned',
            'pickup_partner_en_route',
            'book_collected',
            'in_transit',
            'out_for_delivery',
            'delivered',
            'awaiting_confirmations',
            'exchange_completed'
        ];

        for (const stage of progression) {
            const advRes = await axios.post(`${API_BASE}/swaps/${swapId}/advance-courier`, { stage }, {
                headers: { 'Authorization': `Bearer ${tokenA}` }
            });
            assert(advRes.data.courier_status === stage, `Advanced to stage: ${stage}`);
        }

        // Verify completed status
        const completedDetails = await axios.get(`${API_BASE}/swaps/${swapId}/details`, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert(completedDetails.data.status === 'completed', 'Final swap status is "completed"');
        assert(completedDetails.data.requester_confirmed === 1 && completedDetails.data.owner_confirmed === 1, 'Both confirmations recorded');

        // ----------------------------------------------------
        // TEST 6: Direct Exchange (Option A) & Privacy Gate
        // ----------------------------------------------------
        console.log('\n--- 6. Testing Direct Exchange & Email Privacy Gate ---');
        await pool.execute('UPDATE books SET status = "available", swap_enabled = 1 WHERE id IN (?, ?)', [bookAId, bookBId]);

        const directSwapRes = await axios.post(`${API_BASE}/swaps/request`, {
            requested_book_id: bookBId,
            offered_book_id: bookAId,
            message: 'Direct swap test'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        const directSwapId = directSwapRes.data.swapId;
        await axios.put(`${API_BASE}/swaps/${directSwapId}/accept`, {}, { headers: { 'Authorization': `Bearer ${tokenB}` } });

        // Select SELF_ARRANGED
        await axios.post(`${API_BASE}/swaps/${directSwapId}/select-method`, { method: 'SELF_ARRANGED' }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        await axios.post(`${API_BASE}/swaps/${directSwapId}/select-method`, { method: 'SELF_ARRANGED' }, { headers: { 'Authorization': `Bearer ${tokenB}` } });

        // Check privacy before consent
        const privCheck1 = await axios.get(`${API_BASE}/swaps/${directSwapId}/details`, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(privCheck1.data.isEmailRevealed === false, 'Partner email is hidden before mutual consent');

        // Mutual consent
        await axios.post(`${API_BASE}/swaps/${directSwapId}/consent`, {}, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        const privCheck2 = await axios.get(`${API_BASE}/swaps/${directSwapId}/details`, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(privCheck2.data.isEmailRevealed === false, 'Partner email still hidden after only one consent');

        await axios.post(`${API_BASE}/swaps/${directSwapId}/consent`, {}, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        const privCheck3 = await axios.get(`${API_BASE}/swaps/${directSwapId}/details`, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(privCheck3.data.isEmailRevealed === true && privCheck3.data.owner_email === userB.email, 'Partner email unlocked after mutual consent');

        // Two-party receipt confirmation
        const confA = await axios.post(`${API_BASE}/swaps/${directSwapId}/confirm-completion`, {}, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(confA.data.completed === false && confA.data.waitingForPartner === true, 'First confirmation awaits partner');
        const confB = await axios.post(`${API_BASE}/swaps/${directSwapId}/confirm-completion`, {}, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        assert(confB.data.completed === true, 'Direct exchange completed after mutual receipt confirmation');
        assert(confB.data.message.includes('Your books have found their next readers!'), 'Polished completion message returned');

        // Clean up test books
        await pool.execute('DELETE FROM books WHERE id IN (?, ?)', [bookAId, bookBId]);

        console.log('\n====================================================');
        console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
        console.log('====================================================');

        if (serverInstance && typeof serverInstance.close === 'function') {
            serverInstance.close();
        }

        setTimeout(() => process.exit(failed > 0 ? 1 : 0), 500);
    } catch (err) {
        console.error('Test execution error:', err.response?.data || err.message);
        if (serverInstance && typeof serverInstance.close === 'function') {
            serverInstance.close();
        }
        setTimeout(() => process.exit(1), 500);
    }
}

runTests();

