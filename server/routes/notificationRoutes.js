const express = require('express');
const router = express.Router();
const { 
    getMyNotifications, 
    getUnreadCount,
    markRead, 
    markAllRead, 
    deleteNotification,
    clearReadNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);
router.delete('/clear-read', clearReadNotifications);
router.delete('/:id', deleteNotification);

module.exports = router;
