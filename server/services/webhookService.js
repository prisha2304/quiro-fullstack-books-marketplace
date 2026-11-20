const crypto = require('crypto');
const { pool } = require('../config/db');
const logger = require('./logger');
const metricsService = require('./metricsService');
const { withTransaction } = require('../utils/dbTransaction');

class WebhookService {
    verifySignature(payload, signature, secret) {
        if (!signature || !secret) return false;
        try {
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
                .digest('hex');

            const sigBuf = Buffer.from(signature, 'utf8');
            const expBuf = Buffer.from(expectedSignature, 'utf8');
            if (sigBuf.length !== expBuf.length) return false;
            return crypto.timingSafeEqual(sigBuf, expBuf);
        } catch (e) {
            logger.warn('Webhook signature check exception:', e.message);
            return false;
        }
    }

    async processPaymentWebhook({ 
        eventId, 
        eventType, 
        payload, 
        signature = null, 
        secret = (process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET) 
    }) {
        if (!eventId || !eventType) {
            throw new Error('Event ID and Event Type are required');
        }

        // 1. Replay and Idempotency Protection Check
        const [existing] = await pool.execute(
            'SELECT * FROM payment_webhook_events WHERE event_id = ?',
            [eventId]
        );

        if (existing.length > 0) {
            const row = existing[0];
            if (row.status === 'PROCESSED') {
                logger.info(`Webhook event ${eventId} already processed. Ignoring duplicate.`, { eventId, eventType });
                return { status: 'IGNORED_DUPLICATE', eventId, eventType };
            }
        } else {
            await pool.execute(
                `INSERT INTO payment_webhook_events (event_id, event_type, status, payload)
                 VALUES (?, ?, 'RECEIVED', ?)`,
                [eventId, eventType, JSON.stringify(payload || {})]
            );
        }

        // 2. Signature verification: mandatory when secret is configured or in production
        if (secret) {
            if (!signature) {
                await pool.execute(
                    `UPDATE payment_webhook_events SET status = 'FAILED', error_reason = 'Missing webhook signature' WHERE event_id = ?`,
                    [eventId]
                );
                metricsService.recordWebhookFailure('MISSING_SIGNATURE');
                throw new Error('Webhook signature missing in request header');
            }

            const isValid = this.verifySignature(payload, signature, secret);
            if (!isValid) {
                await pool.execute(
                    `UPDATE payment_webhook_events SET status = 'FAILED', error_reason = 'Invalid signature' WHERE event_id = ?`,
                    [eventId]
                );
                metricsService.recordWebhookFailure('INVALID_SIGNATURE');
                throw new Error('Webhook signature verification failed');
            }
            await pool.execute(
                `UPDATE payment_webhook_events SET status = 'VERIFIED' WHERE event_id = ?`,
                [eventId]
            );
        } else if (process.env.NODE_ENV === 'production') {
            throw new Error('Webhook secret is not configured in production environment');
        }

        // 3. Process inside explicit database transaction
        return await withTransaction(async (conn) => {
            await conn.execute(
                `UPDATE payment_webhook_events SET status = 'PROCESSING' WHERE event_id = ?`,
                [eventId]
            );

            // Extract relevant identifiers from nested Razorpay structures
            const paymentEntity = payload?.payload?.payment?.entity || payload?.payment?.entity || payload?.payment;
            const orderEntity = payload?.payload?.order?.entity || payload?.order?.entity || payload?.order;
            const refundEntity = payload?.payload?.refund?.entity || payload?.refund?.entity || payload?.refund;

            const razorpayPaymentId = paymentEntity?.id || refundEntity?.payment_id || payload?.paymentId;
            const razorpayOrderId = orderEntity?.id || paymentEntity?.order_id || payload?.orderId;
            const razorpayRefundId = refundEntity?.id || payload?.refundId;

            // Handle Specific Razorpay Event Types
            switch (eventType) {
                case 'payment.authorized': {
                    if (razorpayPaymentId) {
                        await conn.execute(
                            `UPDATE payments 
                             SET status = 'AUTHORIZED', razorpay_payment_id = ?, updated_at = NOW() 
                             WHERE (razorpay_order_id = ? OR razorpay_payment_id = ?) AND status != 'CAPTURED'`,
                            [razorpayPaymentId, razorpayOrderId || '', razorpayPaymentId]
                        );
                    }
                    break;
                }

                case 'payment.captured':
                case 'order.paid': {
                    // Update Payment to CAPTURED
                    if (razorpayPaymentId || razorpayOrderId) {
                        await conn.execute(
                            `UPDATE payments 
                             SET status = 'CAPTURED', 
                                 razorpay_payment_id = COALESCE(?, razorpay_payment_id),
                                 captured_at = NOW(), 
                                 payment_date = COALESCE(payment_date, NOW()),
                                 updated_at = NOW() 
                             WHERE razorpay_payment_id = ? OR razorpay_order_id = ?`,
                            [razorpayPaymentId, razorpayPaymentId || '', razorpayOrderId || '']
                        );

                        // Find internal order ID and mark confirmed
                        const [payRows] = await conn.execute(
                            `SELECT order_id FROM payments WHERE razorpay_payment_id = ? OR razorpay_order_id = ? LIMIT 1`,
                            [razorpayPaymentId || '', razorpayOrderId || '']
                        );
                        if (payRows.length > 0) {
                            const internalOrderId = payRows[0].order_id;
                            await conn.execute(
                                `UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = ? AND status = 'pending'`,
                                [internalOrderId]
                            );
                            // Mark reserved books as sold
                            await conn.execute(`
                                UPDATE books SET status = 'sold' 
                                WHERE id IN (SELECT book_id FROM order_items WHERE order_id = ?)
                            `, [internalOrderId]);
                        }
                    }
                    break;
                }

                case 'payment.failed': {
                    const failureReason = paymentEntity?.error_description || payload?.reason || 'Payment failed';
                    if (razorpayPaymentId || razorpayOrderId) {
                        await conn.execute(
                            `UPDATE payments 
                             SET status = 'FAILED', failure_reason = ?, updated_at = NOW() 
                             WHERE razorpay_payment_id = ? OR razorpay_order_id = ?`,
                            [failureReason, razorpayPaymentId || '', razorpayOrderId || '']
                        );

                        // Release any inventory reservations
                        const [payRows] = await conn.execute(
                            `SELECT order_id FROM payments WHERE razorpay_payment_id = ? OR razorpay_order_id = ? LIMIT 1`,
                            [razorpayPaymentId || '', razorpayOrderId || '']
                        );
                        if (payRows.length > 0) {
                            await conn.execute(
                                `UPDATE inventory_reservations SET status = 'RELEASED' WHERE order_id = ? AND status = 'RESERVED'`,
                                [payRows[0].order_id]
                            );
                        }
                    }
                    break;
                }

                case 'refund.created': {
                    if (refundEntity) {
                        const amountInRupees = refundEntity.amount ? (parseFloat(refundEntity.amount) / 100) : 0;
                        const [pRows] = await conn.execute(
                            `SELECT id, order_id, user_id FROM payments WHERE razorpay_payment_id = ? LIMIT 1`,
                            [razorpayPaymentId || '']
                        );
                        if (pRows.length > 0) {
                            const p = pRows[0];
                            // Check if already recorded
                            const [refRows] = await conn.execute(
                                `SELECT id FROM payment_refunds WHERE razorpay_refund_id = ?`,
                                [razorpayRefundId]
                            );
                            if (refRows.length === 0) {
                                await conn.execute(
                                    `INSERT INTO payment_refunds (payment_id, order_id, user_id, amount, reason, status, razorpay_refund_id)
                                     VALUES (?, ?, ?, ?, 'Razorpay Webhook Refund', 'REFUND_PROCESSING', ?)`,
                                    [p.id, p.order_id, p.user_id, amountInRupees, razorpayRefundId]
                                );
                            }
                        }
                    }
                    break;
                }

                case 'refund.processed': {
                    if (razorpayRefundId || razorpayPaymentId) {
                        const amountInRupees = refundEntity?.amount ? (parseFloat(refundEntity.amount) / 100) : null;
                        
                        // Update payment_refunds record
                        await conn.execute(
                            `UPDATE payment_refunds 
                             SET status = 'REFUND_COMPLETED', processed_at = NOW() 
                             WHERE razorpay_refund_id = ? OR payment_id IN (SELECT id FROM payments WHERE razorpay_payment_id = ?)`,
                            [razorpayRefundId || '', razorpayPaymentId || '']
                        );

                        // Update payment refund_amount and status
                        const [pRows] = await conn.execute(
                            `SELECT id, order_id, amount, refund_amount FROM payments WHERE razorpay_payment_id = ? LIMIT 1`,
                            [razorpayPaymentId || '']
                        );
                        if (pRows.length > 0) {
                            const p = pRows[0];
                            const currentRefunded = parseFloat(p.refund_amount || 0);
                            const additionalRefund = amountInRupees !== null ? amountInRupees : (parseFloat(p.amount) - currentRefunded);
                            const newTotalRefunded = currentRefunded + additionalRefund;
                            const isFull = Math.abs(newTotalRefunded - parseFloat(p.amount)) < 0.01;

                            await conn.execute(
                                `UPDATE payments 
                                 SET status = ?, refund_amount = ?, refunded_at = NOW(), updated_at = NOW() 
                                 WHERE id = ?`,
                                [isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED', newTotalRefunded, p.id]
                            );

                            await conn.execute(
                                `UPDATE orders 
                                 SET status = ?, updated_at = NOW() 
                                 WHERE id = ?`,
                                [isFull ? 'refunded' : 'partially_refunded', p.order_id]
                            );
                        }
                    }
                    break;
                }

                case 'refund.failed': {
                    if (razorpayRefundId) {
                        await conn.execute(
                            `UPDATE payment_refunds 
                             SET status = 'REFUND_FAILED' 
                             WHERE razorpay_refund_id = ?`,
                            [razorpayRefundId]
                        );
                    }
                    break;
                }

                default:
                    logger.info(`Webhook event type ${eventType} received and acknowledged.`, { eventId, eventType });
                    break;
            }

            await conn.execute(
                `UPDATE payment_webhook_events SET status = 'PROCESSED', processed_at = NOW() WHERE event_id = ?`,
                [eventId]
            );

            logger.info(`Webhook processed successfully: ${eventId} (${eventType})`, { eventId, eventType });

            return {
                status: 'PROCESSED',
                eventId,
                eventType,
                processedAt: new Date().toISOString()
            };
        });
    }

    async getWebhookEvents({ limit = 20 } = {}) {
        const [rows] = await pool.execute(
            `SELECT id, event_id, event_type, status, error_reason, processed_at, created_at
             FROM payment_webhook_events
             ORDER BY id DESC LIMIT ?`,
            [String(limit)]
        );
        return rows;
    }
}

module.exports = new WebhookService();
