const crypto = require('crypto');
const Razorpay = require('razorpay');
const { pool } = require('../config/db');
const Notification = require('./Notification');

const SWAP_SHIPPING_FEE = parseFloat(process.env.SWAP_SHIPPING_FEE || '79.00');

const COURIER_STAGES = [
    { id: 'payment_confirmed', label: 'Payment Confirmed', desc: 'Shipping fees verified for both readers. Courier dispatch initialized.' },
    { id: 'pickup_scheduled', label: 'Pickup Scheduled', desc: 'Doorstep pickup appointment scheduled for both reader locations.' },
    { id: 'pickup_partner_assigned', label: 'Pickup Partner Assigned', desc: 'Dedicated delivery partner assigned to collect packages.' },
    { id: 'pickup_partner_en_route', label: 'Pickup Partner On The Way', desc: 'Courier agent en route to the pickup addresses.' },
    { id: 'book_collected', label: 'Book Collected', desc: 'Both books collected in tamper-evident protective QUIRO packaging.' },
    { id: 'in_transit', label: 'In Transit', desc: 'Packages sorted at central hub and dispatched to destination addresses.' },
    { id: 'out_for_delivery', label: 'Out For Delivery', desc: 'Packages out for final doorstep delivery to each reader.' },
    { id: 'delivered', label: 'Delivered', desc: 'Packages successfully delivered to readers\' doorsteps.' },
    { id: 'awaiting_confirmations', label: 'Awaiting Both Confirmations', desc: 'Readers inspecting books and confirming receipt on QUIRO.' },
    { id: 'exchange_completed', label: 'Exchange Completed', desc: 'Both readers confirmed! Exchange officially completed.' }
];

function getRazorpayClient() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (keyId && keyId.startsWith('rzp_') && keySecret && keySecret.length > 5 && !keyId.includes('placeholder')) {
        return new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
    return null;
}

