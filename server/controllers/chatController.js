const { pool } = require('../config/db');
const socket = require('../socket');

const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.execute(`
            SELECT c.*, 
                   u1.full_name as p1_name, u2.full_name as p2_name,
                   u1.username as p1_user, u2.username as p2_user
            FROM conversations c
            JOIN users u1 ON c.participant1_id = u1.id
            JOIN users u2 ON c.participant2_id = u2.id
            WHERE c.participant1_id = ? OR c.participant2_id = ?
            ORDER BY c.updated_at DESC
        `, [userId, userId]);

        const formatted = rows.map(c => {
            const isP1 = c.participant1_id === userId;
            return {
                id: c.id,
                otherUser: {
                    id: isP1 ? c.participant2_id : c.participant1_id,
                    full_name: isP1 ? c.p2_name : c.p1_name,
                    username: isP1 ? c.p2_user : c.p1_user
                },
                last_message: c.last_message,
                updated_at: c.updated_at
            };
        });

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching conversations', error: error.message });
    }
};

const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const [rows] = await pool.execute(`
            SELECT * FROM messages 
            WHERE conversation_id = ? 
            ORDER BY created_at ASC
        `, [conversationId]);

        // Mark as read
        await pool.execute('UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ?', [conversationId, req.user.id]);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
};

const sendMessage = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { conversationId, receiverId, message } = req.body;
        const senderId = req.user.id;

        // 1. Save message
        const [result] = await connection.execute(
            'INSERT INTO messages (conversation_id, sender_id, message) VALUES (?, ?, ?)',
            [conversationId, senderId, message]
        );

        // 2. Update conversation last message
        await connection.execute(
            'UPDATE conversations SET last_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [message, conversationId]
        );

        await connection.commit();

        const newMessage = {
            id: result.insertId,
            conversation_id: conversationId,
            sender_id: senderId,
            message,
            created_at: new Date()
        };

        // 3. Socket broadcast
        socket.sendMessage(receiverId, newMessage);

        res.status(201).json(newMessage);
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Error sending message', error: error.message });
    } finally {
        connection.release();
    }
};

const startConversation = async (req, res) => {
    try {
        const { receiverId } = req.body;
        const senderId = req.user.id;

        // Check if conversation exists
        const [existing] = await pool.execute(`
            SELECT id FROM conversations 
            WHERE (participant1_id = ? AND participant2_id = ?) 
               OR (participant1_id = ? AND participant2_id = ?)
        `, [senderId, receiverId, receiverId, senderId]);

        if (existing.length > 0) {
            return res.json({ id: existing[0].id });
        }

        // Create new
        const [result] = await pool.execute(
            'INSERT INTO conversations (participant1_id, participant2_id) VALUES (?, ?)',
            [senderId, receiverId]
        );

        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error starting conversation', error: error.message });
    }
};

module.exports = {
    getConversations,
    getMessages,
    sendMessage,
    startConversation
};
