const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { registerUser, loginUser, getUserProfile, googleAuth, logoutUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

router.post('/register', [
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('username').notEmpty().withMessage('Username is required').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
], registerUser);

router.post('/login', [
    body('identifier').notEmpty().withMessage('Email or Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
], loginUser);

router.get('/profile', protect, getUserProfile);
router.post('/google', googleAuth);
router.post('/logout', protect, logoutUser);

module.exports = router;
