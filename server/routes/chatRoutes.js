const express = require('express');
const router = express.Router();
const { 
    getConversations, 
    getMessages, 
    sendMessage 
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/conversations', getConversations);
router.get('/messages/:conversationId', getMessages);
router.post('/messages', sendMessage);
router.post('/conversations', sendMessage);

module.exports = router;
