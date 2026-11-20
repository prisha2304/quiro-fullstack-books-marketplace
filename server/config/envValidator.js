
function validateEnvironment() {
    const isProduction = process.env.NODE_ENV === 'production';

    const required = [
        'JWT_SECRET',
        'DB_NAME'
    ];

    const optional = [
        'DB_HOST',
        'DB_PORT',
        'DB_SSL',
        'DB_USER',
        'DB_PASSWORD',
        'PORT',
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'CLOUDINARY_CLOUD_NAME'
    ];

    const missingRequired = [];
    for (const key of required) {
        if (!process.env[key] || process.env[key].trim() === '') {
            missingRequired.push(key);
        }
    }

    const status = {
        database: (process.env.DB_NAME && process.env.DB_USER) ? 'CONFIGURED' : 'PARTIAL',
        jwt: process.env.JWT_SECRET ? 'CONFIGURED' : 'MISSING',
        payments: (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) ? 'CONFIGURED' : 'NOT_CONFIGURED',
        cloudinary: (process.env.CLOUDINARY_CLOUD_NAME) ? 'CONFIGURED' : 'LOCAL_STORAGE_FALLBACK'
    };

    if (missingRequired.length > 0 && isProduction) {
        throw new Error(`Mandatory environment variables missing: ${missingRequired.join(', ')}`);
    }

    return {
        valid: missingRequired.length === 0,
        missingRequired,
        status
    };
}

module.exports = { validateEnvironment };
