
const logger = require('../services/logger');

const ERROR_CODES = {
    400: 'VALIDATION_ERROR',
    401: 'AUTH_REQUIRED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'EXTERNAL_SERVICE_ERROR',
    503: 'SERVICE_UNAVAILABLE'
};

function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || (res.statusCode && res.statusCode >= 400 ? res.statusCode : 500);
    const requestId = req?.id || req?.requestId || 'req_unknown';
    const isProduction = process.env.NODE_ENV === 'production';

    // Map custom or HTTP error code
    let code = err.code || ERROR_CODES[statusCode] || 'INTERNAL_ERROR';
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        code = 'AUTH_REQUIRED';
    } else if (err.code === 'ER_DUP_ENTRY') {
        code = 'CONFLICT';
    } else if (err.code && err.code.startsWith('ER_')) {
        code = 'DATABASE_ERROR';
    }

    // Sanitize message for client
    let safeMessage = err.message || 'An unexpected error occurred';
    if (isProduction && statusCode === 500 && code === 'DATABASE_ERROR') {
        safeMessage = 'A database error occurred. Please try again.';
    } else if (isProduction && statusCode === 500 && !err.isOperational) {
        safeMessage = 'Internal server error. Please contact support with the Request ID.';
    }

    res.locals.errorMessage = safeMessage;

    // Log structured error internally
    logger.error(err.message || 'Unhandled Error', {
        requestId,
        errorCode: code,
        statusCode,
        route: req?.originalUrl || req?.url,
        method: req?.method,
        stack: isProduction ? undefined : err.stack
    });

    return res.status(statusCode).json({
        success: false,
        error: {
            code,
            message: safeMessage,
            requestId
        }
    });
}

module.exports = {
    errorHandler,
    ERROR_CODES
};
