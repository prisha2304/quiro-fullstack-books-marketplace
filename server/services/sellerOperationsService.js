const { pool } = require('../config/db');
const AuditService = require('./auditService');
const socket = require('../socket');

// Configurable SLA thresholds in hours
const SLA_CONFIG = {
    PROCESSING_HOURS: 12,
    PACKING_HOURS: 24,
    SHIPPING_HOURS: 24,
    DELIVERY_HOURS: 96
};

// Valid status transitions for the order fulfillment state machine
const FULFILLMENT_TRANSITIONS = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['processing', 'cancelled'],
    'processing': ['ready_to_pack', 'packed', 'cancelled'],
    'ready_to_pack': ['packed', 'cancelled'],
    'packed': ['ready_to_ship', 'shipped', 'cancelled'],
    'ready_to_ship': ['shipped', 'cancelled'],
    'shipped': ['in_transit', 'delivered'],
    'in_transit': ['out_for_delivery', 'delivered'],
    'out_for_delivery': ['delivered'],
    'delivered': ['refunded', 'partially_refunded'],
    'cancelled': [],
    'refunded': [],
    'partially_refunded': []
};

class SellerOperationsService {

    // -------------------------------------------------------------
    // PART 2 & 3: SELLER ONBOARDING & PROFILE COMPLETENESS
    // -------------------------------------------------------------
    static async getSellerOnboarding(sellerId) {
        let [rows] = await pool.execute(
            'SELECT * FROM seller_onboarding WHERE seller_id = ?',
            [sellerId]
        );

        if (rows.length === 0) {
            await pool.execute(
                'INSERT INTO seller_onboarding (seller_id, seller_status) VALUES (?, "NOT_STARTED")',
                [sellerId]
            );
            [rows] = await pool.execute(
                'SELECT * FROM seller_onboarding WHERE seller_id = ?',
                [sellerId]
            );
        }

        const onboarding = rows[0];
        const [userRows] = await pool.execute('SELECT full_name, profile_image, phone, bio, college FROM users WHERE id = ?', [sellerId]);
        const user = userRows[0] || {};

        const completeness = this.calculateProfileCompleteness(onboarding, user);
        
        // Update completeness percentage if changed
        if (onboarding.profile_completion_percentage !== completeness.score) {
            await pool.execute(
                'UPDATE seller_onboarding SET profile_completion_percentage = ? WHERE seller_id = ?',
                [completeness.score, sellerId]
            );
            onboarding.profile_completion_percentage = completeness.score;
        }

        return {
            onboarding,
            completeness
        };
    }

    static calculateProfileCompleteness(onboarding = {}, user = {}) {
        let score = 0;
        const suggestions = [];

        if (user.full_name || onboarding.seller_display_name) {
            score += 20;
        } else {
            suggestions.push('Add your full seller display name');
        }

        if (user.profile_image) {
            score += 20;
        } else {
            suggestions.push('Upload a profile or shop avatar');
        }

        if ((user.bio && user.bio.trim().length >= 20) || (onboarding.seller_bio && onboarding.seller_bio.trim().length >= 20)) {
            score += 20;
        } else {
            suggestions.push('Write a short bio introducing your bookshelf to students');
        }

        if (user.phone || onboarding.seller_phone_verified) {
            score += 20;
        } else {
            suggestions.push('Verify your mobile phone for order SMS dispatch');
        }

        if (user.college || onboarding.campus_department) {
            score += 20;
        } else {
            suggestions.push('Specify your campus department / college for student trust');
        }

        return {
            score,
            suggestions
        };
    }

    static async submitSellerOnboarding(sellerId, { seller_display_name, seller_bio, campus_department, phone }, req = null) {
        const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [sellerId]);
        if (userRows.length === 0) throw new Error('Seller user not found');

        // Update user profile info
        await pool.execute(
            'UPDATE users SET full_name = COALESCE(?, full_name), bio = COALESCE(?, bio), phone = COALESCE(?, phone), college = COALESCE(?, college) WHERE id = ?',
            [seller_display_name || null, seller_bio || null, phone || null, campus_department || null, sellerId]
        );

        // Update onboarding record to SUBMITTED
        await pool.execute(`
            INSERT INTO seller_onboarding (seller_id, seller_status, seller_display_name, seller_bio, campus_department, verification_submitted_at)
            VALUES (?, 'SUBMITTED', ?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE 
                seller_status = 'SUBMITTED',
                seller_display_name = VALUES(seller_display_name),
                seller_bio = VALUES(seller_bio),
                campus_department = VALUES(campus_department),
                verification_submitted_at = CURRENT_TIMESTAMP
        `, [sellerId, seller_display_name || null, seller_bio || null, campus_department || null]);

        await AuditService.log(sellerId, 'SELLER_ONBOARDING_SUBMITTED', 'SELLER_ONBOARDING', sellerId, {
            seller_display_name, campus_department
        }, req);

        socket.sendNotification(sellerId, {
            type: 'SELLER_ONBOARDING_UPDATED',
            message: 'Your seller verification request has been submitted for fast campus review!',
            reference_id: sellerId
        });

