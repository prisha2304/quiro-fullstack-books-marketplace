/**
 * In-Memory / Pass-through Cache Manager for QUIRO.
 * Redis has been removed in favor of direct MySQL persistence and high-speed in-memory caching.
 */
class CacheManager {
    constructor() {
        this.isRedisAvailable = false;
        this.memoryStore = new Map();
        this.ttlStore = new Map();
    }

    cleanupMemoryStore() {
        const now = Date.now();
        for (const [key, expireTime] of this.ttlStore.entries()) {
            if (expireTime <= now) {
                this.memoryStore.delete(key);
                this.ttlStore.delete(key);
            }
        }
    }

    async get(key) {
        const expireTime = this.ttlStore.get(key);
        if (expireTime && expireTime <= Date.now()) {
            this.memoryStore.delete(key);
            this.ttlStore.delete(key);
            return null;
        }
        const data = this.memoryStore.get(key);
        return data !== undefined ? JSON.parse(data) : null;
    }

    async set(key, value, ttlSeconds = 300) {
        const serialized = JSON.stringify(value);
        this.memoryStore.set(key, serialized);
        this.ttlStore.set(key, Date.now() + (ttlSeconds * 1000));
        return true;
    }

    async del(key) {
        this.memoryStore.delete(key);
        this.ttlStore.delete(key);
        return true;
    }

    async delPattern(pattern) {
        const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        for (const key of this.memoryStore.keys()) {
            if (regexPattern.test(key)) {
                this.memoryStore.delete(key);
                this.ttlStore.delete(key);
            }
        }
        return true;
    }

    // Express route caching middleware (pass-through / in-memory cache)
    cacheMiddleware(ttlSeconds = 300) {
        return async (req, res, next) => {
            if (req.method !== 'GET') {
                return next();
            }

            const key = `cache:${req.originalUrl || req.url}`;
            try {
                const cachedData = await this.get(key);
                if (cachedData) {
                    res.setHeader('X-Cache-Lookup', 'HIT');
                    return res.json(cachedData);
                }
            } catch (e) {}

            res.setHeader('X-Cache-Lookup', 'MISS');
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    this.set(key, body, ttlSeconds).catch(() => {});
                }
                return originalJson(body);
            };

            next();
        };
    }
}

const cache = new CacheManager();
module.exports = cache;
