const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load isolated test configuration from .env.test if present
const testEnvPath = path.resolve(__dirname, '../.env.test');
const testFileConfig = fs.existsSync(testEnvPath)
    ? dotenv.parse(fs.readFileSync(testEnvPath))
    : {};

// Explicit isolated test environment
const testEnv = {
    ...process.env,
    ...testFileConfig,
    NODE_ENV: 'test',
    DB_HOST: 'localhost',
    DB_PORT: testFileConfig.DB_PORT || '3306',
    DB_NAME: 'quiro_test',
    TEST_DB_NAME: 'quiro_test',
    DB_USER: testFileConfig.DB_USER || 'root',
    DB_PASSWORD: testFileConfig.DB_PASSWORD !== undefined ? testFileConfig.DB_PASSWORD : (process.env.DB_PASSWORD || ''),
    DB_SSL: 'false',
    PORT: '5001',
    TEST_PORT: '5001'
};

const testSuites = [
    { name: '1. Production Smoke Tests', file: path.join(__dirname, 'integration/smoke.test.js') },
    { name: '2. QUIRO Brand & Search Regression (Phase 18)', file: path.join(__dirname, 'integration/phase18.test.js') },
    { name: '3. End-to-End Marketplace Regression (Phase 17)', file: path.join(__dirname, 'integration/phase17.test.js') },
    { name: '4. Swap & Razorpay Payments Test Suite', file: path.join(__dirname, 'payments/quiro_payments.test.js') },
    { name: '5. Swap Workflow & 10-Stage Courier Test Suite', file: path.join(__dirname, 'swaps/exchange_workflow.test.js') },
    { name: '6. Seller Analytics Scoping Test Suite', file: path.join(__dirname, 'unit/seller_analytics_fix.test.js') },
    { name: '7. Swap Payment Idempotency & Safe Refund Reconciliation Test Suite', file: path.join(__dirname, 'unit/swap_payment_safety.test.js') }
];

function verifySafetyGuards() {
    console.log('\n==============================================================================');
    console.log('🛡️  VERIFYING TEST ISOLATION SAFETY GUARDS (PRE-FLIGHT)');
    console.log('==============================================================================');

    const { execSync } = require('child_process');

    // Test 1: Verify remote host is rejected
    const checkRemote = `
        process.env.NODE_ENV = 'test';
        process.env.DB_HOST = 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com';
        process.env.DB_NAME = 'quiro_test';
        try {
            require('./server/config/db');
            process.exit(1);
        } catch (err) {
            if (err.message.includes('[TEST ISOLATION SAFETY GUARD] FATAL: Automated tests attempted to connect to remote host')) {
                console.log('  ✅ Guard Test 1: Remote TiDB Cloud host correctly rejected with fatal error.');
                process.exit(0);
            }
            process.exit(2);
        }
    `;
    try {
        execSync(`node -e "${checkRemote.replace(/\r?\n\s*/g, ' ')}"`, { cwd: path.join(__dirname, '../..'), stdio: 'inherit' });
    } catch (e) {
        throw new Error('Safety Guard Test 1 FAILED: Remote host was not properly rejected!');
    }

    // Test 2: Verify non-test database name is rejected
    const checkDbName = `
        process.env.NODE_ENV = 'test';
        process.env.DB_HOST = 'localhost';
        process.env.DB_NAME = 'quiro';
        process.env.TEST_DB_NAME = 'quiro_test';
        try {
            require('./server/config/db');
            process.exit(1);
        } catch (err) {
            if (err.message.includes('[TEST ISOLATION SAFETY GUARD] FATAL: Automated tests attempted to connect to database')) {
                console.log('  ✅ Guard Test 2: Non-test database "quiro" correctly rejected with fatal error.');
                process.exit(0);
            }
            process.exit(2);
        }
    `;
    try {
        execSync(`node -e "${checkDbName.replace(/\r?\n\s*/g, ' ')}"`, { cwd: path.join(__dirname, '../..'), stdio: 'inherit' });
    } catch (e) {
        throw new Error('Safety Guard Test 2 FAILED: Non-test database was not properly rejected!');
    }

    // Test 3: Verify fallback to production credentials is blocked
    const checkFallback = `
        process.env.NODE_ENV = 'test';
        delete process.env.DB_HOST;
        delete process.env.DB_NAME;
        require('./server/node_modules/dotenv').config({ path: './server/.env' });
        try {
            require('./server/config/db');
            process.exit(1);
        } catch (err) {
            if (err.message.includes('[TEST ISOLATION SAFETY GUARD] FATAL')) {
                console.log('  ✅ Guard Test 3: Fallback to production TiDB Cloud credentials correctly caught and blocked.');
                process.exit(0);
            }
            process.exit(2);
        }
    `;
    try {
        execSync(`node -e "${checkFallback.replace(/\r?\n\s*/g, ' ')}"`, { cwd: path.join(__dirname, '../..'), stdio: 'inherit' });
    } catch (e) {
        throw new Error('Safety Guard Test 3 FAILED: Production credentials fallback was not blocked!');
    }

    // Test 4: Verify valid isolated test configuration resolves correctly
    const checkValid = `
        process.env.NODE_ENV = 'test';
        process.env.DB_HOST = 'localhost';
        process.env.DB_NAME = 'quiro_test';
        process.env.TEST_DB_NAME = 'quiro_test';
        const { getDbConfig } = require('./server/config/db');
        const cfg = getDbConfig();
        if (cfg.host === 'localhost' && cfg.database === 'quiro_test' && cfg.ssl === undefined) {
            console.log('  ✅ Guard Test 4: Local isolated quiro_test config validated (SSL disabled).');
            process.exit(0);
        }
        process.exit(1);
    `;
    try {
        execSync(`node -e "${checkValid.replace(/\r?\n\s*/g, ' ')}"`, { cwd: path.join(__dirname, '../..'), stdio: 'inherit' });
    } catch (e) {
        throw new Error('Safety Guard Test 4 FAILED: Valid test configuration resolution failed!');
    }

    console.log('🛡️  All 4 Pre-flight Isolation Safety Guards PASSED.\n');
}

