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

// Verify Database Connectivity on Startup
connectDB().catch(err => {
    logger.error('Database connection warning on startup', { error: err.message });
});

const app = express();
const server = http.createServer(app);
socket.init(server);

// Enterprise Security Hardening with Helmet & Security Headers
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
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
const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server, curl, mobile, or same-origin requests with no origin header
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        return callback(new Error(`CORS policy violation: Origin ${origin} not permitted`));
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

// Body Parsers with limits
app.use(express.json({ limit: '10mb' }));
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
