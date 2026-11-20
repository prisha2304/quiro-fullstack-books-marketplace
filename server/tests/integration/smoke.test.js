const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { pool } = require('../../config/db');
const environment = require('../../config/environment');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (!condition) {
        console.error('  ❌ FAIL: ' + message);
        failed++;
    } else {
        console.log('  ✅ PASS: ' + message);
        passed++;
    }
}

async function runProductionSmokeTests() {
    console.log('\n==============================================================================');
    console.log('💨 RUNNING PRODUCTION SMOKE TEST SUITE (14 READ-ONLY CHECKS)');
    console.log('==============================================================================\n');

    try {
        // 1. Liveness check
        assert(process.uptime() >= 0, 'Smoke 1: Process is live and reporting uptime');

        // 2. Readiness check
        const [dbAlive] = await pool.execute('SELECT 1 as val');
        assert(dbAlive[0].val === 1, 'Smoke 2: Database connectivity confirmed ready');

        // 3. User table sanity check
        const [users] = await pool.execute('SELECT COUNT(*) as count FROM users');
        assert(users[0].count > 0, `Smoke 3: User table populated (${users[0].count} users)`);

        // 4. Book table sanity check
        const [books] = await pool.execute('SELECT COUNT(*) as count FROM books');
        assert(books[0].count > 0, `Smoke 4: Books catalog active (${books[0].count} total volumes)`);

        // 5. Swap requests sanity check
        const [swaps] = await pool.execute('SELECT COUNT(*) as count FROM swap_requests');
        assert(swaps[0].count >= 0, `Smoke 5: Swap requests table readable (${swaps[0].count} total records)`);

        // 6. Orders table sanity check
        const [orders] = await pool.execute('SELECT COUNT(*) as count FROM orders');
        assert(orders[0].count >= 0, `Smoke 6: Orders table accessible (${orders[0].count} orders recorded)`);

        // 7. Security: Users password hash verification
        const [plainPasswords] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE password NOT LIKE '$2%'");
        assert(plainPasswords[0].count === 0, 'Smoke 7: Zero plaintext passwords detected in users table');

        // 8. Financials: Verified payment transactions
        const [payments] = await pool.execute('SELECT COUNT(*) as count FROM payments');
        assert(payments[0].count >= 0, `Smoke 8: Payments ledger verified (${payments[0].count} transaction records)`);

        // 9. Categories index check
        const [categories] = await pool.execute('SELECT COUNT(*) as count FROM categories');
        assert(categories[0].count > 0, `Smoke 9: Categories taxonomy loaded (${categories[0].count} categories)`);

        // 10. Audit log readiness
        const [auditLogs] = await pool.execute('SELECT COUNT(*) as count FROM audit_logs');
        assert(auditLogs[0].count >= 0, `Smoke 10: Security audit logging initialized (${auditLogs[0].count} events)`);

        // 11. Environment configuration validation
        assert(environment.nodeEnv === 'development' || environment.nodeEnv === 'production', 'Smoke 11: Valid NODE_ENV detected');
        assert(Boolean(process.env.JWT_SECRET), 'Smoke 12: Production JWT secret initialized');
        assert(Boolean(process.env.RAZORPAY_KEY_ID), 'Smoke 13: Razorpay Key ID configured');
        assert(Boolean(process.env.RAZORPAY_KEY_SECRET), 'Smoke 14: Razorpay Secret configured');

        console.log('\n------------------------------------------------------------------------------');
        console.log(`SMOKE TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
        console.log('------------------------------------------------------------------------------\n');

        if (failed > 0) {
            process.exit(1);
        } else {
            console.log('✨ ALL PRODUCTION SMOKE CHECKS PASSED. SYSTEM IS READY.\n');
            process.exit(0);
        }
    } catch (err) {
        console.error('Smoke tests encounter fatal error:', err);
        process.exit(1);
    }
}

runProductionSmokeTests();

