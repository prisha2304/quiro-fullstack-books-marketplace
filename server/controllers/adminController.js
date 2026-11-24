const { pool } = require('../config/db');
const AuditService = require('../services/auditService');
const Announcement = require('../models/Announcement');
const { NotificationService } = require('../services/notificationService');
const PaymentService = require('../services/paymentService');
const socket = require('../socket');
const User = require('../models/User');

const getAuditLogs = async (req, res) => {
    try {
        const { limit = 50, offset = 0, entity_type } = req.query;
        const logs = await AuditService.getLogs(limit, offset, entity_type);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const stats = {};

        // 1. User counts
        const [users] = await pool.execute('SELECT COUNT(*) as total, COUNT(CASE WHEN role="ADMIN" THEN 1 END) as admins FROM users');
        stats.totalUsers = users[0].total;
        
        // 2. Book stats
        const [books] = await pool.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status="sold" THEN 1 END) as sold,
                COUNT(CASE WHEN status="swapped" THEN 1 END) as swapped,
                COUNT(CASE WHEN status="available" THEN 1 END) as active
            FROM books
        `);
        stats.totalBooks = books[0].total;
        stats.booksSold = books[0].sold;
        stats.booksSwapped = books[0].swapped;
        stats.activeListings = books[0].active;

        // 3. Order stats
        const [orders] = await pool.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status="pending" THEN 1 END) as pending,
                COUNT(CASE WHEN status="completed" OR status="delivered" THEN 1 END) as completed,
                SUM(CASE WHEN status="completed" OR status="delivered" THEN total_price ELSE 0 END) as revenue
            FROM orders
        `);
        stats.totalOrders = orders[0].total;
        stats.pendingOrders = orders[0].pending;
        stats.completedOrders = orders[0].completed;
        stats.revenueGenerated = parseFloat(orders[0].revenue || 0).toFixed(2);

        // 4. Swap stats
        const [swaps] = await pool.execute('SELECT COUNT(*) as total, COUNT(CASE WHEN status="pending" THEN 1 END) as pending FROM swap_requests');
        stats.totalSwaps = swaps[0].total;
        stats.pendingSwaps = swaps[0].pending;

        // 5. Review stats
        const [reviews] = await pool.execute('SELECT COUNT(*) as total, AVG(rating) as avg FROM reviews');
        stats.totalReviews = reviews[0].total;
        stats.avgRating = parseFloat(reviews[0].avg || 0).toFixed(1);

        // 6. Platform Activity Intelligence (Activity Center & Broadcast additions)
        const [notifCount] = await pool.execute('SELECT COUNT(*) as count FROM notifications');
        stats.totalNotifications = notifCount[0]?.count || 0;

        const [msgToday] = await pool.execute('SELECT COUNT(*) as count FROM messages WHERE created_at >= CURDATE()');
        stats.messagesToday = msgToday[0]?.count || 0;

        const [activeUsersRow] = await pool.execute(`
            SELECT COUNT(DISTINCT user_id) as count FROM (
                SELECT buyer_id as user_id FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                UNION
                SELECT seller_id as user_id FROM books WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                UNION
                SELECT sender_id as user_id FROM messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ) as active_u
        `);
        stats.activeUsers = Math.max(activeUsersRow[0]?.count || 0, stats.totalUsers > 0 ? 1 : 0);
        
        // Online Users live count
        const ioInstance = socket.getIo();
        stats.onlineUsers = ioInstance ? Math.max(ioInstance.engine?.clientsCount || 0, 1) : 1;

        // Recent data
        const [recentUsers] = await pool.execute('SELECT id, full_name, username, email, created_at FROM users ORDER BY created_at DESC LIMIT 5');
        stats.recentUsers = recentUsers;

        const [recentOrders] = await pool.execute(`
            SELECT o.*, u.full_name as buyer_name 
            FROM orders o 
            JOIN users u ON o.buyer_id = u.id 
            ORDER BY o.created_at DESC LIMIT 5
        `);
        stats.recentOrders = recentOrders;

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching admin stats', error: error.message });
    }
};

