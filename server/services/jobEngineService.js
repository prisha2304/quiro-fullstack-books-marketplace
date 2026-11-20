
const { pool } = require('../config/db');
const marketplaceIntelligenceService = require('./marketplaceIntelligenceService');
const logger = require('./logger');
const metricsService = require('./metricsService');

class JobEngineService {
    constructor() {
        this.registeredJobs = new Map();
        this.registerDefaultJobs();
    }

    registerDefaultJobs() {
        this.registeredJobs.set('EXPIRE_RESERVATIONS', {
            name: 'Expire Outdated Inventory Reservations',
            description: 'Releases temporary locks on items from unpaid carts after 15m window',
            handler: async () => marketplaceIntelligenceService.runAutomationJob('EXPIRE_RESERVATIONS')
        });

        this.registeredJobs.set('REFRESH_INTELLIGENCE_CACHE', {
            name: 'Refresh Marketplace Demand & Intelligence Cache',
            description: 'Computes and updates aggregate demand forecasts and category signals',
            handler: async () => marketplaceIntelligenceService.runAutomationJob('REFRESH_INTELLIGENCE_CACHE')
        });

        this.registeredJobs.set('DETECT_STALE_LISTINGS', {
            name: 'Detect Stale Marketplace Listings',
            description: 'Identifies listings with 0 views and 0 sales older than 60 days',
            handler: async () => marketplaceIntelligenceService.runAutomationJob('DETECT_STALE_LISTINGS')
        });

        this.registeredJobs.set('DETECT_CATALOG_GAPS', {
            name: 'Detect Academic Catalog Shortages',
            description: 'Scans zero-result queries and high-demand low-supply genres',
            handler: async () => marketplaceIntelligenceService.runAutomationJob('DETECT_CATALOG_GAPS')
        });

        this.registeredJobs.set('SCAN_SLA_BREACH_RISKS', {
            name: 'Scan Seller SLA Breach Risks',
            description: 'Identifies unfulfilled seller orders approaching packing/ship deadline',
            handler: async () => marketplaceIntelligenceService.runAutomationJob('SCAN_SLA_BREACH_RISKS')
        });
    }

    getRegisteredJobs() {
        return Array.from(this.registeredJobs.entries()).map(([key, def]) => ({
            jobKey: key,
            name: def.name,
            description: def.description
        }));
    }

    async executeJob(jobKey, { idempotencyKey = null, maxAttempts = 3, triggerSource = 'MANUAL_ADMIN' } = {}) {
        if (!this.registeredJobs.has(jobKey)) {
            throw new Error(`Unsupported background job: ${jobKey}`);
        }

        const jobDef = this.registeredJobs.get(jobKey);
        const finalIdempotencyKey = idempotencyKey || `job_${jobKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // Check if idempotency key already executed successfully
        const [existing] = await pool.execute(
            'SELECT * FROM job_executions WHERE idempotency_key = ?',
            [finalIdempotencyKey]
        );

        if (existing.length > 0 && existing[0].status === 'SUCCESS') {
            logger.info(`Job execution skipped: Idempotency key ${finalIdempotencyKey} already completed`, { jobKey });
            return {
                executionId: existing[0].id,
                jobKey,
                idempotencyKey: finalIdempotencyKey,
                status: 'SUCCESS',
                alreadyExecuted: true,
                summary: existing[0].summary
            };
        }

        let executionId;
        if (existing.length > 0) {
            executionId = existing[0].id;
            await pool.execute(
                `UPDATE job_executions 
                 SET status = 'RUNNING', started_at = NOW(), attempt_number = attempt_number + 1 
                 WHERE id = ?`,
                [executionId]
            );
        } else {
            const [res] = await pool.execute(
                `INSERT INTO job_executions (job_key, idempotency_key, status, attempt_number, max_attempts, started_at)
                 VALUES (?, ?, 'RUNNING', 1, ?, NOW())`,
                [jobKey, finalIdempotencyKey, maxAttempts]
            );
            executionId = res.insertId;
        }

        const startTime = Date.now();
        let currentAttempt = existing.length > 0 ? (existing[0].attempt_number + 1) : 1;

        while (currentAttempt <= maxAttempts) {
            try {
                logger.info(`Executing job: ${jobKey} (Attempt ${currentAttempt}/${maxAttempts})`, { jobKey, idempotencyKey: finalIdempotencyKey });
                
                const result = await jobDef.handler();
                const durationMs = Date.now() - startTime;

                await pool.execute(
                    `UPDATE job_executions 
                     SET status = 'SUCCESS', completed_at = NOW(), duration_ms = ?, summary = ?
                     WHERE id = ?`,
                    [durationMs, JSON.stringify(result || {}), executionId]
                );

                logger.info(`Job completed successfully: ${jobKey} in ${durationMs}ms`, { jobKey, durationMs });

                return {
                    executionId,
                    jobKey,
                    idempotencyKey: finalIdempotencyKey,
                    status: 'SUCCESS',
                    durationMs,
                    summary: result
                };
            } catch (err) {
                const durationMs = Date.now() - startTime;
                metricsService.recordJobFailure(jobKey, err.message);

                if (currentAttempt < maxAttempts) {
                    currentAttempt++;
                    logger.warn(`Job ${jobKey} failed attempt ${currentAttempt - 1}. Retrying...`, { error: err.message });
                    await pool.execute(
                        `UPDATE job_executions 
                         SET status = 'RETRYING', attempt_number = ?, error_reason = ?
                         WHERE id = ?`,
                        [currentAttempt, err.message, executionId]
                    );
                    await new Promise(r => setTimeout(r, 200 * currentAttempt));
                } else {
                    await pool.execute(
                        `UPDATE job_executions 
                         SET status = 'FAILED', completed_at = NOW(), duration_ms = ?, error_reason = ?
                         WHERE id = ?`,
                        [durationMs, err.message, executionId]
                    );

                    logger.error(`Job ${jobKey} permanently failed after ${maxAttempts} attempts`, { error: err.message, jobKey });

                    throw new Error(`Job ${jobKey} failed: ${err.message}`);
                }
            }
        }
    }

    async getJobHistory({ limit = 20 } = {}) {
        const [rows] = await pool.execute(
            `SELECT id, job_key, idempotency_key, status, attempt_number, max_attempts, started_at, completed_at, duration_ms, summary, error_reason, created_at
             FROM job_executions 
             ORDER BY id DESC LIMIT ?`,
            [String(limit)]
        );
        return rows;
    }
}

module.exports = new JobEngineService();
