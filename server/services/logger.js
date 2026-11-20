
const fs = require('fs');

const LOG_LEVELS = {
    DEBUG: 10,
    INFO: 20,
    WARN: 30,
    ERROR: 40,
    FATAL: 50
};

const SENSITIVE_KEYS = [
    'password', 'token', 'jwt', 'secret', 'key_secret', 'razorpay_secret', 'api_key', 'apikey',
    'authorization', 'credit_card', 'card_number', 'cvv', 'access_token', 'refresh_token'
];

function sanitize(obj, depth = 0) {
    if (depth > 5 || !obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => sanitize(item, depth + 1));

    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
            clean[key] = '[REDACTED]';
        } else if (value && typeof value === 'object') {
            clean[key] = sanitize(value, depth + 1);
        } else {
            clean[key] = value;
        }
    }
    return clean;
}

class Logger {
    constructor() {
        this.currentLevel = process.env.LOG_LEVEL ? (LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || 20) : 20;
        this.isProduction = process.env.NODE_ENV === 'production';
    }

    _format(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const sanitizedMeta = sanitize(meta);

        const logEntry = {
            timestamp,
            level,
            message,
            ...sanitizedMeta
        };

        if (this.isProduction) {
            return JSON.stringify(logEntry);
        } else {
            const reqId = meta.requestId ? `[${meta.requestId}] ` : '';
            const status = meta.statusCode ? ` status=${meta.statusCode}` : '';
            const duration = meta.responseTimeMs !== undefined ? ` (${meta.responseTimeMs}ms)` : '';
            const errCode = meta.errorCode ? ` code=${meta.errorCode}` : '';
            return `[${timestamp}] [${level}] ${reqId}${message}${status}${duration}${errCode}`;
        }
    }

    debug(msg, meta = {}) {
        if (this.currentLevel <= LOG_LEVELS.DEBUG) {
            console.debug(this._format('DEBUG', msg, meta));
        }
    }

    info(msg, meta = {}) {
        if (this.currentLevel <= LOG_LEVELS.INFO) {
            console.info(this._format('INFO', msg, meta));
        }
    }

    warn(msg, meta = {}) {
        if (this.currentLevel <= LOG_LEVELS.WARN) {
            console.warn(this._format('WARN', msg, meta));
        }
    }

    error(msg, meta = {}) {
        if (this.currentLevel <= LOG_LEVELS.ERROR) {
            console.error(this._format('ERROR', msg, meta));
        }
    }

    fatal(msg, meta = {}) {
        if (this.currentLevel <= LOG_LEVELS.FATAL) {
            console.error(this._format('FATAL', msg, meta));
        }
    }

    sanitizeData(data) {
        return sanitize(data);
    }
}

module.exports = new Logger();
