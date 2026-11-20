const crypto = require('crypto');
const Razorpay = require('razorpay');
const { pool } = require('../config/db');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const AuditService = require('./auditService');
const socket = require('../socket');

// Supported payment states
const PAYMENT_STATES = {
    CREATED: 'CREATED',
    PENDING: 'PENDING',
    AUTHORIZED: 'AUTHORIZED',
    CAPTURED: 'CAPTURED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    REFUND_PENDING: 'REFUND_PENDING',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
    REFUNDED: 'REFUNDED'
};

// Allowed State Transitions
const STATE_TRANSITIONS = {
    [PAYMENT_STATES.CREATED]: [PAYMENT_STATES.PENDING, PAYMENT_STATES.CANCELLED, PAYMENT_STATES.FAILED],
    [PAYMENT_STATES.PENDING]: [PAYMENT_STATES.AUTHORIZED, PAYMENT_STATES.CAPTURED, PAYMENT_STATES.FAILED, PAYMENT_STATES.CANCELLED],
    [PAYMENT_STATES.AUTHORIZED]: [PAYMENT_STATES.CAPTURED, PAYMENT_STATES.FAILED, PAYMENT_STATES.CANCELLED],
    [PAYMENT_STATES.CAPTURED]: [PAYMENT_STATES.REFUND_PENDING, PAYMENT_STATES.PARTIALLY_REFUNDED, PAYMENT_STATES.REFUNDED],
    [PAYMENT_STATES.FAILED]: [PAYMENT_STATES.PENDING, PAYMENT_STATES.CREATED],
    [PAYMENT_STATES.REFUND_PENDING]: [PAYMENT_STATES.PARTIALLY_REFUNDED, PAYMENT_STATES.REFUNDED, PAYMENT_STATES.FAILED],
    [PAYMENT_STATES.PARTIALLY_REFUNDED]: [PAYMENT_STATES.REFUND_PENDING, PAYMENT_STATES.REFUNDED],
    [PAYMENT_STATES.REFUNDED]: [],
    [PAYMENT_STATES.CANCELLED]: []
};

class PaymentService {
    // -------------------------------------------------------------
    // Configuration & Helpers
    // -------------------------------------------------------------
    static isRazorpayConfigured() {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        return (
            keyId && 
            keyId !== 'rzp_test_placeholder' && 
            keyId !== 'YOUR_RAZORPAY_KEY_ID' &&
            keySecret && 
            keySecret !== 'rzp_test_secret_placeholder' &&
            keySecret !== 'YOUR_RAZORPAY_KEY_SECRET'
        );
    }

    static getRazorpayInstance() {
        if (!this.isRazorpayConfigured()) {
            return null;
        }
        return new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }

    static validateStateTransition(currentStatus, nextStatus) {
        const current = (currentStatus || '').toUpperCase();
        const next = (nextStatus || '').toUpperCase();
        
        if (current === next) return true;
        
        const allowed = STATE_TRANSITIONS[current] || [];
        return allowed.includes(next);
    }

    // -------------------------------------------------------------
    // Idempotency Protection
    // -------------------------------------------------------------
    static async getIdempotentResponse(idempotencyKey, userId, requestPath, requestPayload) {
        if (!idempotencyKey) return null;

        const cleanPayload = {};
        if (requestPayload && typeof requestPayload === 'object') {
            for (const key of Object.keys(requestPayload).sort()) {
                cleanPayload[key] = requestPayload[key] === undefined ? null : requestPayload[key];
            }
        }

        const requestHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(cleanPayload))
            .digest('hex');

        const [rows] = await pool.execute(
            'SELECT * FROM payment_idempotency WHERE idempotency_key = ? AND user_id = ?',
            [idempotencyKey, userId]
        );

        if (rows.length > 0) {
            const cached = rows[0];
            // If request hash matches, return stored response
            if (cached.request_hash === requestHash) {
                return {
                    status: cached.response_status,
                    body: JSON.parse(cached.response_body),
                    isIdempotentReplay: true
                };
            } else {
                throw new Error('Idempotency key reused with different request payload');
            }
        }

