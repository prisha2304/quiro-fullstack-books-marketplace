const { NotificationService } = require('../services/notificationService');

const getMyNotifications = async (req, res) => {
    try {
        const { limit = 50, offset = 0, category = null } = req.query;
        const notifications = await NotificationService.getUserNotifications(
            req.user.id, 
            parseInt(limit, 10), 
            parseInt(offset, 10),
            category
        );
        const unreadCount = await NotificationService.getUnreadCount(req.user.id);
        res.json({ notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await NotificationService.getUnreadCount(req.user.id);
        res.json({ unreadCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching unread count', error: error.message });
    }
};

const markRead = async (req, res) => {
    try {
        const success = await NotificationService.markAsRead(req.params.id, req.user.id);
        if (!success) return res.status(404).json({ message: 'Notification not found' });
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
};

const markAllRead = async (req, res) => {
    try {
        const updatedCount = await NotificationService.markAllAsRead(req.user.id);
        res.json({ message: 'All notifications marked as read', updatedCount });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notifications', error: error.message });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const success = await NotificationService.delete(req.params.id, req.user.id);
        if (!success) return res.status(404).json({ message: 'Notification not found' });
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification', error: error.message });
    }
};

const clearReadNotifications = async (req, res) => {
    try {
        const clearedCount = await NotificationService.clearRead(req.user.id);
        res.json({ message: 'Cleared read notifications', clearedCount });
    } catch (error) {
        res.status(500).json({ message: 'Error clearing read notifications', error: error.message });
    }
};

module.exports = {
    getMyNotifications,
    getUnreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    clearReadNotifications
};
