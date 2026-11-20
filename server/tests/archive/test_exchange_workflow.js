const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: __dirname + '/.env' });
const { pool } = require('./config/db');

// Start server in-process if not already listening
const { app, server } = require('./index');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET;

function makeToken(user) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
    console.log('====================================================');
    console.log('QUIRO SWAP WORKFLOW & PAYMENT AUTOMATED TEST SUITE');
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

    // Wait a brief tick for server port to bind
    await new Promise(resolve => setTimeout(resolve, 800));

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

        console.log(`User A: ID=${userA.id} (${userA.full_name}, ${userA.email})`);
        console.log(`User B: ID=${userB.id} (${userB.full_name}, ${userB.email})`);

        // ----------------------------------------------------
        // TEST 1: CORS Preflight with Idempotency-Key
        // ----------------------------------------------------
        console.log('\n--- 1. Testing CORS Preflight for Idempotency-Key ---');
        try {
            const preflightRes = await axios({
                method: 'OPTIONS',
                url: `${API_BASE}/payments/create-order`,
                headers: {
                    'Origin': 'http://localhost:5173',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type,Authorization,Idempotency-Key'
                }
            });
            const allowHeaders = preflightRes.headers['access-control-allow-headers'] || '';
            assert(
                allowHeaders.toLowerCase().includes('idempotency-key'),
                'CORS Preflight explicitly allows Idempotency-Key header'
            );
        } catch (err) {
            assert(false, `CORS preflight failed: ${err.message}`);
        }

        // ----------------------------------------------------
        // TEST 2: Razorpay Order Creation via API
        // ----------------------------------------------------
        console.log('\n--- 2. Testing Payment Intent Creation with Idempotency ---');
        const [availableBooks] = await pool.execute('SELECT id, title, price FROM books WHERE status = "available" AND seller_id != ? LIMIT 1', [userA.id]);
        if (availableBooks.length > 0) {
            const testBook = availableBooks[0];
            await pool.execute('DELETE FROM cart_items WHERE user_id = ?', [userA.id]);
            await pool.execute('INSERT INTO cart_items (user_id, book_id, quantity) VALUES (?, ?, 1)', [userA.id, testBook.id]);

            const idempKey = `test_idemp_${Date.now()}`;
            try {
                const orderRes = await axios.post(`${API_BASE}/payments/create-order`, {
                    shipping_address: '123 Baker Street, Mumbai - 400001, Phone: 9876543210',
                    expectedSubtotal: parseFloat(testBook.price),
                    idempotencyKey: idempKey
                }, {
                    headers: {
                        'Authorization': `Bearer ${tokenA}`,
                        'Idempotency-Key': idempKey
                    }
                });

                assert(orderRes.data.orderId && orderRes.data.rzpOrderId, 'Razorpay order generated with orderId and rzpOrderId');
                assert(orderRes.data.amount > 0, `Amount in paise correctly calculated (${orderRes.data.amount})`);

                // Re-send with same idempotency key
                const replayRes = await axios.post(`${API_BASE}/payments/create-order`, {
                    shipping_address: '123 Baker Street, Mumbai - 400001, Phone: 9876543210',
                    expectedSubtotal: parseFloat(testBook.price),
                    idempotencyKey: idempKey
                }, {
                    headers: {
                        'Authorization': `Bearer ${tokenA}`,
                        'Idempotency-Key': idempKey
                    }
                });
                assert(replayRes.data.orderId === orderRes.data.orderId, 'Idempotent replay returned cached payment order without duplicating');
            } catch (err) {
                assert(false, `Payment create-order failed: ${err.response?.data?.message || err.message}`);
            }
        }

        // ----------------------------------------------------
        // TEST 3: Swap Request & Ownership Security on Accept
        // ----------------------------------------------------
        console.log('\n--- 3. Testing Swap Acceptance Security & Ownership Checks ---');
        let [bookBList] = await pool.execute('SELECT id FROM books WHERE seller_id = ? AND status = "available" LIMIT 1', [userB.id]);
        if (bookBList.length === 0) {
            const [insB] = await pool.execute('INSERT INTO books (seller_id, title, author, price, `condition`, genre, status, swap_enabled) VALUES (?, "Book of User B", "Author B", 299, "Like New", "Fiction", "available", 1)', [userB.id]);
            bookBList = [{ id: insB.insertId }];
        }
        let [bookAList] = await pool.execute('SELECT id FROM books WHERE seller_id = ? AND status = "available" LIMIT 1', [userA.id]);
        if (bookAList.length === 0) {
            const [insA] = await pool.execute('INSERT INTO books (seller_id, title, author, price, `condition`, genre, status, swap_enabled) VALUES (?, "Book of User A", "Author A", 349, "Good", "Philosophy", "available", 1)', [userA.id]);
            bookAList = [{ id: insA.insertId }];
        }

        const bookBId = bookBList[0].id;
        const bookAId = bookAList[0].id;

        await pool.execute('UPDATE books SET status = "available", swap_enabled = 1 WHERE id IN (?, ?)', [bookAId, bookBId]);

        // User A requests swap from User B
        const swapCreateRes = await axios.post(`${API_BASE}/swaps/request`, {
            requested_book_id: bookBId,
            offered_book_id: bookAId,
            message: 'Hello, would love to exchange books!'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });

        const testSwapId = swapCreateRes.data.swapId;
        assert(testSwapId, `Swap proposal created (ID: ${testSwapId})`);

        // Unauthorized user (User A is requester, not owner) attempts to accept
        try {
            await axios.put(`${API_BASE}/swaps/${testSwapId}/accept`, {}, {
                headers: { 'Authorization': `Bearer ${tokenA}` }
            });
            assert(false, 'Requester should NOT be able to accept own swap');
        } catch (err) {
            assert(err.response?.status === 403, 'Unauthorized acceptance correctly rejected with 403 Forbidden');
        }

        // Book Owner (User B) accepts swap
        const acceptRes = await axios.put(`${API_BASE}/swaps/${testSwapId}/accept`, {}, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        assert(acceptRes.status === 200, 'Book owner accepted the swap successfully');

        // Check books are marked 'reserved'
        const [reservedCheck] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bookAId, bookBId]);
        assert(reservedCheck.every(b => b.status === 'reserved'), 'Both books marked as "reserved" upon acceptance');

        // Cannot re-accept already accepted swap
        try {
            await axios.put(`${API_BASE}/swaps/${testSwapId}/accept`, {}, {
                headers: { 'Authorization': `Bearer ${tokenB}` }
            });
            assert(false, 'Should not allow re-accepting already accepted swap');
        } catch (err) {
            assert(err.response?.status === 400, 'Re-accepting accepted swap rejected with 400 Bad Request');
        }

        // ----------------------------------------------------
        // TEST 4: Post-Acceptance Option A (Direct Self-Arranged) & Email Privacy
        // ----------------------------------------------------
        console.log('\n--- 4. Testing Option A (Self-Arranged) & Strict Email Privacy ---');
        let detailsRes = await axios.get(`${API_BASE}/swaps/${testSwapId}/details`, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert(
            detailsRes.data.requester_email === null && detailsRes.data.owner_email === null,
            'Strict Privacy: Emails hidden (null) prior to mutual consent'
        );

        // User A selects SELF_ARRANGED
        await axios.post(`${API_BASE}/swaps/${testSwapId}/select-method`, {
            method: 'SELF_ARRANGED'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });

        // User B selects SELF_ARRANGED -> Agreement reached!
        const agreedRes = await axios.post(`${API_BASE}/swaps/${testSwapId}/select-method`, {
            method: 'SELF_ARRANGED'
        }, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        assert(agreedRes.data.method_agreed === 1, 'Mutual agreement recorded when both select SELF_ARRANGED');
        assert(agreedRes.data.exchange_method === 'SELF_ARRANGED', 'Exchange method set to SELF_ARRANGED');

        // User A consents to share email
        await axios.post(`${API_BASE}/swaps/${testSwapId}/consent`, {}, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        detailsRes = await axios.get(`${API_BASE}/swaps/${testSwapId}/details`, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert(
            detailsRes.data.requester_email === null && detailsRes.data.owner_email === null,
            'Strict Privacy: Emails still hidden after only one user consented'
        );

        // User B consents -> MUTUAL CONSENT GRANTED
        const mutualRes = await axios.post(`${API_BASE}/swaps/${testSwapId}/consent`, {}, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        assert(mutualRes.data.isEmailRevealed === true, 'Emails unmasked after mutual consent');
        assert(
            mutualRes.data.requester_email === userA.email && mutualRes.data.owner_email === userB.email,
            'Verified account email addresses revealed to both parties'
        );

        // Mark exchange arranged
        const arrangeRes = await axios.post(`${API_BASE}/swaps/${testSwapId}/arrange`, {}, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert(arrangeRes.data.status === 'arranged', 'Swap status transitioned to "arranged"');

        // Confirm receipt by User A
        const confirmARes = await axios.post(`${API_BASE}/swaps/${testSwapId}/confirm-completion`, {}, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert(confirmARes.data.completed === false, 'First confirmation records receipt without closing exchange');

        // Confirm receipt by User B -> Exchange completed
        const confirmBRes = await axios.post(`${API_BASE}/swaps/${testSwapId}/confirm-completion`, {}, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        assert(confirmBRes.data.completed === true, 'Both confirmations completed the exchange');

        const [swappedCheck] = await pool.execute('SELECT status FROM books WHERE id IN (?, ?)', [bookAId, bookBId]);
        assert(swappedCheck.every(b => b.status === 'swapped'), 'Both books marked as "swapped" in database');

        // ----------------------------------------------------
        // TEST 5: Option B (QUIRO Managed Courier Exchange)
        // ----------------------------------------------------
        console.log('\n--- 5. Testing Option B (QUIRO Managed Courier) Full Flow ---');
        await pool.execute('UPDATE books SET status = "available", swap_enabled = 1 WHERE id IN (?, ?)', [bookAId, bookBId]);

        const swapManagedRes = await axios.post(`${API_BASE}/swaps/request`, {
            requested_book_id: bookBId,
            offered_book_id: bookAId,
            message: 'Requesting QUIRO managed exchange'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });

        const managedSwapId = swapManagedRes.data.swapId;
        await axios.put(`${API_BASE}/swaps/${managedSwapId}/accept`, {}, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });

        // Both select QUIRO_MANAGED
        await axios.post(`${API_BASE}/swaps/${managedSwapId}/select-method`, {
            method: 'QUIRO_MANAGED'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });

        const managedAgreed = await axios.post(`${API_BASE}/swaps/${managedSwapId}/select-method`, {
            method: 'QUIRO_MANAGED'
        }, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        assert(managedAgreed.data.exchange_method === 'QUIRO_MANAGED', 'Agreed on QUIRO_MANAGED method');
        assert(managedAgreed.data.status === 'awaiting_addresses', 'Status transitioned to "awaiting_addresses"');

        // User A submits address
        await axios.post(`${API_BASE}/swaps/${managedSwapId}/address`, {
            full_name: userA.full_name,
            phone: '9876543210',
            address_line1: 'Flat 402, Lotus Towers, Andheri West',
            city: 'Mumbai',
            state: 'Maharashtra',
            postal_code: '400053'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });

        // User B submits address -> moves to awaiting_payment
        const addrResB = await axios.post(`${API_BASE}/swaps/${managedSwapId}/address`, {
            full_name: userB.full_name,
            phone: '9123456780',
            address_line1: '12-A, Green Glen Layout, Bellandur',
            city: 'Bengaluru',
            state: 'Karnataka',
            postal_code: '560103'
        }, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        assert(addrResB.data.status === 'awaiting_payment', 'Both addresses collected; status transitioned to "awaiting_payment"');

        // User A creates and pays shipping fee (₹79.00)
        const payIntentA = await axios.post(`${API_BASE}/swaps/${managedSwapId}/create-payment`, {}, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert(payIntentA.data.amount === 7900 && payIntentA.data.rzpOrderId, 'Razorpay order created for ₹79.00 (7900 paise)');

        await axios.post(`${API_BASE}/swaps/${managedSwapId}/verify-payment`, {
            razorpay_order_id: payIntentA.data.rzpOrderId,
            razorpay_payment_id: `pay_sandbox_A_${Date.now()}`,
            razorpay_signature: `sig_sandbox_A_${Date.now()}`
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });

        // User B creates and pays shipping fee (₹79.00)
        const payIntentB = await axios.post(`${API_BASE}/swaps/${managedSwapId}/create-payment`, {}, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        const paidBRes = await axios.post(`${API_BASE}/swaps/${managedSwapId}/verify-payment`, {
            razorpay_order_id: payIntentB.data.rzpOrderId,
            razorpay_payment_id: `pay_sandbox_B_${Date.now()}`,
            razorpay_signature: `sig_sandbox_B_${Date.now()}`
        }, { headers: { 'Authorization': `Bearer ${tokenB}` } });

        assert(paidBRes.data.status === 'payment_completed', 'Both fees paid; status transitioned to "payment_completed"');
        assert(paidBRes.data.courier_status === 'collection_scheduled', 'Courier collection scheduled');
        assert(paidBRes.data.courier_tracking?.startsWith('QRO-'), `Tracking code generated: ${paidBRes.data.courier_tracking}`);

        // Advance courier stages
        const stage1 = await axios.post(`${API_BASE}/swaps/${managedSwapId}/advance-courier`, {
            stage: 'book_collected'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(stage1.data.courier_status === 'book_collected', 'Courier stage advanced to "book_collected"');

        const stage2 = await axios.post(`${API_BASE}/swaps/${managedSwapId}/advance-courier`, {
            stage: 'in_transit'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(stage2.data.courier_status === 'in_transit', 'Courier stage advanced to "in_transit"');

        const stage3 = await axios.post(`${API_BASE}/swaps/${managedSwapId}/advance-courier`, {
            stage: 'delivered'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(stage3.data.courier_status === 'delivered', 'Courier stage advanced to "delivered"');

        // Confirm receipts to complete
        await axios.post(`${API_BASE}/swaps/${managedSwapId}/confirm-completion`, {}, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        const finalManaged = await axios.post(`${API_BASE}/swaps/${managedSwapId}/confirm-completion`, {}, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        assert(finalManaged.data.completed === true, 'Managed exchange completed after both receipts confirmed');

        // ----------------------------------------------------
        // TEST 6: Cancellation & Refund for Managed Swap
        // ----------------------------------------------------
        console.log('\n--- 6. Testing Cancellation & Refund Integration ---');
        await pool.execute('UPDATE books SET status = "available", swap_enabled = 1 WHERE id IN (?, ?)', [bookAId, bookBId]);

        const refundSwapRes = await axios.post(`${API_BASE}/swaps/request`, {
            requested_book_id: bookBId,
            offered_book_id: bookAId,
            message: 'Refund test exchange'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        const refundSwapId = refundSwapRes.data.swapId;
        await axios.put(`${API_BASE}/swaps/${refundSwapId}/accept`, {}, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        await axios.post(`${API_BASE}/swaps/${refundSwapId}/select-method`, { method: 'QUIRO_MANAGED' }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        await axios.post(`${API_BASE}/swaps/${refundSwapId}/select-method`, { method: 'QUIRO_MANAGED' }, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        await axios.post(`${API_BASE}/swaps/${refundSwapId}/address`, { full_name: userA.full_name, phone: '9876543210', address_line1: 'Addr 1', city: 'City', state: 'State', postal_code: '123456' }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        await axios.post(`${API_BASE}/swaps/${refundSwapId}/address`, { full_name: userB.full_name, phone: '9876543211', address_line1: 'Addr 2', city: 'City', state: 'State', postal_code: '123456' }, { headers: { 'Authorization': `Bearer ${tokenB}` } });

        // Pay for User A
        const refPayIntent = await axios.post(`${API_BASE}/swaps/${refundSwapId}/create-payment`, {}, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        await axios.post(`${API_BASE}/swaps/${refundSwapId}/verify-payment`, {
            razorpay_order_id: refPayIntent.data.rzpOrderId,
            razorpay_payment_id: `pay_sandbox_ref_${Date.now()}`,
            razorpay_signature: `sig_sandbox_ref_${Date.now()}`
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });

        // Now cancel & refund before collection
        const refundAction = await axios.post(`${API_BASE}/swaps/${refundSwapId}/refund`, {
            reason: 'User decided to cancel before pickup'
        }, { headers: { 'Authorization': `Bearer ${tokenA}` } });
        assert(refundAction.data.success === true, 'Refund executed and swap cancelled');

        // Check payment record status in DB
        const [refRows] = await pool.execute('SELECT status, refund_amount FROM swap_payments WHERE swap_id = ?', [refundSwapId]);
        assert(refRows[0]?.status === 'REFUNDED' && parseFloat(refRows[0]?.refund_amount) === 79.00, 'Swap payment record marked as REFUNDED with ₹79.00');

        console.log('\n====================================================');
        console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
        console.log('====================================================');

        // Clean up and exit
        setTimeout(() => process.exit(failed > 0 ? 1 : 0), 500);
    } catch (err) {
        console.error('Test execution error:', err.response?.data || err.message);
        setTimeout(() => process.exit(1), 500);
    }
}

runTests();
