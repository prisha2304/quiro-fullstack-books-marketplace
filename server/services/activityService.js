const { pool } = require('../config/db');
const Announcement = require('../models/Announcement');

class ActivityService {
    static async getUserActivity(userId, filter = 'ALL', limit = 50) {
        const stream = [];

        // 1. Fetch active announcements (visible to all)
        if (filter === 'ALL' || filter === 'ANNOUNCEMENTS') {
            const announcements = await Announcement.findActive(10);
            for (const a of announcements) {
                stream.push({
                    id: `announcement-${a.id}`,
                    type: 'ANNOUNCEMENTS',
                    category: a.category,
                    title: a.title,
                    description: a.message,
                    timestamp: a.created_at,
                    meta: { author: a.author_name },
                    link: '/notifications'
                });
            }
        }

        // 2. Fetch Orders activity
        if (filter === 'ALL' || filter === 'ORDERS') {
            const [orders] = await pool.execute(`
                SELECT o.id, o.status, o.total_price, o.created_at, o.tracking_number,
                       oi.price as item_price, b.title as book_title, b.cover_image as book_cover
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                LEFT JOIN books b ON oi.book_id = b.id
                WHERE o.buyer_id = ?
                ORDER BY o.created_at DESC
                LIMIT 15
            `, [userId]);

            for (const o of orders) {
                stream.push({
                    id: `order-${o.id}`,
                    type: 'ORDERS',
                    title: `Order #${o.id}: ${o.book_title || 'Book Purchase'}`,
                    description: `Status: ${o.status.toUpperCase().replace(/_/g, ' ')} · Total: ₹${o.total_price}`,
                    timestamp: o.created_at,
                    meta: { status: o.status, trackingNumber: o.tracking_number, cover: o.book_cover },
                    link: `/orders/${o.id}`
                });
            }
        }

        // 3. Fetch Swaps activity
        if (filter === 'ALL' || filter === 'SWAPS') {
            const [swaps] = await pool.execute(`
                SELECT s.id, s.status, s.created_at,
                       b1.title as offered_book, b2.title as requested_book
                FROM swap_requests s
                LEFT JOIN books b1 ON s.offered_book_id = b1.id
                LEFT JOIN books b2 ON s.requested_book_id = b2.id
                WHERE s.requester_id = ? OR s.owner_id = ?
                ORDER BY s.created_at DESC
                LIMIT 15
            `, [userId, userId]);

            for (const s of swaps) {
                stream.push({
                    id: `swap-${s.id}`,
                    type: 'SWAPS',
                    title: `Swap Request: "${s.offered_book || 'Book'}" ➔ "${s.requested_book || 'Target'}"`,
                    description: `Exchange Status: ${s.status.toUpperCase()}`,
                    timestamp: s.created_at,
                    meta: { status: s.status },
                    link: '/swaps'
                });
            }
        }

        // 4. Fetch Messages activity
        if (filter === 'ALL' || filter === 'MESSAGES') {
            const [messages] = await pool.execute(`
                SELECT m.id, m.conversation_id, m.message, m.created_at, m.is_read,
                       u.full_name as sender_name
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.receiver_id = ?
                ORDER BY m.created_at DESC
                LIMIT 15
            `, [userId]);

            for (const m of messages) {
                stream.push({
                    id: `msg-${m.id}`,
                    type: 'MESSAGES',
                    title: `Message from ${m.sender_name}`,
                    description: m.message,
                    timestamp: m.created_at,
                    meta: { isRead: m.is_read },
                    link: '/messages'
                });
            }
        }

        // 5. Fetch Reviews activity
        if (filter === 'ALL' || filter === 'REVIEWS') {
            const [reviews] = await pool.execute(`
                SELECT r.id, r.rating, r.title, r.comment, r.created_at,
                       b.title as book_title, u.full_name as reviewer_name
                FROM reviews r
                JOIN books b ON r.book_id = b.id
                JOIN users u ON r.reviewer_id = u.id
                WHERE r.seller_id = ? OR r.reviewer_id = ?
                ORDER BY r.created_at DESC
                LIMIT 15
            `, [userId, userId]);

            for (const r of reviews) {
                stream.push({
                    id: `review-${r.id}`,
                    type: 'REVIEWS',
                    title: `${r.rating}★ Review on "${r.book_title}"`,
                    description: r.title ? `"${r.title}" - ${r.comment}` : r.comment,
                    timestamp: r.created_at,
                    meta: { rating: r.rating, reviewer: r.reviewer_name },
                    link: `/book/${r.id}`
                });
            }
        }

        // Sort all aggregated activities chronologically descending
        stream.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return stream.slice(0, parseInt(limit, 10));
    }
}

module.exports = ActivityService;
