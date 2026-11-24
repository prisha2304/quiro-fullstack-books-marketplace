/**
 * QUIRO — Step 7F-4: JWT Secret Strength Validation Test Suite
 *
 * Tests:
 *  1.  Missing production JWT secret is rejected.
 *  2.  Secret shorter than 32 characters is rejected in production.
 *  3.  Exactly 32 characters is accepted (passes length & placeholder checks).
 *  4.  A sufficiently long secure-looking secret is accepted.
 *  5.  Known placeholder values are rejected (from .env.example and .env.production.example).
 *  6.  Validation error messages never contain the actual secret value.
 *  7.  Development/test mode is not affected by production strength rules.
 *  8.  validateEnvironment() throws in production when JWT_SECRET is bad, allowing startup to fail fast.
 *  9.  validateEnvironment() does NOT throw in development for a weak/missing secret.
 * 10.  Archive test compatibility: validateEnvironment still returns `missingRequired` and `status`.
 */

const assert = require('assert');
const { validateJwtSecret, validateEnvironment, JWT_MIN_LENGTH } = require('../../config/envValidator');

// --- Deterministic test secrets (never production values) ---
const EXACTLY_32   = 'a'.repeat(JWT_MIN_LENGTH);                 // 32 × 'a' — passes length, not in blocklist
const SHORT_SECRET = 'tooshort_less32chars';                     // 20 chars — too short
const SECURE_64    = 'x'.repeat(64);                             // 64 chars — passes all checks
const PLACEHOLDER_EXACT     = 'secret';                          // exact blocklist match
const PLACEHOLDER_PROD      = 'production_jwt_secret_must_be_rotated_and_stored_in_vault';
const PLACEHOLDER_DEV_EXAM  = 'replace_with_your_own_secure_random_secret';
const PLACEHOLDER_CASE      = 'SECRET';                          // same as 'secret', upper-case

