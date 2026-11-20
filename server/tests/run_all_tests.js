const { spawn } = require('child_process');
const path = require('path');

const testSuites = [
    { name: '1. Production Smoke Tests', file: path.join(__dirname, 'integration/smoke.test.js') },
    { name: '2. QUIRO Brand & Search Regression (Phase 18)', file: path.join(__dirname, 'integration/phase18.test.js') },
    { name: '3. End-to-End Marketplace Regression (Phase 17)', file: path.join(__dirname, 'integration/phase17.test.js') },
    { name: '4. Swap & Razorpay Payments Test Suite', file: path.join(__dirname, 'payments/quiro_payments.test.js') },
    { name: '5. Swap Workflow & 10-Stage Courier Test Suite', file: path.join(__dirname, 'swaps/exchange_workflow.test.js') }
];

async function runSuite(suite) {
    return new Promise((resolve) => {
        console.log(`\n==============================================================================`);
        console.log(`🚀 RUNNING: ${suite.name}`);
        console.log(`File: ${suite.file}`);
        console.log(`==============================================================================`);

        const child = spawn(process.execPath, [suite.file], {
            cwd: path.join(__dirname, '..'),
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
    console.log('║          Running All Test Suites in Sequential Execution                 ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝');

    const results = [];
    const startTime = Date.now();

    for (const suite of testSuites) {
        const res = await runSuite(suite);
        results.push(res);
        if (!res.success) {
            console.error(`\n❌ Test suite failed: ${suite.name}`);
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

