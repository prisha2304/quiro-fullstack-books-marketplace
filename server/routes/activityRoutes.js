const express = require('express');
const router = express.Router();
const { getActivityStream, getActiveAnnouncements } = require('../controllers/activityController');
const { protect } = require('../middleware/authMiddleware');

router.get('/announcements', getActiveAnnouncements);
router.get('/', protect, getActivityStream);

module.exports = router;
