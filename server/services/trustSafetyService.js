const { pool } = require('../config/db');
const AuditService = require('./auditService');
const { NotificationService, NOTIFICATION_TYPES } = require('./notificationService');
const socket = require('../socket');

class TrustSafetyService {
    /**
     * ==========================================
     * 1. UNIFIED REPORTING SYSTEM
     * ==========================================
     */
    static async createReport({ reporterId, targetType, targetId, reason, description, evidenceUrl = null, priority = 'MEDIUM' }) {
        const validTargets = ['book', 'seller', 'buyer', 'review', 'order', 'swap'];
        if (!validTargets.includes(targetType)) {
            throw new Error(`Invalid target type: ${targetType}`);
        }

        // Auto-elevate priority for severe reasons
        const severeReasons = ['fraud', 'scam', 'harassment', 'prohibited', 'fake listing', 'abusive'];
        let resolvedPriority = priority;
        if (severeReasons.some(r => (reason || '').toLowerCase().includes(r))) {
            resolvedPriority = 'HIGH';
        }

        const [result] = await pool.query(`
            INSERT INTO reports (reporter_id, target_type, target_id, reason, description, priority, evidence_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [reporterId, targetType, targetId, reason, description || null, resolvedPriority, evidenceUrl]);

        const reportId = result.insertId;

        // Audit log
        await AuditService.log(reporterId, 'REPORT_CREATED', targetType, targetId, {
            reportId,
            reason,
            priority: resolvedPriority
        });

        // Notify admins
        try {
            const [adminRows] = await pool.query("SELECT id FROM users WHERE role = 'ADMIN'");
            for (const adm of adminRows) {
                await NotificationService.send({
                    user_id: adm.id,
                    type: NOTIFICATION_TYPES.REPORT_CREATED,
                    title: '⚠️ New Content Report Submitted',
                    message: `A user reported ${targetType} #${targetId} for "${reason}".`,
                    entity_type: 'report',
                    entity_id: reportId,
                    action_url: `/admin/reports`
                });
            }
        } catch (e) {
            console.error('Failed to notify admins of report:', e.message);
        }

        return { id: reportId, status: 'OPEN', priority: resolvedPriority };
    }

    static async getReports({ status, priority, targetType, limit = 50, offset = 0 }) {
        let query = `
            SELECT r.*, 
                   u.full_name as reporter_name, u.email as reporter_email,
                   adm.full_name as resolver_name
            FROM reports r
            JOIN users u ON r.reporter_id = u.id
            LEFT JOIN users adm ON r.resolved_by = adm.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }
        if (priority) {
            query += ' AND r.priority = ?';
            params.push(priority);
        }
        if (targetType) {
            query += ' AND r.target_type = ?';
            params.push(targetType);
        }

        query += ` ORDER BY r.created_at DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;

        const [rows] = await pool.query(query, params);
        return rows;
    }

    static async resolveReport(reportId, adminId, { status = 'RESOLVED', resolutionNotes = '', actionOnTarget = null }) {
        await pool.query(`
            UPDATE reports 
            SET status = ?, resolved_by = ?, resolution_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, adminId, resolutionNotes, reportId]);

        const [reportRows] = await pool.query('SELECT * FROM reports WHERE id = ?', [reportId]);
        const report = reportRows[0];

        if (report && actionOnTarget) {
            if (actionOnTarget === 'SUSPEND_LISTING' && report.target_type === 'book') {
                await pool.query("UPDATE books SET status = 'unavailable' WHERE id = ?", [report.target_id]);
                await AuditService.log(adminId, 'LISTING_SUSPENDED', 'book', report.target_id, { reason: resolutionNotes });
            } else if (actionOnTarget === 'SUSPEND_USER' && (report.target_type === 'seller' || report.target_type === 'buyer')) {
                await pool.query("UPDATE users SET status = 'suspended' WHERE id = ?", [report.target_id]);
                await AuditService.log(adminId, 'USER_SUSPENDED', 'user', report.target_id, { reason: resolutionNotes });
            } else if (actionOnTarget === 'HIDE_REVIEW' && report.target_type === 'review') {
                await pool.query("DELETE FROM reviews WHERE id = ?", [report.target_id]);
                await AuditService.log(adminId, 'REVIEW_REMOVED', 'review', report.target_id, { reason: resolutionNotes });
            } else if (actionOnTarget === 'WARN_SELLER') {
                await NotificationService.send({
                    user_id: report.target_id,
                    type: NOTIFICATION_TYPES.ADMIN_ACTION,
                    title: '⚠️ Marketplace Content Warning',
                    message: `BookNest Trust & Safety notice: ${resolutionNotes || 'Please adhere to catalog quality standards.'}`,
                    entity_type: 'report',
                    entity_id: reportId
                });
            }
        }

        await AuditService.log(adminId, 'REPORT_RESOLVED', 'report', reportId, {
            status,
            resolutionNotes,
            actionOnTarget
        });

        return { success: true, status };
    }

    /**
     * ==========================================
     * 2. DISPUTE SYSTEM & CASE MANAGEMENT
     * ==========================================
     */
    static async createDispute({ initiatorId, entityType, entityId, reason, description, evidence = [] }) {
        if (!['order', 'swap'].includes(entityType)) {
            throw new Error('Disputes can only be raised on orders or swaps.');
        }

        // Check for existing active dispute
        const [existing] = await pool.query(`
            SELECT id, dispute_code, status 
            FROM disputes 
            WHERE entity_type = ? AND entity_id = ? AND status NOT IN ('RESOLVED', 'REJECTED')
        `, [entityType, entityId]);

        if (existing.length > 0) {
            throw new Error(`An active dispute (${existing[0].dispute_code}) already exists for this ${entityType}.`);
        }

        let respondentId = null;
        let orderTotal = 0;

        if (entityType === 'order') {
            const [orderRows] = await pool.query(`
                SELECT o.id, o.buyer_id, o.status, o.total_price,
                       (SELECT b.seller_id FROM order_items oi JOIN books b ON oi.book_id = b.id WHERE oi.order_id = o.id LIMIT 1) as seller_id
                FROM orders o
                WHERE o.id = ?
            `, [entityId]);

            if (orderRows.length === 0) {
                throw new Error('Order not found.');
            }

            const order = orderRows[0];
            if (order.buyer_id !== initiatorId && order.seller_id !== initiatorId) {
                throw new Error('Unauthorized: You can only dispute orders you are a party to.');
            }

            if (order.status === 'cancelled') {
                throw new Error('Cannot raise dispute on a cancelled order.');
            }

            respondentId = (order.buyer_id === initiatorId) ? order.seller_id : order.buyer_id;
            orderTotal = parseFloat(order.total_price || 0);
        } else if (entityType === 'swap') {
            const [swapRows] = await pool.query(`
                SELECT id, requester_id, owner_id, status 
                FROM swap_requests 
                WHERE id = ?
            `, [entityId]);

            if (swapRows.length === 0) {
                throw new Error('Swap request not found.');
            }

            const swap = swapRows[0];
            if (swap.requester_id !== initiatorId && swap.owner_id !== initiatorId) {
                throw new Error('Unauthorized: You can only dispute swaps you participate in.');
            }

            respondentId = (swap.requester_id === initiatorId) ? swap.owner_id : swap.requester_id;
        }

        // Generate clean dispute code (e.g. DSP-2026-8491)
        const randomCode = Math.floor(1000 + Math.random() * 9000);
        const disputeCode = `DSP-${new Date().getFullYear()}-${randomCode}`;

        // Auto-assign priority based on keyword
        let priority = 'MEDIUM';
        if (description.toLowerCase().includes('damaged') || description.toLowerCase().includes('missing') || description.toLowerCase().includes('fake') || description.toLowerCase().includes('fraud')) {
            priority = 'HIGH';
        }

        const [dispResult] = await pool.query(`
            INSERT INTO disputes (dispute_code, initiator_id, respondent_id, entity_type, entity_id, reason, description, priority, refund_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [disputeCode, initiatorId, respondentId, entityType, entityId, reason, description, priority, orderTotal]);

        const disputeId = dispResult.insertId;

        // Insert initial message
        await pool.query(`
            INSERT INTO dispute_messages (dispute_id, sender_id, sender_role, message)
            VALUES (?, ?, 'USER', ?)
        `, [disputeId, initiatorId, description]);

        // Insert evidence files if provided
        if (Array.isArray(evidence) && evidence.length > 0) {
            for (const ev of evidence) {
                if (ev && ev.url) {
                    await pool.query(`
                        INSERT INTO dispute_evidence (dispute_id, uploader_id, file_url, file_type, caption)
                        VALUES (?, ?, ?, ?, ?)
                    `, [disputeId, initiatorId, ev.url, ev.type || 'image', ev.caption || 'Initial claim evidence']);
                }
            }
        }

        // Audit Trail
        await AuditService.log(initiatorId, 'DISPUTE_CREATED', 'dispute', disputeId, {
            disputeCode,
            entityType,
            entityId,
            reason,
            priority
        });

        // Real-time Notification to respondent (seller or counterpart)
        await NotificationService.send({
            user_id: respondentId,
            type: NOTIFICATION_TYPES.DISPUTE_CREATED,
            title: `🛡️ Issue Reported: Dispute #${disputeCode}`,
            message: `A dispute was opened for ${entityType} #${entityId}: "${reason}". Please review and provide your response.`,
            entity_type: 'dispute',
            entity_id: disputeId,
            action_url: `/disputes/${disputeCode}`
        });

        // Notify admins
        try {
            const [adminRows] = await pool.query("SELECT id FROM users WHERE role = 'ADMIN'");
            for (const adm of adminRows) {
                await NotificationService.send({
                    user_id: adm.id,
                    type: NOTIFICATION_TYPES.DISPUTE_CREATED,
                    title: `🛡️ New Dispute Opened: ${disputeCode}`,
                    message: `${entityType.toUpperCase()} #${entityId} disputed by User #${initiatorId}. Priority: ${priority}`,
                    entity_type: 'dispute',
                    entity_id: disputeId,
                    action_url: `/admin/disputes`
                });
            }
        } catch (e) {
            console.error('Failed to notify admins of new dispute:', e.message);
        }

        return {
            id: disputeId,
            disputeCode,
            status: 'OPEN',
            priority,
            entityType,
            entityId,
            createdAt: new Date()
        };
    }

    /**
     * Get disputes for a user (as buyer/initiator or seller/respondent)
     */
    static async getUserDisputes(userId, { status = null, limit = 50, offset = 0 }) {
        let query = `
            SELECT 
                d.*,
                u_init.full_name as initiator_name, u_init.email as initiator_email,
                u_resp.full_name as respondent_name, u_resp.email as respondent_email,
                (SELECT COUNT(*) FROM dispute_messages dm WHERE dm.dispute_id = d.id AND dm.is_internal = 0) as message_count,
                (SELECT COUNT(*) FROM dispute_evidence de WHERE de.dispute_id = d.id) as evidence_count
            FROM disputes d
            JOIN users u_init ON d.initiator_id = u_init.id
            JOIN users u_resp ON d.respondent_id = u_resp.id
            WHERE (d.initiator_id = ? OR d.respondent_id = ?)
        `;
        const params = [userId, userId];

        if (status && status !== 'ALL') {
            query += ' AND d.status = ?';
            params.push(status);
        }

        query += ` ORDER BY d.created_at DESC LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;

        const [rows] = await pool.query(query, params);
        return rows;
    }

    /**
     * Get single dispute workspace (with IDOR protection)
     */
    static async getDisputeById(disputeIdOrCode, userId, userRole = 'USER') {
        let lookupSql = 'SELECT d.* FROM disputes d WHERE d.id = ?';
        if (isNaN(parseInt(disputeIdOrCode, 10)) || String(disputeIdOrCode).startsWith('DSP-')) {
            lookupSql = 'SELECT d.* FROM disputes d WHERE d.dispute_code = ?';
        }

        const [rows] = await pool.query(lookupSql, [disputeIdOrCode]);
        if (rows.length === 0) {
            return null;
        }

        const dispute = rows[0];

        // Strict IDOR Check
        if (userRole !== 'ADMIN' && dispute.initiator_id !== userId && dispute.respondent_id !== userId) {
            throw new Error('Forbidden: You do not have permission to view this dispute.');
        }

        // Fetch Parties
        const [initiatorRows] = await pool.query(`
            SELECT id, full_name, email, role, status, college, created_at,
                   (SELECT COUNT(*) FROM orders WHERE buyer_id = users.id) as total_orders
            FROM users WHERE id = ?
        `, [dispute.initiator_id]);

        const [respondentRows] = await pool.query(`
            SELECT id, full_name, email, role, status, college, created_at,
                   (SELECT COUNT(*) FROM books WHERE seller_id = users.id) as total_listings,
                   (SELECT COALESCE(AVG(rating), 4.8) FROM reviews WHERE seller_id = users.id) as avg_rating
            FROM users WHERE id = ?
        `, [dispute.respondent_id]);

        // Fetch Related Transaction Details
        let transactionDetails = null;
        if (dispute.entity_type === 'order') {
            const [orderRows] = await pool.query(`
                SELECT o.id, o.total_price, o.shipping_address, o.status, o.created_at,
                       p.razorpay_payment_id, p.status as payment_status, p.method as payment_method
                FROM orders o
                LEFT JOIN payments p ON o.id = p.order_id
                WHERE o.id = ?
            `, [dispute.entity_id]);

            const [orderItems] = await pool.query(`
                SELECT oi.id, oi.price, b.id as book_id, b.title, b.author, b.condition, b.cover_image, b.genre
                FROM order_items oi
                JOIN books b ON oi.book_id = b.id
                WHERE oi.order_id = ?
            `, [dispute.entity_id]);

            transactionDetails = {
                order: orderRows[0] || null,
                items: orderItems
            };
        } else if (dispute.entity_type === 'swap') {
            const [swapRows] = await pool.query(`
                SELECT s.*, 
                       rb.title as requested_title, rb.cover_image as requested_cover,
                       ob.title as offered_title, ob.cover_image as offered_cover
                FROM swap_requests s
                JOIN books rb ON s.requested_book_id = rb.id
                JOIN books ob ON s.offered_book_id = ob.id
                WHERE s.id = ?
            `, [dispute.entity_id]);
            transactionDetails = { swap: swapRows[0] || null };
        }

        // Fetch Messages
        let msgQuery = `
            SELECT dm.*, u.full_name as sender_name, u.role as user_role
            FROM dispute_messages dm
            JOIN users u ON dm.sender_id = u.id
            WHERE dm.dispute_id = ?
        `;
        if (userRole !== 'ADMIN') {
            msgQuery += ' AND dm.is_internal = 0';
        }
        msgQuery += ' ORDER BY dm.created_at ASC';

        const [messages] = await pool.query(msgQuery, [dispute.id]);

        // Fetch Evidence
        const [evidence] = await pool.query(`
            SELECT de.*, u.full_name as uploader_name
            FROM dispute_evidence de
            JOIN users u ON de.uploader_id = u.id
            WHERE de.dispute_id = ?
            ORDER BY de.created_at ASC
        `, [dispute.id]);

        // Calculate Seller Trust & Risk Flags
        const sellerTrust = await this.calculateSellerTrustScore(dispute.respondent_id);
        const sellerRiskFlags = await this.getSellerRiskFlags(dispute.respondent_id);

        return {
            dispute,
            initiator: initiatorRows[0] || null,
            respondent: respondentRows[0] || null,
            transaction: transactionDetails,
            messages,
            evidence,
            sellerTrust,
            sellerRiskFlags
        };
    }

    /**
     * Add Message to Dispute
     */
    static async addDisputeMessage(disputeId, senderId, userRole, { message, attachments = null, isInternal = false }) {
        const [dispRows] = await pool.query('SELECT * FROM disputes WHERE id = ?', [disputeId]);
        if (dispRows.length === 0) throw new Error('Dispute not found.');
        const dispute = dispRows[0];

        // IDOR Check
        if (userRole !== 'ADMIN' && dispute.initiator_id !== senderId && dispute.respondent_id !== senderId) {
            throw new Error('Forbidden: You cannot post in this dispute.');
        }

        let senderRole = 'USER';
        if (userRole === 'ADMIN') senderRole = 'ADMIN';
        else if (dispute.respondent_id === senderId) senderRole = 'SELLER';

        const safeInternal = (userRole === 'ADMIN' && isInternal === true) ? 1 : 0;

        const [res] = await pool.query(`
            INSERT INTO dispute_messages (dispute_id, sender_id, sender_role, message, attachments, is_internal)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [disputeId, senderId, senderRole, message, attachments ? JSON.stringify(attachments) : null, safeInternal]);

        // If party answered while waiting, transition status back to UNDER_REVIEW
        if (!safeInternal && (dispute.status === 'WAITING_FOR_USER' || dispute.status === 'WAITING_FOR_SELLER')) {
            await pool.query("UPDATE disputes SET status = 'UNDER_REVIEW', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [disputeId]);
        }

        // Notify recipient if not internal
        if (!safeInternal) {
            const recipientId = (senderId === dispute.initiator_id) ? dispute.respondent_id : dispute.initiator_id;
            await NotificationService.send({
                user_id: recipientId,
                type: NOTIFICATION_TYPES.DISPUTE_MESSAGE,
                title: `💬 New Message on Dispute #${dispute.dispute_code}`,
                message: `${senderRole}: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`,
                entity_type: 'dispute',
                entity_id: disputeId,
                action_url: `/disputes/${dispute.dispute_code}`
            });
        }

        return { id: res.insertId, disputeId, senderId, senderRole, message, isInternal: safeInternal === 1, createdAt: new Date() };
    }

    /**
     * Add Evidence to Dispute
     */
    static async addDisputeEvidence(disputeId, uploaderId, userRole, { fileUrl, fileType = 'image', caption = '' }) {
        const [dispRows] = await pool.query('SELECT * FROM disputes WHERE id = ?', [disputeId]);
        if (dispRows.length === 0) throw new Error('Dispute not found.');
        const dispute = dispRows[0];

        if (userRole !== 'ADMIN' && dispute.initiator_id !== uploaderId && dispute.respondent_id !== uploaderId) {
            throw new Error('Forbidden: You cannot upload evidence to this dispute.');
        }

        const [res] = await pool.query(`
            INSERT INTO dispute_evidence (dispute_id, uploader_id, file_url, file_type, caption)
            VALUES (?, ?, ?, ?, ?)
        `, [disputeId, uploaderId, fileUrl, fileType, caption]);

        // Audit Log
        await AuditService.log(uploaderId, 'DISPUTE_EVIDENCE_ADDED', 'dispute', disputeId, { fileUrl, caption });

        return { id: res.insertId, disputeId, fileUrl, caption, createdAt: new Date() };
    }

    /**
     * ==========================================
     * 3. ADMIN RESOLUTION & WORKFLOW MUTATIONS
     * ==========================================
     */
    static async updateDisputeStatus(disputeId, adminId, { status, priority, assignedAdminId, resolutionType, resolutionNotes, refundAmount = 0 }) {
        const [dispRows] = await pool.query('SELECT * FROM disputes WHERE id = ?', [disputeId]);
        if (dispRows.length === 0) throw new Error('Dispute not found.');
        const dispute = dispRows[0];

        let resolvedAtSql = '';
        if (status === 'RESOLVED' || status === 'REJECTED') {
            resolvedAtSql = ', resolved_at = CURRENT_TIMESTAMP';
        }

        await pool.query(`
            UPDATE disputes 
            SET status = COALESCE(?, status),
                priority = COALESCE(?, priority),
                assigned_admin_id = COALESCE(?, assigned_admin_id),
                resolution_type = COALESCE(?, resolution_type),
                resolution_notes = COALESCE(?, resolution_notes),
                refund_amount = COALESCE(?, refund_amount),
                updated_at = CURRENT_TIMESTAMP
                ${resolvedAtSql}
            WHERE id = ?
        `, [status || null, priority || null, assignedAdminId || null, resolutionType || null, resolutionNotes || null, refundAmount || null, disputeId]);

        // Handle Special Resolution Actions
        if (resolutionType === 'REFUND_APPROVED' && dispute.entity_type === 'order') {
            await pool.query("UPDATE orders SET status = 'refunded' WHERE id = ?", [dispute.entity_id]);
            await pool.query("UPDATE payments SET status = 'paid' WHERE order_id = ?", [dispute.entity_id]);
            await pool.query("UPDATE disputes SET refund_status = 'REFUNDED' WHERE id = ?", [disputeId]);

            // Notify buyer
            await NotificationService.send({
                user_id: dispute.initiator_id,
                type: NOTIFICATION_TYPES.REFUND_COMPLETED,
                title: '💰 Refund Approved & Processed',
                message: `Your refund for Order #${dispute.entity_id} has been approved and processed.`,
                entity_type: 'dispute',
                entity_id: disputeId,
                action_url: `/disputes/${dispute.dispute_code}`
            });
        } else if (resolutionType === 'RETURN_APPROVED') {
            await pool.query("UPDATE disputes SET return_status = 'RETURN_APPROVED' WHERE id = ?", [disputeId]);
            await NotificationService.send({
                user_id: dispute.initiator_id,
                type: NOTIFICATION_TYPES.RETURN_APPROVED,
                title: '📦 Return Request Approved',
                message: `Please ship the book back to the seller using the registered campus return address.`,
                entity_type: 'dispute',
                entity_id: disputeId,
                action_url: `/disputes/${dispute.dispute_code}`
            });
        }

        // Audit Trail
        await AuditService.log(adminId, 'DISPUTE_UPDATED', 'dispute', disputeId, {
            status,
            priority,
            resolutionType,
            resolutionNotes
        });

        // Broadcast notifications
        const notifTitle = `🛡️ Dispute #${dispute.dispute_code} Updated`;
        const notifMsg = `Status changed to ${status || dispute.status}. ${resolutionNotes ? 'Note: ' + resolutionNotes : ''}`;

        await NotificationService.send({
            user_id: dispute.initiator_id,
            type: NOTIFICATION_TYPES.DISPUTE_UPDATED,
            title: notifTitle,
            message: notifMsg,
            entity_type: 'dispute',
            entity_id: disputeId,
            action_url: `/disputes/${dispute.dispute_code}`
        });

        await NotificationService.send({
            user_id: dispute.respondent_id,
            type: NOTIFICATION_TYPES.DISPUTE_UPDATED,
            title: notifTitle,
            message: notifMsg,
            entity_type: 'dispute',
            entity_id: disputeId,
            action_url: `/disputes/${dispute.dispute_code}`
        });

        return { success: true, disputeId, status };
    }

    /**
     * Seller Response to Dispute
     */
    static async sellerRespondDispute(disputeId, sellerId, { responseText, acceptReturn = false, evidenceUrl = null }) {
        const [dispRows] = await pool.query('SELECT * FROM disputes WHERE id = ?', [disputeId]);
        if (dispRows.length === 0) throw new Error('Dispute not found.');
        const dispute = dispRows[0];

        if (dispute.respondent_id !== sellerId) {
            throw new Error('Forbidden: You are not the respondent for this dispute.');
        }

        // Insert Seller Message
        await pool.query(`
            INSERT INTO dispute_messages (dispute_id, sender_id, sender_role, message)
            VALUES (?, ?, 'SELLER', ?)
        `, [disputeId, sellerId, responseText]);

        // Insert Evidence if present
        if (evidenceUrl) {
            await pool.query(`
                INSERT INTO dispute_evidence (dispute_id, uploader_id, file_url, file_type, caption)
                VALUES (?, ?, ?, 'image', 'Seller response evidence')
            `, [disputeId, sellerId, evidenceUrl]);
        }

        // Update return status if seller proactively accepts return
        if (acceptReturn) {
            await pool.query(`
                UPDATE disputes 
                SET return_status = 'RETURN_APPROVED', status = 'UNDER_REVIEW', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [disputeId]);
        } else {
            await pool.query(`
                UPDATE disputes 
                SET status = 'UNDER_REVIEW', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [disputeId]);
        }

        // Audit Log
        await AuditService.log(sellerId, 'SELLER_DISPUTE_RESPONSE', 'dispute', disputeId, {
            acceptReturn,
            hasEvidence: !!evidenceUrl
        });

        // Notify Buyer
        await NotificationService.send({
            user_id: dispute.initiator_id,
            type: NOTIFICATION_TYPES.DISPUTE_MESSAGE,
            title: `💬 Seller Responded to Dispute #${dispute.dispute_code}`,
            message: acceptReturn ? 'The seller has accepted your return request.' : `Seller: "${responseText.slice(0, 80)}..."`,
            entity_type: 'dispute',
            entity_id: disputeId,
            action_url: `/disputes/${dispute.dispute_code}`
        });

        return { success: true, disputeId, status: 'UNDER_REVIEW' };
    }

    /**
     * Get All Admin Disputes
     */
    static async getAdminDisputes({ status, priority, entityType, search, sortBy = 'newest', limit = 50, offset = 0 }) {
        let query = `
            SELECT 
                d.*,
                u_init.full_name as initiator_name, u_init.email as initiator_email,
                u_resp.full_name as respondent_name, u_resp.email as respondent_email,
                adm.full_name as assigned_admin_name,
                (SELECT COUNT(*) FROM dispute_messages dm WHERE dm.dispute_id = d.id) as message_count,
                (SELECT COUNT(*) FROM dispute_evidence de WHERE de.dispute_id = d.id) as evidence_count
            FROM disputes d
            JOIN users u_init ON d.initiator_id = u_init.id
            JOIN users u_resp ON d.respondent_id = u_resp.id
            LEFT JOIN users adm ON d.assigned_admin_id = adm.id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'ALL') {
            query += ' AND d.status = ?';
            params.push(status);
        }
        if (priority && priority !== 'ALL') {
            query += ' AND d.priority = ?';
            params.push(priority);
        }
        if (entityType && entityType !== 'ALL') {
            query += ' AND d.entity_type = ?';
            params.push(entityType);
        }
        if (search) {
            query += ' AND (d.dispute_code LIKE ? OR d.reason LIKE ? OR u_init.full_name LIKE ? OR u_resp.full_name LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        if (sortBy === 'highest_priority') {
            query += ' ORDER BY FIELD(d.priority, "URGENT", "HIGH", "MEDIUM", "LOW"), d.created_at DESC';
        } else if (sortBy === 'oldest') {
            query += ' ORDER BY d.created_at ASC';
        } else if (sortBy === 'unresolved') {
            query += ' ORDER BY (d.status IN ("RESOLVED", "REJECTED")), d.created_at ASC';
        } else {
            query += ' ORDER BY d.created_at DESC';
        }

        query += ` LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;

        const [rows] = await pool.query(query, params);
        return rows;
    }

    /**
     * ==========================================
     * 4. TRUST & SAFETY DASHBOARD STATS
     * ==========================================
     */
    static async getTrustAndSafetyStats() {
        const [disputeStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_disputes,
                COUNT(CASE WHEN status NOT IN ('RESOLVED', 'REJECTED') THEN 1 END) as open_disputes,
                COUNT(CASE WHEN priority IN ('HIGH', 'URGENT') AND status NOT IN ('RESOLVED', 'REJECTED') THEN 1 END) as high_priority_disputes,
                COUNT(CASE WHEN return_status = 'RETURN_REQUESTED' THEN 1 END) as return_requests,
                COUNT(CASE WHEN refund_status = 'REFUND_REQUESTED' THEN 1 END) as pending_refunds
            FROM disputes
        `);

        const [reportStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_reports,
                COUNT(CASE WHEN created_at >= CURDATE() THEN 1 END) as reports_today,
                COUNT(CASE WHEN status IN ('OPEN', 'UNDER_REVIEW') THEN 1 END) as unresolved_reports
            FROM reports
        `);

        const [userStats] = await pool.query(`
            SELECT 
                COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_sellers,
                COUNT(CASE WHEN role = 'USER' THEN 1 END) as total_users
            FROM users
        `);

        const [bookStats] = await pool.query(`
            SELECT COUNT(CASE WHEN status = 'unavailable' THEN 1 END) as suspended_listings
            FROM books
        `);

        const d = disputeStats[0] || {};
        const r = reportStats[0] || {};
        const u = userStats[0] || {};
        const b = bookStats[0] || {};

        return {
            openDisputes: parseInt(d.open_disputes || 0, 10),
            highPriorityDisputes: parseInt(d.high_priority_disputes || 0, 10),
            reportsToday: parseInt(r.reports_today || 0, 10),
            unresolvedReports: parseInt(r.unresolved_reports || 0, 10),
            returnRequests: parseInt(d.return_requests || 0, 10),
            refundsPending: parseInt(d.pending_refunds || 0, 10),
            suspendedSellers: parseInt(u.suspended_sellers || 0, 10),
            suspendedListings: parseInt(b.suspended_listings || 0, 10),
            totalDisputes: parseInt(d.total_disputes || 0, 10),
            totalReports: parseInt(r.total_reports || 0, 10)
        };
    }

    /**
     * ==========================================
     * 5. SELLER TRUST SCORE & EXPLAINABLE SIGNALS
     * ==========================================
     */
    static async calculateSellerTrustScore(sellerId) {
        const numericSeller = parseInt(sellerId, 10);
        if (!numericSeller || isNaN(numericSeller)) return null;

        const [sellerRows] = await pool.query(`
            SELECT u.id, u.full_name, u.college, u.status, u.created_at,
                   (SELECT COUNT(*) FROM books WHERE seller_id = u.id) as listings_count,
                   (SELECT COUNT(*) FROM order_items oi JOIN books bk ON oi.book_id = bk.id WHERE bk.seller_id = u.id) as delivered_orders,
                   (SELECT COUNT(*) FROM disputes WHERE respondent_id = u.id) as total_disputes,
                   (SELECT COUNT(*) FROM disputes WHERE respondent_id = u.id AND status NOT IN ('RESOLVED', 'REJECTED')) as active_disputes,
                   (SELECT COUNT(*) FROM reports WHERE target_type = 'seller' AND target_id = u.id) as total_reports,
                   (SELECT COALESCE(AVG(rating), 4.8) FROM reviews WHERE seller_id = u.id) as avg_rating
            FROM users u
            WHERE u.id = ?
        `, [numericSeller]);

        if (sellerRows.length === 0) return null;
        const s = sellerRows[0];

        let score = 70; // Base score
        const breakdown = [];

        // Factor 1: Verified student / College affiliation
        if (s.college) {
            score += 10;
            breakdown.push({ factor: 'Campus Student Verification', impact: '+10 pts', positive: true });
        }

        // Factor 2: Delivery & Sales Track Record
        const orders = parseInt(s.delivered_orders || 0, 10);
        if (orders >= 10) {
            score += 15;
            breakdown.push({ factor: 'High Order Volume (10+ successful sales)', impact: '+15 pts', positive: true });
        } else if (orders >= 3) {
            score += 8;
            breakdown.push({ factor: 'Active Order Fulfillment (3+ sales)', impact: '+8 pts', positive: true });
        }

        // Factor 3: Average Customer Rating
        const rating = parseFloat(parseFloat(s.avg_rating || 4.8).toFixed(1));
        if (rating >= 4.8) {
            score += 10;
            breakdown.push({ factor: `Top-Tier Rating (${rating} ★)`, impact: '+10 pts', positive: true });
        } else if (rating < 3.5) {
            score -= 15;
            breakdown.push({ factor: `Below Average Rating (${rating} ★)`, impact: '-15 pts', positive: false });
        }

        // Factor 4: Active Disputes Penalty
        const activeDisputes = parseInt(s.active_disputes || 0, 10);
        if (activeDisputes > 0) {
            const penalty = Math.min(25, activeDisputes * 10);
            score -= penalty;
            breakdown.push({ factor: `${activeDisputes} Unresolved Customer Dispute(s)`, impact: `-${penalty} pts`, positive: false });
        }

        // Factor 5: Reports Penalty
        const reports = parseInt(s.total_reports || 0, 10);
        if (reports > 0) {
            const penalty = Math.min(20, reports * 5);
            score -= penalty;
            breakdown.push({ factor: `${reports} Marketplace Content Report(s)`, impact: `-${penalty} pts`, positive: false });
        }

        // Account status penalty
        if (s.status === 'suspended') {
            score = 0;
            breakdown.push({ factor: 'Account Currently Suspended', impact: 'Reset to 0', positive: false });
        }

        const finalScore = Math.max(0, Math.min(100, score));

        let grade = 'A';
        let badge = 'VERIFIED_TRUSTED';
        if (finalScore >= 85) { grade = 'A+'; badge = 'EXEMPLARY_SELLER'; }
        else if (finalScore >= 70) { grade = 'A'; badge = 'TRUSTED_MERCHANT'; }
        else if (finalScore >= 50) { grade = 'B'; badge = 'FAIR_STANDING'; }
        else { grade = 'C'; badge = 'UNDER_MONITORING'; }

        return {
            sellerId: numericSeller,
            sellerName: s.full_name,
            trustScore: finalScore,
            grade,
            badge,
            isSuspended: s.status === 'suspended',
            breakdown
        };
    }

    /**
     * Explainable Risk Flags for Admin Investigation
     */
    static async getSellerRiskFlags(sellerId) {
        const numericSeller = parseInt(sellerId, 10);
        if (!numericSeller || isNaN(numericSeller)) return [];

        const [rows] = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM disputes WHERE respondent_id = ? AND status NOT IN ('RESOLVED', 'REJECTED')) as active_disputes,
                (SELECT COUNT(*) FROM reports WHERE target_type = 'seller' AND target_id = ?) as seller_reports,
                (SELECT COUNT(*) FROM reports r JOIN books b ON r.target_id = b.id WHERE r.target_type = 'book' AND b.seller_id = ?) as listing_reports,
                (SELECT COUNT(*) FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN books b ON oi.book_id = b.id WHERE b.seller_id = ? AND o.status = 'cancelled') as cancelled_orders,
                (SELECT COUNT(*) FROM order_items oi JOIN books b ON oi.book_id = b.id WHERE b.seller_id = ?) as total_orders
            FROM dual
        `, [numericSeller, numericSeller, numericSeller, numericSeller, numericSeller]);

        const r = rows[0] || {};
        const activeDisputes = parseInt(r.active_disputes || 0, 10);
        const sellerReports = parseInt(r.seller_reports || 0, 10);
        const listingReports = parseInt(r.listing_reports || 0, 10);
        const cancelled = parseInt(r.cancelled_orders || 0, 10);
        const total = parseInt(r.total_orders || 0, 10);

        const flags = [];

        if (activeDisputes >= 2) {
            flags.push({
                code: 'MULTIPLE_ACTIVE_DISPUTES',
                severity: 'HIGH',
                title: 'Multiple Unresolved Disputes',
                description: `Seller currently has ${activeDisputes} open buyer disputes.`
            });
        }

        if (listingReports >= 3 || sellerReports >= 2) {
            flags.push({
                code: 'REPEATED_CONTENT_REPORTS',
                severity: 'HIGH',
                title: 'High Report Frequency',
                description: `${listingReports + sellerReports} community reports filed against listings/profile.`
            });
        }

        if (total >= 5 && (cancelled / total) >= 0.25) {
            flags.push({
                code: 'HIGH_CANCELLATION_RATE',
                severity: 'MEDIUM',
                title: 'Elevated Cancellation Rate',
                description: `${Math.round((cancelled / total) * 100)}% of orders were cancelled post-purchase.`
            });
        }

        return flags;
    }
}

module.exports = TrustSafetyService;
