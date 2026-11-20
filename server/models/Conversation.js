const { pool } = require('../config/db');

class Conversation {
    static async findOrCreate({ buyer_id, seller_id, book_id = null }) {
        // Prevent duplicate conversations
        let query = `
            SELECT id FROM conversations 
            WHERE ((buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?))
        `;
        const params = [buyer_id, seller_id, seller_id, buyer_id];

        if (book_id) {
            query += ' AND (book_id = ? OR book_id IS NULL)';
            params.push(book_id);
        }

        query += ' ORDER BY created_at DESC LIMIT 1';

        const [existing] = await pool.execute(query, params);

        if (existing.length > 0) {
            return existing[0].id;
        }

        const [result] = await pool.execute(
            'INSERT INTO conversations (buyer_id, seller_id, book_id) VALUES (?, ?, ?)',
            [buyer_id, seller_id, book_id || null]
        );

        return result.insertId;
    }

    static async findByUserId(userId) {
        const [conversations] = await pool.execute(`
            SELECT 
                c.id,
                c.buyer_id,
                c.seller_id,
                c.book_id,
                c.created_at,
                -- Buyer Info
                ub.full_name as buyer_name,
                ub.username as buyer_username,
                ub.profile_image as buyer_image,
                ub.college as buyer_college,
                -- Seller Info
                us.full_name as seller_name,
                us.username as seller_username,
                us.profile_image as seller_image,
                us.college as seller_college,
                -- Book Info
                b.title as book_title,
                b.author as book_author,
                b.cover_image as book_cover,
                b.price as book_price
            FROM conversations c
            LEFT JOIN users ub ON c.buyer_id = ub.id
            LEFT JOIN users us ON c.seller_id = us.id
            LEFT JOIN books b ON c.book_id = b.id
            WHERE c.buyer_id = ? OR c.seller_id = ?
            ORDER BY c.created_at DESC
        `, [userId, userId]);

        const enriched = [];

        for (const conv of conversations) {
            const isBuyer = conv.buyer_id === userId;
            const partner = {
                id: isBuyer ? conv.seller_id : conv.buyer_id,
                full_name: isBuyer ? conv.seller_name : conv.buyer_name,
                username: isBuyer ? conv.seller_username : conv.buyer_username,
                profile_image: isBuyer ? conv.seller_image : conv.buyer_image,
                college: isBuyer ? conv.seller_college : conv.buyer_college
            };

            // Latest Message
            const [lastMsgRows] = await pool.execute(`
                SELECT id, sender_id, receiver_id, message, is_read, created_at
                FROM messages 
                WHERE conversation_id = ?
                ORDER BY id DESC 
                LIMIT 1
            `, [conv.id]);

            // Unread Count for this user
            const [unreadRows] = await pool.execute(`
                SELECT COUNT(*) as count
                FROM messages 
                WHERE conversation_id = ? AND receiver_id = ? AND is_read = FALSE
            `, [conv.id, userId]);

            const lastMessage = lastMsgRows[0] || null;
            const unreadCount = parseInt(unreadRows[0]?.count || 0, 10);

            enriched.push({
                id: conv.id,
                buyer_id: conv.buyer_id,
                seller_id: conv.seller_id,
                partner,
                book: conv.book_id ? {
                    id: conv.book_id,
                    title: conv.book_title,
                    author: conv.book_author,
                    cover_image: conv.book_cover,
                    price: conv.book_price
                } : null,
                last_message: lastMessage,
                unread_count: unreadCount,
                updated_at: lastMessage ? lastMessage.created_at : conv.created_at
            });
        }

        // Sort by most recent message activity
        enriched.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        return enriched;
    }

    static async findById(id) {
        const [rows] = await pool.execute(`
            SELECT c.*, 
                   ub.full_name as buyer_name, ub.username as buyer_username, ub.profile_image as buyer_image,
                   us.full_name as seller_name, us.username as seller_username, us.profile_image as seller_image,
                   b.title as book_title, b.author as book_author, b.cover_image as book_cover, b.price as book_price
            FROM conversations c
            LEFT JOIN users ub ON c.buyer_id = ub.id
            LEFT JOIN users us ON c.seller_id = us.id
            LEFT JOIN books b ON c.book_id = b.id
            WHERE c.id = ?
        `, [id]);

        return rows[0] || null;
    }
}

module.exports = Conversation;