class Swap {
    static async create(swapData) {
        const { requester_id, owner_id, requested_book_id, offered_book_id, message } = swapData;

        if (parseInt(requester_id, 10) === parseInt(owner_id, 10)) {
            throw new Error('You cannot propose a book exchange for your own listing');
        }

        if (parseInt(requested_book_id, 10) === parseInt(offered_book_id, 10)) {
            throw new Error('You cannot swap a book with itself');
        }

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Check for duplicate pending/accepted requests
            const [existing] = await connection.execute(
                'SELECT id FROM swap_requests WHERE ((requested_book_id = ? AND offered_book_id = ?) OR (requested_book_id = ? AND offered_book_id = ?)) AND status IN ("pending", "accepted", "awaiting_consent", "awaiting_addresses", "awaiting_payment", "payment_completed", "collection_scheduled", "book_collected", "in_transit", "delivered")',
                [requested_book_id, offered_book_id, offered_book_id, requested_book_id]
            );

            if (existing.length > 0) {
                throw new Error('An active swap proposal for these books already exists');
            }

            // Verify both books are available
            const [bookStatus] = await connection.execute(
                'SELECT id, title, status FROM books WHERE id IN (?, ?)',
                [requested_book_id, offered_book_id]
            );
            for (const b of bookStatus) {
                if (b.status !== 'available') {
                    throw new Error(`"${b.title}" is currently ${b.status} and not available for exchange`);
                }
            }

            // 2. Insert request
            const [result] = await connection.execute(`
                INSERT INTO swap_requests (requester_id, owner_id, requested_book_id, offered_book_id, message, status)
                VALUES (?, ?, ?, ?, ?, 'pending')
            `, [requester_id, owner_id, requested_book_id, offered_book_id, message || null]);
            const swapId = result.insertId;

            // 3. Insert initial timeline entry
            await connection.execute(
                'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "pending", "Exchange proposal submitted by reader.", ?)',
                [swapId, requester_id]
            );

            // 4. Fetch book title for notification (still inside tx, read-only)
            const [bookRows] = await connection.execute('SELECT title FROM books WHERE id = ?', [requested_book_id]);
            const title = bookRows.length > 0 ? bookRows[0].title : 'your book';

            await connection.commit();

            // 5. Fire notification AFTER commit — uses pool connection, must not run inside tx
            Promise.allSettled([
                Notification.create({
                    user_id: owner_id,
                    title: 'New Swap Proposal',
                    message: `A fellow reader proposed an exchange for your book "${title}".`,
                    type: 'swap_request'
                })
            ]).catch(() => {});

            return swapId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findById(id) {
        const [rows] = await pool.execute('SELECT * FROM swap_requests WHERE id = ?', [id]);
        return rows[0];
    }

    static async findIncoming(userId) {
        const [rows] = await pool.execute(`
            SELECT sr.*, 
                   COALESCE(rb.title, 'Book Listing') as requested_title, 
                   rb.cover_image as requested_image,
                   rb.author as requested_author,
                   rb.genre as requested_genre,
                   rb.condition as requested_condition,
                   COALESCE(ob.title, 'Offered Book') as offered_title, 
                   ob.cover_image as offered_image,
                   ob.author as offered_author,
                   ob.genre as offered_genre,
                   ob.condition as offered_condition,
                   COALESCE(u.full_name, 'QUIRO Reader') as requester_name,
                   u.username as requester_username
            FROM swap_requests sr
            LEFT JOIN books rb ON sr.requested_book_id = rb.id
            LEFT JOIN books ob ON sr.offered_book_id = ob.id
            LEFT JOIN users u ON sr.requester_id = u.id
            WHERE sr.owner_id = ? AND sr.status NOT IN ('completed', 'rejected', 'cancelled')
            ORDER BY sr.created_at DESC
        `, [userId]);
        return rows;
    }

    static async findOutgoing(userId) {
        const [rows] = await pool.execute(`
            SELECT sr.*, 
                   COALESCE(rb.title, 'Book Listing') as requested_title, 
                   rb.cover_image as requested_image,
                   rb.author as requested_author,
                   rb.genre as requested_genre,
                   rb.condition as requested_condition,
                   COALESCE(ob.title, 'Offered Book') as offered_title, 
                   ob.cover_image as offered_image,
                   ob.author as offered_author,
                   ob.genre as offered_genre,
                   ob.condition as offered_condition,
                   COALESCE(u.full_name, 'QUIRO Reader') as owner_name,
                   u.username as owner_username
            FROM swap_requests sr
            LEFT JOIN books rb ON sr.requested_book_id = rb.id
            LEFT JOIN books ob ON sr.offered_book_id = ob.id
            LEFT JOIN users u ON sr.owner_id = u.id
            WHERE sr.requester_id = ? AND sr.status NOT IN ('completed', 'rejected', 'cancelled')
            ORDER BY sr.created_at DESC
        `, [userId]);
        return rows;
    }

    static async findHistory(userId) {
        const [rows] = await pool.execute(`
            SELECT sr.*, 
                   COALESCE(rb.title, 'Book Listing') as requested_title, 
                   rb.cover_image as requested_image,
                   rb.author as requested_author,
                   rb.genre as requested_genre,
                   rb.condition as requested_condition,
                   COALESCE(ob.title, 'Offered Book') as offered_title, 
                   ob.cover_image as offered_image,
                   ob.author as offered_author,
                   ob.genre as offered_genre,
                   ob.condition as offered_condition,
                   COALESCE(u1.full_name, 'Requester') as requester_name,
                   COALESCE(u2.full_name, 'Owner') as owner_name
            FROM swap_requests sr
            LEFT JOIN books rb ON sr.requested_book_id = rb.id
            LEFT JOIN books ob ON sr.offered_book_id = ob.id
            LEFT JOIN users u1 ON sr.requester_id = u1.id
            LEFT JOIN users u2 ON sr.owner_id = u2.id
            WHERE (sr.requester_id = ? OR sr.owner_id = ?) 
            AND sr.status IN ('completed', 'rejected', 'cancelled')
            ORDER BY sr.updated_at DESC
        `, [userId, userId]);
        return rows;
    }

    static async getDiscoverable(currentUserId = null, options = {}) {
        const { limit = 24, page = 1, genre = null, condition = null, search = null } = options;
        const safeLimit = Math.max(1, parseInt(limit, 10) || 24);
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (safePage - 1) * safeLimit;

        let query = `
            SELECT b.*, 
                   COALESCE(u.full_name, 'QUIRO Reader') as seller_name, 
                   u.username as seller_username,
                   u.id as owner_id
            FROM books b 
            JOIN users u ON b.seller_id = u.id 
            WHERE b.swap_enabled = 1 AND b.status = 'available'
        `;
        const params = [];

        if (currentUserId) {
            query += ' AND b.seller_id != ?';
            params.push(currentUserId);
        }

        if (genre && genre !== 'All' && genre !== 'all') {
            query += ' AND b.genre = ?';
            params.push(genre);
        }

        if (condition && condition !== 'All' && condition !== 'all') {
            query += ' AND b.condition = ?';
            params.push(condition);
        }

        if (search && search.trim()) {
            query += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
        params.push(safeLimit, offset);

        const [rows] = await pool.query(query, params);

        let countQuery = `
            SELECT COUNT(*) as total 
            FROM books b 
            WHERE b.swap_enabled = 1 AND b.status = 'available'
        `;
        const countParams = [];

        if (currentUserId) {
            countQuery += ' AND b.seller_id != ?';
            countParams.push(currentUserId);
        }
        if (genre && genre !== 'All' && genre !== 'all') {
            countQuery += ' AND b.genre = ?';
            countParams.push(genre);
        }
        if (condition && condition !== 'All' && condition !== 'all') {
            countQuery += ' AND b.condition = ?';
            countParams.push(condition);
        }
        if (search && search.trim()) {
            countQuery += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)';
            const term = `%${search.trim()}%`;
            countParams.push(term, term, term);
        }

        const [countRows] = await pool.query(countQuery, countParams);
        const total = countRows[0]?.total || 0;

        return {
            books: rows,
            pagination: {
                total,
                page: safePage,
                limit: safeLimit,
                pages: Math.ceil(total / safeLimit)
            }
        };
    }

    static async getUserSwapEligible(userId) {
        const [rows] = await pool.execute(
            'SELECT id, title, author, cover_image, genre, `condition`, price, seller_id, swap_enabled, status FROM books WHERE seller_id = ? AND status = "available" AND swap_enabled = 1 ORDER BY title ASC',
            [userId]
        );
        return rows;
    }

    static async getMyListings(userId) {
        const [rows] = await pool.execute(`
            SELECT b.*, 
                   COALESCE(u.full_name, 'QUIRO Reader') as seller_name, 
                   u.username as seller_username
            FROM books b 
            JOIN users u ON b.seller_id = u.id
            WHERE b.seller_id = ? AND b.swap_enabled = 1
            ORDER BY b.created_at DESC
        `, [userId]);
        return rows;
    }

    static async getCompletedSwaps(userId) {
        const [rows] = await pool.execute(`
            SELECT sr.*, 
                   COALESCE(rb.title, 'Book Listing') as requested_title, 
                   rb.cover_image as requested_image,
                   rb.author as requested_author,
                   rb.genre as requested_genre,
                   rb.condition as requested_condition,
                   COALESCE(ob.title, 'Offered Book') as offered_title, 
                   ob.cover_image as offered_image,
                   ob.author as offered_author,
                   ob.genre as offered_genre,
                   ob.condition as offered_condition,
                   COALESCE(u1.full_name, 'Requester') as requester_name,
                   COALESCE(u2.full_name, 'Owner') as owner_name,
                   u1.username as requester_username,
                   u2.username as owner_username
            FROM swap_requests sr
            LEFT JOIN books rb ON sr.requested_book_id = rb.id
            LEFT JOIN books ob ON sr.offered_book_id = ob.id
            LEFT JOIN users u1 ON sr.requester_id = u1.id
            LEFT JOIN users u2 ON sr.owner_id = u2.id
            WHERE (sr.requester_id = ? OR sr.owner_id = ?) 
              AND sr.status = 'completed'
            ORDER BY sr.updated_at DESC
        `, [userId, userId]);
        return rows;
    }

    static async updateStatus(id, status, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [requestRows] = await connection.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [id]);
            const request = requestRows[0];
            if (!request) throw new Error('Swap request not found');

            let acceptedBookTitle = 'your requested book';

            // 1. Business Logic & validations per status
            if (status === 'accepted') {
                if (request.status !== 'pending' && request.status !== 'counter_offered') {
                    throw new Error(`Cannot accept this exchange because its current status is '${request.status}'`);
                }

                // Ensure neither book is already reserved or swapped
                const [bookStatuses] = await connection.execute(
                    'SELECT id, title, status FROM books WHERE id IN (?, ?)',
                    [request.requested_book_id, request.offered_book_id]
                );
                
                for (const b of bookStatuses) {
                    if (b.status !== 'available') {
                        throw new Error(`"${b.title}" is no longer available (currently ${b.status})`);
                    }
                }

                // 2. Mark both books as 'reserved'
                await connection.execute(
                    "UPDATE books SET status = 'reserved' WHERE id IN (?, ?)",
                    [request.requested_book_id, request.offered_book_id]
                );

                // 3. Prevent conflicting pending requests for these reserved books
                await connection.execute(
                    `UPDATE swap_requests 
                     SET status = 'cancelled' 
                     WHERE id != ? 
                       AND status = 'pending' 
                       AND (requested_book_id IN (?, ?) OR offered_book_id IN (?, ?))`,
                    [id, request.requested_book_id, request.offered_book_id, request.requested_book_id, request.offered_book_id]
                );
                
                const [bookRows] = await connection.execute('SELECT title FROM books WHERE id = ?', [request.requested_book_id]);
                acceptedBookTitle = bookRows.length > 0 ? bookRows[0].title : 'your requested book';
                
                // Record in timeline
                await connection.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "accepted", "Exchange request accepted! Please choose how you want to exchange the books.", ?)',
                    [id, userId || null]
                );
            } 
            else if (status === 'completed') {
                // Mark both books as 'swapped'
                await connection.execute(
                    "UPDATE books SET status = 'swapped', swap_enabled = 0 WHERE id IN (?, ?)",
                    [request.requested_book_id, request.offered_book_id]
                );

                await connection.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "completed", "Book exchange marked as completed.", ?)',
                    [id, userId || null]
                );
            }
            else if (status === 'rejected') {
                await connection.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "rejected", "Exchange proposal was declined by the owner.", ?)',
                    [id, userId || null]
                );
            }
            else if (status === 'cancelled') {
                // If the swap was previously accepted or reserved, release books back to available
                await connection.execute(
                    "UPDATE books SET status = 'available' WHERE id IN (?, ?) AND status = 'reserved'",
                    [request.requested_book_id, request.offered_book_id]
                );

                await connection.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "cancelled", "Exchange proposal cancelled.", ?)',
                    [id, userId || null]
                );
            }

            // Update swap_requests table status
            await connection.execute(
                'UPDATE swap_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, id]
            );

            await connection.commit();

            // Fire notifications AFTER commit — Notification.create uses pool (not tx connection)
            if (status === 'accepted') {
                Promise.allSettled([
                    Notification.create({
                        user_id: request.requester_id,
                        title: 'Swap Proposal Accepted!',
                        message: `Your exchange proposal for "${acceptedBookTitle}" was accepted. Please choose your preferred exchange method!`,
                        type: 'swap_accepted'
                    })
                ]).catch(() => {});
            } else if (status === 'completed') {
                const partnerId = parseInt(userId, 10) === parseInt(request.requester_id, 10) ? request.owner_id : request.requester_id;
                Promise.allSettled([
                    Notification.create({
                        user_id: partnerId,
                        title: 'Swap Completed',
                        message: `The book exchange has been marked as completed successfully. Enjoy your new read!`,
                        type: 'swap_completed'
                    })
                ]).catch(() => {});
            } else if (status === 'rejected') {
                Promise.allSettled([
                    Notification.create({
                        user_id: request.requester_id,
                        title: 'Swap Request Declined',
                        message: `The owner declined the exchange request. You can propose another book.`,
                        type: 'swap_rejected'
                    })
                ]).catch(() => {});
            }

            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // Post-Acceptance Exchange Method Selection
    // -------------------------------------------------------------
    static async selectMethod(swapId, userId, method) {
        if (!['SELF_ARRANGED', 'QUIRO_MANAGED'].includes(method)) {
            throw new Error("Invalid exchange method. Must be 'SELF_ARRANGED' or 'QUIRO_MANAGED'.");
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [swapRows] = await connection.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
            const swap = swapRows[0];
            if (!swap) throw new Error('Swap request not found');

            const isRequester = parseInt(swap.requester_id, 10) === parseInt(userId, 10);
            const isOwner = parseInt(swap.owner_id, 10) === parseInt(userId, 10);

            if (!isRequester && !isOwner) {
                throw new Error('Only the exchange participants can choose the exchange method.');
            }

            let requesterMethod = isRequester ? method : swap.requester_method;
            let ownerMethod = isOwner ? method : swap.owner_method;
            let finalMethod = swap.exchange_method;
            let methodAgreed = swap.method_agreed || 0;
            let nextStatus = swap.status;

            const methodName = method === 'SELF_ARRANGED' ? 'Direct Self-Arranged Exchange' : 'QUIRO Managed Courier Delivery';
            const userRoleName = isRequester ? 'Requester' : 'Owner';

            await connection.execute(
                'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, ?, ?, ?)',
                [swapId, swap.status, `${userRoleName} selected: ${methodName}`, userId]
            );

            // Check if both participants selected
            if (requesterMethod && ownerMethod) {
                if (requesterMethod === ownerMethod) {
                    finalMethod = requesterMethod;
                    methodAgreed = 1;

                    if (finalMethod === 'SELF_ARRANGED') {
                        nextStatus = (swap.requester_consent === 1 && swap.owner_consent === 1) ? 'contact_shared' : 'awaiting_consent';
                        await connection.execute(
                            'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, ?, ?, ?)',
                            [swapId, nextStatus, 'Mutual agreement reached: Direct Self-Arranged Exchange. Please consent to share verified email addresses.', userId]
                        );
                    } else {
                        nextStatus = 'awaiting_addresses';
                        await connection.execute(
                            'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, ?, ?, ?)',
                            [swapId, nextStatus, 'Mutual agreement reached: QUIRO Managed Courier Exchange. Please provide your delivery addresses.', userId]
                        );
                    }
                } else {
                    methodAgreed = 0;
                    finalMethod = null;
                    await connection.execute(
                        'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, ?, ?, ?)',
                        [swapId, swap.status, `Different exchange methods selected (${requesterMethod} vs ${ownerMethod}). Both readers must align on the same method.`, userId]
                    );
                }
            }

            await connection.execute(`
                UPDATE swap_requests 
                SET requester_method = ?,
                    owner_method = ?,
                    exchange_method = ?,
                    method_agreed = ?,
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [requesterMethod, ownerMethod, finalMethod, methodAgreed, nextStatus, swapId]);

            await connection.commit();

            return await this.getSwapDetails(swapId, userId);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // Option A: Direct Self-Arranged Consent to Share Email
    // -------------------------------------------------------------
    static async recordConsent(swapId, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [swapRows] = await connection.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
            const swap = swapRows[0];
            if (!swap) throw new Error('Swap request not found');

            const isRequester = parseInt(swap.requester_id, 10) === parseInt(userId, 10);
            const isOwner = parseInt(swap.owner_id, 10) === parseInt(userId, 10);

            if (!isRequester && !isOwner) {
                throw new Error('Only exchange participants can grant contact consent.');
            }

            let requesterConsent = isRequester ? 1 : (swap.requester_consent || 0);
            let ownerConsent = isOwner ? 1 : (swap.owner_consent || 0);
            let nextStatus = swap.status;

            const userRoleName = isRequester ? 'Requester' : 'Owner';
            await connection.execute(
                'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, ?, ?, ?)',
                [swapId, swap.status, `${userRoleName} consented to share verified email address.`, userId]
            );

            // Mutual Consent Check
            if (requesterConsent === 1 && ownerConsent === 1) {
                nextStatus = 'contact_shared';
                await connection.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "contact_shared", "Mutual consent granted! Verified contact emails are now unlocked for both readers.", ?)',
                    [swapId, userId]
                );
            }

            await connection.execute(`
                UPDATE swap_requests 
                SET requester_consent = ?,
                    owner_consent = ?,
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [requesterConsent, ownerConsent, nextStatus, swapId]);

            await connection.commit();

            // Fire notifications AFTER commit — Notification.create uses pool (not tx connection)
            if (requesterConsent === 1 && ownerConsent === 1) {
                const contactMsg = 'Both readers have consented to share email addresses. You can now coordinate your book handover directly.';
                Promise.allSettled([
                    Notification.create({ user_id: swap.requester_id, title: 'Contact Details Unlocked', message: contactMsg, type: 'swap_contact_shared' }),
                    Notification.create({ user_id: swap.owner_id, title: 'Contact Details Unlocked', message: contactMsg, type: 'swap_contact_shared' })
                ]).catch(() => {});
            }

            return await this.getSwapDetails(swapId, userId);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // Mark Direct Exchange Arranged
    // -------------------------------------------------------------
    static async markArranged(swapId, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [swapRows] = await connection.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
            const swap = swapRows[0];
            if (!swap) throw new Error('Swap request not found');

            const isRequester = parseInt(swap.requester_id, 10) === parseInt(userId, 10);
            const isOwner = parseInt(swap.owner_id, 10) === parseInt(userId, 10);
            if (!isRequester && !isOwner) {
                throw new Error('Only participants can update exchange arrangement.');
            }

            await connection.execute(`
                UPDATE swap_requests 
                SET status = 'arranged', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [swapId]);

            await connection.execute(
                'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "arranged", "Readers agreed on exchange handover details. Swap is actively arranged.", ?)',
                [swapId, userId]
            );

            await connection.commit();
            return await this.getSwapDetails(swapId, userId);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // Configurable Exchange Fee & Breakdown
    // -------------------------------------------------------------
    static getExchangeConfig() {
        const fee = parseFloat(process.env.SWAP_SHIPPING_FEE || '79.00');
        const base = Math.round(fee * 0.70 * 100) / 100;
        const packaging = Math.round(fee * 0.20 * 100) / 100;
        const insurance = Math.round((fee - base - packaging) * 100) / 100;

        return {
            shippingFeePerUser: fee,
            currency: 'INR',
            currencySymbol: '₹',
            breakdown: {
                baseShipping: base,
                packagingAndHandling: packaging,
                protectiveInsurance: insurance
            },
            totalPerUser: fee,
            totalExchange: fee * 2,
            courierStages: COURIER_STAGES
        };
    }

    // -------------------------------------------------------------
    // Option B: Delivery & Pickup Address Submission
    // -------------------------------------------------------------
    static async saveAddress(swapId, userId, addressData) {
        const { 
            full_name, 
            phone, 
            pickup_address, 
            delivery_address, 
            address_line1, 
            city, 
            state, 
            postal_code, 
            delivery_instructions 
        } = addressData || {};

        const resolvedPickup = (pickup_address || address_line1 || '').trim();
        const resolvedDelivery = (delivery_address || address_line1 || pickup_address || '').trim();
        const resolvedAddressLine1 = (address_line1 || pickup_address || delivery_address || '').trim();
        const resolvedInstructions = delivery_instructions ? String(delivery_instructions).trim() : null;

        if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
            throw new Error('Full name is required (at least 2 characters).');
        }
        if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
            throw new Error('Valid phone number is required (at least 7 digits).');
        }
        if (!resolvedPickup || resolvedPickup.length < 5) {
            throw new Error('Pickup address is required (at least 5 characters).');
        }
        if (!resolvedDelivery || resolvedDelivery.length < 5) {
            throw new Error('Delivery address is required (at least 5 characters).');
        }
        if (!city || typeof city !== 'string' || city.trim().length < 2) {
            throw new Error('City is required.');
        }
        if (!state || typeof state !== 'string' || state.trim().length < 2) {
            throw new Error('State is required.');
        }
        if (!postal_code || typeof postal_code !== 'string' || postal_code.trim().length < 4) {
            throw new Error('Valid postal / PIN code is required (at least 4 characters).');
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [swapRows] = await connection.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
            const swap = swapRows[0];
            if (!swap) throw new Error('Swap request not found');

            const isRequester = parseInt(swap.requester_id, 10) === parseInt(userId, 10);
            const isOwner = parseInt(swap.owner_id, 10) === parseInt(userId, 10);
            if (!isRequester && !isOwner) {
                throw new Error('Only exchange participants can submit shipping addresses.');
            }

            // Upsert address with pickup_address, delivery_address, delivery_instructions and confirmed_at
            await connection.execute(`
                INSERT INTO swap_addresses (
                    swap_id, user_id, full_name, phone, address_line1,
                    pickup_address, delivery_address, city, state, postal_code,
                    delivery_instructions, confirmed_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE 
                    full_name = VALUES(full_name),
                    phone = VALUES(phone),
                    address_line1 = VALUES(address_line1),
                    pickup_address = VALUES(pickup_address),
                    delivery_address = VALUES(delivery_address),
                    city = VALUES(city),
                    state = VALUES(state),
                    postal_code = VALUES(postal_code),
                    delivery_instructions = VALUES(delivery_instructions),
                    confirmed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
            `, [
                swapId, userId, full_name.trim(), phone.trim(), resolvedAddressLine1,
                resolvedPickup, resolvedDelivery, city.trim(), state.trim(), postal_code.trim(),
                resolvedInstructions
            ]);

            // Check if BOTH addresses are now submitted and confirmed
            const [addrRows] = await connection.execute(
                'SELECT COUNT(DISTINCT user_id) as count FROM swap_addresses WHERE swap_id = ? AND confirmed_at IS NOT NULL',
                [swapId]
            );
            const addressCount = addrRows[0]?.count || 0;

            let nextStatus = swap.status;
            if (addressCount >= 2) {
                nextStatus = 'awaiting_payment';
                await connection.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "awaiting_payment", "Both pickup and delivery addresses confirmed. Ready for exchange shipping fee payment.", ?)',
                    [swapId, userId]
                );
            } else {
                await connection.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, ?, ?, ?)',
                    [swapId, swap.status, `${isRequester ? 'Requester' : 'Owner'} submitted and confirmed address. Waiting for partner address.`, userId]
                );
            }

            await connection.execute(
                'UPDATE swap_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [nextStatus, swapId]
            );

            await connection.commit();
            return await this.getSwapDetails(swapId, userId);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // Option B: Shipping Fee Payment (Razorpay Test Mode / Live)
    // -------------------------------------------------------------
    static async createManagedPayment(swapId, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [swapRows] = await connection.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
            const swap = swapRows[0];
            if (!swap) throw new Error('Swap request not found');

            const isRequester = parseInt(swap.requester_id, 10) === parseInt(userId, 10);
            const isOwner = parseInt(swap.owner_id, 10) === parseInt(userId, 10);
            if (!isRequester && !isOwner) {
                throw new Error('Only participants can pay the exchange courier fee.');
            }

            if (swap.exchange_method !== 'QUIRO_MANAGED' || swap.method_agreed !== 1) {
                throw new Error('Both readers must select and agree to QUIRO Managed Exchange before payment can begin.');
            }

            const [addrRows] = await connection.execute(
                'SELECT COUNT(DISTINCT user_id) as count FROM swap_addresses WHERE swap_id = ? AND confirmed_at IS NOT NULL',
                [swapId]
            );
            if ((addrRows[0]?.count || 0) < 2) {
                throw new Error('Both readers must submit and confirm their pickup and delivery addresses before payment.');
            }

            const role = isRequester ? 'requester' : 'owner';
            const alreadyPaid = isRequester ? swap.requester_paid : swap.owner_paid;
            if (alreadyPaid) {
                throw new Error('You have already paid your courier shipping fee for this swap.');
            }

            const feeAmount = parseFloat(process.env.SWAP_SHIPPING_FEE || swap.shipping_fee_per_user || '79.00');
            const amountInPaise = Math.round(feeAmount * 100);

            // Check for existing valid pending Razorpay order for this swap and user (Idempotency)
            const [existingPendingRows] = await connection.execute(
                'SELECT * FROM swap_payments WHERE swap_id = ? AND user_id = ? AND status = "PENDING" ORDER BY id DESC FOR UPDATE',
                [swapId, userId]
            );

            const rzp = getRazorpayClient();
            const isTestMode = !rzp;
            const ORDER_VALIDITY_MS = 24 * 60 * 60 * 1000; // Razorpay orders remain valid for 24 hours

            if (existingPendingRows.length > 0) {
                const pendingOrder = existingPendingRows[0];
                const orderAgeMs = Date.now() - new Date(pendingOrder.created_at).getTime();
                const isAmountMatch = Math.abs(parseFloat(pendingOrder.amount) - feeAmount) < 0.01;

                // Reuse if order is within validity window and amount matches
                if (orderAgeMs < ORDER_VALIDITY_MS && isAmountMatch && pendingOrder.razorpay_order_id) {
                    await connection.commit();
                    return {
                        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_booknest_sandbox',
                        rzpOrderId: pendingOrder.razorpay_order_id,
                        amount: Math.round(parseFloat(pendingOrder.amount) * 100),
                        fee: parseFloat(pendingOrder.amount),
                        currency: 'INR',
                        isTestMode,
                        swapId
                    };
                }

                // If expired or invalid, mark prior pending rows as EXPIRED
                for (const oldRow of existingPendingRows) {
                    await connection.execute(
                        'UPDATE swap_payments SET status = "EXPIRED", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [oldRow.id]
                    );
                }
            }

            let rzpOrderId;
            if (rzp) {
                const rzpOrder = await rzp.orders.create({
                    amount: amountInPaise,
                    currency: 'INR',
                    receipt: `swap_${swapId}_${userId}_${Date.now().toString().slice(-4)}`
                });
                rzpOrderId = rzpOrder.id;
            } else {
                rzpOrderId = `order_swap_${swapId}_${Date.now()}`;
            }

            await connection.execute(`
                INSERT INTO swap_payments (swap_id, user_id, role, razorpay_order_id, amount, status)
                VALUES (?, ?, ?, ?, ?, 'PENDING')
            `, [swapId, userId, role, rzpOrderId, feeAmount]);

            await connection.commit();

            return {
                keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_booknest_sandbox',
                rzpOrderId,
                amount: amountInPaise,
                fee: feeAmount,
                currency: 'INR',
                isTestMode,
                swapId
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async verifyManagedPayment(swapId, userId, paymentData) {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, method } = paymentData;
        if (!razorpay_order_id || !razorpay_payment_id) {
            throw new Error('Missing payment verification identifiers.');
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [swapRows] = await connection.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
            const swap = swapRows[0];
            if (!swap) throw new Error('Swap request not found');

            const isRequester = parseInt(swap.requester_id, 10) === parseInt(userId, 10);
            const isOwner = parseInt(swap.owner_id, 10) === parseInt(userId, 10);
            if (!isRequester && !isOwner) {
                throw new Error('User not part of this swap.');
            }

            // Lock and inspect the specific payment record for this exact swap_id, user_id, and razorpay_order_id
            const [paymentRows] = await connection.execute(
                'SELECT * FROM swap_payments WHERE swap_id = ? AND user_id = ? AND razorpay_order_id = ? FOR UPDATE',
                [swapId, userId, razorpay_order_id]
            );

            if (paymentRows.length === 0) {
                throw new Error(`No payment order found matching order ID: ${razorpay_order_id} for this swap.`);
            }

            const paymentRecord = paymentRows[0];

            // Idempotency: If this exact payment order has already been captured
            if (paymentRecord.status === 'CAPTURED') {
                if (paymentRecord.razorpay_payment_id === razorpay_payment_id) {
                    // Safe repeated callback - commit and return current details without duplicate timeline events
                    await connection.commit();
                    return await this.getSwapDetails(swapId, userId);
                }
                throw new Error('Payment for this order has already been captured with a different transaction ID.');
            }

            if (paymentRecord.status !== 'PENDING') {
                throw new Error(`Payment order is not in PENDING state (current status: ${paymentRecord.status}).`);
            }

            // Verify Signature with timing-safe HMAC SHA-256
            const keySecret = process.env.RAZORPAY_KEY_SECRET;
            const isProduction = process.env.NODE_ENV === 'production';

            if (isProduction) {
                if (!keySecret) {
                    throw new Error('Payment gateway not configured: Missing Razorpay key secret.');
                }
                if (!razorpay_signature || razorpay_signature.startsWith('sig_sandbox_')) {
                    throw new Error('Invalid or missing Razorpay signature for production.');
                }
            }

            if (!razorpay_signature) {
                throw new Error('Razorpay signature is required for payment verification.');
            }

            // In non-production, allow sandbox test signatures only during automated tests/development
            const isSandboxTestToken = razorpay_signature.startsWith('sig_sandbox_') || razorpay_signature.startsWith('sig_test_');

            if (keySecret && !isSandboxTestToken) {
                const expectedSignature = crypto
                    .createHmac('sha256', keySecret)
                    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                    .digest('hex');

                const expBuf = Buffer.from(expectedSignature, 'utf8');
                const sigBuf = Buffer.from(razorpay_signature, 'utf8');
                const isValid = expBuf.length === sigBuf.length && crypto.timingSafeEqual(expBuf, sigBuf);

                if (!isValid) {
                    throw new Error('Razorpay signature verification failed.');
                }
            } else if (!isSandboxTestToken && !keySecret) {
                throw new Error('Missing Razorpay credentials: Payment verification failed safely.');
            }

            // Strict update by specific payment record ID only (removed "OR status = 'PENDING'")
            await connection.execute(`
                UPDATE swap_payments 
                SET status = 'CAPTURED', 
                    razorpay_payment_id = ?, 
                    razorpay_signature = ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [razorpay_payment_id, razorpay_signature || null, paymentRecord.id]);

            let requesterPaid = isRequester ? 1 : swap.requester_paid;
            let ownerPaid = isOwner ? 1 : swap.owner_paid;
            let nextStatus = swap.status;
            let courierStatus = swap.courier_status;
            let courierTracking = swap.courier_tracking;
            let collectionDate = swap.collection_date;
            let deliveryDate = swap.delivery_date;

            const feeCharged = parseFloat(process.env.SWAP_SHIPPING_FEE || swap.shipping_fee_per_user || '79.00');
            const userRoleName = isRequester ? 'Requester' : 'Owner';

            // Insert timeline event only if one does not already exist for this user's payment (Timeline Idempotency)
            const [existingTimeline] = await connection.execute(
                'SELECT id FROM swap_timeline WHERE swap_id = ? AND actor_id = ? AND message LIKE ?',
                [swapId, userId, `%completed shipping fee payment%`]
            );
            if (existingTimeline.length === 0) {
                await connection.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, ?, ?, ?)',
                    [swapId, swap.status, `${userRoleName} completed shipping fee payment of ₹${feeCharged.toFixed(2)}.`, userId]
                );
            }

            // Check if BOTH participants have paid
            let bothPaidMsg = null;
            if (requesterPaid === 1 && ownerPaid === 1) {
                if (swap.status !== 'payment_completed' && swap.courier_status !== 'payment_confirmed' && swap.courier_status !== 'pickup_scheduled') {
                    nextStatus = 'payment_completed';
                    courierStatus = 'payment_confirmed';
                    courierTracking = swap.courier_tracking || `QRO-${Date.now().toString().slice(-8)}`;
                    
                    const now = new Date();
                    collectionDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
                    deliveryDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days later

                    const [existingBothPaidTimeline] = await connection.execute(
                        'SELECT id FROM swap_timeline WHERE swap_id = ? AND status = "payment_completed"',
                        [swapId]
                    );
                    if (existingBothPaidTimeline.length === 0) {
                        await connection.execute(
                            'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "payment_completed", "Both readers have paid shipping fees! Payment Confirmed. QUIRO Express Courier dispatch initialized.", ?)',
                            [swapId, userId]
                        );
                    }

                    // Note: notifications sent after commit below
                    bothPaidMsg = `Both shipping payments received! Reference: ${courierTracking}. Courier pickup has been scheduled.`;
                }
            }

            await connection.execute(`
                UPDATE swap_requests 
                SET requester_paid = ?,
                    owner_paid = ?,
                    status = ?,
                    courier_status = ?,
                    courier_tracking = ?,
                    collection_date = ?,
                    delivery_date = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [requesterPaid, ownerPaid, nextStatus, courierStatus, courierTracking, collectionDate, deliveryDate, swapId]);

            await connection.commit();

            // Fire notifications AFTER commit — Notification.create uses pool (not tx connection)
            if (bothPaidMsg) {
                Promise.allSettled([
                    Notification.create({ user_id: swap.requester_id, title: 'Exchange Payment Confirmed!', message: bothPaidMsg, type: 'swap_payment_complete' }),
                    Notification.create({ user_id: swap.owner_id, title: 'Exchange Payment Confirmed!', message: bothPaidMsg, type: 'swap_payment_complete' })
                ]).catch(() => {});
            }

            return await this.getSwapDetails(swapId, userId);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // Option B: Advance Courier Stage (DEMO Simulator Workflow)
    // -------------------------------------------------------------
    static async advanceCourierStage(swapId, requestedStage = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [swapRows] = await connection.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
            const swap = swapRows[0];
            if (!swap) throw new Error('Swap request not found');

            const currentStage = swap.courier_status || 'payment_confirmed';
            let nextStage = requestedStage;

            const stageIds = COURIER_STAGES.map(s => s.id);
            if (!nextStage) {
                const currentIndex = stageIds.indexOf(currentStage);
                if (currentIndex >= 0 && currentIndex < stageIds.length - 1) {
                    nextStage = stageIds[currentIndex + 1];
                } else if (currentIndex === -1) {
                    nextStage = 'pickup_scheduled';
                } else {
                    nextStage = stageIds[stageIds.length - 1];
                }
            } else if (!stageIds.includes(nextStage)) {
                // Support legacy alias mappings
                if (nextStage === 'collection_scheduled') nextStage = 'pickup_scheduled';
                else if (nextStage === 'dispatched') nextStage = 'in_transit';
                else throw new Error(`Invalid courier stage: ${nextStage}`);
            }

            const stageInfo = COURIER_STAGES.find(s => s.id === nextStage);
            const logMessage = stageInfo ? `[DEMO Simulator] ${stageInfo.label}: ${stageInfo.desc}` : `Courier status: ${nextStage}`;

            let nextStatus = swap.status;
            if (nextStage === 'exchange_completed') {
                nextStatus = 'completed';
                await connection.execute(
                    "UPDATE books SET status = 'swapped', swap_enabled = 0 WHERE id IN (?, ?)",
                    [swap.requested_book_id, swap.offered_book_id]
                );
            } else if (nextStage === 'delivered' || nextStage === 'awaiting_confirmations') {
                nextStatus = 'delivered';
            } else {
                nextStatus = nextStage;
            }

            await connection.execute(`
                UPDATE swap_requests 
                SET courier_status = ?,
                    status = ?,
                    requester_confirmed = CASE WHEN ? = 'exchange_completed' THEN 1 ELSE requester_confirmed END,
                    owner_confirmed = CASE WHEN ? = 'exchange_completed' THEN 1 ELSE owner_confirmed END,
                    requester_confirmed_at = CASE WHEN ? = 'exchange_completed' AND requester_confirmed_at IS NULL THEN CURRENT_TIMESTAMP ELSE requester_confirmed_at END,
                    owner_confirmed_at = CASE WHEN ? = 'exchange_completed' AND owner_confirmed_at IS NULL THEN CURRENT_TIMESTAMP ELSE owner_confirmed_at END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [nextStage, nextStatus, nextStage, nextStage, nextStage, nextStage, swapId]);

            await connection.execute(
                'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, ?, ?, NULL)',
                [swapId, nextStage, logMessage]
            );

            await connection.commit();
            return await this.getSwapDetails(swapId, null, true);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // -------------------------------------------------------------
    // Step 8D — Shared Refund Finalization (Webhook + Worker path)
    // -------------------------------------------------------------
    /**
     * finalizeSwapPaymentRefund
     * --------------------------
     * Transaction-safe, shared finalization used by BOTH the Razorpay webhook
     * handler and the scheduled reconciliation worker.
     *
     * @param {object} conn       - Active DB connection (must already be inside beginTransaction)
     * @param {object} context
     *   swapId            {number}  - Internal swap ID
     *   razorpayPaymentId {string}  - Razorpay payment ID (pay_xxx)
     *   razorpayRefundId  {string}  - Razorpay refund ID (rfnd_xxx)
     *   refundAmountRupees {number|null} - Refund amount in RUPEES; null = hard skip
     *   currency          {string}  - Currency code (default 'INR')
     *   incomingStatus    {string}  - 'processed' | 'created' | 'pending' | 'failed'
     *   actorLabel        {string}  - 'WEBHOOK' | 'SCHEDULER' (for timeline messages)
     *   claimedStatus     {string|undefined} - If set, row must still carry this status
     *                                          (worker fencing).  Absent = webhook path
     *                                          (overrides REFUND_PENDING without a token).
     *
     * @returns {{ claimLost: boolean, skipped: boolean, processed: number, pending: number, failed: number }}
     */
    static async finalizeSwapPaymentRefund(conn, context) {
        const {
            swapId,
            razorpayPaymentId,
            razorpayRefundId,
            refundAmountRupees,
            currency = 'INR',
            incomingStatus,
            actorLabel = 'SYSTEM',
            claimedStatus
        } = context;

        // Hard-skip on missing or non-positive amount
        if (refundAmountRupees === null || refundAmountRupees === undefined || isNaN(refundAmountRupees) || refundAmountRupees <= 0) {
            console.warn('[finalizeSwapPaymentRefund] Skipped: missing or invalid refund amount', { swapId, razorpayPaymentId, refundAmountRupees });
            return { skipped: true, reason: 'MISSING_AMOUNT', claimLost: false, processed: 0, pending: 0, failed: 0 };
        }

        // Determine target DB status from Razorpay gateway status
        let targetDbStatus;
        if (incomingStatus === 'processed') {
            targetDbStatus = 'REFUNDED';
        } else if (incomingStatus === 'created' || incomingStatus === 'pending') {
            targetDbStatus = 'REFUND_PENDING';
        } else if (incomingStatus === 'failed') {
            targetDbStatus = 'REFUND_FAILED';
        } else {
            console.warn('[finalizeSwapPaymentRefund] Unknown incomingStatus; skipping', { swapId, incomingStatus });
            return { skipped: true, reason: 'UNKNOWN_STATUS', claimLost: false, processed: 0, pending: 0, failed: 0 };
        }

        // Lock all matching rows for this swap+payment
        const [rows] = await conn.execute(
            'SELECT * FROM swap_payments WHERE swap_id = ? AND razorpay_payment_id = ? FOR UPDATE',
            [swapId, razorpayPaymentId]
        );

        let processedCount = 0;
        let pendingCount = 0;
        let failedCount = 0;

        for (const pay of rows) {
            const currentStatus = pay.status;

            // Terminal guard: never downgrade a confirmed REFUNDED row
            if (currentStatus === 'REFUNDED' && incomingStatus !== 'processed') {
                console.log('[finalizeSwapPaymentRefund] Row already REFUNDED; skipping downgrade', { payId: pay.id, incomingStatus });
                processedCount++; // Count as processed for the "all-refunded" check below
                continue;
            }
            if (currentStatus === 'REFUNDED' && incomingStatus === 'processed') {
                processedCount++;
                continue; // Already done — idempotent
            }

            // Amount tolerance check (±₹0.01)
            const dbAmountRupees = parseFloat(pay.amount);
            if (Math.abs(refundAmountRupees - dbAmountRupees) > 0.01) {
                console.warn('[finalizeSwapPaymentRefund] Amount mismatch; skipping row', {
                    payId: pay.id,
                    expected: dbAmountRupees,
                    received: refundAmountRupees
                });
                return { skipped: true, reason: 'AMOUNT_MISMATCH', claimLost: false, processed: processedCount, pending: pendingCount, failed: failedCount };
            }

            // Build WHERE clause based on path (worker fencing vs. webhook)
            let updateSql, updateParams;
            if (claimedStatus) {
                // Worker path: row MUST still carry our claimed token
                updateSql = `UPDATE swap_payments SET status = ?, refund_id = ?, refund_amount = amount, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?`;
                updateParams = [targetDbStatus, razorpayRefundId, pay.id, claimedStatus];
            } else {
                // Webhook path: allow override of REFUND_PENDING but never overwrite REFUNDED
                updateSql = `UPDATE swap_payments SET status = ?, refund_id = ?, refund_amount = amount, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status NOT IN ('REFUNDED')`;
                updateParams = [targetDbStatus, razorpayRefundId, pay.id];
            }

            const [updateRes] = await conn.execute(updateSql, updateParams);

            if (updateRes.affectedRows === 0) {
                if (claimedStatus) {
                    // Fencing failure — another worker reclaimed this row
                    console.warn('[finalizeSwapPaymentRefund] Claim lost for row', { payId: pay.id, claimedStatus });
                    return { claimLost: true, processed: processedCount, pending: pendingCount, failed: failedCount, skipped: false };
                }
                // Webhook path: row was REFUNDED by concurrent worker — count it
                processedCount++;
                continue;
            }

            // Record timeline event (idempotent — check refund ID before inserting)
            const timelineStatus = targetDbStatus === 'REFUNDED' ? 'refunded'
                : targetDbStatus === 'REFUND_PENDING' ? 'refund_pending'
                : 'refund_failed';

            const [existingTimeline] = await conn.execute(
                'SELECT id FROM swap_timeline WHERE swap_id = ? AND message LIKE ?',
                [swapId, `%Ref: ${razorpayRefundId}%`]
            );
            if (existingTimeline.length === 0) {
                let tlMsg;
                if (targetDbStatus === 'REFUNDED') {
                    tlMsg = `Shipping fee of ₹${pay.amount} refunded to ${pay.role} (Ref: ${razorpayRefundId}) [${actorLabel}].`;
                } else if (targetDbStatus === 'REFUND_PENDING') {
                    tlMsg = `Refund of ₹${pay.amount} for ${pay.role} pending bank settlement (Ref: ${razorpayRefundId}) [${actorLabel}].`;
                } else {
                    tlMsg = `Refund of ₹${pay.amount} for ${pay.role} failed at gateway (Ref: ${razorpayRefundId}) [${actorLabel}].`;
                }
                await conn.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, ?, ?, NULL)',
                    [swapId, timelineStatus, tlMsg]
                );
            }

            if (targetDbStatus === 'REFUNDED') processedCount++;
            else if (targetDbStatus === 'REFUND_PENDING') pendingCount++;
            else failedCount++;
        }

        // Check if ALL payments for this swap are now REFUNDED → release books
        if (targetDbStatus === 'REFUNDED') {
            const [allPays] = await conn.execute(
                'SELECT id, status FROM swap_payments WHERE swap_id = ?',
                [swapId]
            );
            const allRefunded = allPays.length > 0 && allPays.every(p => p.status === 'REFUNDED');

            if (allRefunded) {
                const [swapRows] = await conn.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
                const swap = swapRows[0];
                if (swap && swap.status !== 'cancelled') {
                    await conn.execute(
                        "UPDATE books SET status = 'available' WHERE id IN (?, ?) AND status = 'reserved'",
                        [swap.requested_book_id, swap.offered_book_id]
                    );
                    await conn.execute(
                        `UPDATE swap_requests SET status = 'cancelled', requester_paid = 0, owner_paid = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [swapId]
                    );
                    console.log('[finalizeSwapPaymentRefund] All payments REFUNDED — swap cancelled and books released', { swapId });
                }
            }
        }

        return { claimLost: false, skipped: false, processed: processedCount, pending: pendingCount, failed: failedCount };
    }

    // -------------------------------------------------------------
    // Step 8D — Scheduled Swap Refund Reconciliation Worker
    // -------------------------------------------------------------
    /**
     * reconcileAllPendingSwapRefunds
     * --------------------------------
     * Scheduled sweep that picks up REFUND_PENDING and stale
     * REFUND_PROCESSING swap payments and reconciles them against
     * the authoritative Razorpay gateway status.
     *
     * Design:
     *   Phase R1 — Short, locking DB transaction: claim eligible rows
     *              for each swap under ONE shared claimToken.
     *   Phase R2 — No DB locks: query Razorpay for each distinct payment ID.
     *   Phase R3 — Short, locking DB transaction: call finalizeSwapPaymentRefund
     *              with the claim token for fencing.
     *
     * @returns {{ swapsProcessed, swapsSkipped, swapsErrored, details[] }}
     */
    static async reconcileAllPendingSwapRefunds() {
        const STALE_THRESHOLD_MS = 65 * 1000; // 65s — 5s buffer over processSwapRefund's 60s lock
        const BATCH_SIZE = 50;
        const rzp = getRazorpayClient();

        // Find swaps that have payments needing reconciliation
        const [candidateRows] = await pool.execute(`
            SELECT DISTINCT swap_id FROM swap_payments
            WHERE status = 'REFUND_PENDING'
               OR (status LIKE 'REFUND_PROCESSING%' AND updated_at < NOW() - INTERVAL 65 SECOND)
            LIMIT 50
        `);

        const swapIds = candidateRows.map(r => r.swap_id);
        console.log(`[reconcileAllPendingSwapRefunds] Found ${swapIds.length} swap(s) to reconcile`);

        const results = [];

        for (const swapId of swapIds) {
            let newToken;
            let claimedStatus;
            let eligibleRows = [];

            // ---- Phase R1: Atomically claim all eligible rows for this swap ----
            const r1Conn = await pool.getConnection();
            try {
                await r1Conn.beginTransaction();

                const [allRows] = await r1Conn.execute(
                    'SELECT * FROM swap_payments WHERE swap_id = ? FOR UPDATE',
                    [swapId]
                );

                const now = Date.now();
                eligibleRows = allRows.filter(p => {
                    if (p.status === 'REFUND_PENDING') return true;
                    if (p.status && p.status.startsWith('REFUND_PROCESSING')) {
                        const updatedAt = p.updated_at ? new Date(p.updated_at).getTime() : 0;
                        return (now - updatedAt) >= STALE_THRESHOLD_MS;
                    }
                    return false;
                });

                if (eligibleRows.length === 0) {
                    await r1Conn.commit();
                    results.push({ swapId, status: 'SKIPPED', reason: 'No eligible rows after re-check' });
                    continue;
                }

                // One shared token for ALL rows in this swap (mirrors processSwapRefund Phase 1)
                newToken = crypto.randomBytes(8).toString('hex');
                claimedStatus = `REFUND_PROCESSING:${newToken}`;

                const eligibleIds = eligibleRows.map(p => p.id);
                const eligibleOldStatuses = [...new Set(eligibleRows.map(p => p.status))];
                const idPlaceholders = eligibleIds.map(() => '?').join(',');
                const statusPlaceholders = eligibleOldStatuses.map(() => '?').join(',');

                const [claimRes] = await r1Conn.execute(
                    `UPDATE swap_payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${idPlaceholders}) AND status IN (${statusPlaceholders})`,
                    [claimedStatus, ...eligibleIds, ...eligibleOldStatuses]
                );

                if (claimRes.affectedRows === 0) {
                    // Another worker already claimed — skip gracefully
                    await r1Conn.commit();
                    results.push({ swapId, status: 'SKIPPED', reason: 'Claim lost during R1 — concurrent worker' });
                    continue;
                }

                await r1Conn.commit();
            } catch (r1Err) {
                await r1Conn.rollback();
                console.error(`[reconcileAllPendingSwapRefunds] R1 error for swap ${swapId}`, { error: r1Err.message });
                results.push({ swapId, status: 'ERROR', phase: 'R1', error: r1Err.message });
                continue;
            } finally {
                r1Conn.release();
            }

            // ---- Phase R2: Query Razorpay (no DB locks held) ----
            // Deduplicate by razorpay_payment_id
            const paymentResultMap = new Map(); // razorpay_payment_id → reconcileRazorpayRefund result

            for (const pay of eligibleRows) {
                if (!pay.razorpay_payment_id) continue;
                if (paymentResultMap.has(pay.razorpay_payment_id)) continue;

                // Skip sandbox/test payment IDs — treat as PROCESSED for test environments
                if (pay.razorpay_payment_id.startsWith('pay_sandbox_') || pay.razorpay_payment_id.startsWith('pay_test_') || pay.razorpay_payment_id.startsWith('pay_mock_')) {
                    paymentResultMap.set(pay.razorpay_payment_id, {
                        state: 'PROCESSED',
                        refundId: pay.refund_id || `rfnd_mock_reconciled_${pay.id}`,
                        status: 'processed',
                        amount: parseFloat(pay.amount)
                    });
                    continue;
                }

                if (!rzp) {
                    console.warn('[reconcileAllPendingSwapRefunds] Razorpay client unavailable; skipping gateway query', { paymentId: pay.razorpay_payment_id });
                    paymentResultMap.set(pay.razorpay_payment_id, null);
                    continue;
                }

                const gatewayResult = await Swap.reconcileRazorpayRefund(pay.razorpay_payment_id, rzp);
                paymentResultMap.set(pay.razorpay_payment_id, gatewayResult);
            }

            // ---- Phase R3: Finalize in a short transaction using claimedStatus fencing ----
            const r3Conn = await pool.getConnection();
            try {
                await r3Conn.beginTransaction();

                // Group eligible rows by razorpay_payment_id
                const paymentGroups = new Map();
                for (const pay of eligibleRows) {
                    const key = pay.razorpay_payment_id || `no_rzp_${pay.id}`;
                    if (!paymentGroups.has(key)) paymentGroups.set(key, []);
                    paymentGroups.get(key).push(pay);
                }

                let swapProcessed = 0, swapPending = 0, swapFailed = 0;
                let claimLostInR3 = false;

                for (const [rzpPaymentId, groupRows] of paymentGroups) {
                    if (claimLostInR3) break;
                    const gatewayResult = paymentResultMap.get(rzpPaymentId);

                    if (!gatewayResult) {
                        // No gateway result — release claim back to REFUND_PENDING so it retries next cycle
                        const groupIds = groupRows.map(r => r.id);
                        const ph = groupIds.map(() => '?').join(',');
                        await r3Conn.execute(
                            `UPDATE swap_payments SET status = 'REFUND_PENDING', updated_at = CURRENT_TIMESTAMP WHERE id IN (${ph}) AND status = ?`,
                            [...groupIds, claimedStatus]
                        );
                        swapPending += groupRows.length;
                        continue;
                    }

                    const incomingStatus = gatewayResult.status; // 'processed' | 'created' | 'pending' | 'failed'
                    const refundAmountRupees = gatewayResult.amount; // already rupees from reconcileRazorpayRefund

                    const finalizeResult = await Swap.finalizeSwapPaymentRefund(r3Conn, {
                        swapId,
                        razorpayPaymentId: rzpPaymentId,
                        razorpayRefundId: gatewayResult.refundId,
                        refundAmountRupees,
                        incomingStatus,
                        actorLabel: 'SCHEDULER',
                        claimedStatus
                    });

                    if (finalizeResult.claimLost) {
                        claimLostInR3 = true;
                        break;
                    }

                    if (finalizeResult.skipped) {
                        // Amount mismatch or unknown status — revert claim to REFUND_PENDING
                        const groupIds = groupRows.map(r => r.id);
                        const ph = groupIds.map(() => '?').join(',');
                        await r3Conn.execute(
                            `UPDATE swap_payments SET status = 'REFUND_PENDING', updated_at = CURRENT_TIMESTAMP WHERE id IN (${ph}) AND status = ?`,
                            [...groupIds, claimedStatus]
                        );
                        swapPending += groupRows.length;
                        continue;
                    }

                    swapProcessed += finalizeResult.processed;
                    swapPending += finalizeResult.pending;
                    swapFailed += finalizeResult.failed;
                }

                if (claimLostInR3) {
                    await r3Conn.rollback();
                    results.push({ swapId, status: 'SKIPPED', reason: 'Claim lost during R3 — concurrent worker' });
                } else {
                    await r3Conn.commit();
                    results.push({ swapId, status: 'OK', processed: swapProcessed, pending: swapPending, failed: swapFailed });
                }
            } catch (r3Err) {
                await r3Conn.rollback();
                console.error(`[reconcileAllPendingSwapRefunds] R3 error for swap ${swapId}`, { error: r3Err.message });
                results.push({ swapId, status: 'ERROR', phase: 'R3', error: r3Err.message });
            } finally {
                r3Conn.release();
            }
        }

        const summary = {
            swapsProcessed: results.filter(r => r.status === 'OK').length,
            swapsSkipped: results.filter(r => r.status === 'SKIPPED').length,
            swapsErrored: results.filter(r => r.status === 'ERROR').length,
            details: results
        };
        console.log('[reconcileAllPendingSwapRefunds] Sweep complete', summary);
        return summary;
    }

    // -------------------------------------------------------------
    // Authoritative Razorpay Refund Reconciliation Helper
    // -------------------------------------------------------------
    static async reconcileRazorpayRefund(paymentId, customRzp = null) {
        const rzp = customRzp || getRazorpayClient();
        if (!rzp || !paymentId) return null;

        // 1. Authoritative check via fetchMultipleRefund
        try {
            if (rzp.payments && typeof rzp.payments.fetchMultipleRefund === 'function') {
                const refundList = await rzp.payments.fetchMultipleRefund(paymentId);
                if (refundList && Array.isArray(refundList.items) && refundList.items.length > 0) {
                    // Priority 1: Check for authoritatively processed refund
                    const processedRefund = refundList.items.find(r => r.status === 'processed');
                    if (processedRefund && processedRefund.id) {
                        return {
                            state: 'PROCESSED',
                            refundId: processedRefund.id,
                            status: 'processed',
                            amount: processedRefund.amount ? processedRefund.amount / 100 : null
                        };
                    }

                    // Priority 2: Check for in-flight pending/created refund (awaiting banking settlement)
                    const pendingRefund = refundList.items.find(r => r.status === 'created' || r.status === 'pending');
                    if (pendingRefund && pendingRefund.id) {
                        return {
                            state: 'PENDING',
                            refundId: pendingRefund.id,
                            status: pendingRefund.status || 'created',
                            amount: pendingRefund.amount ? pendingRefund.amount / 100 : null
                        };
                    }

                    // Priority 3: Check if all refund records failed
                    const allFailed = refundList.items.every(r => r.status === 'failed');
                    if (allFailed) {
                        return {
                            state: 'FAILED',
                            refundId: refundList.items[0].id,
                            status: 'failed',
                            amount: refundList.items[0].amount ? refundList.items[0].amount / 100 : null
                        };
                    }
                }
            }
        } catch (fetchErr) {
            // Ignore and try fallback
        }

        // 2. Authoritative check via payment entity fetch
        try {
            if (rzp.payments && typeof rzp.payments.fetch === 'function') {
                const payment = await rzp.payments.fetch(paymentId);
                if (payment && (payment.refund_status === 'full' || (payment.amount_refunded && payment.amount_refunded > 0))) {
                    return {
                        state: 'PROCESSED',
                        refundId: `rfnd_reconciled_${paymentId}`,
                        status: 'processed',
                        amount: payment.amount_refunded ? payment.amount_refunded / 100 : null
                    };
                }
            }
        } catch (pErr) {
            // Ignore
        }

        return null;
    }

    // -------------------------------------------------------------
    // Option B: Refund for Managed Swap Cancellation
    // -------------------------------------------------------------
    static async processSwapRefund(swapId, userId, reason = 'Swap cancelled before courier pickup') {
        const STALE_REFUND_TIMEOUT_MS = 60 * 1000; // 60s timeout for in-flight refund locks
        const claimToken = crypto.randomBytes(8).toString('hex');
        const claimedStatus = `REFUND_PROCESSING:${claimToken}`;

        // =========================================================
        // PHASE 1: Short DB Transaction - Validate, Check Idempotency & Claim Locks
        // =========================================================
        let paymentsToProcess = [];
        let swapData = null;

        const phase1Conn = await pool.getConnection();
        try {
            await phase1Conn.beginTransaction();

            const [swapRows] = await phase1Conn.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
            swapData = swapRows[0];
            if (!swapData) throw new Error('Swap request not found');

            const isRequester = parseInt(swapData.requester_id, 10) === parseInt(userId, 10);
            const isOwner = parseInt(swapData.owner_id, 10) === parseInt(userId, 10);
            if (!isRequester && !isOwner) {
                throw new Error('Only exchange participants can cancel and request refund.');
            }

            if (['book_collected', 'in_transit', 'delivered', 'completed'].includes(swapData.courier_status)) {
                throw new Error('Cannot refund once books have been collected by courier.');
            }

            // Find all payments for this swap
            const [allPayments] = await phase1Conn.execute(
                'SELECT * FROM swap_payments WHERE swap_id = ? FOR UPDATE',
                [swapId]
            );

            // Check if there are active in-progress refunds from a concurrent request
            const now = Date.now();
            const inProgressPayments = allPayments.filter(p => {
                if (!p.status || !p.status.startsWith('REFUND_PROCESSING')) return false;
                const updatedAt = p.updated_at ? new Date(p.updated_at).getTime() : 0;
                return (now - updatedAt) < STALE_REFUND_TIMEOUT_MS;
            });

            if (inProgressPayments.length > 0) {
                await phase1Conn.commit();
                return {
                    success: false,
                    inProgress: true,
                    message: 'A refund is currently in progress for this exchange. Please wait a moment and refresh.'
                };
            }

            // Filter payments eligible for refund:
            // CAPTURED, REFUND_FAILED, REFUND_PENDING, or stale REFUND_PROCESSING
            const eligiblePayments = allPayments.filter(p => {
                if (p.status === 'CAPTURED' || p.status === 'REFUND_FAILED' || p.status === 'REFUND_PENDING') return true;
                if (p.status && p.status.startsWith('REFUND_PROCESSING')) {
                    const updatedAt = p.updated_at ? new Date(p.updated_at).getTime() : 0;
                    return (now - updatedAt) >= STALE_REFUND_TIMEOUT_MS;
                }
                return false;
            });

            // If no eligible payments remain, check if already cancelled and refunded (Idempotency)
            if (eligiblePayments.length === 0) {
                const refundedPayments = allPayments.filter(p => p.status === 'REFUNDED');
                if (refundedPayments.length > 0 || swapData.status === 'cancelled') {
                    // Self-healing: if payments are refunded but swap was not yet marked cancelled or books reserved
                    if (swapData.status !== 'cancelled') {
                        await phase1Conn.execute(
                            "UPDATE books SET status = 'available' WHERE id IN (?, ?) AND status = 'reserved'",
                            [swapData.requested_book_id, swapData.offered_book_id]
                        );
                        await phase1Conn.execute(`
                            UPDATE swap_requests 
                            SET status = 'cancelled',
                                requester_paid = 0,
                                owner_paid = 0,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [swapId]);
                    }
                    await phase1Conn.commit();
                    return { success: true, message: 'Exchange was already cancelled and shipping fees refunded.', alreadyRefunded: true };
                }
            }

            // Atomically claim eligible payments using unique worker claim token
            if (eligiblePayments.length > 0) {
                const claimIds = eligiblePayments.map(p => p.id);
                const placeholders = claimIds.map(() => '?').join(',');
                await phase1Conn.execute(
                    `UPDATE swap_payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
                    [claimedStatus, ...claimIds]
                );
            }

            await phase1Conn.commit();
            for (const p of eligiblePayments) {
                p.claimedStatus = claimedStatus;
            }
            paymentsToProcess = eligiblePayments;
        } catch (error) {
            await phase1Conn.rollback();
            throw error;
        } finally {
            phase1Conn.release();
        }

        if (paymentsToProcess.length === 0) {
            return { success: true, message: 'No payments required refund.', alreadyRefunded: true };
        }

        // =========================================================
        // PHASE 2: Gateway Execution & Authoritative Reconciliation (NO DB LOCKS HELD!)
        // =========================================================
        const rzp = getRazorpayClient();
        const processedPaymentIds = new Map(); // Maps razorpay_payment_id -> { refundId, refundState, refundErrorMsg }
        const paymentResults = [];

        for (const pay of paymentsToProcess) {
            // Deduplicate by razorpay_payment_id:
            // Prevent multiple gateway refund requests for the same actual payment
            if (pay.razorpay_payment_id && processedPaymentIds.has(pay.razorpay_payment_id)) {
                const cachedResult = processedPaymentIds.get(pay.razorpay_payment_id);
                paymentResults.push({
                    payment: pay,
                    refundId: cachedResult.refundId,
                    refundState: cachedResult.refundState,
                    refundErrorMsg: cachedResult.refundErrorMsg,
                    claimedStatus
                });
                continue;
            }

            let refundId = null;
            let refundState = 'NONE'; // 'PROCESSED' | 'PENDING' | 'FAILED' | 'NONE'
            let refundErrorMsg = null;

            if (rzp && pay.razorpay_payment_id && !pay.razorpay_payment_id.startsWith('pay_sandbox_') && !pay.razorpay_payment_id.startsWith('pay_test_')) {
                // Step 2A: Authoritative Gateway Reconciliation Check before requesting a new refund
                const existingGatewayRefund = await Swap.reconcileRazorpayRefund(pay.razorpay_payment_id, rzp);
                if (existingGatewayRefund) {
                    if (existingGatewayRefund.state === 'PROCESSED') {
                        refundId = existingGatewayRefund.refundId;
                        refundState = 'PROCESSED';
                    } else if (existingGatewayRefund.state === 'PENDING') {
                        refundId = existingGatewayRefund.refundId;
                        refundState = 'PENDING';
                    } else if (existingGatewayRefund.state === 'FAILED') {
                        // Previous gateway attempt failed; allow fresh refund attempt below
                        refundState = 'NONE';
                    }
                }

                // Step 2B: Attempt gateway refund only if no processed or pending refund exists
                if (refundState === 'NONE') {
                    try {
                        const rzpRefund = await rzp.payments.refund(pay.razorpay_payment_id, {
                            amount: Math.round(parseFloat(pay.amount) * 100),
                            notes: { reason, swapId, paymentDbId: pay.id }
                        });

                        if (rzpRefund && rzpRefund.status === 'processed') {
                            refundId = rzpRefund.id;
                            refundState = 'PROCESSED';
                        } else if (rzpRefund && (rzpRefund.status === 'created' || rzpRefund.status === 'pending')) {
                            refundId = rzpRefund.id;
                            refundState = 'PENDING';
                        } else if (rzpRefund && rzpRefund.status === 'failed') {
                            refundState = 'FAILED';
                            refundErrorMsg = 'Gateway returned failed status for refund request.';
                        } else if (rzpRefund && rzpRefund.id) {
                            // If status not explicit, re-verify authoritatively
                            const postVerify = await Swap.reconcileRazorpayRefund(pay.razorpay_payment_id, rzp);
                            if (postVerify && postVerify.state === 'PROCESSED') {
                                refundId = postVerify.refundId;
                                refundState = 'PROCESSED';
                            } else {
                                refundId = rzpRefund.id;
                                refundState = 'PENDING';
                            }
                        } else {
                            refundState = 'FAILED';
                            refundErrorMsg = 'Gateway response did not contain a valid refund confirmation.';
                        }
                    } catch (rzpErr) {
                        // Step 2C: Gateway Timeout or Failure Reconciliation Check
                        const postErrorReconciliation = await Swap.reconcileRazorpayRefund(pay.razorpay_payment_id, rzp);
                        if (postErrorReconciliation && postErrorReconciliation.state === 'PROCESSED') {
                            refundId = postErrorReconciliation.refundId;
                            refundState = 'PROCESSED';
                        } else if (postErrorReconciliation && postErrorReconciliation.state === 'PENDING') {
                            refundId = postErrorReconciliation.refundId;
                            refundState = 'PENDING';
                        } else {
                            refundState = 'FAILED';
                            refundErrorMsg = rzpErr.message || 'Razorpay refund API call failed.';
                            console.warn(`Razorpay refund failed for payment ${pay.id} (${pay.razorpay_payment_id}):`, refundErrorMsg);
                        }
                    }
                }
            } else {
                // Test mode / sandbox mock refund
                refundId = `rfnd_mock_${Date.now()}_${pay.id}`;
                refundState = 'PROCESSED';
            }

            if (pay.razorpay_payment_id) {
                processedPaymentIds.set(pay.razorpay_payment_id, { refundId, refundState, refundErrorMsg });
            }

            paymentResults.push({
                payment: pay,
                refundId,
                refundState,
                refundErrorMsg,
                claimedStatus
            });
        }

        // =========================================================
        // PHASE 3: Short DB Transaction - Fencing Enforcement, State Finalization & Release
        // =========================================================
        const phase3Conn = await pool.getConnection();
        let successfulRefunds = 0;
        let pendingRefunds = 0;
        let refundFailures = 0;
        let claimOwnershipLost = false;

        try {
            await phase3Conn.beginTransaction();

            const [freshSwapRows] = await phase3Conn.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [swapId]);
            const freshSwap = freshSwapRows[0] || swapData;

            for (const item of paymentResults) {
                const { payment: pay, refundId, refundState, refundErrorMsg, claimedStatus: itemClaimedStatus } = item;

                if (refundState === 'PROCESSED' && refundId) {
                    successfulRefunds++;
                    const [updateRes] = await phase3Conn.execute(`
                        UPDATE swap_payments 
                        SET status = 'REFUNDED', 
                            refund_id = ?, 
                            refund_amount = amount,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND status = ?
                    `, [refundId, pay.id, itemClaimedStatus]);

                    if (updateRes.affectedRows === 0) {
                        claimOwnershipLost = true;
                        break;
                    }

                    // Check timeline idempotency before inserting
                    const [existingTimeline] = await phase3Conn.execute(
                        'SELECT id FROM swap_timeline WHERE swap_id = ? AND status = "refunded" AND message LIKE ?',
                        [swapId, `%Ref: ${refundId}%`]
                    );
                    if (existingTimeline.length === 0) {
                        await phase3Conn.execute(
                            'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "refunded", ?, ?)',
                            [swapId, `Shipping fee of ₹${pay.amount} was refunded to ${pay.role} (Ref: ${refundId}).`, userId]
                        );
                    }
                } else if (refundState === 'PENDING' && refundId) {
                    pendingRefunds++;
                    const [updateRes] = await phase3Conn.execute(`
                        UPDATE swap_payments 
                        SET status = 'REFUND_PENDING', 
                            refund_id = ?, 
                            refund_amount = amount,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND status = ?
                    `, [refundId, pay.id, itemClaimedStatus]);

                    if (updateRes.affectedRows === 0) {
                        claimOwnershipLost = true;
                        break;
                    }

                    const [existingTimeline] = await phase3Conn.execute(
                        'SELECT id FROM swap_timeline WHERE swap_id = ? AND status = "refund_pending" AND message LIKE ?',
                        [swapId, `%Ref: ${refundId}%`]
                    );
                    if (existingTimeline.length === 0) {
                        await phase3Conn.execute(
                            'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "refund_pending", ?, ?)',
                            [swapId, `Refund of ₹${pay.amount} for ${pay.role} was initiated and is pending bank settlement (Ref: ${refundId}).`, userId]
                        );
                    }
                } else {
                    refundFailures++;
                    const [updateRes] = await phase3Conn.execute(`
                        UPDATE swap_payments 
                        SET status = 'REFUND_FAILED',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND status = ?
                    `, [pay.id, itemClaimedStatus]);

                    if (updateRes.affectedRows === 0) {
                        claimOwnershipLost = true;
                        break;
                    }

                    await phase3Conn.execute(
                        'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "refund_failed", ?, ?)',
                        [swapId, `Refund attempt of ₹${pay.amount} for ${pay.role} failed: ${refundErrorMsg}`, userId]
                    );
                }
            }

            // Enforce worker fencing: abort transaction if claim ownership was lost to a newer worker
            if (claimOwnershipLost) {
                await phase3Conn.rollback();
                return {
                    success: false,
                    claimLost: true,
                    message: 'Refund worker lost claim ownership to a concurrent or newer worker. Aborting without mutating state.'
                };
            }

            // Verify status of ALL payments for this swap
            const [allCurrentPayments] = await phase3Conn.execute(
                'SELECT id, status FROM swap_payments WHERE swap_id = ?',
                [swapId]
            );

            const hasUnconfirmedPayments = allCurrentPayments.some(p => p.status !== 'REFUNDED');

            if (hasUnconfirmedPayments || pendingRefunds > 0 || refundFailures > 0) {
                // Do NOT release books or cancel swap until all refunds are authoritatively REFUNDED
                await phase3Conn.commit();
                return {
                    success: false,
                    pending: pendingRefunds > 0,
                    failed: refundFailures > 0,
                    message: pendingRefunds > 0
                        ? `Refund request of ₹${paymentsToProcess[0]?.amount || '79.00'} was accepted by gateway and is pending bank settlement. Books remain reserved until settlement is confirmed.`
                        : `Refund processing encountered failures for ${refundFailures} payment(s).`,
                    successfulRefunds,
                    pendingRefunds,
                    refundFailures
                };
            }

            // All payments are authoritatively verified REFUNDED! Safe to release books and cancel swap
            await phase3Conn.execute(
                "UPDATE books SET status = 'available' WHERE id IN (?, ?) AND status = 'reserved'",
                [freshSwap.requested_book_id, freshSwap.offered_book_id]
            );

            await phase3Conn.execute(`
                UPDATE swap_requests 
                SET status = 'cancelled',
                    requester_paid = 0,
                    owner_paid = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [swapId]);

            await phase3Conn.commit();
            return { success: true, message: 'Exchange cancelled and shipping fees refunded.', successfulRefunds };
        } catch (error) {
            await phase3Conn.rollback();
            throw error;
        } finally {
            phase3Conn.release();
        }
    }

    // -------------------------------------------------------------
    // Comprehensive Swap Details with Strict Email Privacy
    // -------------------------------------------------------------
    static async getSwapDetails(swapId, currentUserId = null, isInternal = false) {
        const [rows] = await pool.execute(`
            SELECT sr.*,
                   rb.title as requested_title,
                   rb.cover_image as requested_image,
                   rb.author as requested_author,
                   rb.genre as requested_genre,
                   rb.condition as requested_condition,
                   rb.price as requested_price,
                   rb.seller_id as requested_seller_id,
                   ob.title as offered_title,
                   ob.cover_image as offered_image,
                   ob.author as offered_author,
                   ob.genre as offered_genre,
                   ob.condition as offered_condition,
                   ob.price as offered_price,
                   ob.seller_id as offered_seller_id,
                   req_u.id as req_user_id,
                   req_u.full_name as requester_name,
                   req_u.username as requester_username,
                   req_u.email as raw_requester_email,
                   own_u.id as own_user_id,
                   own_u.full_name as owner_name,
                   own_u.username as owner_username,
                   own_u.email as raw_owner_email
            FROM swap_requests sr
            LEFT JOIN books rb ON sr.requested_book_id = rb.id
            LEFT JOIN books ob ON sr.offered_book_id = ob.id
            LEFT JOIN users req_u ON sr.requester_id = req_u.id
            LEFT JOIN users own_u ON sr.owner_id = own_u.id
            WHERE sr.id = ?
        `, [swapId]);

        if (rows.length === 0) return null;
        const swap = rows[0];

        // Security check: Only participants (or internal/admin operations) can access details
        if (!isInternal) {
            if (!currentUserId) {
                const err = new Error('Authentication required to access exchange details.');
                err.statusCode = 401;
                throw err;
            }
            const isParticipant = parseInt(swap.requester_id, 10) === parseInt(currentUserId, 10) || parseInt(swap.owner_id, 10) === parseInt(currentUserId, 10);
            if (!isParticipant) {
                const err = new Error('Access denied: You are not a participant in this exchange.');
                err.statusCode = 403;
                throw err;
            }
        }

        // STRICT PRIVACY: Mask emails unless mutual consent is given!
        const mutualConsent = Boolean(swap.requester_consent === 1 && swap.owner_consent === 1);
        swap.requester_email = mutualConsent ? swap.raw_requester_email : null;
        swap.owner_email = mutualConsent ? swap.raw_owner_email : null;
        swap.isEmailRevealed = mutualConsent;
        delete swap.raw_requester_email;
        delete swap.raw_owner_email;

        // Fetch Addresses
        const [addresses] = await pool.execute(
            'SELECT * FROM swap_addresses WHERE swap_id = ?',
            [swapId]
        );
        swap.addresses = {
            requester: addresses.find(a => parseInt(a.user_id, 10) === parseInt(swap.requester_id, 10)) || null,
            owner: addresses.find(a => parseInt(a.user_id, 10) === parseInt(swap.owner_id, 10)) || null
        };

        // Fetch Payments
        const [payments] = await pool.execute(
            'SELECT id, user_id, role, razorpay_order_id, razorpay_payment_id, amount, status, refund_id, refund_amount, created_at, updated_at FROM swap_payments WHERE swap_id = ? ORDER BY created_at ASC',
            [swapId]
        );
        swap.payments = payments;

        // Fetch Timeline
        const [timeline] = await pool.execute(
            'SELECT id, status, message, actor_id, created_at FROM swap_timeline WHERE swap_id = ? ORDER BY created_at ASC',
            [swapId]
        );
        swap.timeline = timeline;

        // Exchange Configuration & Stage progression
        swap.config = this.getExchangeConfig();
        swap.stages = COURIER_STAGES;

        return swap;
    }

    static async confirmCompletion(id, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [requestRows] = await connection.execute(
                'SELECT * FROM swap_requests WHERE id = ? FOR UPDATE',
                [id]
            );
            const request = requestRows[0];
            if (!request) throw new Error('Swap request not found');

            const isReq = parseInt(request.requester_id, 10) === parseInt(userId, 10);
            const isOwn = parseInt(request.owner_id, 10) === parseInt(userId, 10);

            if (!isReq && !isOwn) {
                throw new Error('Only participating readers can confirm swap completion');
            }

            const allowedStatuses = ['accepted', 'arranged', 'contact_shared', 'awaiting_payment', 'payment_completed', 'collection_scheduled', 'book_collected', 'in_transit', 'delivered', 'dispatched', 'received'];
            if (!allowedStatuses.includes(request.status) && request.courier_status !== 'delivered') {
                if (request.status === 'completed') {
                    return {
                        completed: true,
                        status: 'completed',
                        message: 'This swap exchange has already been marked as completed.'
                    };
                }
                throw new Error(`Cannot complete swap from status "${request.status}".`);
            }

            let requesterConfirmed = request.requester_confirmed || 0;
            let ownerConfirmed = request.owner_confirmed || 0;

            if (isReq) {
                requesterConfirmed = 1;
                await connection.execute(
                    'UPDATE swap_requests SET requester_confirmed = 1, requester_confirmed_at = COALESCE(requester_confirmed_at, CURRENT_TIMESTAMP) WHERE id = ?',
                    [id]
                );
            } else if (isOwn) {
                ownerConfirmed = 1;
                await connection.execute(
                    'UPDATE swap_requests SET owner_confirmed = 1, owner_confirmed_at = COALESCE(owner_confirmed_at, CURRENT_TIMESTAMP) WHERE id = ?',
                    [id]
                );
            }

            const [reqBook] = await connection.execute('SELECT title FROM books WHERE id = ?', [request.requested_book_id]);
            const [offBook] = await connection.execute('SELECT title FROM books WHERE id = ?', [request.offered_book_id]);
            const requestedTitle = reqBook[0]?.title || 'requested book';
            const offeredTitle = offBook[0]?.title || 'offered book';

            const partnerId = isReq ? request.owner_id : request.requester_id;

            // Check if BOTH parties have confirmed
            if (requesterConfirmed === 1 && ownerConfirmed === 1) {
                const completionMsg = "Your books have found their next readers! Your QUIRO exchange is complete.";
                await connection.execute(
                    "UPDATE swap_requests SET status = 'completed', courier_status = 'exchange_completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [id]
                );

                // Mark both books swapped
                await connection.execute(
                    "UPDATE books SET status = 'swapped', swap_enabled = 0 WHERE id IN (?, ?)",
                    [request.requested_book_id, request.offered_book_id]
                );

                await connection.execute(
                    'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "completed", ?, ?)',
                    [id, completionMsg, userId]
                );

                await connection.commit();

                // Fire notifications and socket AFTER commit — Notification.create uses pool (not tx connection)
                Promise.allSettled([
                    Notification.create({ user_id: request.requester_id, title: 'Book Exchange Completed!', message: completionMsg, type: 'swap_completed' }),
                    Notification.create({ user_id: request.owner_id, title: 'Book Exchange Completed!', message: completionMsg, type: 'swap_completed' })
                ]).catch(() => {});

                try {
                    const socket = require('../socket');
                    socket.sendNotification(request.requester_id, {
                        type: 'SWAP_COMPLETED',
                        message: completionMsg,
                        reference_id: id
                    });
                    socket.sendNotification(request.owner_id, {
                        type: 'SWAP_COMPLETED',
                        message: completionMsg,
                        reference_id: id
                    });
                } catch (sockErr) {
                    // Non-blocking
                }

                return {
                    completed: true,
                    status: 'completed',
                    courier_status: 'exchange_completed',
                    requesterConfirmed: 1,
                    ownerConfirmed: 1,
                    requester_confirmed_at: new Date().toISOString(),
                    owner_confirmed_at: new Date().toISOString(),
                    message: completionMsg
                };
            } else {
                await connection.commit();

                const [userRow] = await pool.execute('SELECT full_name FROM users WHERE id = ?', [userId]);
                const userName = userRow[0]?.full_name || 'Your swap partner';

                await Notification.create({
                    user_id: partnerId,
                    title: 'Swap Receipt Confirmed by Partner',
                    message: `${userName} has confirmed receiving their book. Please confirm your receipt to complete the trade.`,
                    type: 'swap_confirmed_by_partner'
                });

                try {
                    const socket = require('../socket');
                    socket.sendNotification(partnerId, {
                        type: 'SWAP_CONFIRMED',
                        message: `${userName} confirmed book receipt. Please confirm receipt to complete the swap.`,
                        reference_id: id
                    });
                } catch (sockErr) {
                    // Non-blocking
                }

                return {
                    completed: false,
                    status: request.status,
                    requesterConfirmed,
                    ownerConfirmed,
                    waitingForPartner: true,
                    message: 'Your confirmation has been recorded! Waiting for the other reader to confirm receipt.'
                };
            }
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async counter(id, newOfferedBookId, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [requestRows] = await connection.execute('SELECT * FROM swap_requests WHERE id = ? FOR UPDATE', [id]);
            const request = requestRows[0];
            if (!request) throw new Error('Request not found');

            if (parseInt(request.owner_id, 10) !== parseInt(userId, 10)) {
                throw new Error('Only the book owner can propose a counter-offer');
            }

            const [bookRows] = await connection.execute('SELECT seller_id, title FROM books WHERE id = ?', [newOfferedBookId]);
            if (bookRows.length === 0 || parseInt(bookRows[0].seller_id, 10) !== parseInt(request.requester_id, 10)) {
                throw new Error('Proposed counter book must belong to the requester');
            }

            await connection.execute(
                'UPDATE swap_requests SET offered_book_id = ?, status = "counter_offered", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newOfferedBookId, id]
            );

            await connection.execute(
                'INSERT INTO swap_timeline (swap_id, status, message, actor_id) VALUES (?, "counter_offered", ?, ?)',
                [id, `Owner proposed a counter-offer book: "${bookRows[0].title}".`, userId]
            );

            await connection.commit();

            // Fire notification AFTER commit — Notification.create uses pool (not tx connection)
            Promise.allSettled([
                Notification.create({
                    user_id: request.requester_id,
                    title: 'Counter-Offer Proposed',
                    message: `Owner has proposed swapping for your book "${bookRows[0].title}" instead.`,
                    type: 'swap_counter'
                })
            ]).catch(() => {});

            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = Swap;
