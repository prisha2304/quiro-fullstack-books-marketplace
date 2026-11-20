
const crypto = require('crypto');
const logger = require('../services/logger');
const metricsService = require('../services/metricsService');

function requestContextMiddleware(req, res, next) {
    // Propagate or generate unique request ID
    const incomingId = req.headers['x-request-id'];
    const requestId = (incomingId && typeof incomingId === 'string' && incomingId.length <= 128)
        ? incomingId
        : 'req_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    req.id = requestId;
    req.requestId = requestId;
    req.startTime = Date.now();

    // Set standard response header
    res.setHeader('X-Request-ID', requestId);

    // Capture response completion for logging and metrics
    res.on('finish', () => {
        const responseTimeMs = Date.now() - req.startTime;
        const statusCode = res.statusCode;
        const route = req.originalUrl || req.url;
        const method = req.method;
        const userId = req.user?.id || null;

        // Record metrics
        metricsService.recordRequest({
            method,
            route,
            statusCode,
            durationMs: responseTimeMs,
            error: res.locals?.errorMessage
        });

        // Log structured info
        const meta = {
            requestId,
            userId,
            route,
            method,
            statusCode,
            responseTimeMs
        };

        if (statusCode >= 500) {
            logger.error(`${method} ${route} - Server Error`, { ...meta, errorCode: 'INTERNAL_ERROR' });
        } else if (statusCode >= 400) {
            logger.warn(`${method} ${route} - Client Error`, { ...meta, errorCode: 'CLIENT_ERROR' });
        } else {
            logger.info(`${method} ${route} - Success`, meta);
        }
    });

    next();
}

module.exports = requestContextMiddleware;
