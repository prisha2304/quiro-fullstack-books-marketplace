/**
 * QUIRO — Production CORS Configuration & Origin Resolver
 * 
 * Production Rules:
 * 1. Allow ONLY the explicitly configured CLIENT_URL origin(s).
 * 2. Reject localhost (5173, 3000, 5000), 127.0.0.1, or arbitrary external origins.
 * 3. Handle missing or malformed CLIENT_URL safely by rejecting cross-origin browser requests.
 * 4. Never use wildcard '*' with credentials enabled.
 * 
 * Development Rules:
 * 1. Allow local development frontend origins:
 *    - http://localhost:5173
 *    - http://127.0.0.1:5173
 *    - http://localhost:3000
 *    - http://127.0.0.1:3000
 *    - http://localhost:5000
 *    plus CLIENT_URL if configured.
 * 
 * Universal Rules:
 * 1. Allow requests without an Origin header (server-to-server, mobile apps, curl, same-origin).
 * 2. Whitelist standard HTTP methods and headers required by QUIRO.
 * 3. Preserve credentials: true.
 */

const logger = require('../services/logger');

function parseOrigin(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return null;
    try {
        const parsed = new URL(urlStr.trim());
        // Return standard protocol + host (without trailing slash or path)
        return parsed.origin;
    } catch {
        return null;
    }
}

/**
 * Resolves the list of allowed origins based on environment and CLIENT_URL.
 * Supports optional explicit env / clientUrl arguments for testability,
 * defaulting to process.env.NODE_ENV and process.env.CLIENT_URL.
 */
function getAllowedOrigins(customEnv, customClientUrl) {
    const nodeEnv = customEnv !== undefined ? customEnv : (process.env.NODE_ENV || 'development');
    const rawClientUrl = customClientUrl !== undefined ? customClientUrl : process.env.CLIENT_URL;
    const isProduction = nodeEnv === 'production';

    if (isProduction) {
        if (!rawClientUrl || !rawClientUrl.trim()) {
            logger.warn('[CORS] Production mode active with no CLIENT_URL configured. All cross-origin browser requests will be rejected.');
            return [];
        }

        const parsedOrigins = rawClientUrl
            .split(',')
            .map(u => parseOrigin(u))
            .filter(Boolean);

        if (parsedOrigins.length === 0) {
            logger.error(`[CORS] Production CLIENT_URL '${rawClientUrl}' is malformed. All cross-origin browser requests will be rejected.`);
            return [];
        }

        return parsedOrigins;
    }

    // Development & Test environments: local dev origins
    const devOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5000'
    ];

    if (rawClientUrl && rawClientUrl.trim()) {
        const parsed = parseOrigin(rawClientUrl);
        if (parsed && !devOrigins.includes(parsed)) {
            devOrigins.unshift(parsed);
        }
    }

    return devOrigins;
}

/**
 * Checks whether an incoming origin is permitted.
 */
function isOriginAllowed(origin, customEnv, customClientUrl) {
    // Server-to-server, curl, mobile native, or same-origin requests do not include an Origin header
    if (!origin) {
        return true;
    }

    const normalized = parseOrigin(origin) || origin.trim();
    const allowed = getAllowedOrigins(customEnv, customClientUrl);
    return allowed.includes(normalized) || allowed.includes(origin.trim());
}

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

const ALLOWED_HEADERS = [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'Idempotency-Key',
    'idempotency-key',
    'X-Requested-With',
    'x-razorpay-signature',
    'Accept',
    'Origin'
];

const corsOptions = {
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            return callback(null, true);
        }
        const err = new Error(`CORS policy violation: Origin ${origin} not permitted`);
        err.statusCode = 403;
        err.code = 'CORS_FORBIDDEN';
        return callback(err);
    },
    credentials: true,
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS
};

module.exports = {
    parseOrigin,
    getAllowedOrigins,
    isOriginAllowed,
    ALLOWED_METHODS,
    ALLOWED_HEADERS,
    corsOptions
};
