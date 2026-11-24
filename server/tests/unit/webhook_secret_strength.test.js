/**
 * QUIRO — Step 8B Task 2: Razorpay Webhook Secret Strength Validation Tests
 *
 * Verifies validateWebhookSecret():
 * 1. Missing secret → invalid in production.
 * 2. Secret shorter than 32 chars → invalid in production.
 * 3. Exactly 32 chars → valid.
 * 4. Longer than 32 chars → valid.
 * 5. Known placeholder values → invalid.
 * 6. API key secret reused as webhook secret → invalid.
 * 7. Development/test mode → always valid (no length enforcement).
 * 8. startup validateEnvironment() throws in production on bad webhook secret.
 * 9. startup validateEnvironment() does NOT throw in dev with no webhook secret.
 * 10. Secret values are never exposed in error messages.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Isolated test environment
const testEnvPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(testEnvPath)) {
    require('dotenv').config({ path: testEnvPath, override: false });
}
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'quiro_test';
process.env.TEST_DB_NAME = 'quiro_test';
process.env.DB_SSL = 'false';

const {
    validateWebhookSecret,
    validateEnvironment,
    WEBHOOK_SECRET_MIN_LENGTH
} = require('../../config/envValidator');

async function runWebhookSecretValidationTests() {
    console.log('\n============================================================');
    console.log('QUIRO Step 8B Task 2: Webhook Secret Strength Validation Tests');
    console.log('============================================================\n');

    let pass = 0;
    let total = 0;
    const failures = [];

    function check(desc, condition) {
        total++;
        if (condition) {
            pass++;
            console.log(`  [PASS] ${total}: ${desc}`);
        } else {
            console.error(`  [FAIL] ${total}: ${desc}`);
            failures.push(desc);
        }
    }

    const VALID_32  = 'exactly_32_chars_webhook_secret!'; // exactly 32 chars
    const VALID_48  = 'a_longer_valid_webhook_secret_that_is_48_chars__xx'; // 48 chars
    const SHORT_16  = 'tooshort_secret';                  // 15 chars
    const API_SECRET = 'some_api_key_secret_that_is_long_enough_here_ok';

    console.log(`--- Constants: WEBHOOK_SECRET_MIN_LENGTH = ${WEBHOOK_SECRET_MIN_LENGTH} ---\n`);
    check('WEBHOOK_SECRET_MIN_LENGTH exported and equals 32', WEBHOOK_SECRET_MIN_LENGTH === 32);

    // ── Production rules ────────────────────────────────────────────────────
    console.log('--- Production Validation Rules ---');

    // 1. Missing
    const r1 = validateWebhookSecret(undefined, undefined, true);
    check('Missing secret: not valid in production', r1.valid === false);
    check('Missing secret: has an error message', r1.errors.length > 0);
    check('Missing secret: error does not reveal secret value', !r1.errors.join('').includes('undefined'));

    // 2. Empty string
    const r2 = validateWebhookSecret('', undefined, true);
    check('Empty string: not valid in production', r2.valid === false);

    // 3. Too short (15 chars)
    const r3 = validateWebhookSecret(SHORT_16, undefined, true);
    check('15-char secret: not valid in production', r3.valid === false);
    check('15-char secret: error mentions length requirement', r3.errors.some(e => e.includes('32')));
    check('15-char secret: error does not expose the secret', !r3.errors.join('').includes(SHORT_16));

    // 4. Exactly 32 chars
    const r4 = validateWebhookSecret(VALID_32, undefined, true);
    check('Exactly 32-char secret: valid in production', r4.valid === true);
    check('Exactly 32-char secret: no errors', r4.errors.length === 0);

    // 5. 48-char secret
    const r5 = validateWebhookSecret(VALID_48, undefined, true);
    check('48-char secret: valid in production', r5.valid === true);
    check('48-char secret: no errors', r5.errors.length === 0);

    // 6. Known placeholder values
    const placeholders = ['webhook_secret', 'changeme', 'placeholder', 'test_secret', 'dev_secret', 'secret'];
    for (const ph of placeholders) {
        const r = validateWebhookSecret(ph, undefined, true);
        check(`Placeholder '${ph}': not valid in production`, r.valid === false);
        // Error message must not reproduce the secret as "your secret is: X" but may describe the category
        // The actual check: error must not begin with the secret value or quote it verbatim after "is:"
        check(`Placeholder '${ph}': error does not quote secret verbatim after a colon`,
            !r.errors.join('').match(new RegExp(':\\s*' + ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[.,]')));
    }

    // 7. API key reused as webhook secret
    const r7 = validateWebhookSecret(API_SECRET, API_SECRET, true);
    check('API key reused as webhook secret: not valid in production', r7.valid === false);
    check('API key reuse error: does not expose the secret value', !r7.errors.join('').includes(API_SECRET));

    // 8. API key same as webhook but different → valid (they differ)
    const differentApiKey = 'different_api_key_secret_value_here_!!xyz';
    const r8 = validateWebhookSecret(VALID_48, differentApiKey, true);
    check('Different API key and webhook secret: valid', r8.valid === true);

    // ── Development/test rules ───────────────────────────────────────────────
    console.log('\n--- Development/Test Mode (No Enforcement) ---');

    // 9. Dev mode — missing secret is OK
    const r9 = validateWebhookSecret(undefined, undefined, false);
    check('Dev mode missing secret: valid (no enforcement)', r9.valid === true);
    check('Dev mode missing secret: no errors', r9.errors.length === 0);

    // 10. Dev mode — short secret is OK
    const r10 = validateWebhookSecret(SHORT_16, undefined, false);
    check('Dev mode short secret: valid (no enforcement)', r10.valid === true);

    // 11. Dev mode — placeholder is OK
    const r11 = validateWebhookSecret('changeme', undefined, false);
    check('Dev mode placeholder: valid (no enforcement)', r11.valid === true);

    // ── Integration with validateEnvironment() ──────────────────────────────
    console.log('\n--- Integration: validateEnvironment() ---');

    const savedEnv = {
        NODE_ENV: process.env.NODE_ENV,
        JWT_SECRET: process.env.JWT_SECRET,
        RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
        RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
        DB_NAME: process.env.DB_NAME,
    };

    try {
        // 12. Production startup throws when webhook secret missing
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'prod_jwt_secret_exactly_32_chars!';
        process.env.DB_NAME = 'quiro_test';
        delete process.env.RAZORPAY_WEBHOOK_SECRET;
        delete process.env.RAZORPAY_KEY_SECRET;

        let threwOnMissing = false;
        try { validateEnvironment(); } catch (e) {
            threwOnMissing = e.message.includes('RAZORPAY_WEBHOOK_SECRET');
        }
        check('Production startup throws on missing webhook secret', threwOnMissing);

        // 13. Production startup throws when webhook secret is too short
        process.env.RAZORPAY_WEBHOOK_SECRET = 'short';
        let threwOnShort = false;
        try { validateEnvironment(); } catch (e) {
            threwOnShort = e.message.includes('RAZORPAY_WEBHOOK_SECRET');
        }
        check('Production startup throws on short webhook secret', threwOnShort);

        // 14. Production startup throws when webhook secret is a placeholder
        process.env.RAZORPAY_WEBHOOK_SECRET = 'changeme';
        let threwOnPlaceholder = false;
        try { validateEnvironment(); } catch (e) {
            threwOnPlaceholder = e.message.includes('RAZORPAY_WEBHOOK_SECRET');
        }
        check('Production startup throws on placeholder webhook secret', threwOnPlaceholder);

        // 15. Production startup succeeds with valid 32-char webhook secret
        process.env.RAZORPAY_WEBHOOK_SECRET = VALID_32;
        let startupOk = false;
        try { const r = validateEnvironment(); startupOk = r.status.webhookSecret === 'CONFIGURED'; } catch (e) {}
        check('Production startup succeeds with valid 32-char webhook secret', startupOk);

        // 16. Dev mode startup does NOT throw when webhook secret is absent
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'dev_jwt_secret_present';
        delete process.env.RAZORPAY_WEBHOOK_SECRET;
        let devOk = false;
        try { validateEnvironment(); devOk = true; } catch (e) {}
        check('Dev/test startup does not throw when webhook secret absent', devOk);

        // 17. Error messages never contain the actual secret value
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'prod_jwt_secret_exactly_32_chars!';
        process.env.RAZORPAY_WEBHOOK_SECRET = 'short_secret_should_fail_here';
        let errorText = '';
        try { validateEnvironment(); } catch (e) { errorText = e.message; }
        check('Production error message does not contain actual short secret value',
            errorText.length > 0 && !errorText.includes('short_secret_should_fail_here'));

    } finally {
        // Restore env
        process.env.NODE_ENV = savedEnv.NODE_ENV;
        if (savedEnv.JWT_SECRET !== undefined) process.env.JWT_SECRET = savedEnv.JWT_SECRET;
        else delete process.env.JWT_SECRET;
        if (savedEnv.RAZORPAY_WEBHOOK_SECRET !== undefined) process.env.RAZORPAY_WEBHOOK_SECRET = savedEnv.RAZORPAY_WEBHOOK_SECRET;
        else delete process.env.RAZORPAY_WEBHOOK_SECRET;
        if (savedEnv.RAZORPAY_KEY_SECRET !== undefined) process.env.RAZORPAY_KEY_SECRET = savedEnv.RAZORPAY_KEY_SECRET;
        else delete process.env.RAZORPAY_KEY_SECRET;
        process.env.DB_NAME = savedEnv.DB_NAME;
    }

    console.log('\n============================================================');
    if (failures.length === 0) {
        console.log(`QUIRO Step 8B Task 2 Webhook Secret: ALL ${pass}/${total} CHECKS PASSED`);
    } else {
        console.error(`QUIRO Step 8B Task 2 Webhook Secret: ${pass}/${total} — FAILURES:`);
        failures.forEach(f => console.error('  - ' + f));
    }
    console.log('============================================================\n');

    if (failures.length > 0) throw new Error(`${failures.length} webhook secret check(s) failed`);
    return { pass, total };
}

if (require.main === module) {
    runWebhookSecretValidationTests()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n[FATAL]:', err.message);
            process.exit(1);
        });
}

module.exports = { runWebhookSecretValidationTests };