        return { success: true, message: 'Onboarding application submitted for review' };
    }

    static async reviewSellerOnboarding(adminId, sellerId, { decision, rejectionReason }, req = null) {
        const validDecisions = ['VERIFIED', 'REJECTED', 'UNDER_REVIEW', 'SUSPENDED'];
        if (!validDecisions.includes(decision)) {
            throw new Error(`Invalid onboarding review decision: ${decision}`);
        }

        await pool.execute(`
            UPDATE seller_onboarding 
            SET seller_status = ?,
                rejection_reason = ?,
                verification_reviewed_at = CURRENT_TIMESTAMP,
                onboarding_completed_at = ${decision === 'VERIFIED' ? 'CURRENT_TIMESTAMP' : 'onboarding_completed_at'}
            WHERE seller_id = ?
        `, [decision, rejectionReason || null, sellerId]);

        await AuditService.log(adminId, 'SELLER_ONBOARDING_REVIEWED', 'SELLER_ONBOARDING', sellerId, {
            decision, rejectionReason
        }, req);

        socket.sendNotification(sellerId, {
            type: 'SELLER_ONBOARDING_UPDATED',
            message: decision === 'VERIFIED' 
                ? 'Congratulations! Your BookNest seller status is now officially VERIFIED.'
                : `Seller application update: ${decision}. ${rejectionReason || ''}`,
            reference_id: sellerId
        });

        return { success: true, sellerId, decision };
    }

    // -------------------------------------------------------------
    // PART 4, 5 & 6: LISTING QUALITY ENGINE & DUPLICATE DETECTION
    // -------------------------------------------------------------
    static calculateListingQuality(bookData) {
        let score = 0;
        const issues = [];
        const suggestions = [];

        // 1. Title Quality (20 pts)
        if (bookData.title && bookData.title.trim().length >= 5) {
            score += 20;
        } else {
            issues.push('Title is too short or missing');
            suggestions.push('Provide the full book title and subtitle');
        }

        // 2. Author & Publisher (15 pts)
        if (bookData.author && bookData.author.trim().length >= 3) {
            score += 15;
        } else {
            issues.push('Author name missing');
            suggestions.push('Specify primary author(s)');
        }

        // 3. ISBN / Edition (15 pts)
        if (bookData.isbn && bookData.isbn.trim().length >= 9) {
            score += 15;
        } else {
            issues.push('ISBN missing');
            suggestions.push('Adding a 10 or 13-digit ISBN doubles search visibility');
        }

        // 4. Description Quality (15 pts)
        if (bookData.description && bookData.description.trim().length >= 30) {
            score += 15;
        } else {
            issues.push('Description too brief');
            suggestions.push('Describe book edition, notes/highlights, or syllabus alignment');
        }

        // 5. Condition Standardization (15 pts)
        const validConditions = ['NEW', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'];
        const normalizedCondition = this.standardizeCondition(bookData.condition);
        if (validConditions.includes(normalizedCondition)) {
            score += 15;
        } else {
            issues.push('Condition not standardized');
            suggestions.push('Select a standard condition rating (New, Like New, Good, Acceptable)');
        }

        // 6. Cover Image (20 pts)
        if (bookData.cover_image && bookData.cover_image.trim().length > 5) {
            score += 20;
        } else {
            issues.push('Cover image missing');
            suggestions.push('Upload a clear front-cover photo');
        }

        let qualityStatus = 'INCOMPLETE';
        if (score >= 85) qualityStatus = 'EXCELLENT';
        else if (score >= 65) qualityStatus = 'GOOD';
        else if (score >= 45) qualityStatus = 'NEEDS_IMPROVEMENT';

        return {
            qualityScore: score,
            qualityStatus,
            issues,
            suggestions,
            standardizedCondition: normalizedCondition
        };
    }

    static standardizeCondition(condition) {
        if (!condition) return 'GOOD';
        const c = condition.toUpperCase().replace(/\s+/g, '_');
        if (['NEW', 'BRAND_NEW'].includes(c)) return 'NEW';
        if (['LIKE_NEW', 'AS_NEW', 'MINT'].includes(c)) return 'LIKE_NEW';
        if (['VERY_GOOD', 'EXCELLENT', 'FINE'].includes(c)) return 'VERY_GOOD';
        if (['GOOD', 'DECENT', 'MODERATE'].includes(c)) return 'GOOD';
        if (['ACCEPTABLE', 'FAIR', 'POOR', 'READABLE'].includes(c)) return 'ACCEPTABLE';
        return 'GOOD';
    }

    static async detectPotentialDuplicate(bookData, sellerId, excludeBookId = null) {
        if (!bookData.title && !bookData.isbn) {
            return { isDuplicate: false };
        }

        const normalizedTitle = (bookData.title || '').trim().toLowerCase();
        const isbn = (bookData.isbn || '').trim();

        let query = `
            SELECT id, title, author, isbn, price, status, \`condition\`
            FROM books 
            WHERE seller_id = ? AND status != 'unavailable'
        `;
        const params = [sellerId];

        if (excludeBookId) {
            query += ' AND id != ?';
            params.push(excludeBookId);
        }

        const [existingListings] = await pool.execute(query, params);

        for (const item of existingListings) {
            // Check exact ISBN match
            if (isbn && item.isbn && isbn.replace(/[-\s]/g, '') === item.isbn.replace(/[-\s]/g, '')) {
                return {
                    isDuplicate: true,
                    matchType: 'ISBN_EXACT',
                    matchedListing: item,
                    message: `This listing matches an existing book in your catalog with ISBN ${isbn}.`
                };
            }

            // Check normalized Title + Author match
            const itemTitle = (item.title || '').trim().toLowerCase();
            const itemAuthor = (item.author || '').trim().toLowerCase();
            const author = (bookData.author || '').trim().toLowerCase();

            if (normalizedTitle.length > 5 && itemTitle === normalizedTitle && (author === itemAuthor || !author)) {
                return {
                    isDuplicate: true,
                    matchType: 'TITLE_AUTHOR_MATCH',
                    matchedListing: item,
                    message: `You already have an active listing titled "${item.title}".`
                };
            }
        }

        return { isDuplicate: false };
    }

    static async evaluateAndSaveListingQuality(bookId, sellerId) {
        const [bookRows] = await pool.execute('SELECT * FROM books WHERE id = ? AND seller_id = ?', [bookId, sellerId]);
        if (bookRows.length === 0) throw new Error('Book not found or unauthorized');

        const book = bookRows[0];
        const quality = this.calculateListingQuality(book);
        const dupCheck = await this.detectPotentialDuplicate(book, sellerId, bookId);

        // Upsert into listing_moderation
        await pool.execute(`
            INSERT INTO listing_moderation (
                book_id, seller_id, quality_score, quality_status, 
                quality_issues, quality_suggestions,
                is_duplicate_suspect, duplicate_matched_book_id, moderation_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                quality_score = VALUES(quality_score),
                quality_status = VALUES(quality_status),
                quality_issues = VALUES(quality_issues),
                quality_suggestions = VALUES(quality_suggestions),
                is_duplicate_suspect = VALUES(is_duplicate_suspect),
                duplicate_matched_book_id = VALUES(duplicate_matched_book_id),
                moderation_status = IF(listing_moderation.moderation_status = 'PENDING_REVIEW' AND VALUES(is_duplicate_suspect) = 1, 'FLAGGED', listing_moderation.moderation_status)
        `, [
            bookId, 
            sellerId, 
            quality.qualityScore, 
            quality.qualityStatus, 
            JSON.stringify(quality.issues),
            JSON.stringify(quality.suggestions),
            dupCheck.isDuplicate ? 1 : 0, 
            dupCheck.matchedListing ? dupCheck.matchedListing.id : null,
            dupCheck.isDuplicate ? 'FLAGGED' : 'ACTIVE'
        ]);

        return {
            bookId,
            quality,
            duplicateCheck: dupCheck
        };
    }

    static async getAllSellerListingsQuality(sellerId) {
        const [books] = await pool.execute(`
            SELECT b.id, b.title, b.author, b.price, b.isbn, b.\`condition\`, b.cover_image, b.stock, b.status,
                   lm.quality_score, lm.quality_status, lm.is_duplicate_suspect, lm.moderation_status
            FROM books b
            LEFT JOIN listing_moderation lm ON b.id = lm.book_id
            WHERE b.seller_id = ? AND b.status != 'unavailable'
            ORDER BY b.created_at DESC
        `, [sellerId]);

        const analyzedListings = books.map(b => {
            const quality = this.calculateListingQuality({
                title: b.title,
                author: b.author,
                isbn: b.isbn,
                condition: b.condition,
                cover_image: b.cover_image,
                description: b.description || ''
            });

            return {
                id: b.id,
                title: b.title,
                author: b.author,
                price: parseFloat(b.price),
                stock: b.stock,
                status: b.status,
                qualityScore: b.quality_score !== null ? b.quality_score : quality.qualityScore,
                qualityStatus: b.quality_status || quality.qualityStatus,
                isDuplicateSuspect: Boolean(b.is_duplicate_suspect),
                moderationStatus: b.moderation_status || 'ACTIVE',
                issues: quality.issues,
                suggestions: quality.suggestions
            };
        });

        return {
            listings: analyzedListings,
            averageScore: analyzedListings.length > 0 
                ? Math.round(analyzedListings.reduce((sum, item) => sum + item.qualityScore, 0) / analyzedListings.length) 
                : 100
        };
    }

    static async moderateListing(adminId, bookId, { decision, reason }, req = null) {
        const validDecisions = ['ACTIVE', 'FLAGGED', 'REJECTED', 'SUSPENDED'];
        if (!validDecisions.includes(decision)) {
            throw new Error(`Invalid moderation decision: ${decision}`);
        }

        const [bookRows] = await pool.execute('SELECT seller_id, title FROM books WHERE id = ?', [bookId]);
        if (bookRows.length === 0) throw new Error('Book listing not found');
        const book = bookRows[0];

        await pool.execute(`
            INSERT INTO listing_moderation (book_id, seller_id, moderation_status, flagged_reason, moderated_by_admin_id, moderated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                moderation_status = VALUES(moderation_status),
                flagged_reason = VALUES(flagged_reason),
                moderated_by_admin_id = VALUES(moderated_by_admin_id),
                moderated_at = CURRENT_TIMESTAMP
        `, [bookId, book.seller_id, decision, reason || null, adminId]);

        if (decision === 'REJECTED' || decision === 'SUSPENDED') {
            await pool.execute('UPDATE books SET status = "unavailable" WHERE id = ?', [bookId]);
        } else if (decision === 'ACTIVE') {
            await pool.execute('UPDATE books SET status = "available" WHERE id = ? AND status = "unavailable"', [bookId]);
        }

        await AuditService.log(adminId, 'LISTING_MODERATED', 'BOOK_LISTING', bookId, {
            decision, reason, sellerId: book.seller_id
        }, req);

        socket.sendNotification(book.seller_id, {
            type: 'LISTING_MODERATION_UPDATED',
            message: `Your listing "${book.title}" status is now ${decision}. ${reason || ''}`,
            reference_id: bookId
        });

        return { success: true, bookId, decision };
    }

    // -------------------------------------------------------------
    // PART 7 & 8: INVENTORY INTELLIGENCE & SELLER RECOMMENDATIONS
    // -------------------------------------------------------------
    static async getSellerInventoryIntelligence(sellerId) {
        const [books] = await pool.execute(`
            SELECT b.*,
                   COALESCE(SUM(ir.quantity), 0) as reserved_stock,
                   (SELECT COUNT(*) FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.book_id = b.id AND o.status = 'delivered') as total_sold,
                   DATEDIFF(NOW(), b.created_at) as days_listed
            FROM books b
            LEFT JOIN inventory_reservations ir ON b.id = ir.book_id AND ir.status = 'RESERVED' AND ir.expires_at > NOW()
            WHERE b.seller_id = ?
            GROUP BY b.id
            ORDER BY b.created_at DESC
        `, [sellerId]);

        const inventoryItems = books.map((b) => {
            const stock = b.stock !== null ? parseInt(b.stock) : 1;
            const reserved = parseInt(b.reserved_stock || 0);
            const available = Math.max(0, stock - reserved);
            const views = parseInt(b.views || 0);
            const sold = parseInt(b.total_sold || 0);
            const daysListed = parseInt(b.days_listed || 0);
            const conversionRate = views > 0 ? parseFloat(((sold / views) * 100).toFixed(1)) : 0;

            let inventoryHealth = 'HEALTHY';
            if (stock === 0 || b.status === 'sold') {
                inventoryHealth = 'OUT_OF_STOCK';
            } else if (available === 1 && stock <= 1) {
                inventoryHealth = 'LOW_STOCK';
            } else if (daysListed > 45 && views > 10 && sold === 0) {
                inventoryHealth = 'SLOW_MOVING';
            } else if (views >= 20 || b.wishlist_count >= 5) {
                inventoryHealth = 'HIGH_DEMAND';
            }

            return {
                id: b.id,
                title: b.title,
                author: b.author,
                price: parseFloat(b.price),
                stock,
                reserved,
                available,
                sold,
                views,
                wishlistCount: b.wishlist_count || 0,
                daysListed,
                conversionRate,
                inventoryHealth,
                status: b.status
            };
        });

        const recommendations = this.generateSellerGrowthRecommendations(inventoryItems);

        return {
            inventoryItems,
            recommendations,
            summary: {
                totalListings: inventoryItems.length,
                healthyCount: inventoryItems.filter(i => i.inventoryHealth === 'HEALTHY').length,
                lowStockCount: inventoryItems.filter(i => i.inventoryHealth === 'LOW_STOCK').length,
                outOfStockCount: inventoryItems.filter(i => i.inventoryHealth === 'OUT_OF_STOCK').length,
                slowMovingCount: inventoryItems.filter(i => i.inventoryHealth === 'SLOW_MOVING').length,
                highDemandCount: inventoryItems.filter(i => i.inventoryHealth === 'HIGH_DEMAND').length
            }
        };
    }

    static generateSellerGrowthRecommendations(inventoryItems) {
        const recs = [];

        // 1. Slow moving items with high views
        const slowMoving = inventoryItems.filter(i => i.inventoryHealth === 'SLOW_MOVING');
        if (slowMoving.length > 0) {
            const sample = slowMoving[0];
            recs.push({
                type: 'PRICE_OPTIMIZATION',
                title: `Consider a 5-10% price drop on "${sample.title}"`,
                description: `This listing has received ${sample.views} views over ${sample.daysListed} days with 0 purchases. A slight price drop will trigger instant Price-Drop notifications to interested buyers.`,
                impact: 'High',
                bookId: sample.id
            });
        }

        // 2. High demand items low in stock
        const highDemand = inventoryItems.filter(i => i.inventoryHealth === 'HIGH_DEMAND' || i.wishlistCount >= 3);
        if (highDemand.length > 0) {
            const sample = highDemand[0];
            recs.push({
                type: 'RESTOCK_OPPORTUNITY',
                title: `High student interest for "${sample.title}"`,
                description: `Bookmarked by ${sample.wishlistCount} students. If you have additional copies or editions, list them to capture repeat demand.`,
                impact: 'Medium',
                bookId: sample.id
            });
        }

        // 3. Complete missing metadata
        recs.push({
            type: 'METADATA_COMPLETENESS',
            title: 'Listings with complete ISBNs receive 2x more discovery',
            description: 'Books with verified ISBNs match exact syllabus searches and rank higher in student recommendation carousels.',
            impact: 'Medium'
        });

        return recs;
    }

    // -------------------------------------------------------------
    // PART 9, 10 & 11: ORDER FULFILLMENT WORKFLOW & SELLER SLA
    // -------------------------------------------------------------
    static validateFulfillmentTransition(currentStatus, nextStatus) {
        const current = (currentStatus || '').toLowerCase();
        const next = (nextStatus || '').toLowerCase();

        if (current === next) return true;

        const allowed = FULFILLMENT_TRANSITIONS[current] || [];
        return allowed.includes(next);
    }

    static async updateFulfillmentStatus(sellerId, orderId, nextStatus, { trackingNumber, carrier, notes } = {}, req = null) {
        const [orderRows] = await pool.execute(`
            SELECT o.*, oi.book_id, b.seller_id, b.title as book_title
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN books b ON oi.book_id = b.id
            WHERE o.id = ? AND b.seller_id = ?
            LIMIT 1
        `, [orderId, sellerId]);

        if (orderRows.length === 0) {
            throw new Error('Order not found or not authorized for this seller');
        }

        const order = orderRows[0];
        const currentStatus = order.status;

        // Prevent modifying cancelled or refunded orders
        if (currentStatus === 'cancelled' || currentStatus === 'refunded' || currentStatus === 'partially_refunded') {
            throw new Error(`Cannot modify fulfillment for order in status ${currentStatus}`);
        }

        // Validate state transition
        if (!this.validateFulfillmentTransition(currentStatus, nextStatus)) {
            throw new Error(`Invalid fulfillment transition from "${currentStatus}" to "${nextStatus}"`);
        }

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // 1. Update order status
            await connection.execute(
                'UPDATE orders SET status = ?, tracking_number = COALESCE(?, tracking_number), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [nextStatus, trackingNumber || null, orderId]
            );

            // 2. Manage SLA Events
            await this.recordSLAEvent(sellerId, orderId, nextStatus, connection);

            // 3. Create / Update Shipment if tracking provided or shipped
            if (trackingNumber || nextStatus === 'shipped') {
                const autoTracking = trackingNumber || `TRK_${orderId}_${Date.now().toString().slice(-6)}`;
                await connection.execute(`
                    INSERT INTO shipments (order_id, seller_id, tracking_number, carrier, mode, status, shipped_at, estimated_delivery)
                    VALUES (?, ?, ?, ?, 'MOCK', 'IN_TRANSIT', CURRENT_TIMESTAMP, DATE_ADD(NOW(), INTERVAL 3 DAY))
                    ON DUPLICATE KEY UPDATE 
                        tracking_number = VALUES(tracking_number),
                        carrier = VALUES(carrier),
                        status = 'IN_TRANSIT',
                        shipped_at = COALESCE(shipments.shipped_at, CURRENT_TIMESTAMP)
                `, [orderId, sellerId, autoTracking, carrier || 'Campus Courier']);

                // Add timeline event
                const [shipmentRows] = await connection.execute('SELECT id FROM shipments WHERE order_id = ?', [orderId]);
                if (shipmentRows.length > 0) {
                    await connection.execute(`
                        INSERT INTO shipment_events (shipment_id, status, description)
                        VALUES (?, 'IN_TRANSIT', 'Package dispatched and in transit to buyer')
                    `, [shipmentRows[0].id]);
                }
            } else if (nextStatus === 'delivered') {
                await connection.execute(`
                    UPDATE shipments 
                    SET status = 'DELIVERED', delivered_at = CURRENT_TIMESTAMP 
                    WHERE order_id = ?
                `, [orderId]);
            }

            await connection.commit();

            await AuditService.log(sellerId, 'ORDER_FULFILLMENT_UPDATED', 'ORDER', orderId, {
                fromStatus: currentStatus,
                toStatus: nextStatus,
                notes: notes || null
            }, req);

            socket.sendNotification(order.buyer_id, {
                type: 'ORDER_FULFILLMENT_UPDATED',
                message: `Your order #${orderId} status has updated to ${nextStatus.toUpperCase().replace(/_/g, ' ')}.`,
                reference_id: orderId
            });

            return {
                success: true,
                orderId,
                previousStatus: currentStatus,
                status: nextStatus
            };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    static async bulkUpdateFulfillmentStatus(sellerId, { orderIds, nextStatus, notes }, req = null) {
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            throw new Error('Valid orderIds array is required');
        }

        // Prevent destructive bulk states
        const allowedBulkStates = ['processing', 'ready_to_pack', 'packed', 'ready_to_ship'];
        if (!allowedBulkStates.includes(nextStatus)) {
            throw new Error(`Bulk status update not permitted for state "${nextStatus}".`);
        }

        const results = [];
        for (const id of orderIds) {
            try {
                const res = await this.updateFulfillmentStatus(sellerId, id, nextStatus, { notes }, req);
                results.push({ orderId: id, success: true, status: res.status });
            } catch (err) {
                results.push({ orderId: id, success: false, error: err.message });
            }
        }

        return {
            total: orderIds.length,
            successful: results.filter(r => r.success).length,
            results
        };
    }

    static async recordSLAEvent(sellerId, orderId, nextStatus, connection = null) {
        const conn = connection || pool;

        if (nextStatus === 'processing') {
            await conn.execute(`
                INSERT INTO seller_sla_events (seller_id, order_id, sla_type, target_deadline, sla_status)
                VALUES (?, ?, 'PROCESSING', DATE_ADD(NOW(), INTERVAL ${SLA_CONFIG.PROCESSING_HOURS} HOUR), 'ON_TIME')
            `, [sellerId, orderId]);
        } else if (nextStatus === 'packed') {
            await conn.execute(`
                UPDATE seller_sla_events 
                SET completed_at = CURRENT_TIMESTAMP,
                    sla_status = IF(CURRENT_TIMESTAMP <= target_deadline, 'ON_TIME', 'BREACHED')
                WHERE order_id = ? AND sla_type = 'PROCESSING' AND completed_at IS NULL
            `, [orderId]);

            await conn.execute(`
                INSERT INTO seller_sla_events (seller_id, order_id, sla_type, target_deadline, sla_status)
                VALUES (?, ?, 'PACKING', DATE_ADD(NOW(), INTERVAL ${SLA_CONFIG.PACKING_HOURS} HOUR), 'ON_TIME')
            `, [sellerId, orderId]);
        } else if (nextStatus === 'shipped') {
            await conn.execute(`
                UPDATE seller_sla_events 
                SET completed_at = CURRENT_TIMESTAMP,
                    sla_status = IF(CURRENT_TIMESTAMP <= target_deadline, 'ON_TIME', 'BREACHED')
                WHERE order_id = ? AND sla_type = 'PACKING' AND completed_at IS NULL
            `, [orderId]);
        }
    }

    static async getSellerSLASummary(sellerId) {
        const [rows] = await pool.execute(`
            SELECT 
                COUNT(*) as total_tracked_events,
                COALESCE(SUM(CASE WHEN sla_status = 'ON_TIME' THEN 1 ELSE 0 END), 0) as on_time_count,
                COALESCE(SUM(CASE WHEN sla_status = 'BREACHED' THEN 1 ELSE 0 END), 0) as breached_count,
                COALESCE(SUM(CASE WHEN sla_status = 'AT_RISK' OR (completed_at IS NULL AND target_deadline < NOW()) THEN 1 ELSE 0 END), 0) as at_risk_count
            FROM seller_sla_events
            WHERE seller_id = ?
        `, [sellerId]);

        const summary = rows[0] || {};
        const total = parseInt(summary.total_tracked_events || 0);
        const onTime = parseInt(summary.on_time_count || 0);
        const breached = parseInt(summary.breached_count || 0);
        const atRisk = parseInt(summary.at_risk_count || 0);

        const onTimeRate = total > 0 ? parseFloat(((onTime / total) * 100).toFixed(1)) : 100;

        return {
            sellerId,
            totalTrackedEvents: total,
            onTimeCount: onTime,
            breachedCount: breached,
            atRiskCount: atRisk,
            onTimeRate,
            slaConfigHours: SLA_CONFIG
        };
    }

    // -------------------------------------------------------------
    // PART 13, 14 & 15: SHIPMENT TRACKING & TIMELINE
    // -------------------------------------------------------------
    static async createShipment(sellerId, { orderId, trackingNumber, carrier = 'CampusExpress', mode = 'MOCK', estimatedDelivery }, req = null) {
        const [orderRows] = await pool.execute(`
            SELECT o.id, b.seller_id
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN books b ON oi.book_id = b.id
            WHERE o.id = ? AND b.seller_id = ?
            LIMIT 1
        `, [orderId, sellerId]);

        if (orderRows.length === 0) {
            throw new Error('Not authorized to create shipment for this order');
        }

        const est = estimatedDelivery || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

        const [res] = await pool.execute(`
            INSERT INTO shipments (order_id, seller_id, tracking_number, carrier, mode, status, shipped_at, estimated_delivery)
            VALUES (?, ?, ?, ?, ?, 'LABEL_CREATED', CURRENT_TIMESTAMP, ?)
        `, [orderId, sellerId, trackingNumber, carrier, mode, est]);

        const shipmentId = res.insertId;

        // Add initial event
        await pool.execute(`
            INSERT INTO shipment_events (shipment_id, status, location, description)
            VALUES (?, 'LABEL_CREATED', 'Campus Store', 'Shipping label created. Awaiting pickup.')
        `, [shipmentId]);

        await AuditService.log(sellerId, 'SHIPMENT_CREATED', 'SHIPMENT', shipmentId, {
            orderId, trackingNumber, carrier, mode
        }, req);

        return {
            success: true,
            shipmentId,
            trackingNumber,
            carrier,
            mode
        };
    }

    static async addShipmentEvent(shipmentId, { status, location, description }) {
        await pool.execute(`
            INSERT INTO shipment_events (shipment_id, status, location, description)
            VALUES (?, ?, ?, ?)
        `, [shipmentId, status, location || null, description]);

        // Update shipment status if valid
        const validShipmentStatuses = ['LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED'];
        if (validShipmentStatuses.includes(status)) {
            await pool.execute(
                'UPDATE shipments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, shipmentId]
            );
        }

        return { success: true, shipmentId, status };
    }

    static async getBuyerShipmentTimeline(orderId) {
        const [shipmentRows] = await pool.execute(
            'SELECT * FROM shipments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
            [orderId]
        );

        if (shipmentRows.length === 0) {
            return {
                hasShipment: false,
                orderId,
                status: 'PROCESSING',
                events: []
            };
        }

        const shipment = shipmentRows[0];
        const [events] = await pool.execute(
            'SELECT * FROM shipment_events WHERE shipment_id = ? ORDER BY event_time ASC',
            [shipment.id]
        );

        return {
            hasShipment: true,
            shipmentId: shipment.id,
            trackingNumber: shipment.tracking_number,
            carrier: shipment.carrier,
            mode: shipment.mode,
            status: shipment.status,
            shippedAt: shipment.shipped_at,
            estimatedDelivery: shipment.estimated_delivery,
            deliveredAt: shipment.delivered_at,
            events
        };
    }

    // -------------------------------------------------------------
    // PART 17, 18 & 19: SELLER RISK SIGNALS & ADMIN OPERATIONS CENTER
    // -------------------------------------------------------------
    static async calculateSellerRiskSignals(sellerId) {
        // Calculate late shipments, cancellation rate, dispute rate, refund rate
        const [orderStats] = await pool.execute(`
            SELECT 
                COUNT(o.id) as total_orders,
                COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_orders,
                COALESCE(SUM(CASE WHEN o.status = 'refunded' THEN 1 ELSE 0 END), 0) as refunded_orders
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN books b ON oi.book_id = b.id
            WHERE b.seller_id = ?
        `, [sellerId]);

        const [disputeStats] = await pool.execute(`
            SELECT COUNT(*) as total_disputes
            FROM disputes
            WHERE respondent_id = ?
        `, [sellerId]);

        const [slaStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_slas,
                COALESCE(SUM(CASE WHEN sla_status = 'BREACHED' THEN 1 ELSE 0 END), 0) as breaches
            FROM seller_sla_events
            WHERE seller_id = ?
        `, [sellerId]);

        const stats = orderStats[0] || {};
        const totalOrders = parseInt(stats.total_orders || 0);
        const cancellations = parseInt(stats.cancelled_orders || 0);
        const refunds = parseInt(stats.refunded_orders || 0);
        const disputes = parseInt(disputeStats[0]?.total_disputes || 0);
        const slaBreaches = parseInt(slaStats[0]?.breaches || 0);

        const cancellationRate = totalOrders > 0 ? (cancellations / totalOrders) * 100 : 0;
        const disputeRate = totalOrders > 0 ? (disputes / totalOrders) * 100 : 0;

        const signals = [];
        let riskLevel = 'LOW';

        if (cancellationRate >= 20 && totalOrders >= 5) {
            signals.push(`High cancellation rate of ${cancellationRate.toFixed(1)}%`);
            riskLevel = 'MEDIUM';
        }
        if (disputeRate >= 15 && totalOrders >= 5) {
            signals.push(`High dispute rate of ${disputeRate.toFixed(1)}%`);
            riskLevel = 'HIGH';
        }
        if (slaBreaches >= 3) {
            signals.push(`${slaBreaches} SLA delivery/fulfillment breaches`);
            if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
        }

        return {
            sellerId,
            riskLevel,
            signals,
            metrics: {
                totalOrders,
                cancellations,
                cancellationRate: parseFloat(cancellationRate.toFixed(1)),
                disputes,
                disputeRate: parseFloat(disputeRate.toFixed(1)),
                refunds,
                slaBreaches
            }
        };
    }

    // -------------------------------------------------------------
    // PART 20, 21 & 22: SELLER & ADMIN OPERATIONAL DASHBOARDS
    // -------------------------------------------------------------
    static async getSellerOperationsOverview(sellerId) {
        const onboarding = await this.getSellerOnboarding(sellerId);
        const inventory = await this.getSellerInventoryIntelligence(sellerId);
        const sla = await this.getSellerSLASummary(sellerId);
        const listingQuality = await this.getAllSellerListingsQuality(sellerId);

        // Get Fulfillment Order Queues
        const [orders] = await pool.execute(`
            SELECT o.id, o.total_price, o.status, o.created_at, o.tracking_number,
                   b.title as book_title, u.full_name as buyer_name, u.college as buyer_college
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN books b ON oi.book_id = b.id
            JOIN users u ON o.buyer_id = u.id
            WHERE b.seller_id = ?
            ORDER BY o.created_at DESC
            LIMIT 50
        `, [sellerId]);

        const fulfillmentQueue = {
            pending: orders.filter(o => ['confirmed', 'processing', 'ready_to_pack'].includes(o.status)),
            packed: orders.filter(o => ['packed', 'ready_to_ship'].includes(o.status)),
            shipped: orders.filter(o => ['shipped', 'in_transit', 'out_for_delivery'].includes(o.status)),
            delivered: orders.filter(o => o.status === 'delivered')
        };

        return {
            sellerId,
            onboarding: onboarding.onboarding,
            completeness: onboarding.completeness,
            inventorySummary: inventory.summary,
            recommendations: inventory.recommendations,
            sla,
            averageListingQuality: listingQuality.averageScore,
            fulfillmentQueue,
            totalOrders: orders.length
        };
    }

    static async getBuyerPublicSellerProfile(sellerId) {
        const [userRows] = await pool.execute(`
            SELECT u.id, u.full_name, u.profile_image, u.college, u.created_at,
                   so.seller_status, so.seller_display_name, so.seller_bio
            FROM users u
            LEFT JOIN seller_onboarding so ON u.id = so.seller_id
            WHERE u.id = ?
        `, [sellerId]);

        if (userRows.length === 0) throw new Error('Seller not found');

        const seller = userRows[0];

        // Public metrics only
        const [reviews] = await pool.execute(`
            SELECT COUNT(*) as total_reviews, COALESCE(AVG(rating), 5.0) as average_rating
            FROM reviews
            WHERE seller_id = ?
        `, [sellerId]);

        const [sales] = await pool.execute(`
            SELECT COUNT(DISTINCT o.id) as total_sales
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN books b ON oi.book_id = b.id
            WHERE b.seller_id = ? AND o.status = 'delivered'
        `, [sellerId]);

        const [activeListings] = await pool.execute(`
            SELECT id, title, author, price, cover_image, \`condition\`
            FROM books
            WHERE seller_id = ? AND status = 'available'
            LIMIT 12
        `, [sellerId]);

        return {
            sellerId: seller.id,
            name: seller.seller_display_name || seller.full_name,
            bio: seller.seller_bio || 'Student BookNest seller',
            college: seller.college,
            isVerified: seller.seller_status === 'VERIFIED',
            memberSince: seller.created_at,
            averageRating: parseFloat(parseFloat(reviews[0]?.average_rating || 5).toFixed(1)),
            totalReviews: parseInt(reviews[0]?.total_reviews || 0),
            totalCompletedSales: parseInt(sales[0]?.total_sales || 0),
            activeListings
        };
    }

    static async getAdminOperationsOverview() {
        // 1. Pending Seller Onboardings
        const [pendingOnboardings] = await pool.execute(`
            SELECT so.*, u.full_name as user_name, u.email as user_email
            FROM seller_onboarding so
            JOIN users u ON so.seller_id = u.id
            WHERE so.seller_status IN ('SUBMITTED', 'UNDER_REVIEW')
            ORDER BY so.verification_submitted_at ASC
        `);

        // 2. Listing Moderation Queue
        const [moderationQueue] = await pool.execute(`
            SELECT lm.*, b.title, b.author, b.price, b.cover_image, u.full_name as seller_name
            FROM listing_moderation lm
            JOIN books b ON lm.book_id = b.id
            JOIN users u ON lm.seller_id = u.id
            WHERE lm.moderation_status IN ('PENDING_REVIEW', 'FLAGGED')
               OR lm.is_duplicate_suspect = 1
            ORDER BY lm.created_at DESC
        `);

        // 3. At-Risk / Pending Fulfillment Orders
        const [atRiskOrders] = await pool.execute(`
            SELECT o.id, o.total_price, o.status, o.created_at,
                   u.full_name as buyer_name,
                   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
            FROM orders o
            JOIN users u ON o.buyer_id = u.id
            WHERE o.status IN ('confirmed', 'processing', 'ready_to_pack')
            ORDER BY o.created_at ASC
            LIMIT 20
        `);

        // 4. Marketplace Operations Health Metrics
        const [healthStats] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM seller_onboarding WHERE seller_status = 'VERIFIED') as verified_sellers,
                (SELECT COUNT(*) FROM seller_onboarding WHERE seller_status = 'SUBMITTED') as pending_seller_reviews,
                (SELECT COUNT(*) FROM listing_moderation WHERE moderation_status = 'FLAGGED') as flagged_listings,
                (SELECT COUNT(*) FROM orders WHERE status IN ('confirmed', 'processing', 'ready_to_pack', 'packed')) as pending_fulfillment_orders,
                (SELECT COUNT(*) FROM seller_sla_events WHERE sla_status = 'BREACHED') as total_sla_breaches,
                (SELECT COUNT(*) FROM disputes WHERE status = 'OPEN') as open_disputes
        `);

        return {
            metrics: healthStats[0] || {},
            pendingOnboardings,
            moderationQueue,
            atRiskOrders
        };
    }
}

module.exports = SellerOperationsService;
