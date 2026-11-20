const ActivityService = require('../services/activityService');
const Announcement = require('../models/Announcement');

const getActivityStream = async (req, res) => {
    try {
        const { filter = 'ALL', limit = 50 } = req.query;
        const activities = await ActivityService.getUserActivity(req.user.id, filter.toUpperCase(), limit);
        res.json(activities);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching activity stream', error: error.message });
    }
};

const getActiveAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.findActive(20);
        res.json(announcements);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching announcements', error: error.message });
    }
};

module.exports = {
    getActivityStream,
    getActiveAnnouncements
};
