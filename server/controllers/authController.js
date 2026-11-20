const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');

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
                token: generateToken(userId)
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
                token: generateToken(user.id)
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
            return res.status(503).json({ 
                message: 'Google Sign-In is awaiting configuration. Please set GOOGLE_CLIENT_ID in server/.env.' 
            });
        }

        // Verify ID Token with Google tokeninfo endpoint
        const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
            signal: AbortSignal.timeout(6000)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return res.status(401).json({ message: 'Invalid or expired Google token', details: errData });
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
            token: generateToken(user.id)
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({ message: 'Google authentication failed', error: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    googleAuth
};
