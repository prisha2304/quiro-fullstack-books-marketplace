
class EnvironmentConfig {
    constructor() {
        this.nodeEnv = process.env.NODE_ENV || 'development';
        this.port = parseInt(process.env.PORT || '5000', 10);
        this.isProduction = this.nodeEnv === 'production';
        this.isStaging = this.nodeEnv === 'staging';
        this.isDevelopment = this.nodeEnv === 'development' || !this.isProduction;
    }

    getDatabaseConfig() {
        return {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            database: process.env.DB_NAME || 'quiro',
            port: parseInt(process.env.DB_PORT || '3306', 10),
            ssl: process.env.DB_SSL === 'true',
            connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '10', 10),
            isConfigured: !!(process.env.DB_NAME && process.env.DB_USER)
        };
    }

    getRedisConfig() {
        return {
            isConfigured: false,
            mode: 'DISABLED_MYSQL_ONLY',
            note: 'Redis removed in favor of direct MySQL persistence'
        };
    }

    getPaymentConfig() {
        const hasKeys = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
        const isLive = (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_live');
        return {
            isConfigured: hasKeys,
            mode: !hasKeys ? 'NOT_CONFIGURED' : (isLive ? 'PRODUCTION' : 'TEST'),
            keyId: process.env.RAZORPAY_KEY_ID || null
        };
    }

    getStorageConfig() {
        const isCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
        return {
            provider: isCloudinary ? 'CLOUDINARY' : 'LOCAL_DISK',
            isCloudinaryConfigured: isCloudinary,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME || null
        };
    }

    getSafeSummary() {
        return {
            nodeEnv: this.nodeEnv,
            port: this.port,
            isProduction: this.isProduction,
            database: this.getDatabaseConfig(),
            redis: this.getRedisConfig(),
            payments: this.getPaymentConfig(),
            storage: this.getStorageConfig(),
            cors: {
                clientUrl: process.env.CLIENT_URL || 'http://localhost:5173'
            }
        };
    }
}

module.exports = new EnvironmentConfig();