// Announcement Center Management
const getAnnouncements = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const announcements = await Announcement.findAll(parseInt(limit, 10), parseInt(offset, 10));
        res.json(announcements);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching announcements', error: error.message });
    }
};

const createAnnouncement = async (req, res) => {
    try {
        const { title, message, category } = req.body;
        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required' });
        }

        const announcementId = await Announcement.create({
            title,
            message,
            category: category || 'GENERAL',
            created_by: req.user.id
        });

        // Broadcast notification to all marketplace users
        const [users] = await pool.query('SELECT id FROM users');
        for (const u of users) {
            NotificationService.send({
                user_id: u.id,
                type: 'ADMIN_ANNOUNCEMENT',
                title: `[${category || 'ANNOUNCEMENT'}] ${title}`,
                message,
                entity_type: 'ANNOUNCEMENT',
                entity_id: announcementId
            }).catch(() => {});
        }

        await AuditService.log(req.user.id, 'CREATE_ANNOUNCEMENT', 'ANNOUNCEMENT', announcementId, { title, category }, req);

        res.status(201).json({ id: announcementId, message: 'Announcement published and broadcasted to all users' });
    } catch (error) {
        res.status(500).json({ message: 'Error creating announcement', error: error.message });
    }
};

const deleteAnnouncement = async (req, res) => {
    try {
        await Announcement.delete(req.params.id);
        await AuditService.log(req.user.id, 'DELETE_ANNOUNCEMENT', 'ANNOUNCEMENT', req.params.id, {}, req);
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting announcement', error: error.message });
    }
};

// User Management
const getUsers = async (req, res) => {
    try {
        const [users] = await pool.execute('SELECT id, full_name, username, email, phone, college, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, full_name, college } = req.body;
        await pool.execute(
            'UPDATE users SET role = COALESCE(?, role), full_name = COALESCE(?, full_name), college = COALESCE(?, college) WHERE id = ?',
            [role, full_name, college, id]
        );
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user', error: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
};

// Books Management
const getBooks = async (req, res) => {
    try {
        const [books] = await pool.execute(`
            SELECT b.*, u.full_name as seller_name, u.email as seller_email 
            FROM books b 
            JOIN users u ON b.seller_id = u.id 
            ORDER BY b.created_at DESC
        `);
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching books', error: error.message });
    }
};

const updateBook = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, price } = req.body;
        await pool.execute(
            'UPDATE books SET status = COALESCE(?, status), price = COALESCE(?, price) WHERE id = ?',
            [status, price, id]
        );
        res.json({ message: 'Book updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating book', error: error.message });
    }
};

// Categories Management
const getCategories = async (req, res) => {
    try {
        const [categories] = await pool.execute('SELECT * FROM categories ORDER BY name ASC');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching categories', error: error.message });
    }
};

const createCategory = async (req, res) => {
    try {
        const { name, icon } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO categories (name, icon) VALUES (?, ?)',
            [name, icon]
        );
        res.status(201).json({ id: result.insertId, name, icon });
    } catch (error) {
        res.status(500).json({ message: 'Error creating category', error: error.message });
    }
};

// Orders Management
const getOrders = async (req, res) => {
    try {
        const [orders] = await pool.execute(`
            SELECT o.*, u.full_name as buyer_name, u.email as buyer_email 
            FROM orders o 
            JOIN users u ON o.buyer_id = u.id 
            ORDER BY o.created_at DESC
        `);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
};

const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating order', error: error.message });
    }
};

// Swaps Management
const getSwaps = async (req, res) => {
    try {
        const [swaps] = await pool.execute(`
            SELECT s.*, 
                   u1.full_name as requester_name, 
                   u2.full_name as owner_name,
                   b1.title as offered_book,
                   b2.title as requested_book
            FROM swap_requests s
            JOIN users u1 ON s.requester_id = u1.id
            JOIN users u2 ON s.owner_id = u2.id
            JOIN books b1 ON s.offered_book_id = b1.id
            JOIN books b2 ON s.requested_book_id = b2.id
            ORDER BY s.created_at DESC
        `);
        res.json(swaps);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching swaps', error: error.message });
    }
};

