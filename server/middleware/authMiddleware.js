const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            if (!process.env.JWT_SECRET) {
                return res.status(500).json({ message: 'Authentication misconfigured: Missing JWT_SECRET' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id);

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            const currentVersion = Number.isInteger(req.user.token_version)
                ? req.user.token_version
                : parseInt(req.user.token_version, 10);
            if (!Number.isInteger(decoded.tv) || decoded.tv !== currentVersion) {
                return res.status(401).json({ message: 'Not authorized, session invalidated or expired' });
            }

            return next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const optionalAuth = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            const currentVersion = user
                ? (Number.isInteger(user.token_version) ? user.token_version : parseInt(user.token_version, 10))
                : null;
            if (user && Number.isInteger(decoded.tv) && decoded.tv === currentVersion) {
                req.user = user;
            } else {
                req.user = null;
            }
        } catch (error) {
            req.user = null;
        }
    }
    next();
};

module.exports = { protect, optionalAuth };
