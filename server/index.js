const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const socket = require('./socket');
const { pool, connectDB } = require('./config/db');
const logger = require('./services/logger');
const { validateEnvironment } = require('./config/envValidator');
const requestContextMiddleware = require('./middleware/requestContextMiddleware');
const { errorHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const userRoutes = require('./routes/userRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const swapRoutes = require('./routes/swapRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const couponRoutes = require('./routes/couponRoutes');
const activityRoutes = require('./routes/activityRoutes');
const aiRoutes = require('./routes/aiRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const searchRoutes = require('./routes/searchRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const reportRoutes = require('./routes/reportRoutes');
const personalizationRoutes = require('./routes/personalizationRoutes');
const financialRoutes = require('./routes/financialRoutes');
const sellerOperationsRoutes = require('./routes/sellerOperationsRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const adminOperationsRoutes = require('./routes/adminOperationsRoutes');
const intelligenceRoutes = require('./routes/intelligenceRoutes');
const healthRoutes = require('./routes/healthRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// Validate Environment on Startup
try {
    const envCheck = validateEnvironment();
    logger.info('Environment configuration verified successfully', { status: envCheck.status });
} catch (e) {
    logger.fatal('Environment validation failed on startup', { error: e.message });
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}

// Verify Database Connectivity on Startup + Start Scheduled Reconciliation Worker
connectDB().then(() => {
    logger.info('Database connected. Starting scheduled swap refund reconciliation worker...');
    const jobEngineService = require('./services/jobEngineService');

    // Immediate startup sweep — catches refunds pending from before server restart
    jobEngineService.executeJob('RECONCILE_SWAP_REFUNDS', {
        idempotencyKey: `RECONCILE_SWAP_REFUNDS_startup_${Date.now()}`,
        maxAttempts: 1,
        triggerSource: 'SCHEDULER'
    }).catch(err => logger.warn('Startup swap refund reconciliation failed (non-fatal)', { error: err.message }));

    // Recurring 30-minute sweep; DB-level UNIQUE constraint on idempotency_key
    // prevents concurrent execution across PM2 cluster instances
    setInterval(async () => {
        const windowKey = `RECONCILE_SWAP_REFUNDS_${Math.floor(Date.now() / (30 * 60 * 1000))}`;
        try {
            await jobEngineService.executeJob('RECONCILE_SWAP_REFUNDS', {
                idempotencyKey: windowKey,
                maxAttempts: 1,
                triggerSource: 'SCHEDULER'
            });
        } catch (err) {
            // Errors are non-fatal — logged and retried on next window
            logger.warn('Scheduled swap refund reconciliation failed (non-fatal)', { error: err.message, windowKey });
        }
    }, 30 * 60 * 1000);
}).catch(err => {
    logger.error('Database connection warning on startup', { error: err.message });
});

const app = express();
const server = http.createServer(app);
socket.init(server);

// Trust Proxy Configuration:
// When running behind a trusted reverse proxy (e.g. Nginx in Docker / production),
// trust loopback and private RFC1918 subnets (uniquelocal, linklocal) so req.ip resolves
// to the real client IP forwarded by Nginx. Direct untrusted connections cannot spoof X-Forwarded-For.
const trustProxyConfig = process.env.TRUST_PROXY 
    ? (process.env.TRUST_PROXY === 'true' ? true : (process.env.TRUST_PROXY === 'false' ? false : (isNaN(process.env.TRUST_PROXY) ? process.env.TRUST_PROXY.split(',').map(s => s.trim()) : parseInt(process.env.TRUST_PROXY, 10))))
    : (process.env.NODE_ENV === 'production' ? ['loopback', 'linklocal', 'uniquelocal'] : false);

if (trustProxyConfig !== false) {
    app.set('trust proxy', trustProxyConfig);
}

// Enterprise Security Hardening with Helmet & Security Headers
//
// Content Security Policy — Canonical Allowlist (mirrored in nginx/nginx.conf for the SPA):
//
// Dual CSP Architecture:
// 1. Nginx attaches this policy to the top-level React SPA HTML document ('location /')
//    where browsers actually enforce DOM, script, and frame security boundaries.
// 2. Helmet attaches this policy here to Express API responses ('/api/*') as defense-in-depth
//    against direct API navigation.
// 3. Nginx does NOT set CSP in 'location /api/' or 'location /socket.io/', preventing duplicate headers.
//
// Directives & Justifications:
//   default-src: Restrict all unlisted resource types to same-origin ('self').
//   script-src:  Razorpay checkout SDK (checkout.razorpay.com),
//                Google Identity Services (accounts.google.com),
//                Vite-bundled application code ('self').
//                No eval and no broad wildcards.
//   style-src:   Google Fonts CSS (fonts.googleapis.com), bundled styles ('self').
//                'unsafe-inline' is required because Vite and Tailwind CSS inject utility
//                classes into <style> tags dynamically at runtime during client-side hydration.
//   font-src:    Google Fonts binary assets (fonts.gstatic.com), bundled fonts ('self').
//   img-src:     Cloudinary media CDN (res.cloudinary.com),
//                Google user profile avatars (*.googleusercontent.com covering lh3..lh6),
//                Razorpay badge images (checkout.razorpay.com),
//                data: URIs for inline SVG fallbacks used in DisputeDetail component,
//                blob: for canvas/object-URL patterns,
//                self for locally hosted book covers / placeholder assets.
//   connect-src: Same-origin API calls and Socket.IO ('self'),
//                Google Books API (www.googleapis.com) used by googleBooksService,
//                Razorpay payment gateway API (api.razorpay.com),
//                Cloudinary upload endpoint (api.cloudinary.com),
//                Google Identity Services authentication endpoints (accounts.google.com),
//                WebSocket connections to same origin (ws: wss:).
//   frame-src:   Google Identity Services One Tap / credential iframe (accounts.google.com),
//                Razorpay checkout modals & 3D-Secure bank OTP verification (api.razorpay.com, checkout.razorpay.com),
//                'self' for same-origin iframes.
//   object-src:  Disallowed entirely ('none') to block Flash / plugin execution.
//   base-uri:    Restricted to 'self' to prevent <base> tag hijacking.
//   form-action: Restricted to 'self'.
const cspDirectives = {
    defaultSrc:     ["'self'"],
    scriptSrc:      ["'self'", 'https://checkout.razorpay.com', 'https://accounts.google.com'],
    styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
    imgSrc:         [
        "'self'",
        'data:',
        'blob:',
        'https://res.cloudinary.com',
        'https://*.googleusercontent.com',
        'https://checkout.razorpay.com'
    ],
    connectSrc:     [
        "'self'",
        'https://www.googleapis.com',
        'https://api.razorpay.com',
        'https://api.cloudinary.com',
        'https://accounts.google.com',
        'wss:',
        'ws:'
    ],
    frameSrc:       [
        "'self'",
        'https://accounts.google.com',
        'https://api.razorpay.com',
        'https://checkout.razorpay.com'
    ],
    objectSrc:      ["'none'"],
    baseUri:        ["'self'"],
    formAction:     ["'self'"],
};

app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: { directives: cspDirectives },
    referrerPolicy: { policy: 'no-referrer-when-downgrade' },
    xContentTypeOptions: true
}));

// Additional Security Headers
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// CORS Configuration - Restrict to Explicitly Configured Trusted Origins
const { isOriginAllowed } = require('./config/cors');

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server, curl, mobile, or same-origin requests with no origin header
        if (!origin) return callback(null, true);
        if (isOriginAllowed(origin)) {
            return callback(null, true);
        }
        const err = new Error(`CORS policy violation: Origin ${origin} not permitted`);
        err.statusCode = 403;
        err.code = 'CORS_FORBIDDEN';
        return callback(err);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Request-ID', 
        'Idempotency-Key', 
        'idempotency-key', 
        'X-Requested-With', 
        'x-razorpay-signature',
        'Accept',
        'Origin'
    ]
}));

