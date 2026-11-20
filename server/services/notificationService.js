const Notification = require('../models/Notification');
const socket = require('../socket');
const { pool } = require('../config/db');

const NOTIFICATION_TYPES = {
    ORDER_CONFIRMED: 'ORDER_CONFIRMED',
    ORDER_PACKED: 'ORDER_PACKED',
    ORDER_SHIPPED: 'ORDER_SHIPPED',
    ORDER_OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
    ORDER_DELIVERED: 'ORDER_DELIVERED',
    ORDER_CANCELLED: 'ORDER_CANCELLED',
    ORDER_PLACED: 'ORDER_PLACED',

    SWAP_REQUESTED: 'SWAP_REQUESTED',
    SWAP_ACCEPTED: 'SWAP_ACCEPTED',
    SWAP_REJECTED: 'SWAP_REJECTED',
    SWAP_COUNTER_OFFERED: 'SWAP_COUNTER_OFFERED',
    SWAP_DISPATCHED: 'SWAP_DISPATCHED',
    SWAP_RECEIVED: 'SWAP_RECEIVED',
    SWAP_COMPLETED: 'SWAP_COMPLETED',
    SWAP_CANCELLED: 'SWAP_CANCELLED',

    NEW_MESSAGE: 'NEW_MESSAGE',
    NEW_REVIEW: 'NEW_REVIEW',
    BOOK_APPROVED: 'BOOK_APPROVED',
    BOOK_REJECTED: 'BOOK_REJECTED',
    WISHLIST_RESTOCK: 'WISHLIST_RESTOCK',
    PRICE_DROP: 'PRICE_DROP',
    ADMIN_ANNOUNCEMENT: 'ADMIN_ANNOUNCEMENT',

    // Trust & Safety, Disputes & Return/Refund Types
    DISPUTE_CREATED: 'DISPUTE_CREATED',
    DISPUTE_UPDATED: 'DISPUTE_UPDATED',
    DISPUTE_MESSAGE: 'DISPUTE_MESSAGE',
    RETURN_REQUESTED: 'RETURN_REQUESTED',
    RETURN_APPROVED: 'RETURN_APPROVED',
    RETURN_REJECTED: 'RETURN_REJECTED',
    REFUND_INITIATED: 'REFUND_INITIATED',
    REFUND_COMPLETED: 'REFUND_COMPLETED',
    REPORT_CREATED: 'REPORT_CREATED',
    ADMIN_ACTION: 'ADMIN_ACTION'
};

class NotificationService {
    /**
     * Create notification in DB and broadcast via Socket.IO
     * @param {Object} data { user_id, type, title, message, entity_type, entity_id, action_url }
     */
    static async send(data) {
        try {
            const { user_id, type, title, message, entity_type, entity_id, action_url } = data;
            
            const notifId = await Notification.create({
                user_id,
                type: type || NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
                title,
                message,
                entity_type: entity_type || null,
                entity_id: entity_id || null,
                action_url: action_url || null
            });

            const payload = {
                id: notifId,
                user_id,
                type,
                title,
                message,
                entity_type,
                entity_id,
                action_url,
                is_read: false,
                created_at: new Date().toISOString()
            };

            // Real-time WebSocket emission
            try {
                socket.sendNotification(user_id, payload);
                const unread = await Notification.getUnreadCount(user_id);
                socket.sendNotificationCountUpdate(user_id, unread);
            } catch (err) {
                console.error('Socket emission notice for notification:', err.message);
            }

            return payload;
        } catch (error) {
            console.error('NotificationService.send error:', error);
            throw error;
        }
    }

    /**
     * Broadcast notification to wishlisted users on restock or price drop
     */
    static async notifyWishlistUsers(bookId, type = 'WISHLIST_RESTOCK', details = {}) {
        try {
            const [rows] = await pool.query(`
                SELECT w.user_id, b.title, b.price
                FROM wishlists w
                JOIN books b ON w.book_id = b.id
                WHERE w.book_id = ?
            `, [bookId]);

            if (rows.length === 0) return 0;

            const notifs = rows.map(r => ({
                user_id: r.user_id,
                type,
                title: type === 'PRICE_DROP' ? 'Price Dropped!' : 'Back in Stock!',
                message: type === 'PRICE_DROP' 
                    ? `"${r.title}" is now available at ₹${details.newPrice || r.price} (was ₹${details.oldPrice})!`
                    : `"${r.title}" is available again on BookNest. Grab it before it sells out!`,
                entity_type: 'book',
                entity_id: bookId,
                action_url: `/book/${bookId}`
            }));

            await Notification.createBulk(notifs);

            for (const n of notifs) {
                socket.sendNotification(n.user_id, n);
            }

            return notifs.length;
        } catch (err) {
            console.error('Error notifying wishlist users:', err.message);
            return 0;
        }
    }

    static async getUserNotifications(userId, limit = 50, offset = 0, category = null) {
        return await Notification.findByUserId(userId, limit, offset, category);
    }

    static async getUnreadCount(userId) {
        return await Notification.getUnreadCount(userId);
    }

    static async markAsRead(id, userId) {
        const success = await Notification.markAsRead(id, userId);
        if (success) {
            const unread = await Notification.getUnreadCount(userId);
            socket.sendNotificationCountUpdate(userId, unread);
        }
        return success;
    }

    static async markAllAsRead(userId) {
        const count = await Notification.markAllAsRead(userId);
        socket.sendNotificationCountUpdate(userId, 0);
        return count;
    }

    static async delete(id, userId) {
        const success = await Notification.delete(id, userId);
        if (success) {
            const unread = await Notification.getUnreadCount(userId);
            socket.sendNotificationCountUpdate(userId, unread);
        }
        return success;
    }

    static async clearRead(userId) {
        return await Notification.clearRead(userId);
    }
}

module.exports = {
    NotificationService,
    NOTIFICATION_TYPES
};
