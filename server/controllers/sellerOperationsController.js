const SellerOperationsService = require('../services/sellerOperationsService');
const { pool } = require('../config/db');

class SellerOperationsController {

    // -------------------------------------------------------------
    // SELLER ONBOARDING
    // -------------------------------------------------------------
    static async getOnboarding(req, res) {
        try {
            const sellerId = req.user.id;
            const data = await SellerOperationsService.getSellerOnboarding(sellerId);
            res.json({ success: true, ...data });
        } catch (err) {
            console.error('getOnboarding error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async submitOnboarding(req, res) {
        try {
            const sellerId = req.user.id;
            const { seller_display_name, seller_bio, campus_department, phone } = req.body;
            const result = await SellerOperationsService.submitSellerOnboarding(
                sellerId, 
                { seller_display_name, seller_bio, campus_department, phone }, 
                req
            );
            res.json(result);
        } catch (err) {
            console.error('submitOnboarding error:', err);
            res.status(400).json({ error: err.message });
        }
    }

    // -------------------------------------------------------------
    // LISTING QUALITY & DUPLICATES
    // -------------------------------------------------------------
    static async getListingQuality(req, res) {
        try {
            const sellerId = req.user.id;
            const bookId = parseInt(req.params.id, 10);
            const result = await SellerOperationsService.evaluateAndSaveListingQuality(bookId, sellerId);
            res.json({ success: true, ...result });
        } catch (err) {
            console.error('getListingQuality error:', err);
            res.status(404).json({ error: err.message });
        }
    }

    static async getAllSellerListingsQuality(req, res) {
        try {
            const sellerId = req.user.id;
            const result = await SellerOperationsService.getAllSellerListingsQuality(sellerId);
            res.json({ success: true, ...result });
        } catch (err) {
            console.error('getAllSellerListingsQuality error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async checkDuplicate(req, res) {
        try {
            const sellerId = req.user.id;
            const bookId = req.params.id ? parseInt(req.params.id, 10) : null;
            const bookData = req.body;
            const result = await SellerOperationsService.detectPotentialDuplicate(bookData, sellerId, bookId);
            res.json({ success: true, ...result });
        } catch (err) {
            console.error('checkDuplicate error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    // -------------------------------------------------------------
    // FULFILLMENT & SLA
    // -------------------------------------------------------------
    static async getFulfillmentOrders(req, res) {
        try {
            const sellerId = req.user.id;
            const statusFilter = req.query.status;

            let query = `
                SELECT o.id, o.buyer_id, o.total_price, o.status, o.tracking_number, o.created_at, o.updated_at,
                       b.id as book_id, b.title as book_title, b.author, b.price as item_price, b.cover_image,
                       u.full_name as buyer_name, u.college as buyer_college, u.email as buyer_email
                FROM orders o
                JOIN order_items oi ON o.id = oi.order_id
                JOIN books b ON oi.book_id = b.id
                JOIN users u ON o.buyer_id = u.id
                WHERE b.seller_id = ?
            `;
            const params = [sellerId];

            if (statusFilter) {
                query += ' AND o.status = ?';
                params.push(statusFilter);
            }

            query += ' ORDER BY o.created_at DESC';

            const [orders] = await pool.execute(query, params);
            res.json({ success: true, orders });
        } catch (err) {
            console.error('getFulfillmentOrders error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async updateFulfillmentStatus(req, res) {
        try {
            const sellerId = req.user.id;
            const orderId = parseInt(req.params.id, 10);
            const { status, trackingNumber, carrier, notes } = req.body;

            if (!status) {
                return res.status(400).json({ error: 'Status is required' });
            }

            const result = await SellerOperationsService.updateFulfillmentStatus(
                sellerId, 
                orderId, 
                status, 
                { trackingNumber, carrier, notes }, 
                req
            );
            res.json(result);
        } catch (err) {
            console.error('updateFulfillmentStatus error:', err);
            res.status(400).json({ error: err.message });
        }
    }

    static async bulkUpdateFulfillmentStatus(req, res) {
        try {
            const sellerId = req.user.id;
            const { orderIds, nextStatus, notes } = req.body;
            const result = await SellerOperationsService.bulkUpdateFulfillmentStatus(
                sellerId, 
                { orderIds, nextStatus, notes }, 
                req
            );
            res.json(result);
        } catch (err) {
            console.error('bulkUpdateFulfillmentStatus error:', err);
            res.status(400).json({ error: err.message });
        }
    }

    static async getSellerSLA(req, res) {
        try {
            const sellerId = req.user.id;
            const result = await SellerOperationsService.getSellerSLASummary(sellerId);
            res.json({ success: true, ...result });
        } catch (err) {
            console.error('getSellerSLA error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    // -------------------------------------------------------------
    // SHIPMENTS
    // -------------------------------------------------------------
    static async createShipment(req, res) {
        try {
            const sellerId = req.user.id;
            const { orderId, trackingNumber, carrier, mode, estimatedDelivery } = req.body;
            const result = await SellerOperationsService.createShipment(
                sellerId,
                { orderId, trackingNumber, carrier, mode, estimatedDelivery },
                req
            );
            res.json(result);
        } catch (err) {
            console.error('createShipment error:', err);
            res.status(400).json({ error: err.message });
        }
    }

    static async getShipmentTimeline(req, res) {
        try {
            const orderId = parseInt(req.params.orderId, 10);
            const result = await SellerOperationsService.getBuyerShipmentTimeline(orderId);
            res.json({ success: true, ...result });
        } catch (err) {
            console.error('getShipmentTimeline error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async addShipmentEvent(req, res) {
        try {
            const shipmentId = parseInt(req.params.id, 10);
            const { status, location, description } = req.body;
            const result = await SellerOperationsService.addShipmentEvent(shipmentId, { status, location, description });
            res.json(result);
        } catch (err) {
            console.error('addShipmentEvent error:', err);
            res.status(400).json({ error: err.message });
        }
    }

    // -------------------------------------------------------------
    // SELLER OPERATIONS & INTELLIGENCE
    // -------------------------------------------------------------
    static async getOperationsOverview(req, res) {
        try {
            const sellerId = req.user.id;
            const overview = await SellerOperationsService.getSellerOperationsOverview(sellerId);
            res.json({ success: true, ...overview });
        } catch (err) {
            console.error('getOperationsOverview error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async getInventoryIntelligence(req, res) {
        try {
            const sellerId = req.user.id;
            const result = await SellerOperationsService.getSellerInventoryIntelligence(sellerId);
            res.json({ success: true, ...result });
        } catch (err) {
            console.error('getInventoryIntelligence error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async getOperationsInsights(req, res) {
        try {
            const sellerId = req.user.id;
            const inv = await SellerOperationsService.getSellerInventoryIntelligence(sellerId);
            const risk = await SellerOperationsService.calculateSellerRiskSignals(sellerId);
            res.json({
                success: true,
                recommendations: inv.recommendations,
                operationalRisk: risk
            });
        } catch (err) {
            console.error('getOperationsInsights error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async getPublicSellerProfile(req, res) {
        try {
            const sellerId = parseInt(req.params.sellerId, 10);
            const profile = await SellerOperationsService.getBuyerPublicSellerProfile(sellerId);
            res.json({ success: true, profile });
        } catch (err) {
            console.error('getPublicSellerProfile error:', err);
            res.status(404).json({ error: err.message });
        }
    }

    // -------------------------------------------------------------
    // ADMIN OPERATIONS CENTER
    // -------------------------------------------------------------
    static async getAdminOperationsOverview(req, res) {
        try {
            const overview = await SellerOperationsService.getAdminOperationsOverview();
            res.json({ success: true, ...overview });
        } catch (err) {
            console.error('getAdminOperationsOverview error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async getAdminModerationQueue(req, res) {
        try {
            const [queue] = await pool.execute(`
                SELECT lm.*, b.title, b.author, b.price, b.cover_image, b.isbn,
                       u.full_name as seller_name, u.email as seller_email
                FROM listing_moderation lm
                JOIN books b ON lm.book_id = b.id
                JOIN users u ON lm.seller_id = u.id
                ORDER BY lm.created_at DESC
            `);
            res.json({ success: true, queue });
        } catch (err) {
            console.error('getAdminModerationQueue error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async moderateListing(req, res) {
        try {
            const adminId = req.user.id;
            const bookId = parseInt(req.params.id, 10);
            const { decision, reason } = req.body;
            const result = await SellerOperationsService.moderateListing(adminId, bookId, { decision, reason }, req);
            res.json(result);
        } catch (err) {
            console.error('moderateListing error:', err);
            res.status(400).json({ error: err.message });
        }
    }

    static async reviewSellerOnboarding(req, res) {
        try {
            const adminId = req.user.id;
            const sellerId = parseInt(req.params.id, 10);
            const { decision, rejectionReason } = req.body;
            const result = await SellerOperationsService.reviewSellerOnboarding(
                adminId, 
                sellerId, 
                { decision, rejectionReason }, 
                req
            );
            res.json(result);
        } catch (err) {
            console.error('reviewSellerOnboarding error:', err);
            res.status(400).json({ error: err.message });
        }
    }

    static async getAdminSellers(req, res) {
        try {
            const [sellers] = await pool.execute(`
                SELECT u.id, u.full_name, u.email, u.college, u.created_at,
                       so.seller_status, so.profile_completion_percentage, so.verification_submitted_at,
                       (SELECT COUNT(*) FROM books WHERE seller_id = u.id AND status != 'deleted') as total_listings,
                       (SELECT COUNT(DISTINCT o.id) FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN books b ON oi.book_id = b.id WHERE b.seller_id = u.id) as total_orders
                FROM users u
                LEFT JOIN seller_onboarding so ON u.id = so.seller_id
                WHERE u.id IN (SELECT DISTINCT seller_id FROM books) OR so.seller_status IS NOT NULL
                ORDER BY so.verification_submitted_at DESC, u.created_at DESC
            `);

            // Compute risk signal for each seller
            const enrichedSellers = await Promise.all(sellers.map(async (s) => {
                const risk = await SellerOperationsService.calculateSellerRiskSignals(s.id);
                return {
                    ...s,
                    risk
                };
            }));

            res.json({ success: true, sellers: enrichedSellers });
        } catch (err) {
            console.error('getAdminSellers error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async getAdminSLA(req, res) {
        try {
            const [events] = await pool.execute(`
                SELECT sse.*, u.full_name as seller_name, o.total_price, o.status as order_status
                FROM seller_sla_events sse
                JOIN users u ON sse.seller_id = u.id
                JOIN orders o ON sse.order_id = o.id
                ORDER BY sse.created_at DESC
                LIMIT 50
            `);
            res.json({ success: true, events });
        } catch (err) {
            console.error('getAdminSLA error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    static async getAdminShipments(req, res) {
        try {
            const [shipments] = await pool.execute(`
                SELECT s.*, u.full_name as seller_name, o.total_price, o.buyer_id
                FROM shipments s
                JOIN users u ON s.seller_id = u.id
                JOIN orders o ON s.order_id = o.id
                ORDER BY s.created_at DESC
                LIMIT 50
            `);
            res.json({ success: true, shipments });
        } catch (err) {
            console.error('getAdminShipments error:', err);
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = SellerOperationsController;