const updateSwap = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await pool.execute('UPDATE swap_requests SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: 'Swap status updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating swap', error: error.message });
    }
};

// Reviews Moderation
const getReviews = async (req, res) => {
    try {
        const [reviews] = await pool.execute(`
            SELECT r.*, u.full_name as reviewer_name, b.title as book_title
            FROM reviews r
            JOIN users u ON r.reviewer_id = u.id
            JOIN books b ON r.book_id = b.id
            ORDER BY r.created_at DESC
        `);
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error: error.message });
    }
};

const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM reviews WHERE id = ?', [id]);
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting review', error: error.message });
    }
};

// Coupons Management
const getCoupons = async (req, res) => {
    try {
        const [coupons] = await pool.execute('SELECT * FROM coupons ORDER BY created_at DESC');
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching coupons', error: error.message });
    }
};

const createCoupon = async (req, res) => {
    try {
        const { code, discount_percent, max_discount, min_order_amount, expires_at } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO coupons (code, discount_percent, max_discount, min_order_amount, expires_at) VALUES (?, ?, ?, ?, ?)',
            [code.toUpperCase(), discount_percent, max_discount, min_order_amount, expires_at]
        );
        res.status(201).json({ id: result.insertId, message: 'Coupon created successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error creating coupon', error: error.message });
    }
};

const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('UPDATE coupons SET is_active = NOT is_active WHERE id = ?', [id]);
        res.json({ message: 'Coupon status toggled successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error toggling coupon status', error: error.message });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM coupons WHERE id = ?', [id]);
        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting coupon', error: error.message });
    }
};

const getRefunds = async (req, res) => {
    try {
        const [refunds] = await pool.execute(`
            SELECT pr.*, 
                   o.total_price as order_total, 
                   o.invoice_number,
                   u.full_name as buyer_name, 
                   u.email as buyer_email,
                   p.razorpay_payment_id,
                   p.razorpay_order_id,
                   p.amount as payment_amount,
                   p.status as payment_status
            FROM payment_refunds pr
            JOIN orders o ON pr.order_id = o.id
            JOIN users u ON pr.user_id = u.id
            LEFT JOIN payments p ON pr.payment_id = p.id
            ORDER BY pr.created_at DESC
        `);
        res.json(refunds);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching refunds', error: error.message });
    }
};

const processOrderRefund = async (req, res) => {
    try {
        const { id } = req.params; // order id
        const { amount, reason, adminNotes } = req.body;

        const [paymentRows] = await pool.execute(
            'SELECT id FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
            [id]
        );
        if (paymentRows.length === 0) {
            return res.status(404).json({ message: 'Payment record not found for this order' });
        }

        const paymentId = paymentRows[0].id;

        const result = await PaymentService.processRefund(req.user.id, {
            paymentId,
            amount: amount ? parseFloat(amount) : undefined,
            reason: reason || adminNotes || 'Admin approved refund'
        }, req);

        res.json({
            success: true,
            message: 'Refund processed successfully',
            result
        });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(400).json({ message: error.message || 'Refund processing failed' });
    }
};

const revokeUserTokens = async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id, 10);
        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const existingUser = await User.findById(targetUserId);
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        await User.incrementTokenVersion(targetUserId);
        const updatedUser = await User.findById(targetUserId);

        res.json({
            message: 'User tokens revoked successfully',
            userId: targetUserId,
            token_version: updatedUser.token_version
        });
    } catch (error) {
        res.status(500).json({ message: 'Error revoking user tokens', error: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getAuditLogs,
    getAnnouncements,
    createAnnouncement,
    deleteAnnouncement,
    getUsers,
    updateUser,
    deleteUser,
    revokeUserTokens,
    getBooks,
    updateBook,
    getCategories,
    createCategory,
    getOrders,
    updateOrder,
    getSwaps,
    updateSwap,
    getReviews,
    deleteReview,
    getCoupons,
    createCoupon,
    toggleCouponStatus,
    deleteCoupon,
    getRefunds,
    processOrderRefund
};
