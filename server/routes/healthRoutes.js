
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const metricsService = require('../services/metricsService');
const { validateEnvironment } = require('../config/envValidator');
const jobEngineService = require('../services/jobEngineService');
const webhookService = require('../services/webhookService');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');
const logger = require('../services/logger');

// Root health check endpoint
router.get('/', async (req, res) => {
    try {
        await pool.execute('SELECT 1');
        return res.status(200).json({
            status: 'UP',
            readiness: 'READY_FOR_TRAFFIC',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        logger.error('Root health check database probe failed', { error: e.message });
        return res.status(503).json({
            status: 'DOWN',
            readiness: 'NOT_READY',
            error: 'Database unreachable',
            timestamp: new Date().toISOString()
        });
    }
});

// Liveness check: Is process running
router.get('/live', (req, res) => {
    return res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime())
    });
});

// Readiness check: Can server accept traffic
router.get('/ready', async (req, res) => {
    try {
        await pool.execute('SELECT 1');
        return res.status(200).json({
            status: 'UP',
            readiness: 'READY_FOR_TRAFFIC',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        logger.error('Readiness health check database probe failed', { error: e.message });
        return res.status(503).json({
            status: 'DOWN',
            readiness: 'NOT_READY',
            error: 'Database unreachable',
            timestamp: new Date().toISOString()
        });
    }
});

// Deep Dependencies Check
router.get('/dependencies', protect, admin, async (req, res) => {
    const checks = {};
    let isHealthy = true;

    // 1. MySQL
    try {
        const start = Date.now();
        await pool.execute('SELECT 1');
        checks.database = { status: 'UP', latencyMs: Date.now() - start };
    } catch (e) {
        logger.error('Dependencies check database probe failed', { error: e.message });
        checks.database = { status: 'DOWN', error: 'Database unreachable' };
        isHealthy = false;
    }

    // 2. Database & Persistence Layer
    checks.persistence = {
        status: checks.database.status,
        provider: 'MYSQL'
    };

    // 3. Environment & Configuration
    const envCheck = validateEnvironment();
    checks.environment = {
        status: envCheck.valid ? 'UP' : 'DEGRADED',
        integrations: envCheck.status
    };

    // 4. Background Jobs Engine
    checks.jobEngine = {
        status: 'UP',
        registeredJobsCount: jobEngineService.getRegisteredJobs().length
    };

    return res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'UP' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        checks
    });
});

// Operational Metrics
router.get('/metrics', protect, admin, (req, res) => {
    const summary = metricsService.getMetricsSummary();
    return res.json(summary);
});

// Production Diagnostics Full Snapshot (Admin / Dashboard)
router.get('/diagnostics', protect, admin, async (req, res) => {
    try {
        const metrics = metricsService.getMetricsSummary();
        const env = validateEnvironment();
        const jobHistory = await jobEngineService.getJobHistory({ limit: 10 });
        const webhookEvents = await webhookService.getWebhookEvents({ limit: 10 });

        let dbStatus = 'HEALTHY';
        try {
            await pool.execute('SELECT 1');
        } catch (e) {
            logger.error('Diagnostics database probe failed', { error: e.message });
            dbStatus = 'DOWN';
        }

        const diagnostics = {
            system: {
                apiStatus: 'HEALTHY',
                dbStatus,
                persistenceStatus: 'MYSQL_DIRECT',
                socketStatus: 'CONNECTED',
                jobEngineStatus: 'RUNNING',
                uptime: `${Math.floor(process.uptime() / 60)} minutes`
            },
            reliability: {
                totalRequests: metrics.totalRequests,
                totalErrors: metrics.totalErrors,
                rate4xx: metrics.rate4xx,
                rate5xx: metrics.rate5xx,
                avgResponseTimeMs: metrics.avgResponseTimeMs,
                slowRequestsCount: metrics.slowRequestsCount
            },
            operations: metrics.operations,
            database: metrics.database,
            recentJobExecutions: jobHistory,
            recentWebhookEvents: webhookEvents,
            environmentStatus: env.status,
            evaluatedAt: new Date().toISOString()
        };

        return res.json(diagnostics);
    } catch (e) {
        logger.error('Diagnostics snapshot generation failed', { error: e.message });
        return res.status(500).json({ message: 'Failed to fetch diagnostics' });
    }
});

module.exports = router;
