const express = require('express');
const router = express.Router();
const {
    createReport,
    getReports,
    resolveReport
} = require('../controllers/disputeController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

// All report routes require authentication
router.use(protect);

// Users can submit reports
router.post('/', createReport);

// Admin-Only Report Management
router.get('/', admin, getReports);
router.put('/:id/resolve', admin, resolveReport);

module.exports = router;