// Rate Limiting Configuration
const isDev = process.env.NODE_ENV !== 'production';

// Standard API Limiter: generous in dev, protects API from flooding in production
const standardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || (isDev ? 5000 : 600),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Do not count health checks or auth endpoints toward standard general limits
        // Auth endpoints have dedicated authLimiter brute-force protection
        const path = req.baseUrl || req.path || '';
        return path.includes('/auth') || path.includes('/health');
    },
    message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Strict Brute-Force Rate Limiting for Auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || (isDev ? 100 : 30),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed attempts so legitimate users are not locked out
    message: { message: 'Too many failed login/registration attempts, please try again after 15 minutes.' }
});

app.use('/api/', standardLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Request Correlation & Structured Logging Middleware
app.use(requestContextMiddleware);

// Body Parsers with limits & raw body capture for webhook HMAC signature verification
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        if (buf && buf.length) {
            req.rawBody = buf;
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 1. Production Health, Readiness & Metrics
app.use('/api/health', healthRoutes);
app.use('/api/v1/health', healthRoutes);

// 2. Payment & External Webhooks
app.use('/api/webhooks', webhookRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// 3. Core API Routes (with /api/v1 versioned aliases)
function registerRoutes(prefix) {
    app.use(`${prefix}/auth`, authRoutes);
    app.use(`${prefix}/categories`, categoryRoutes);
    app.use(`${prefix}/recommendations`, recommendationRoutes);
    app.use(`${prefix}/books`, bookRoutes);
    app.use(`${prefix}/users`, userRoutes);
    app.use(`${prefix}/wishlist`, wishlistRoutes);
    app.use(`${prefix}/cart`, cartRoutes);
    app.use(`${prefix}/orders`, orderRoutes);
    app.use(`${prefix}/swaps`, swapRoutes);
    app.use(`${prefix}/notifications`, notificationRoutes);
    app.use(`${prefix}/reviews`, reviewRoutes);
    app.use(`${prefix}/admin`, adminRoutes);
    app.use(`${prefix}/chat`, chatRoutes);
    app.use(`${prefix}/messages`, messageRoutes);
    app.use(`${prefix}/upload`, uploadRoutes);
    app.use(`${prefix}/payments`, paymentRoutes);
    app.use(`${prefix}/coupons`, couponRoutes);
    app.use(`${prefix}/activity`, activityRoutes);
    app.use(`${prefix}/ai`, aiRoutes);
    app.use(`${prefix}/analytics`, analyticsRoutes);
    app.use(`${prefix}/search`, searchRoutes);
    app.use(`${prefix}/disputes`, disputeRoutes);
    app.use(`${prefix}/reports`, reportRoutes);
    app.use(`${prefix}/personalization`, personalizationRoutes);
    app.use(`${prefix}/financials`, financialRoutes);
    app.use(`${prefix}/seller`, sellerOperationsRoutes);
    app.use(`${prefix}/shipments`, shipmentRoutes);
    app.use(`${prefix}/admin/operations`, adminOperationsRoutes);
    app.use(`${prefix}/intelligence`, intelligenceRoutes);
}

registerRoutes('/api');
registerRoutes('/api/v1');

// Root Status
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'QUIRO Book Marketplace Production API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Standardized Central Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    server.listen(PORT, () => {
        logger.info(`Server running in production-ready mode on port ${PORT}`);
    });
}

// Graceful Shutdown Handler
let isShuttingDown = false;
async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.warn(`Received ${signal}. Initiating graceful shutdown sequence...`);

    // 1. Stop accepting new HTTP connections
    server.close(() => {
        logger.info('HTTP server stopped accepting new connections');
    });

    try {
        // 2. Close MySQL connection pool
        await pool.end();
        logger.info('MySQL database connection pool closed cleanly');

        logger.info('Graceful shutdown complete. Exiting process safely.');
        process.exit(0);
    } catch (err) {
        logger.error('Error during graceful shutdown', { error: err.message });
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, gracefulShutdown };
