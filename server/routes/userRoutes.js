const express = require('express');
const router = express.Router();
const { 
    getPublicProfile, 
    getDashboardStats, 
    updateProfile, 
    changePassword,
    logActivity
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Public
router.get('/:id/public', getPublicProfile);

// Private
router.use(protect);
router.get('/dashboard/stats', getDashboardStats);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/activity', logActivity);

module.exports = router;