        return null;
    }

    static async saveIdempotentResponse(idempotencyKey, userId, requestPath, requestPayload, responseStatus, responseBody) {
        if (!idempotencyKey) return;

        const cleanPayload = {};
        if (requestPayload && typeof requestPayload === 'object') {
            for (const key of Object.keys(requestPayload).sort()) {
                cleanPayload[key] = requestPayload[key] === undefined ? null : requestPayload[key];
            }
        }

        const requestHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(cleanPayload))
            .digest('hex');

        try {
            await pool.execute(
                'INSERT INTO payment_idempotency (idempotency_key, user_id, request_path, request_hash, response_status, response_body) VALUES (?, ?, ?, ?, ?, ?)',
                [idempotencyKey, userId, requestPath, requestHash, responseStatus, JSON.stringify(responseBody)]
            );
        } catch (error) {
            // Silently ignore duplicate key inserts on race
            console.warn('Idempotency save duplicate warning:', error.message);
        }
    }

    // -------------------------------------------------------------
    // Inventory Reservation System
    // -------------------------------------------------------------
    static async reserveInventory(items, userId, orderId = null, ttlMinutes = 15, connection = null) {
        const db = connection || pool;
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

        // 1. Clean up expired reservations first
        await this.cleanupExpiredReservations(db);

        // 2. Verify stock availability with lock
        for (const item of items) {
            const qtyNeeded = parseInt(item.quantity) || 1;

            // Get current active reservations for this book
            const [reservedRows] = await db.execute(`
                SELECT COALESCE(SUM(quantity), 0) as total_reserved
                FROM inventory_reservations
                WHERE book_id = ? AND status = 'RESERVED' AND expires_at > NOW() AND (user_id != ? OR order_id != ?)
            `, [item.id, userId, orderId || 0]);

            const totalReserved = parseInt(reservedRows[0]?.total_reserved || 0);

            const [bookRows] = await db.execute(
                'SELECT id, title, status, stock FROM books WHERE id = ? FOR UPDATE',
                [item.id]
            );

            if (bookRows.length === 0) {
                throw new Error(`Book "${item.title || item.id}" not found`);
            }

            const book = bookRows[0];
            if (book.status !== 'available') {
                throw new Error(`Book "${book.title}" is no longer available`);
            }

            const availableStock = (book.stock !== null && book.stock !== undefined) ? parseInt(book.stock) : 1;
            if (availableStock - totalReserved < qtyNeeded) {
                throw new Error(`Insufficient stock for "${book.title}". Only ${Math.max(0, availableStock - totalReserved)} remaining.`);
            }

            // Create reservation record
            await db.execute(`
                INSERT INTO inventory_reservations (book_id, user_id, order_id, quantity, status, expires_at)
                VALUES (?, ?, ?, ?, 'RESERVED', ?)
            `, [item.id, userId, orderId, qtyNeeded, expiresAt]);
        }

        return { success: true, expiresAt };
    }

    static async releaseReservation(userId, orderId = null, connection = null) {
        const db = connection || pool;
        if (orderId) {
            await db.execute(
                "UPDATE inventory_reservations SET status = 'RELEASED' WHERE order_id = ? AND status = 'RESERVED'",
                [orderId]
            );
        } else {
            await db.execute(
                "UPDATE inventory_reservations SET status = 'RELEASED' WHERE user_id = ? AND status = 'RESERVED'",
                [userId]
            );
        }
    }

    static async finalizeReservation(orderId, connection = null) {
        const db = connection || pool;
        await db.execute(
            "UPDATE inventory_reservations SET status = 'FINALIZED' WHERE order_id = ? AND status = 'RESERVED'",
            [orderId]
        );
    }

    static async cleanupExpiredReservations(connection = null) {
        const db = connection || pool;
        try {
            await db.execute(
                "UPDATE inventory_reservations SET status = 'EXPIRED' WHERE status = 'RESERVED' AND expires_at <= NOW()"
            );
        } catch (e) {
            console.error('Reservation cleanup error:', e.message);
        }
    }

    // -------------------------------------------------------------
    // Checkout Validation & Recalculation
    // -------------------------------------------------------------
    static async validateAndCalculateCheckout(userId, { couponCode, expectedSubtotal, shippingAddress }) {
        const cartItems = await Cart.findByUserId(userId);
        if (!cartItems || cartItems.length === 0) {
            throw new Error('Cart is empty');
        }

        let subtotal = 0;
        const validatedItems = [];
        let priceChanged = false;

        for (const item of cartItems) {
            // Load latest book price from DB
            const [bookRows] = await pool.execute(
                'SELECT id, title, author, price, status, seller_id, stock FROM books WHERE id = ?',
                [item.id]
            );

            if (bookRows.length === 0 || bookRows[0].status !== 'available') {
                throw new Error(`Book "${item.title || item.id}" is no longer available`);
            }

            const currentBook = bookRows[0];
            const qty = parseInt(item.quantity) || 1;
            const currentPrice = parseFloat(currentBook.price);
            const cartPrice = parseFloat(item.price);

            if (Math.abs(currentPrice - cartPrice) > 0.01) {
                priceChanged = true;
            }

            subtotal += currentPrice * qty;

            for (let i = 0; i < qty; i++) {
                validatedItems.push({
                    id: currentBook.id,
                    price: currentPrice,
                    title: currentBook.title,
                    author: currentBook.author,
                    seller_id: currentBook.seller_id
                });
            }
        }

        // Check if price changed significantly from frontend expectation
        if (expectedSubtotal !== undefined && Math.abs(parseFloat(expectedSubtotal) - subtotal) > 0.01) {
            priceChanged = true;
        }

        // Apply Coupon if present
        let discount = 0;
        let appliedCoupon = null;
        if (couponCode) {
            const [coupons] = await pool.execute(
                'SELECT * FROM coupons WHERE code = ? AND active = TRUE',
                [couponCode]
            );
            if (coupons.length > 0) {
                const coupon = coupons[0];
                if (subtotal >= parseFloat(coupon.min_order_value || 0)) {
                    discount = subtotal * (coupon.discount_percent / 100);
                    if (coupon.max_discount && discount > parseFloat(coupon.max_discount)) {
                        discount = parseFloat(coupon.max_discount);
                    }
                    appliedCoupon = coupon.code;
                }
            }
        }

        const discountedSubtotal = subtotal - discount;
        const shipping = discountedSubtotal > 500 ? 0 : 50;
        const gst = parseFloat((discountedSubtotal * 0.05).toFixed(2));
        const platformFee = 29.00;
        const total = parseFloat((discountedSubtotal + shipping + gst + platformFee).toFixed(2));

        return {
            items: validatedItems,
            cartItemCount: cartItems.length,
            subtotal: parseFloat(subtotal.toFixed(2)),
            discount: parseFloat(discount.toFixed(2)),
            appliedCoupon,
            shipping,
            gst,
            platformFee,
            total,
            priceChanged
        };
    }

    // -------------------------------------------------------------
    // Order & Payment Intent Creation
    // -------------------------------------------------------------
    static async createPaymentIntent(userId, { shipping_address, couponCode, expectedSubtotal, idempotencyKey }, req = null) {
        const payloadForIdempotency = {
            shipping_address: shipping_address || '',
            couponCode: couponCode || null,
            expectedSubtotal: expectedSubtotal !== undefined ? expectedSubtotal : null
        };

        // 1. Idempotency Check
        const cached = await this.getIdempotentResponse(idempotencyKey, userId, '/api/payments/create-order', payloadForIdempotency);
        if (cached) return cached.body;

        // 2. Validate Checkout and recalculate amounts
        const calc = await this.validateAndCalculateCheckout(userId, { couponCode, expectedSubtotal, shippingAddress: shipping_address });

        if (calc.priceChanged && expectedSubtotal !== undefined) {
            const err = new Error('PRICE_CHANGED');
            err.code = 'PRICE_CHANGED';
            err.details = {
                message: 'Listing prices have updated. Please review your revised order total.',
                oldSubtotal: expectedSubtotal,
                newSubtotal: calc.subtotal,
                newTotal: calc.total,
                totals: calc
            };
            throw err;
        }

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // 3. Reserve Inventory
            await this.reserveInventory(calc.items, userId, null, 15, connection);

            // 4. Create Pending Order in DB
            const invoiceNum = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
            const [orderResult] = await connection.execute(
                'INSERT INTO orders (buyer_id, total_price, shipping_address, status, invoice_number) VALUES (?, ?, ?, ?, ?)',
                [userId, calc.total, shipping_address, 'pending', invoiceNum]
            );
            const orderId = orderResult.insertId;

            // Associate reservation with orderId
            await connection.execute(
                "UPDATE inventory_reservations SET order_id = ? WHERE user_id = ? AND status = 'RESERVED' AND order_id IS NULL",
                [orderId, userId]
            );

            // Insert Order Items
            for (const item of calc.items) {
                await connection.execute(
                    'INSERT INTO order_items (order_id, book_id, price) VALUES (?, ?, ?)',
                    [orderId, item.id, item.price]
                );
            }

            // 5. Generate Razorpay / Test Sandbox Order
            const amountInPaisa = Math.round(calc.total * 100);
            let rzpOrderId;
            const isConfigured = this.isRazorpayConfigured();

            if (isConfigured) {
                const rzp = this.getRazorpayInstance();
                const rzpOrder = await rzp.orders.create({
                    amount: amountInPaisa,
                    currency: 'INR',
                    receipt: `rcpt_${orderId}_${Date.now().toString().slice(-6)}`
                });
                rzpOrderId = rzpOrder.id;
            } else {
                // Production-safe Mock / Sandbox mode
                rzpOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            }

            // 6. Save Payment record as PENDING
            const [paymentResult] = await connection.execute(`
                INSERT INTO payments (order_id, user_id, razorpay_order_id, amount, currency, status, idempotency_key, metadata)
                VALUES (?, ?, ?, ?, 'INR', 'PENDING', ?, ?)
            `, [orderId, userId, rzpOrderId, calc.total, idempotencyKey || null, JSON.stringify({ totals: calc, isTestMode: !isConfigured })]);

            const paymentId = paymentResult.insertId;

            await connection.commit();

            // 7. Audit Log
            await AuditService.log(userId, 'PAYMENT_INTENT_CREATED', 'PAYMENT', paymentId, {
                orderId, rzpOrderId, amount: calc.total, idempotencyKey
            }, req);

            const responseData = {
                keyId: isConfigured ? process.env.RAZORPAY_KEY_ID : 'rzp_test_booknest_sandbox',
                paymentId,
                orderId,
                rzpOrderId,
                amount: amountInPaisa,
                currency: 'INR',
                status: PAYMENT_STATES.PENDING,
                isTestMode: !isConfigured,
                totals: calc
            };

            // Save idempotency response
            if (idempotencyKey) {
                await this.saveIdempotentResponse(idempotencyKey, userId, '/api/payments/create-order', payloadForIdempotency, 200, responseData);
            }

            return responseData;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // Secure Payment Verification & Capture
    // -------------------------------------------------------------
    static async verifyAndCapturePayment(userId, { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature, method = 'Card' }, req = null) {
        // 1. Fetch internal order and payment record
        const [paymentRows] = await pool.execute(
            'SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
            [orderId]
        );

        if (paymentRows.length === 0) {
            throw new Error('Payment record not found for this order');
        }

        const payment = paymentRows[0];

        // Idempotent check: if already captured, return success
        if (payment.status === PAYMENT_STATES.CAPTURED) {
            return {
                success: true,
                message: 'Payment already captured and verified',
                orderId,
                paymentId: payment.id,
                status: PAYMENT_STATES.CAPTURED
            };
        }

        // Validate state transition
        if (!this.validateStateTransition(payment.status, PAYMENT_STATES.CAPTURED)) {
            throw new Error(`Invalid payment state transition from ${payment.status} to ${PAYMENT_STATES.CAPTURED}`);
        }

        // 2. Strict Signature Verification & Safe Gateway Handling
        const isConfigured = this.isRazorpayConfigured();
        const isProduction = process.env.NODE_ENV === 'production';
        let isValidSignature = false;

        // In production, missing credentials or test-mode signatures are strictly prohibited
        if (isProduction && !isConfigured) {
            await pool.execute(
                "UPDATE payments SET status = 'FAILED', failure_reason = ? WHERE id = ?",
                ['Payment gateway not configured in production', payment.id]
            );
            throw new Error('Payment gateway is not configured for production transactions');
        }

        if (isProduction && razorpay_signature && razorpay_signature.startsWith('sig_sandbox_')) {
            await pool.execute(
                "UPDATE payments SET status = 'FAILED', failure_reason = ? WHERE id = ?",
                ['Test mode sandbox signatures are prohibited in production', payment.id]
            );
            throw new Error('Invalid signature format for production');
        }

        if (isConfigured) {
            if (!razorpay_signature) {
                isValidSignature = false;
            } else {
                const body = razorpay_order_id + "|" + razorpay_payment_id;
                const expectedSignature = crypto
                    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                    .update(body.toString())
                    .digest('hex');
                const expBuf = Buffer.from(expectedSignature, 'utf8');
                const sigBuf = Buffer.from(razorpay_signature, 'utf8');
                isValidSignature = expBuf.length === sigBuf.length && crypto.timingSafeEqual(expBuf, sigBuf);
            }
        } else if (process.env.NODE_ENV === 'test') {
            // Dedicated test runner simulation (only active during automated test suites)
            isValidSignature = Boolean(
                razorpay_signature && 
                (razorpay_signature.startsWith('sig_sandbox_') || razorpay_signature.startsWith('sig_test_')) &&
                razorpay_payment_id && 
                razorpay_order_id
            );
        } else {
            // Missing credentials in dev/staging without test runner: fail safely
            isValidSignature = false;
        }

        if (!isValidSignature) {
            // Mark payment as FAILED
            await pool.execute(
                "UPDATE payments SET status = 'FAILED', failure_reason = ? WHERE id = ?",
                ['Signature verification failed or tampering detected', payment.id]
            );

            await AuditService.log(userId, 'PAYMENT_VERIFICATION_FAILED', 'PAYMENT', payment.id, {
                orderId, reason: 'Invalid signature'
            }, req);

            throw new Error('Payment signature verification failed');
        }

        // 3. Atomic Capture Transaction
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // A. Update Payment status to CAPTURED
            await connection.execute(`
                UPDATE payments 
                SET status = 'CAPTURED', 
                    razorpay_payment_id = ?, 
                    razorpay_signature = ?, 
                    method = ?, 
                    captured_at = CURRENT_TIMESTAMP,
                    payment_date = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [razorpay_payment_id, razorpay_signature, method, payment.id]);

            // B. Finalize Inventory Reservations and mark books sold
            await this.finalizeReservation(orderId, connection);

            const [orderItems] = await connection.execute(`
                SELECT oi.book_id, oi.price, b.title, b.seller_id, b.stock
                FROM order_items oi
                JOIN books b ON oi.book_id = b.id
                WHERE oi.order_id = ?
            `, [orderId]);

            for (const item of orderItems) {
                await connection.execute(
                    "UPDATE books SET status = 'sold' WHERE id = ?",
                    [item.book_id]
                );
            }

            // C. Update Order status to confirmed
            await connection.execute(
                "UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [orderId]
            );

            // D. Clear Cart for buyer
            await connection.execute(
                'DELETE FROM cart_items WHERE user_id = ?',
                [userId]
            );

            // E. Record Seller Payouts & Append to Financial Ledger
            const platformFeeRate = 0.05; // 5% configurable platform fee

            for (const item of orderItems) {
                const itemGross = parseFloat(item.price);
                const itemPlatformFee = parseFloat((itemGross * platformFeeRate).toFixed(2));
                const itemSellerAmount = parseFloat((itemGross - itemPlatformFee).toFixed(2));

                // Insert into seller_payouts
                await connection.execute(`
                    INSERT INTO seller_payouts (seller_id, order_id, payment_id, gross_amount, platform_fee, seller_amount, payout_status)
                    VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
                `, [item.seller_id, orderId, payment.id, itemGross, itemPlatformFee, itemSellerAmount]);

                // Append Seller Earning to Financial Ledger
                const sellerTxId = `TX_SELLER_${orderId}_${item.book_id}_${Date.now().toString().slice(-6)}`;
                await connection.execute(`
                    INSERT INTO financial_ledger (transaction_id, order_id, payment_id, seller_id, transaction_type, amount, currency, direction, status, metadata)
                    VALUES (?, ?, ?, ?, 'SELLER_EARNING', ?, 'INR', 'CREDIT', 'COMPLETED', ?)
                `, [sellerTxId, orderId, payment.id, item.seller_id, itemSellerAmount, JSON.stringify({ bookTitle: item.title, gross: itemGross, fee: itemPlatformFee })]);
            }

            // Append Sale & Platform Fee Ledger entries
            const saleTxId = `TX_PAY_${orderId}_${Date.now().toString().slice(-6)}`;
            await connection.execute(`
                INSERT INTO financial_ledger (transaction_id, order_id, payment_id, user_id, transaction_type, amount, currency, direction, status, metadata)
                VALUES (?, ?, ?, ?, 'PAYMENT', ?, 'INR', 'CREDIT', 'COMPLETED', ?)
            `, [saleTxId, orderId, payment.id, userId, payment.amount, JSON.stringify({ razorpay_payment_id, method })]);

            const feeTxId = `TX_FEE_${orderId}_${Date.now().toString().slice(-6)}`;
            const totalFee = parseFloat((parseFloat(payment.amount) * platformFeeRate).toFixed(2));
            await connection.execute(`
                INSERT INTO financial_ledger (transaction_id, order_id, payment_id, transaction_type, amount, currency, direction, status, metadata)
                VALUES (?, ?, ?, 'PLATFORM_FEE', ?, 'INR', 'CREDIT', 'COMPLETED', ?)
            `, [feeTxId, orderId, payment.id, totalFee, JSON.stringify({ rate: '5%' })]);

            await connection.commit();

            // 4. Socket.io Notifications to Buyer and Sellers
            socket.sendNotification(userId, {
                type: 'ORDER_PAYMENT_CONFIRMED',
                message: `Payment of ₹${payment.amount} successful! Order #${orderId} confirmed.`,
                reference_id: orderId
            });

            for (const item of orderItems) {
                socket.sendNotification(item.seller_id, {
                    type: 'NEW_ORDER',
                    message: `Book "${item.title}" purchased in Order #${orderId}!`,
                    reference_id: orderId
                });
            }

            // 5. Audit Log
            await AuditService.log(userId, 'PAYMENT_CAPTURED', 'PAYMENT', payment.id, {
                orderId, rzpPaymentId: razorpay_payment_id, amount: payment.amount
            }, req);

            return {
                success: true,
                message: 'Payment verified and order processed successfully',
                orderId,
                paymentId: payment.id,
                status: PAYMENT_STATES.CAPTURED
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // Payment Failure & Retry Handling
    // -------------------------------------------------------------
    static async handlePaymentFailure(userId, paymentId, failureReason, req = null) {
        const [paymentRows] = await pool.execute(
            'SELECT * FROM payments WHERE id = ? AND user_id = ?',
            [paymentId, userId]
        );

        if (paymentRows.length === 0) {
            throw new Error('Payment record not found');
        }

        const payment = paymentRows[0];

        if (this.validateStateTransition(payment.status, PAYMENT_STATES.FAILED)) {
            await pool.execute(
                "UPDATE payments SET status = 'FAILED', failure_reason = ? WHERE id = ?",
                [failureReason || 'Payment declined or cancelled by user', paymentId]
            );

            // Release inventory reservation
            await this.releaseReservation(userId, payment.order_id);

            socket.sendNotification(userId, {
                type: 'PAYMENT_FAILED',
                message: `Payment for Order #${payment.order_id} failed: ${failureReason || 'Transaction unsuccessful'}. You can retry anytime.`,
                reference_id: payment.order_id
            });

            await AuditService.log(userId, 'PAYMENT_FAILED', 'PAYMENT', paymentId, {
                orderId: payment.order_id, reason: failureReason
            }, req);
        }

        return { success: true, status: PAYMENT_STATES.FAILED };
    }

    static async retryPayment(userId, paymentId, req = null) {
        const [paymentRows] = await pool.execute(
            'SELECT * FROM payments WHERE id = ? AND user_id = ?',
            [paymentId, userId]
        );

        if (paymentRows.length === 0) {
            throw new Error('Payment not found');
        }

        const oldPayment = paymentRows[0];
        if (oldPayment.status === PAYMENT_STATES.CAPTURED) {
            throw new Error('This payment is already captured and completed');
        }

        const orderId = oldPayment.order_id;
        const [orderRows] = await pool.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orderRows.length === 0) throw new Error('Order not found');

        const order = orderRows[0];
        const [orderItems] = await pool.execute('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

        // Re-reserve inventory
        await this.reserveInventory(orderItems.map(i => ({ id: i.book_id, quantity: 1 })), userId, orderId, 15);

        // Generate new Razorpay order
        const isConfigured = this.isRazorpayConfigured();
        const amountInPaisa = Math.round(parseFloat(order.total_price) * 100);
        let rzpOrderId;

        if (isConfigured) {
            const rzp = this.getRazorpayInstance();
            const rzpOrder = await rzp.orders.create({
                amount: amountInPaisa,
                currency: 'INR',
                receipt: `rcpt_retry_${orderId}_${Date.now().toString().slice(-6)}`
            });
            rzpOrderId = rzpOrder.id;
        } else {
            rzpOrderId = `order_retry_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }

        // Update payment with new rzp order and reset status to PENDING
        await pool.execute(
            "UPDATE payments SET razorpay_order_id = ?, status = 'PENDING', failure_reason = NULL WHERE id = ?",
            [rzpOrderId, paymentId]
        );

        await AuditService.log(userId, 'PAYMENT_RETRY_INITIATED', 'PAYMENT', paymentId, {
            orderId, rzpOrderId
        }, req);

        return {
            keyId: isConfigured ? process.env.RAZORPAY_KEY_ID : 'rzp_test_booknest_sandbox',
            paymentId,
            orderId,
            rzpOrderId,
            amount: amountInPaisa,
            currency: 'INR',
            status: PAYMENT_STATES.PENDING,
            isTestMode: !isConfigured
        };
    }

    // -------------------------------------------------------------
    // Refund Processing & Reliability
    // -------------------------------------------------------------
    static async processRefund(actorId, { paymentId, amount, reason, disputeId = null, idempotencyKey }, req = null) {
        const payloadForIdempotency = {
            paymentId,
            amount: amount !== undefined ? amount : null,
            reason: reason || ''
        };

        // Idempotency check
        const cached = await this.getIdempotentResponse(idempotencyKey, actorId, '/api/payments/refund', payloadForIdempotency);
        if (cached) return cached.body;

        const [paymentRows] = await pool.execute('SELECT * FROM payments WHERE id = ?', [paymentId]);
        if (paymentRows.length === 0) throw new Error('Payment not found');

        const payment = paymentRows[0];
        if (payment.status !== PAYMENT_STATES.CAPTURED && payment.status !== PAYMENT_STATES.PARTIALLY_REFUNDED) {
            throw new Error(`Cannot refund payment in status ${payment.status}`);
        }

        const refundAmount = parseFloat(amount || payment.amount);
        const alreadyRefunded = parseFloat(payment.refund_amount || 0.00);
        const capturedAmount = parseFloat(payment.amount);

        if (refundAmount <= 0) {
            throw new Error('Refund amount must be greater than zero');
        }

        if (alreadyRefunded + refundAmount > capturedAmount + 0.01) {
            throw new Error(`Total refund (${alreadyRefunded + refundAmount}) exceeds captured payment amount (${capturedAmount})`);
        }

        const isFullRefund = Math.abs(alreadyRefunded + refundAmount - capturedAmount) < 0.01;
        const nextPaymentStatus = isFullRefund ? PAYMENT_STATES.REFUNDED : PAYMENT_STATES.PARTIALLY_REFUNDED;

        let rzpRefundId = `rfnd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        if (this.isRazorpayConfigured() && payment.razorpay_payment_id && !payment.razorpay_payment_id.startsWith('pay_sandbox')) {
            try {
                const rzp = this.getRazorpayInstance();
                const rzpRefund = await rzp.payments.refund(payment.razorpay_payment_id, {
                    amount: Math.round(refundAmount * 100),
                    notes: {
                        reason: reason || 'Customer requested refund',
                        order_id: String(payment.order_id)
                    }
                });
                if (rzpRefund && rzpRefund.id) {
                    rzpRefundId = rzpRefund.id;
                }
            } catch (rzpErr) {
                console.error('Razorpay refund API error:', rzpErr);
                throw new Error(`Razorpay Refund API error: ${rzpErr.error ? rzpErr.error.description : rzpErr.message}`);
            }
        }

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Record Refund in payment_refunds
            const [refundResult] = await connection.execute(`
                INSERT INTO payment_refunds (payment_id, order_id, user_id, dispute_id, amount, reason, status, razorpay_refund_id, idempotency_key, processed_at)
                VALUES (?, ?, ?, ?, ?, ?, 'REFUND_COMPLETED', ?, ?, CURRENT_TIMESTAMP)
            `, [payment.id, payment.order_id, payment.user_id, disputeId, refundAmount, reason, rzpRefundId, idempotencyKey || null]);

            const refundId = refundResult.insertId;

            // 2. Update Payment record
            const newTotalRefunded = alreadyRefunded + refundAmount;
            await connection.execute(`
                UPDATE payments 
                SET status = ?, refund_amount = ?, refunded_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [nextPaymentStatus, newTotalRefunded, payment.id]);

            // 3. Update Order status
            const newOrderStatus = isFullRefund ? 'refunded' : 'partially_refunded';
            await connection.execute(
                'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newOrderStatus, payment.order_id]
            );

            // 4. Update Seller Payouts to REVERSED if full refund
            if (isFullRefund) {
                await connection.execute(
                    "UPDATE seller_payouts SET payout_status = 'REVERSED' WHERE order_id = ?",
                    [payment.order_id]
                );
            }

            // 5. Append Refund entry to Financial Ledger (DEBIT)
            const refundTxId = `TX_RFND_${refundId}_${Date.now().toString().slice(-6)}`;
            await connection.execute(`
                INSERT INTO financial_ledger (transaction_id, order_id, payment_id, user_id, transaction_type, amount, currency, direction, status, metadata)
                VALUES (?, ?, ?, ?, 'REFUND', ?, 'INR', 'DEBIT', 'COMPLETED', ?)
            `, [refundTxId, payment.order_id, payment.id, payment.user_id, refundAmount, JSON.stringify({ refundId, reason, disputeId })]);

            await connection.commit();

            // 6. Notify Buyer
            socket.sendNotification(payment.user_id, {
                type: 'REFUND_COMPLETED',
                message: `Refund of ₹${refundAmount} has been processed for Order #${payment.order_id}.`,
                reference_id: payment.order_id
            });

            // 7. Audit Log
            await AuditService.log(actorId, 'PAYMENT_REFUNDED', 'PAYMENT', payment.id, {
                refundId, orderId: payment.order_id, amount: refundAmount, isFullRefund
            }, req);

            const responseData = {
                success: true,
                refundId,
                paymentId: payment.id,
                orderId: payment.order_id,
                refundAmount,
                totalRefunded: newTotalRefunded,
                status: nextPaymentStatus
            };

            if (idempotencyKey) {
                await this.saveIdempotentResponse(idempotencyKey, actorId, '/api/payments/refund', payloadForIdempotency, 200, responseData);
            }

            return responseData;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // User Payment History Querying
    // -------------------------------------------------------------
    static async getUserPaymentHistory(userId, limit = 20, offset = 0) {
        const lim = parseInt(limit, 10) || 20;
        const off = parseInt(offset, 10) || 0;

        const [rows] = await pool.execute(`
            SELECT p.id, p.order_id, p.amount, p.currency, p.status, p.method, 
                   p.refund_amount, p.payment_date, p.created_at, p.captured_at, p.refunded_at,
                   o.invoice_number, o.status as order_status,
                   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = p.order_id) as item_count
            FROM payments p
            JOIN orders o ON p.order_id = o.id
            WHERE p.user_id = ? OR o.buyer_id = ?
            ORDER BY p.created_at DESC
            LIMIT ${lim} OFFSET ${off}
        `, [userId, userId]);

        return rows;
    }
}

module.exports = PaymentService;
