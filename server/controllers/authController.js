const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const logger = require('../services/logger');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { full_name, username, email, password } = req.body;

        // Check if user exists
        const userExists = await User.findByUsernameOrEmail(email) || await User.findByUsernameOrEmail(username);
        
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const userId = await User.create({
            full_name,
            username,
            email,
            password: hashedPassword
        });

        if (userId) {
            const newUser = await User.findById(userId);
            res.status(201).json({
                id: userId,
                full_name,
                username,
                email,
                role: newUser?.role || 'USER',
                token: generateToken(userId, newUser?.token_version || 1)
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { identifier, password } = req.body; // identifier can be email or username

        // Find user by email or username
        const user = await User.findByUsernameOrEmail(identifier);

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                id: user.id,
                full_name: user.full_name,
                username: user.username,
                email: user.email,
                profile_image: user.profile_image,
                role: user.role || 'USER',
                token: generateToken(user.id, user.token_version || 1)
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Authenticate with Google ID token
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ message: 'Google ID Token is required' });
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID' || clientId.includes('placeholder')) {
            logger.warn('[Google Auth] Sign-In is not configured. Set GOOGLE_CLIENT_ID in server environment.');
            return res.status(503).json({ 
                message: 'Google Sign-In is temporarily unavailable. Please sign in with email and password or contact support.' 
            });
        }

        // Verify ID Token with Google tokeninfo endpoint
        const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
            signal: AbortSignal.timeout(6000)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            logger.warn('[Google Auth] ID token verification rejected by Google API', { status: response.status, details: errData });
            return res.status(401).json({ message: 'Invalid or expired Google token' });
        }

        const payload = await response.json();

        // Security Checks: Audience, Issuer, Email Verified
        if (payload.aud !== clientId) {
            return res.status(401).json({ message: 'Token audience mismatch (Invalid Client ID)' });
        }

        if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
            return res.status(401).json({ message: 'Invalid token issuer' });
        }

        if (payload.email_verified !== 'true' && payload.email_verified !== true) {
            return res.status(400).json({ message: 'Google account email is not verified' });
        }

        const googleId = payload.sub;
        const email = (payload.email || '').toLowerCase().trim();
        const fullName = payload.name || payload.given_name || 'Google User';
        const picture = payload.picture || null;

        // 1. Check if user exists by Google ID
        let user = await User.findByGoogleId(googleId);

        if (!user) {
            // 2. Check if user exists by email -> link accounts
            user = await User.findByEmail(email);
            if (user) {
                user = await User.linkGoogleAccount(user.id, googleId, picture);
            } else {
                // 3. Register new user
                const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user';
                let uniqueUsername = baseUsername;
                let counter = 1;
                while (await User.findByUsername(uniqueUsername)) {
                    uniqueUsername = baseUsername + counter;
                    counter++;
                }

                const userId = await User.create({
                    full_name: fullName,
                    username: uniqueUsername,
                    email,
                    password: null,
                    role: 'USER'
                });

                await User.linkGoogleAccount(userId, googleId, picture);
                user = await User.findById(userId);
            }
        }

        res.json({
            id: user.id,
            full_name: user.full_name,
            username: user.username,
            email: user.email,
            profile_image: user.profile_image,
            role: user.role,
            token: generateToken(user.id, user.token_version || 1)
        });
    } catch (error) {
        logger.error('[Google Auth] Authentication failure:', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Google authentication service error. Please try again later.' });
    }
};

// @desc    Logout user & revoke all active sessions by incrementing token_version
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
    try {
        await User.incrementTokenVersion(req.user.id);
        res.json({ message: 'Logged out successfully. All active sessions have been revoked.' });
    } catch (error) {
        logger.error('[Auth] Logout failure:', { error: error.message, userId: req.user?.id });
        res.status(500).json({ message: 'Error logging out' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    googleAuth,
    logoutUser
};
