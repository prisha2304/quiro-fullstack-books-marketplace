const jwt = require('jsonwebtoken');

const generateToken = (id, tokenVersion = 1) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured in environment variables');
    }
    const tv = Number.isInteger(tokenVersion) && tokenVersion >= 1 ? tokenVersion : 1;
    return jwt.sign({ id, tv }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

module.exports = generateToken;
