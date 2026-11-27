/**
 * QUIRO — Stage 10C: Strict Production Environment Validation Test Suite
 *
 * Tests validateStrictProductionEnv and validateEnvironment({ strictProduction: true })
 * using synthetic non-secret test values only.
 */

'use strict';

const assert = require('assert');
const {
    validateEnvironment,
    validateStrictProductionEnv
} = require('../../config/envValidator');

function makeValidProdEnv() {
    return {
        NODE_ENV: 'production',
        DB_HOST: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
        DB_PORT: '4000',
        DB_USER: 'quiro_prod_user',
        DB_PASSWORD: 'fake_strong_db_pass_value_for_unit_test_only',
        DB_NAME: 'quiro',
        DB_SSL: 'true',
        JWT_SECRET: 'fake_jwt_secret_for_unit_test_minimum_32_chars_ok',
        CLIENT_URL: 'https://quiro.vercel.app,https://quiro.in',
        RAZORPAY_KEY_ID: 'rzp_live_fake_key_id_123456',
        RAZORPAY_KEY_SECRET: 'fake_razorpay_key_secret_123456',
        RAZORPAY_WEBHOOK_SECRET: 'fake_webhook_secret_for_unit_test_min_32_chars_ok',
        CLOUDINARY_CLOUD_NAME: 'quiro-media',
        CLOUDINARY_API_KEY: '123456789012345',
        CLOUDINARY_API_SECRET: 'fake_cloudinary_api_secret_unit_test'
    };
}