async function runSuite(suite) {
    return new Promise((resolve) => {
        console.log(`\n==============================================================================`);
        console.log(`🚀 RUNNING: ${suite.name}`);
        console.log(`File: ${suite.file}`);
        console.log(`🔒 ISOLATED DB TARGET: ${testEnv.DB_HOST}:${testEnv.DB_PORT} / ${testEnv.DB_NAME} (SSL: ${testEnv.DB_SSL})`);
        console.log(`🌐 TEST IN-PROCESS PORT: ${testEnv.TEST_PORT}`);
        console.log(`==============================================================================`);

        const child = spawn(process.execPath, [suite.file], {
            cwd: path.join(__dirname, '..'),
            env: testEnv,
            stdio: 'inherit'
        });

        child.on('close', (code) => {
            resolve({ name: suite.name, code, success: code === 0 });
        });
    });
}

async function runAll() {
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║               QUIRO MASTER AUTOMATED TEST RUNNER                         ║');
    console.log('║               ISOLATED LOCAL TEST DATABASE RUNNER                        ║');
    console.log('║          Running All Test Suites Against local MySQL `quiro_test`        ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝');

    // Run Pre-flight Safety Guard Verification
    verifySafetyGuards();

    const results = [];
    const startTime = Date.now();

    for (const suite of testSuites) {
        const res = await runSuite(suite);
        results.push(res);
        if (!res.success) {
            console.error(`\n❌ Test suite failed: ${suite.name} (exit code ${res.code})`);
        }
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n\n╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                       MASTER TEST SUMMARY REPORT                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝');
    
    let allPassed = true;
    for (const r of results) {
        const status = r.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`  ${status.padEnd(10)} | ${r.name}`);
        if (!r.success) allPassed = false;
    }

    console.log(`\nTotal Execution Time: ${totalDuration}s`);
    console.log(`Final Outcome: ${allPassed ? 'ALL TEST SUITES PASSED (100% SUCCESS)' : 'SOME TEST SUITES FAILED'}\n`);

    process.exit(allPassed ? 0 : 1);
}

runAll();


