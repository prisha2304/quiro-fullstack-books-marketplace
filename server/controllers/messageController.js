const MessageService = require('../services/messageService');

const getConversations = async (req, res) => {
    try {
        const conversations = await MessageService.getUserConversations(req.user.id);
        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching conversations', error: error.message });
    }
};

const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { limit = 100, offset = 0 } = req.query;

        const data = await MessageService.getConversationMessages(
            conversationId, 
            req.user.id, 
            parseInt(limit, 10), 
            parseInt(offset, 10)
        );
        res.json(data);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Error fetching messages' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { receiver_id, receiverId, book_id, bookId, message, conversation_id, conversationId } = req.body;
        
        const payload = await MessageService.sendMessage({
            senderId: req.user.id,
            receiverId: receiver_id || receiverId,
            bookId: book_id || bookId,
            message,
            conversationId: conversation_id || conversationId
        });

        res.status(201).json(payload);
    } catch (error) {
        res.status(400).json({ message: error.message || 'Failed to send message' });
    }
};

const markRead = async (req, res) => {
    try {
        const success = await MessageService.markMessageAsRead(req.params.id, req.user.id);
        if (!success) return res.status(404).json({ message: 'Message not found or not authorized' });
        res.json({ message: 'Message marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating message status', error: error.message });
    }
};

module.exports = {
    getConversations,
    getMessages,
    sendMessage,
    markRead
};