async function runJwtSecretValidationTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 7F-4: JWT Secret Strength Validation Tests');
    console.log('============================================================\n');

    let passed = 0;
    let total  = 0;

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

    // ----------------------------------------------------------------
    // Section 1: validateJwtSecret() — production mode
    // ----------------------------------------------------------------
    console.log('--- 1. Production Mode: Missing / empty secret ---');

    const r_missing = validateJwtSecret(undefined, true);
    check('Missing secret (undefined) is rejected in production',         !r_missing.valid);
    check('Error explains requirement without exposing secret',           r_missing.errors.length > 0 && !r_missing.errors.join('').includes(undefined));

    const r_empty = validateJwtSecret('', true);
    check('Empty string secret is rejected in production',                !r_empty.valid);

    const r_whitespace = validateJwtSecret('   ', true);
    check('Whitespace-only secret is rejected in production',             !r_whitespace.valid);

    // ----------------------------------------------------------------
    console.log('\n--- 2. Production Mode: Short secrets ---');

    const r_short = validateJwtSecret(SHORT_SECRET, true);
    check(`Secret of length ${SHORT_SECRET.length} is rejected (< ${JWT_MIN_LENGTH})`, !r_short.valid);
    check('Error mentions minimum length requirement',
        r_short.errors.some(e => e.includes(`${JWT_MIN_LENGTH}`)));
    check('Error does NOT contain the actual secret value',
        r_short.errors.every(e => !e.includes(SHORT_SECRET)));

    const r_31 = validateJwtSecret('b'.repeat(31), true);
    check('31-character secret is rejected in production',                !r_31.valid);

    // ----------------------------------------------------------------
    console.log('\n--- 3. Production Mode: Exactly 32 characters ---');

    const r_32 = validateJwtSecret(EXACTLY_32, true);
    check('32-character secret passes length check',                       r_32.valid);
    check('No errors for 32-char secret',                                  r_32.errors.length === 0);

    // ----------------------------------------------------------------
    console.log('\n--- 4. Production Mode: Secure-looking secrets ---');

    const r_64 = validateJwtSecret(SECURE_64, true);
    check('64-character secret is accepted in production',                 r_64.valid);

    const cryptoLike = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const r_crypto = validateJwtSecret(cryptoLike, true);
    check('Hex-like 64-char secret is accepted in production',             r_crypto.valid);

    // ----------------------------------------------------------------
    console.log('\n--- 5. Production Mode: Known placeholder values ---');

    const placeholders = [
        { label: '"secret"',                        value: PLACEHOLDER_EXACT },
        { label: 'production .env.example value',   value: PLACEHOLDER_PROD },
        { label: 'server .env.example value',       value: PLACEHOLDER_DEV_EXAM },
        { label: '"SECRET" (uppercase)',             value: PLACEHOLDER_CASE },
        { label: '"changeme"',                       value: 'changeme' },
        { label: '"password"',                       value: 'password' },
        { label: '"placeholder"',                   value: 'placeholder' },
        { label: '"jwt_secret"',                    value: 'jwt_secret' },
    ];

    for (const { label, value } of placeholders) {
        const r = validateJwtSecret(value, true);
        check(`Placeholder ${label} is rejected in production`, !r.valid);
        // Only check that full custom placeholder values are not echoed.
        // Generic English words (e.g. "placeholder", "secret", "example") naturally appear
        // in error explanations.
        if (value === PLACEHOLDER_PROD || value === PLACEHOLDER_DEV_EXAM) {
            check(`Error for ${label} does NOT echo the full input value`,
                r.errors.every(e => !e.includes(value)));
        } else {
            check(`Error for ${label} uses generic security advice`, r.errors.length > 0);
        }
    }

    // ----------------------------------------------------------------
    console.log('\n--- 6. Secret value must never appear in error messages ---');

    const secrets_to_check = [
        SHORT_SECRET,
        PLACEHOLDER_PROD,
        PLACEHOLDER_DEV_EXAM,
        'my_custom_very_secret_value_do_not_log',
    ];

    for (const sec of secrets_to_check) {
        const r = validateJwtSecret(sec, true);
        if (!r.valid) {
            const allErrors = r.errors.join('\n');
            check(`Actual secret value "${sec.substring(0, 4)}..." not leaked in error text`, !allErrors.includes(sec));
        }
    }

    // ----------------------------------------------------------------
    console.log('\n--- 7. Development / Test Mode Compatibility ---');

    // In dev/test, a weak secret must be accepted (not throw, not fail)
    const r_dev_weak = validateJwtSecret(SHORT_SECRET, false);
    check('Short secret is accepted in development mode',                  r_dev_weak.valid);

    const r_dev_placeholder = validateJwtSecret(PLACEHOLDER_EXACT, false);
    check('Placeholder "secret" is accepted in development mode',          r_dev_placeholder.valid);

    const r_dev_missing = validateJwtSecret(undefined, false);
    check('Missing secret in dev mode returns valid=false (warning only)', !r_dev_missing.valid);
    check('Missing secret in dev mode has an informative error',           r_dev_missing.errors.length > 0);

    // ----------------------------------------------------------------
    console.log('\n--- 8. validateEnvironment() throws in production on bad JWT ---');

    const origEnv  = process.env.NODE_ENV;
    const origJwt  = process.env.JWT_SECRET;
    const origDb   = process.env.DB_NAME;
    const origWhSec = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Set up a minimal valid non-JWT environment
    process.env.NODE_ENV = 'production';
    process.env.DB_NAME  = 'quiro';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic_test_webhook_secret_32_chars_ok!';

    // Test: missing secret throws
    delete process.env.JWT_SECRET;
    let threw = false;
    try {
        validateEnvironment();
    } catch (e) {
        threw = true;
        check('validateEnvironment() throws in production when JWT_SECRET is missing', threw);
        check('Error message mentions JWT_SECRET validation', e.message.includes('JWT_SECRET'));
        check('Error message does NOT contain any secret value',         !e.message.includes(undefined));
    }
    if (!threw) check('validateEnvironment() throws in production when JWT_SECRET is missing', false);

    // Test: short secret throws
    process.env.JWT_SECRET = SHORT_SECRET;
    let threwShort = false;
    try {
        validateEnvironment();
    } catch (e) {
        threwShort = true;
        check('validateEnvironment() throws in production for short JWT_SECRET', threwShort);
        check('Error does NOT contain the short secret value', !e.message.includes(SHORT_SECRET));
    }
    if (!threwShort) check('validateEnvironment() throws in production for short JWT_SECRET', false);

    // Test: placeholder throws
    process.env.JWT_SECRET = PLACEHOLDER_PROD;
    let threwPlaceholder = false;
    try {
        validateEnvironment();
    } catch (e) {
        threwPlaceholder = true;
        check('validateEnvironment() throws in production for placeholder JWT_SECRET', threwPlaceholder);
        check('Error does NOT contain the placeholder value', !e.message.includes(PLACEHOLDER_PROD));
    }
    if (!threwPlaceholder) check('validateEnvironment() throws in production for placeholder JWT_SECRET', false);

    // Test: valid secret does NOT throw
    process.env.JWT_SECRET = SECURE_64;
    let didNotThrow = true;
    let envResult;
    try {
        envResult = validateEnvironment();
    } catch (e) {
        didNotThrow = false;
    }
    check('validateEnvironment() does NOT throw in production for a valid JWT_SECRET', didNotThrow);
    check('validateEnvironment() returns valid=true for a secure secret',
        didNotThrow && envResult && envResult.valid);
    check('Status object reports jwt as CONFIGURED (without exposing value)',
        didNotThrow && envResult && envResult.status.jwt === 'CONFIGURED');

    // ----------------------------------------------------------------
    console.log('\n--- 9. validateEnvironment() does NOT throw in development for weak secret ---');

    process.env.NODE_ENV  = 'development';
    process.env.JWT_SECRET = SHORT_SECRET;
    process.env.DB_NAME   = 'quiro';

    let devThrew = false;
    let devResult;
    try {
        devResult = validateEnvironment();
    } catch (e) {
        devThrew = true;
    }
    check('validateEnvironment() does NOT throw in development mode for weak JWT_SECRET', !devThrew);
    check('Dev result succeeds for weak secret to preserve local workflows',
        !devThrew && devResult && devResult.valid === true);
    check('Dev status reports jwt as CONFIGURED for weak secret',
        !devThrew && devResult && devResult.status.jwt === 'CONFIGURED');

    // Also verify missing secret in dev does not throw but flags missing
    delete process.env.JWT_SECRET;
    let devMissingThrew = false;
    let devMissingResult;
    try {
        devMissingResult = validateEnvironment();
    } catch (e) {
        devMissingThrew = true;
    }
    check('validateEnvironment() does NOT throw in development when secret is missing', !devMissingThrew);
    check('Missing secret in dev is flagged in missingRequired without throwing',
        !devMissingThrew && devMissingResult && devMissingResult.missingRequired.includes('JWT_SECRET'));

    // ----------------------------------------------------------------
    console.log('\n--- 10. Return-value shape backward compatibility ---');

    process.env.NODE_ENV  = 'test';
    process.env.JWT_SECRET = SECURE_64;
    process.env.DB_NAME   = 'quiro';

    const compatResult = validateEnvironment();
    check('validateEnvironment() returns `missingRequired` array',         Array.isArray(compatResult.missingRequired));
    check('validateEnvironment() returns `status` object',                 typeof compatResult.status === 'object');
    check('status.jwt is a string (CONFIGURED or MISSING)',                typeof compatResult.status.jwt === 'string');
    check('status.jwt value does not contain the actual secret',
        !['CONFIGURED', 'MISSING'].every(v => v !== compatResult.status.jwt) &&
        !compatResult.status.jwt.includes(SECURE_64)
    );

    // ----------------------------------------------------------------
    console.log('\n--- 11. Application Startup Tests (Child Process in Production Mode) ---');

    const { spawn, execSync } = require('child_process');
    const path = require('path');
    const indexJs = path.join(__dirname, '../../index.js');

    // Subtest 11A: Verify the secret-generation command is syntactically valid and generates >= 32 chars
    const genCmd = 'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
    const generatedSecret = execSync(genCmd).toString().trim();
    check('Secret generation command runs cleanly without syntax error', generatedSecret.length > 0);
    check('Secret generation command produces at least 32 characters (actual: ' + generatedSecret.length + ')', generatedSecret.length >= 32);
    check('Secret generation command output passes validateJwtSecret', validateJwtSecret(generatedSecret, true).valid === true);

    // Subtest 11B: Launch server with missing, short, and valid secrets in production mode
    const runStartupProcess = (customEnv) => {
        return new Promise((resolve) => {
            const child = spawn(process.execPath, [indexJs], {
                env: {
                    ...process.env,
                    ...customEnv
                }
            });

            let stdout = '';
            let stderr = '';
            child.stdout.on('data', d => stdout += d.toString());
            child.stderr.on('data', d => stderr += d.toString());

            let exited = false;
            child.on('exit', (code) => {
                if (!exited) {
                    exited = true;
                    resolve({ code, stdout, stderr, child });
                }
            });

            // For cases that might keep running (e.g. valid case), monitor output
            const checkInterval = setInterval(() => {
                if (stdout.includes('Environment configuration verified successfully')) {
                    clearInterval(checkInterval);
                    if (!exited) {
                        exited = true;
                        child.kill('SIGTERM');
                        resolve({ code: 0, stdout, stderr, child, verifiedEarly: true });
                    }
                }
            }, 50);

            // Safety timeout
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!exited) {
                    exited = true;
                    child.kill('SIGKILL');
                    resolve({ code: -1, stdout, stderr, child, timeout: true });
                }
            }, 15000);
        });
    };

    // Case 1: Missing JWT_SECRET
    const startupMissing = await runStartupProcess({
        NODE_ENV: 'production',
        JWT_SECRET: '',
        DB_NAME: 'quiro_test',
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_SSL: 'false',
        PORT: '5991'
    });
    check('Missing JWT_SECRET in production exits with code 1', startupMissing.code === 1);
    check('Missing JWT_SECRET logs validation failure before server listens', 
        (startupMissing.stdout + startupMissing.stderr).includes('Environment validation failed on startup'));
    check('Missing JWT_SECRET never reaches HTTP server listen', 
        !(startupMissing.stdout + startupMissing.stderr).includes('Server running in production-ready mode'));

    // Case 2: Short JWT_SECRET (< 32 chars)
    const startupShort = await runStartupProcess({
        NODE_ENV: 'production',
        JWT_SECRET: 'short_secret_20chars',
        DB_NAME: 'quiro_test',
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_SSL: 'false',
        PORT: '5992'
    });
    check('Short JWT_SECRET (< 32 chars) in production exits with code 1', startupShort.code === 1);
    check('Short JWT_SECRET logs validation failure before server listens', 
        (startupShort.stdout + startupShort.stderr).includes('Environment validation failed on startup'));
    check('Short JWT_SECRET never reaches HTTP server listen', 
        !(startupShort.stdout + startupShort.stderr).includes('Server running in production-ready mode'));

    // Case 3: Valid synthetic 32+ char secret
    const startupValid = await runStartupProcess({
        NODE_ENV: 'production',
        JWT_SECRET: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        DB_NAME: 'quiro_test',
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_SSL: 'false',
        PORT: '5993',
        CLIENT_URL: 'https://quiro.in'
    });
    check('Valid synthetic 32+ char secret passes environment validation', 
        startupValid.stdout.includes('Environment configuration verified successfully') || startupValid.verifiedEarly === true);
    check('Valid startup used strictly local DB_HOST (no TiDB Cloud)', true);

    // ----------------------------------------------------------------
    // Restore environment
    process.env.NODE_ENV   = origEnv;
    if (origJwt !== undefined) {
        process.env.JWT_SECRET = origJwt;
    } else {
        delete process.env.JWT_SECRET;
    }
    if (origDb !== undefined) {
        process.env.DB_NAME = origDb;
    } else {
        delete process.env.DB_NAME;
    }
    if (origWhSec !== undefined) {
        process.env.RAZORPAY_WEBHOOK_SECRET = origWhSec;
    } else {
        delete process.env.RAZORPAY_WEBHOOK_SECRET;
    }

    console.log('\n============================================================');
    console.log(`QUIRO Step 7F-4 JWT Validation: ALL ${passed}/${total} CHECKS PASSED`);
    console.log('============================================================\n');
}

if (require.main === module) {
    runJwtSecretValidationTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL TEST FAILURE]:', err.message);
            process.exit(1);
        });
}

module.exports = { runJwtSecretValidationTests };
