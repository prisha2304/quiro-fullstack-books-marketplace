const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const socket = require('../socket');
const { NotificationService } = require('./notificationService');

class MessageService {
    static async getUserConversations(userId) {
        return await Conversation.findByUserId(userId);
    }

    static async getConversationMessages(conversationId, userId, limit = 100, offset = 0) {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        // Authorization check
        if (conversation.buyer_id !== userId && conversation.seller_id !== userId) {
            throw new Error('Not authorized to access this conversation');
        }

        // Auto-mark unread incoming messages as read
        const readRows = await Message.markConversationAsRead(conversationId, userId);
        
        // Notify partner that messages were seen
        if (readRows > 0) {
            const partnerId = conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id;
            socket.notifyMessageRead(partnerId, {
                conversationId: parseInt(conversationId, 10),
                readBy: userId,
                readAt: new Date().toISOString()
            });
        }

        const messages = await Message.findByConversationId(conversationId, limit, offset);
        return { conversation, messages };
    }

    static async sendMessage({ senderId, receiverId, bookId, message, conversationId }) {
        if (!message || !message.trim()) {
            throw new Error('Message text cannot be empty');
        }

        let convId = conversationId;
        let targetReceiverId = receiverId;

        // 1. Resolve or automatically create conversation
        if (!convId) {
            if (!targetReceiverId) {
                throw new Error('Receiver ID is required to start a conversation');
            }
            convId = await Conversation.findOrCreate({
                buyer_id: senderId,
                seller_id: targetReceiverId,
                book_id: bookId || null
            });
        } else {
            const existingConv = await Conversation.findById(convId);
            if (!existingConv) throw new Error('Conversation not found');
            if (!targetReceiverId) {
                targetReceiverId = existingConv.buyer_id === senderId ? existingConv.seller_id : existingConv.buyer_id;
            }
        }

        // 2. Insert message
        const messageId = await Message.create({
            conversation_id: convId,
            sender_id: senderId,
            receiver_id: targetReceiverId,
            message: message.trim()
        });

        const createdPayload = {
            id: messageId,
            conversation_id: convId,
            sender_id: senderId,
            receiver_id: targetReceiverId,
            message: message.trim(),
            is_read: false,
            created_at: new Date().toISOString()
        };

        // 3. Dispatch real-time WebSocket event
        try {
            socket.sendMessage(targetReceiverId, createdPayload);
        } catch (err) {
            console.error('Socket message dispatch error:', err.message);
        }

        // 4. Trigger In-App Notification for recipient
        try {
            await NotificationService.send({
                user_id: targetReceiverId,
                type: 'NEW_MESSAGE',
                title: 'New Message',
                message: `You received a message: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`,
                entity_type: 'MESSAGE',
                entity_id: convId
            });
        } catch (err) {}

        return createdPayload;
    }

    static async markMessageAsRead(messageId, userId) {
        return await Message.markAsRead(messageId, userId);
    }
}

module.exports = MessageService;
