const Redis = require('ioredis');

class CacheManager {
    constructor() {
        this.isRedisAvailable = false;
        this.memoryStore = new Map();
        this.ttlStore = new Map();

        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        
        try {
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: 1,
                connectTimeout: 2000,
                lazyConnect: true,
                retryStrategy: (times) => {
                    if (times > 2) {
                        return null; // Stop retrying, use in-memory
                    }
                    return 1000;
                }
            });

            this.redis.connect()
                .then(() => {
                    this.isRedisAvailable = true;
                    console.log('⚡ Redis Cache Connected Successfully');
                })
                .catch(() => {
                    this.isRedisAvailable = false;
                    console.log('⚡ Redis Offline -> Using High-Speed In-Memory Cache Fallback');
                });

            this.redis.on('error', () => {
                this.isRedisAvailable = false;
            });
        } catch (e) {
            this.isRedisAvailable = false;
            console.log('⚡ Using In-Memory Cache Fallback');
        }

        // Cleanup expired memory keys periodically
        setInterval(() => this.cleanupMemoryStore(), 60000);
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
        if (this.isRedisAvailable) {
            try {
                const data = await this.redis.get(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                this.isRedisAvailable = false;
            }
        }

        // Memory fallback
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

        if (this.isRedisAvailable) {
            try {
                await this.redis.set(key, serialized, 'EX', ttlSeconds);
                return true;
            } catch (e) {
                this.isRedisAvailable = false;
            }
        }

        // Memory fallback
        this.memoryStore.set(key, serialized);
        this.ttlStore.set(key, Date.now() + ttlSeconds * 1000);
        return true;
    }

    async del(key) {
        if (this.isRedisAvailable) {
            try {
                await this.redis.del(key);
            } catch (e) {}
        }
        this.memoryStore.delete(key);
        this.ttlStore.delete(key);
    }

    async delPattern(pattern) {
        const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

        if (this.isRedisAvailable) {
            try {
                const keys = await this.redis.keys(pattern);
                if (keys.length > 0) {
                    await this.redis.del(keys);
                }
            } catch (e) {}
        }

        // In-memory pattern deletion
        for (const key of this.memoryStore.keys()) {
            if (regexPattern.test(key)) {
                this.memoryStore.delete(key);
                this.ttlStore.delete(key);
            }
        }
    }

    // Express route caching middleware
    cacheMiddleware(ttlSeconds = 300) {
        return async (req, res, next) => {
            // Only cache GET requests
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
