
// Known insecure placeholder values for RAZORPAY_WEBHOOK_SECRET.
// Compared case-insensitively against the full secret value.
const INSECURE_WEBHOOK_SECRET_PATTERNS = [
    'secret',
    'your-secret',
    'your_secret',
    'webhook_secret',
    'webhooksecret',
    'changeme',
    'change_me',
    'replace_me',
    'placeholder',
    'example',
    'default',
    'test_secret',
    'test-secret',
    'dev_secret',
    'dev-secret',
    'quiro_webhook',
    'quiro-webhook',
    '12345',
    'abcdef',
    'razorpay_webhook_secret',
    'your_razorpay_webhook_secret',
    'your-razorpay-webhook-secret',
];

const WEBHOOK_SECRET_MIN_LENGTH = 32;

/**
 * Validates RAZORPAY_WEBHOOK_SECRET for production strength requirements.
 *
 * Rules (production only):
 *   1. Must be present and non-empty.
 *   2. Must be at least WEBHOOK_SECRET_MIN_LENGTH (32) characters.
 *   3. Must not match any known insecure placeholder.
 *   4. Must not equal RAZORPAY_KEY_SECRET (API key must not double as webhook secret).
 *
 * The actual secret value is NEVER included in error messages or return values.
 *
 * @param {string|undefined} secret       - The webhook secret to validate
 * @param {string|undefined} apiKeySecret - The Razorpay API key secret (for reuse check)
 * @param {boolean} isProduction          - Whether to enforce production rules
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateWebhookSecret(secret, apiKeySecret, isProduction) {
    if (!isProduction) {
        // In development/test: only require presence if explicitly set; fallback allowed.
        return { valid: true, errors: [] };
    }

    const errors = [];

    // Rule 1: Presence
    if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
        errors.push(
            'RAZORPAY_WEBHOOK_SECRET is required in production and must not be empty. ' +
            'Set a dedicated, cryptographically random webhook secret of at least 32 characters ' +
            'in your Razorpay dashboard and configure it as RAZORPAY_WEBHOOK_SECRET.'
        );
        return { valid: false, errors };
    }

    const trimmed = secret.trim();

    // Rule 2: Minimum length
    if (trimmed.length < WEBHOOK_SECRET_MIN_LENGTH) {
        errors.push(
            `RAZORPAY_WEBHOOK_SECRET must be at least ${WEBHOOK_SECRET_MIN_LENGTH} characters long in production ` +
            `(current length: ${trimmed.length}). ` +
            'Use a dedicated webhook secret configured in the Razorpay dashboard.'
        );
    }

    // Rule 3: Known insecure placeholder check (case-insensitive, exact match)
    const lower = trimmed.toLowerCase();
    const isPlaceholder = INSECURE_WEBHOOK_SECRET_PATTERNS.some(p => lower === p.toLowerCase());
    if (isPlaceholder) {
        errors.push(
            'RAZORPAY_WEBHOOK_SECRET appears to contain a known placeholder or example value. ' +
            'Replace it with the dedicated webhook secret from your Razorpay dashboard.'
        );
    }

    // Rule 4: Must not be the same as the API key secret
    if (apiKeySecret && typeof apiKeySecret === 'string' && trimmed === apiKeySecret.trim()) {
        errors.push(
            'RAZORPAY_WEBHOOK_SECRET must not be the same as RAZORPAY_KEY_SECRET. ' +
            'Use a dedicated webhook secret from the Razorpay dashboard, separate from the API key.'
        );
    }

    return { valid: errors.length === 0, errors };
}

const INSECURE_JWT_PATTERNS = [
    'secret',
    'your-secret',
    'your_secret',
    'jwt_secret',
    'jwtsecret',
    'changeme',
    'change_me',
    'change-me',
    'replace_me',
    'replace-me',
    'placeholder',
    'example',
    'default',
    'password',
    'quiro_secret',
    'quiro-secret',
    'mysecret',
    'my-secret',
    'my_secret',
    'supersecret',
    'super_secret',
    'super-secret',
    'randomsecret',
    'random_secret',
    'dev_secret',
    'dev-secret',
    'test_secret',
    'test-secret',
    '12345',
    'abcdef',
    'replace_with_your_own_secure_random_secret',  // from server/.env.example
    'production_jwt_secret_must_be_rotated_and_stored_in_vault',  // from .env.production.example
    'your-jwt-secret-key',
    'your_jwt_secret_key',
];

const JWT_MIN_LENGTH = 32;

/**
 * Validates the JWT_SECRET for production strength requirements.
 *
 * Rules (production only):
 *   1. Secret must be present and non-empty.
 *   2. Secret must be at least JWT_MIN_LENGTH (32) characters long.
 *   3. Secret must not match any known insecure placeholder string.
 *
 * The actual secret value is NEVER included in error messages or return values.
 *
 * @param {string|undefined} secret  - The secret to validate (from process.env.JWT_SECRET)
 * @param {boolean} isProduction     - Whether to enforce production-strength requirements
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateJwtSecret(secret, isProduction) {
    if (!isProduction) {
        // In development/test: only require presence so existing workflows are not broken.
        const present = typeof secret === 'string' && secret.trim().length > 0;
        return {
            valid: present,
            errors: present ? [] : ['JWT_SECRET is not set. Authentication will not function correctly.']
        };
    }

    const errors = [];

    // Rule 1: Presence
    if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
        errors.push(
            'JWT_SECRET is required in production and must not be empty. ' +
            'Generate a cryptographically random value of at least 32 characters ' +
            '(e.g. `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"`).'
        );
        // Cannot check length or patterns on a missing value — stop here.
        return { valid: false, errors };
    }

    const trimmed = secret.trim();

    // Rule 2: Minimum length
    if (trimmed.length < JWT_MIN_LENGTH) {
        errors.push(
            `JWT_SECRET must be at least ${JWT_MIN_LENGTH} characters long in production ` +
            `(current length: ${trimmed.length}). ` +
            'Generate a cryptographically random value with sufficient entropy.'
        );
    }

    // Rule 3: Known insecure placeholder check (case-insensitive, no partial match)
    const lowerSecret = trimmed.toLowerCase();
    const matched = INSECURE_JWT_PATTERNS.some(pattern => lowerSecret === pattern.toLowerCase());
    if (matched) {
        errors.push(
            'JWT_SECRET appears to contain a known placeholder or example value. ' +
            'Replace it with a cryptographically random secret before deploying to production.'
        );
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

const GENERIC_PLACEHOLDER_SUBSTRINGS = [
    'placeholder',
    'changeme',
    'change_me',
    'replace_with',
    'replace_me',
    'your_',
    'your-',
    'dummy_',
    'example'
];

function isGenericPlaceholder(val) {
    if (!val || typeof val !== 'string') return false;
    const lower = val.trim().toLowerCase();
    return GENERIC_PLACEHOLDER_SUBSTRINGS.some(p => lower.includes(p));
}

function isLocalHostname(host) {
    if (!host || typeof host !== 'string') return false;
    const lower = host.trim().toLowerCase();
    return lower === 'localhost' || lower === '127.0.0.1' || lower === '::1';
}

/**
 * Validates the full set of required production environment variables for
 * Render + TiDB Cloud + Vercel deployment without ever exposing secret values.
 *
 * @param {Record<string, string|undefined>} env - Environment object (defaults to process.env)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateStrictProductionEnv(env = process.env) {
    const errors = [];

    // 1. Database configuration (TiDB Cloud / managed MySQL over TLS)
    const dbHost = env.DB_HOST ? env.DB_HOST.trim() : '';
    if (!dbHost) {
        errors.push('DB_HOST is required in production.');
    } else if (isLocalHostname(dbHost) || isGenericPlaceholder(dbHost)) {
        errors.push('DB_HOST must be a valid remote database hostname (not localhost or a placeholder) in production.');
    }

    const dbPortRaw = env.DB_PORT ? env.DB_PORT.trim() : '';
    const dbPort = parseInt(dbPortRaw, 10);
    if (!dbPortRaw || !Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535 || String(dbPort) !== dbPortRaw) {
        errors.push('DB_PORT must be a valid TCP port number (e.g. 4000 for TiDB Cloud) in production.');
    }

    const dbUser = env.DB_USER ? env.DB_USER.trim() : '';
    if (!dbUser || isGenericPlaceholder(dbUser)) {
        errors.push('DB_USER is required and must not be a placeholder in production.');
    }

    const dbPassword = env.DB_PASSWORD ? env.DB_PASSWORD.trim() : '';
    if (!dbPassword || isGenericPlaceholder(dbPassword) || dbPassword.toLowerCase() === 'password') {
        errors.push('DB_PASSWORD is required and must not be a placeholder in production.');
    }

    const dbName = env.DB_NAME ? env.DB_NAME.trim() : '';
    if (!dbName || dbName === 'quiro_test' || isGenericPlaceholder(dbName)) {
        errors.push('DB_NAME is required and must target the production database (not quiro_test or a placeholder).');
    }

    if ((env.DB_SSL || '').trim().toLowerCase() !== 'true') {
        errors.push('DB_SSL must be set to "true" in production to enforce TLS for TiDB Cloud.');
    }

    // 2. Frontend CORS origin(s)
    const clientUrlRaw = env.CLIENT_URL ? env.CLIENT_URL.trim() : '';
    if (!clientUrlRaw) {
        errors.push('CLIENT_URL is required in production (set to your Vercel frontend HTTPS origin).');
    } else {
        const origins = clientUrlRaw.split(',').map(s => s.trim()).filter(Boolean);
        if (origins.length === 0) {
            errors.push('CLIENT_URL must contain at least one valid HTTPS origin in production.');
        } else {
            for (const origin of origins) {
                if (origin === '*') {
                    errors.push('CLIENT_URL must not contain wildcard "*" in production.');
                    break;
                }
                let parsed;
                try {
                    parsed = new URL(origin);
                } catch {
                    errors.push('CLIENT_URL contains a malformed URL in production.');
                    break;
                }
                if (parsed.protocol !== 'https:') {
                    errors.push('CLIENT_URL origins must use https:// in production.');
                    break;
                }
                if (isLocalHostname(parsed.hostname)) {
                    errors.push('CLIENT_URL must not reference localhost or 127.0.0.1 in production.');
                    break;
                }
            }
        }
    }

    // 3. Razorpay API credentials
    const rzpKeyId = env.RAZORPAY_KEY_ID ? env.RAZORPAY_KEY_ID.trim() : '';
    if (!rzpKeyId || isGenericPlaceholder(rzpKeyId) || (!rzpKeyId.startsWith('rzp_live_') && !rzpKeyId.startsWith('rzp_test_'))) {
        errors.push('RAZORPAY_KEY_ID is required and must be a valid non-placeholder Razorpay key ID in production.');
    }

    const rzpKeySecret = env.RAZORPAY_KEY_SECRET ? env.RAZORPAY_KEY_SECRET.trim() : '';
    if (!rzpKeySecret || isGenericPlaceholder(rzpKeySecret) || rzpKeySecret.length < 16) {
        errors.push('RAZORPAY_KEY_SECRET is required and must be a valid non-placeholder Razorpay secret in production.');
    }

    // 4. Cloudinary media storage (required on Render ephemeral filesystem)
    const cloudName = env.CLOUDINARY_CLOUD_NAME ? env.CLOUDINARY_CLOUD_NAME.trim() : '';
    if (!cloudName || isGenericPlaceholder(cloudName)) {
        errors.push('CLOUDINARY_CLOUD_NAME is required and must not be a placeholder in production.');
    }

    const cloudApiKey = env.CLOUDINARY_API_KEY ? env.CLOUDINARY_API_KEY.trim() : '';
    if (!cloudApiKey || isGenericPlaceholder(cloudApiKey)) {
        errors.push('CLOUDINARY_API_KEY is required and must not be a placeholder in production.');
    }

    const cloudApiSecret = env.CLOUDINARY_API_SECRET ? env.CLOUDINARY_API_SECRET.trim() : '';
    if (!cloudApiSecret || isGenericPlaceholder(cloudApiSecret)) {
        errors.push('CLOUDINARY_API_SECRET is required and must not be a placeholder in production.');
    }

    return { valid: errors.length === 0, errors };
}

function validateEnvironment(options = {}) {
    const isProduction = process.env.NODE_ENV === 'production';
    const isTestProcess =
        Boolean(process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('/tests/')) ||
        process.env.DB_NAME === 'quiro_test' ||
        process.env.TEST_DB_NAME === 'quiro_test';

    const required = [
        'DB_NAME'
    ];

    const missingRequired = [];
    for (const key of required) {
        if (!process.env[key] || process.env[key].trim() === '') {
            missingRequired.push(key);
        }
    }

    // JWT secret is validated separately with strength checks
    const jwtResult = validateJwtSecret(process.env.JWT_SECRET, isProduction);
    if (!jwtResult.valid) {
        if (isProduction) {
            // Throw immediately so startup fails before any server socket is opened
            const errorText = jwtResult.errors.join(' | ');
            throw new Error(`JWT_SECRET validation failed: ${errorText}`);
        }
        // In dev/test: flag as missing but do not throw
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
            missingRequired.push('JWT_SECRET');
        }
    }

    // Razorpay webhook secret is validated separately with strength checks (production only)
    const webhookResult = validateWebhookSecret(
        process.env.RAZORPAY_WEBHOOK_SECRET,
        process.env.RAZORPAY_KEY_SECRET,
        isProduction
    );
    if (!webhookResult.valid && isProduction) {
        const errorText = webhookResult.errors.join(' | ');
        throw new Error(`RAZORPAY_WEBHOOK_SECRET validation failed: ${errorText}`);
    }

    // Full strict production environment validation for Render + TiDB Cloud + Vercel
    const enforceStrictProduction =
        isProduction && (options.strictProduction === true || (!isTestProcess && options.strictProduction !== false));

    let strictResult = { valid: true, errors: [] };
    if (enforceStrictProduction) {
        strictResult = validateStrictProductionEnv(process.env);
        if (!strictResult.valid) {
            throw new Error(`Production environment validation failed: ${strictResult.errors.join(' | ')}`);
        }
    }

    const status = {
        database: (process.env.DB_NAME && process.env.DB_USER) ? 'CONFIGURED' : 'PARTIAL',
        // Never expose the actual secret value in the status object
        jwt: jwtResult.valid ? 'CONFIGURED' : 'MISSING',
        webhookSecret: webhookResult.valid ? 'CONFIGURED' : (isProduction ? 'INVALID' : 'NOT_VALIDATED'),
        payments: (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) ? 'CONFIGURED' : 'NOT_CONFIGURED',
        cloudinary: (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
            ? 'CONFIGURED'
            : 'LOCAL_STORAGE_FALLBACK'
    };

    if (missingRequired.length > 0 && isProduction) {
        throw new Error(`Mandatory environment variables missing: ${missingRequired.join(', ')}`);
    }

    return {
        valid: missingRequired.length === 0 && jwtResult.valid && (isProduction ? (webhookResult.valid && strictResult.valid) : true),
        missingRequired,
        status
    };
}

module.exports = {
    validateEnvironment,
    validateJwtSecret,
    validateWebhookSecret,
    validateStrictProductionEnv,
    JWT_MIN_LENGTH,
    WEBHOOK_SECRET_MIN_LENGTH
};
