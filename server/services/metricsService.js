
class MetricsService {
    constructor() {
        this.reset();
    }

    reset() {
        this.startTime = Date.now();
        this.totalRequests = 0;
        this.totalErrors = 0;
        this.statusCodes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
        this.totalResponseTimeMs = 0;
        this.slowRequests = 0; // >500ms
        this.dbQueries = 0;
        this.dbFailures = 0;
        this.dbTotalLatencyMs = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.paymentFailures = 0;
        this.refundFailures = 0;
        this.orderFailures = 0;
        this.webhookFailures = 0;
        this.jobFailures = 0;
        this.socketErrors = 0;
        this.aiFailures = 0;
        this.recentSlowEndpoints = [];
        this.recentErrors = [];
    }

    recordRequest({ method, route, statusCode, durationMs, error = null }) {
        this.totalRequests++;
        this.totalResponseTimeMs += durationMs;

        const bucket = Math.floor(statusCode / 100) + 'xx';
        if (this.statusCodes[bucket] !== undefined) {
            this.statusCodes[bucket]++;
        }

        if (statusCode >= 400) {
            this.totalErrors++;
            this.recentErrors.push({
                timestamp: new Date().toISOString(),
                method,
                route,
                statusCode,
                error: typeof error === 'string' ? error : error?.message || 'HTTP Error'
            });
            if (this.recentErrors.length > 50) this.recentErrors.shift();
        }

        if (durationMs > 500) {
            this.slowRequests++;
            this.recentSlowEndpoints.push({
                timestamp: new Date().toISOString(),
                method,
                route,
                durationMs
            });
            if (this.recentSlowEndpoints.length > 50) this.recentSlowEndpoints.shift();
        }
    }

    recordDbQuery(durationMs, success = true) {
        this.dbQueries++;
        this.dbTotalLatencyMs += durationMs;
        if (!success) this.dbFailures++;
    }

    recordCache(hit = true) {
        if (hit) this.cacheHits++;
        else this.cacheMisses++;
    }

    recordPaymentFailure(reason) {
        this.paymentFailures++;
    }

    recordWebhookFailure(reason) {
        this.webhookFailures++;
    }

    recordJobFailure(jobKey, reason) {
        this.jobFailures++;
    }

    recordSocketError(err) {
        this.socketErrors++;
    }

    recordAiFailure(err) {
        this.aiFailures++;
    }

    getMetricsSummary() {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const avgResponseTimeMs = this.totalRequests > 0 
            ? Math.round(this.totalResponseTimeMs / this.totalRequests) 
            : 0;
        const avgDbLatencyMs = this.dbQueries > 0 
            ? (this.dbTotalLatencyMs / this.dbQueries).toFixed(2) 
            : '0.00';
        const rate4xx = this.totalRequests > 0 
            ? ((this.statusCodes['4xx'] / this.totalRequests) * 100).toFixed(2) + '%' 
            : '0.00%';
        const rate5xx = this.totalRequests > 0 
            ? ((this.statusCodes['5xx'] / this.totalRequests) * 100).toFixed(2) + '%' 
            : '0.00%';

        const cacheTotal = this.cacheHits + this.cacheMisses;
        const cacheHitRate = cacheTotal > 0 
            ? ((this.cacheHits / cacheTotal) * 100).toFixed(1) + '%' 
            : '100.0%';

        return {
            uptimeSeconds,
            totalRequests: this.totalRequests,
            totalErrors: this.totalErrors,
            statusCodes: this.statusCodes,
            rate4xx,
            rate5xx,
            avgResponseTimeMs,
            slowRequestsCount: this.slowRequests,
            database: {
                totalQueries: this.dbQueries,
                failures: this.dbFailures,
                avgLatencyMs: Number(avgDbLatencyMs)
            },
            cache: {
                hits: this.cacheHits,
                misses: this.cacheMisses,
                hitRate: cacheHitRate
            },
            operations: {
                paymentFailures: this.paymentFailures,
                refundFailures: this.refundFailures,
                orderFailures: this.orderFailures,
                webhookFailures: this.webhookFailures,
                jobFailures: this.jobFailures,
                socketErrors: this.socketErrors,
                aiFailures: this.aiFailures
            },
            recentSlowEndpoints: this.recentSlowEndpoints.slice(-10),
            recentErrors: this.recentErrors.slice(-10)
        };
    }
}

module.exports = new MetricsService();