function runTests() {
    console.log('\n============================================================');
    console.log('QUIRO Stage 10C: Strict Production Environment Validation Tests');
    console.log('============================================================\n');

    let passed = 0;
    let total = 0;

    function check(desc, condition) {
        total++;
        if (condition) {
            passed++;
            console.log(`  [PASS] Check ${total}: ${desc}`);
        } else {
            console.error(`  [FAIL] Check ${total}: ${desc}`);
            throw new Error(`Assertion failed: ${desc}`);
        }
    }

    // 1. Valid production configuration (without optional AI or Google OAuth)
    const baseValid = makeValidProdEnv();
    const validRes = validateStrictProductionEnv(baseValid);
    check('Valid production env passes without optional AI/Google OAuth vars', validRes.valid === true && validRes.errors.length === 0);

    // 2. Missing critical variables
    const requiredKeys = [
        'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_SSL',
        'CLIENT_URL', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET',
        'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'
    ];
    for (const k of requiredKeys) {
        const envCopy = makeValidProdEnv();
        delete envCopy[k];
        const r = validateStrictProductionEnv(envCopy);
        check(`Missing ${k} fails strict production validation`, r.valid === false && r.errors.some(e => e.includes(k)));
    }

    // 3. Empty variables
    for (const k of ['DB_HOST', 'DB_PASSWORD', 'CLIENT_URL', 'CLOUDINARY_API_SECRET']) {
        const envCopy = makeValidProdEnv();
        envCopy[k] = '   ';
        const r = validateStrictProductionEnv(envCopy);
        check(`Empty ${k} fails strict production validation`, r.valid === false && r.errors.some(e => e.includes(k)));
    }

    // 4. Invalid database configuration
    {
        const e1 = makeValidProdEnv(); e1.DB_HOST = 'localhost';
        check('DB_HOST=localhost rejected in production', !validateStrictProductionEnv(e1).valid);

        const e2 = makeValidProdEnv(); e2.DB_SSL = 'false';
        check('DB_SSL=false rejected in production', !validateStrictProductionEnv(e2).valid);

        const e3 = makeValidProdEnv(); e3.DB_NAME = 'quiro_test';
        check('DB_NAME=quiro_test rejected in production', !validateStrictProductionEnv(e3).valid);

        const e4 = makeValidProdEnv(); e4.DB_PORT = 'notaport';
        check('Non-numeric DB_PORT rejected in production', !validateStrictProductionEnv(e4).valid);
    }

    // 5. Invalid CLIENT_URL
    {
        const e1 = makeValidProdEnv(); e1.CLIENT_URL = 'http://quiro.vercel.app';
        check('HTTP CLIENT_URL rejected in production', !validateStrictProductionEnv(e1).valid);

        const e2 = makeValidProdEnv(); e2.CLIENT_URL = 'https://localhost:5173';
        check('Localhost CLIENT_URL rejected in production', !validateStrictProductionEnv(e2).valid);

        const e3 = makeValidProdEnv(); e3.CLIENT_URL = '*';
        check('Wildcard CLIENT_URL rejected in production', !validateStrictProductionEnv(e3).valid);

        const e4 = makeValidProdEnv(); e4.CLIENT_URL = 'not-a-valid-url';
        check('Malformed CLIENT_URL rejected in production', !validateStrictProductionEnv(e4).valid);
    }

    // 6. Invalid Razorpay & placeholder secrets (and zero secret leakage)
    {
        const e1 = makeValidProdEnv(); e1.RAZORPAY_KEY_ID = 'invalid_key_123';
        check('Invalid RAZORPAY_KEY_ID prefix rejected', !validateStrictProductionEnv(e1).valid);

        const e2 = makeValidProdEnv(); e2.RAZORPAY_KEY_SECRET = 'your_secret_placeholder';
        const r2 = validateStrictProductionEnv(e2);
        check('Placeholder RAZORPAY_KEY_SECRET rejected without leaking value', !r2.valid && !r2.errors.join(' ').includes('your_secret_placeholder'));

        const e3 = makeValidProdEnv(); e3.DB_PASSWORD = 'your_ultra_secure_prod_password_here';
        const r3 = validateStrictProductionEnv(e3);
        check('Placeholder DB_PASSWORD rejected without leaking value', !r3.valid && !r3.errors.join(' ').includes('your_ultra_secure_prod_password_here'));

        const e4 = makeValidProdEnv(); e4.CLOUDINARY_API_KEY = 'dummy_key';
        check('Dummy CLOUDINARY_API_KEY rejected', !validateStrictProductionEnv(e4).valid);
    }

    // 7. validateEnvironment({ strictProduction: true }) integration
    const origEnv = { ...process.env };
    try {
        Object.assign(process.env, makeValidProdEnv());
        const okRes = validateEnvironment({ strictProduction: true });
        check('validateEnvironment({ strictProduction: true }) succeeds with valid production env',
            okRes.valid === true && okRes.status.cloudinary === 'CONFIGURED');

        // Webhook secret == Key secret rejected
        process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_KEY_SECRET;
        let sameSecretThrew = false;
        try {
            validateEnvironment({ strictProduction: true });
        } catch (err) {
            sameSecretThrew = err.message.includes('RAZORPAY_WEBHOOK_SECRET');
        }
        check('validateEnvironment rejects identical webhook and API key secrets', sameSecretThrew);

        // Missing Cloudinary throws in strict production
        Object.assign(process.env, makeValidProdEnv());
        delete process.env.CLOUDINARY_API_SECRET;
        let missingCloudThrew = false;
        try {
            validateEnvironment({ strictProduction: true });
        } catch (err) {
            missingCloudThrew = err.message.includes('CLOUDINARY_API_SECRET');
        }
        check('validateEnvironment({ strictProduction: true }) throws when Cloudinary is missing', missingCloudThrew);

        // Development & test compatibility preserved
        process.env.NODE_ENV = 'development';
        delete process.env.DB_HOST;
        delete process.env.CLOUDINARY_API_SECRET;
        delete process.env.CLIENT_URL;
        process.env.DB_NAME = 'quiro';
        process.env.JWT_SECRET = 'dev_short';
        const devRes = validateEnvironment();
        check('Development mode remains compatible without production-only vars', devRes.valid === true);
    } finally {
        for (const k of Object.keys(process.env)) {
            if (!(k in origEnv)) delete process.env[k];
        }
        Object.assign(process.env, origEnv);
    }

    console.log(`\n============================================================`);
    console.log(`Stage 10C Production Env Validation: ALL ${passed}/${total} CHECKS PASSED`);
    console.log(`============================================================\n`);
}

runTests();
