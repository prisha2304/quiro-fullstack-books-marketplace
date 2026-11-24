const crypto = require('crypto');
const { pool } = require('../config/db');
const logger = require('./logger');
const metricsService = require('./metricsService');
const { withTransaction } = require('../utils/dbTransaction');
const Swap = require('../models/Swap');

class WebhookService {
    verifySignature(payload, signature, secret, rawBody = null) {
        if (!signature || !secret) return false;
        try {
            let dataToVerify;
            if (rawBody && Buffer.isBuffer(rawBody)) {
                dataToVerify = rawBody;
            } else if (rawBody && typeof rawBody === 'string') {
                dataToVerify = Buffer.from(rawBody, 'utf8');
            } else if (typeof payload === 'string') {
                dataToVerify = Buffer.from(payload, 'utf8');
            } else if (Buffer.isBuffer(payload)) {
                dataToVerify = payload;
            } else {
                // In production, signature verification without rawBody is prohibited
                if (process.env.NODE_ENV === 'production') {
                    logger.error('Webhook verification failed: rawBody buffer is required in production');
                    return false;
                }
                dataToVerify = Buffer.from(JSON.stringify(payload), 'utf8');
            }

            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(dataToVerify)
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

    getWebhookSecret(overrideSecret = null) {
        const isProduction = process.env.NODE_ENV === 'production';
        if (overrideSecret) {
            if (isProduction && process.env.RAZORPAY_KEY_SECRET && overrideSecret === process.env.RAZORPAY_KEY_SECRET && overrideSecret !== process.env.RAZORPAY_WEBHOOK_SECRET) {
                return null;
            }
            return overrideSecret;
        }
        if (isProduction) {
            return process.env.RAZORPAY_WEBHOOK_SECRET || null;
        }
        return process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || null;
    }

    async processPaymentWebhook({ 
        eventId, 
        eventType, 
        payload, 
        signature = null, 
        secret = null,
        rawBody = null
    }) {
        if (!eventId || !eventType) {
            const err = new Error('Event ID and Event Type are required');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            err.isOperational = true;
            throw err;
        }

        const isProduction = process.env.NODE_ENV === 'production';
        const effectiveSecret = this.getWebhookSecret(secret);

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
        if (effectiveSecret) {
            if (!signature) {
                await pool.execute(
                    `UPDATE payment_webhook_events SET status = 'FAILED', error_reason = 'Missing webhook signature' WHERE event_id = ?`,
                    [eventId]
                );
                metricsService.recordWebhookFailure('MISSING_SIGNATURE');
                const err = new Error('Webhook signature missing in request header');
                err.statusCode = 400;
                err.code = 'MISSING_SIGNATURE';
                err.isOperational = true;
                throw err;
            }

            const hasRawData = Boolean(
                (rawBody && (Buffer.isBuffer(rawBody) || typeof rawBody === 'string')) ||
                typeof payload === 'string' ||
                Buffer.isBuffer(payload)
            );
            if (isProduction && !hasRawData) {
                await pool.execute(
                    `UPDATE payment_webhook_events SET status = 'FAILED', error_reason = 'Missing raw request body in production' WHERE event_id = ?`,
                    [eventId]
                );
                metricsService.recordWebhookFailure('MISSING_RAW_BODY');
                const err = new Error('Webhook verification failed: raw request body is required in production');
                err.statusCode = 500;
                err.code = 'INTERNAL_ERROR';
                throw err;
            }

            const isValid = this.verifySignature(payload, signature, effectiveSecret, rawBody);
            if (!isValid) {
                await pool.execute(
                    `UPDATE payment_webhook_events SET status = 'FAILED', error_reason = 'Invalid signature' WHERE event_id = ?`,
                    [eventId]
                );
                metricsService.recordWebhookFailure('INVALID_SIGNATURE');
                const err = new Error('Webhook signature verification failed');
                err.statusCode = 401;
                err.code = 'INVALID_SIGNATURE';
                err.isOperational = true;
                throw err;
            }
            await pool.execute(
                `UPDATE payment_webhook_events SET status = 'VERIFIED' WHERE event_id = ?`,
                [eventId]
            );
        } else if (isProduction) {
            await pool.execute(
                `UPDATE payment_webhook_events SET status = 'FAILED', error_reason = 'Webhook secret not configured in production' WHERE event_id = ?`,
                [eventId]
            ).catch(() => {});
            metricsService.recordWebhookFailure('MISSING_WEBHOOK_SECRET');
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

                        // Step 8D: Also handle swap_payments — refund.created → REFUND_PENDING (never marks REFUNDED)
                        if (razorpayPaymentId && razorpayRefundId) {
                            const refundAmountRupees = refundEntity.amount ? parseFloat(refundEntity.amount) / 100 : null;
                            const [swapCheck] = await conn.execute(
                                'SELECT DISTINCT swap_id FROM swap_payments WHERE razorpay_payment_id = ? LIMIT 1',
                                [razorpayPaymentId]
                            );
                            if (swapCheck.length > 0) {
                                const swapId = swapCheck[0].swap_id;
                                const finalizeResult = await Swap.finalizeSwapPaymentRefund(conn, {
                                    swapId,
                                    razorpayPaymentId,
                                    razorpayRefundId,
                                    refundAmountRupees,
                                    currency: refundEntity.currency || 'INR',
                                    incomingStatus: 'created',
                                    actorLabel: 'WEBHOOK'
                                });
                                logger.info('[webhookService] refund.created handled for swap_payments', { swapId, finalizeResult });
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

                        // Step 8D: Also handle swap_payments — refund.processed → REFUNDED (books released if all done)
                        if (razorpayPaymentId && razorpayRefundId) {
                            const refundAmountRupees = refundEntity?.amount ? parseFloat(refundEntity.amount) / 100 : null;
                            const [swapCheck] = await conn.execute(
                                'SELECT DISTINCT swap_id FROM swap_payments WHERE razorpay_payment_id = ? LIMIT 1',
                                [razorpayPaymentId]
                            );
                            if (swapCheck.length > 0) {
                                const swapId = swapCheck[0].swap_id;
                                const finalizeResult = await Swap.finalizeSwapPaymentRefund(conn, {
                                    swapId,
                                    razorpayPaymentId,
                                    razorpayRefundId,
                                    refundAmountRupees,
                                    currency: refundEntity?.currency || 'INR',
                                    incomingStatus: 'processed',
                                    actorLabel: 'WEBHOOK'
                                });
                                logger.info('[webhookService] refund.processed handled for swap_payments', { swapId, finalizeResult });
                            }
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

                        // Step 8D: Also handle swap_payments — refund.failed → REFUND_FAILED (books NEVER released)
                        if (razorpayPaymentId) {
                            const refundAmountRupees = refundEntity?.amount ? parseFloat(refundEntity.amount) / 100 : null;
                            const [swapCheck] = await conn.execute(
                                'SELECT DISTINCT swap_id FROM swap_payments WHERE razorpay_payment_id = ? LIMIT 1',
                                [razorpayPaymentId]
                            );
                            if (swapCheck.length > 0) {
                                const swapId = swapCheck[0].swap_id;
                                const finalizeResult = await Swap.finalizeSwapPaymentRefund(conn, {
                                    swapId,
                                    razorpayPaymentId,
                                    razorpayRefundId,
                                    refundAmountRupees,
                                    currency: refundEntity?.currency || 'INR',
                                    incomingStatus: 'failed',
                                    actorLabel: 'WEBHOOK'
                                });
                                logger.info('[webhookService] refund.failed handled for swap_payments', { swapId, finalizeResult });
                            }
                        }
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
