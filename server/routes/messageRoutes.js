const express = require('express');
const router = express.Router();
const { 
    getConversations, 
    getMessages, 
    sendMessage, 
    markRead 
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/conversations', getConversations);
router.get('/:conversationId', getMessages);
router.post('/', sendMessage);
router.put('/:id/read', markRead);

module.exports = router;
