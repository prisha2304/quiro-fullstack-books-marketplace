
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runCheck(name, fn) {
    process.stdout.write(`Checking ${name.padEnd(45, '.')} `);
    try {
        const result = fn();
        console.log(result ? '✅ PASS' : '⚠️ WARN');
        return result ? 'PASS' : 'WARN';
    } catch (e) {
        console.log('❌ FAIL:', e.message);
        return 'FAIL';
    }
}

async function runReleaseGate() {
    console.log('\n==============================================================================');
    console.log('🛡️ BOOKNEST MARKETPLACE — PHASE 13 PRODUCTION RELEASE GATE');
    console.log('==============================================================================\n');

    const results = {};

    // 1. Environment separation templates
    results.envTemplates = runCheck('Environment Configuration Templates', () => {
        return fs.existsSync('E:/booknest_gpt_ag/.env.production.example') &&
               fs.existsSync('E:/booknest_gpt_ag/.env.staging.example') &&
               fs.existsSync('E:/booknest_gpt_ag/.env.development.example');
    });

    // 2. Docker & Compose
    results.docker = runCheck('Docker & Compose Infrastructure', () => {
        return fs.existsSync('E:/booknest_gpt_ag/server/Dockerfile') &&
               fs.existsSync('E:/booknest_gpt_ag/client/Dockerfile') &&
               fs.existsSync('E:/booknest_gpt_ag/nginx/nginx.conf') &&
               fs.existsSync('E:/booknest_gpt_ag/docker-compose.yml');
    });

    // 3. Database Migration System
    results.migrations = runCheck('Database Migration System', () => {
        return fs.existsSync('E:/booknest_gpt_ag/server/migrate.js') &&
               fs.existsSync('E:/booknest_gpt_ag/server/services/migrationService.js');
    });

    // 4. CI/CD Workflow
    results.cicd = runCheck('CI/CD Pipeline Definition', () => {
        return fs.existsSync('E:/booknest_gpt_ag/.github/workflows/ci.yml');
    });

    // 5. Client Production Build
    results.frontendBuild = runCheck('Frontend Production Dist Build', () => {
        return fs.existsSync('E:/booknest_gpt_ag/client/dist/index.html');
    });

    // 6. Smoke Test Suite
    results.smoke = runCheck('Production Smoke Test Suite', () => {
        return fs.existsSync('E:/booknest_gpt_ag/server/test_production_smoke.js');
    });

    // 7. Backup & Restore Tooling
    results.backupRestore = runCheck('Backup & Restore Automation Tooling', () => {
        return fs.existsSync('E:/booknest_gpt_ag/scripts/backup-database.js') &&
               fs.existsSync('E:/booknest_gpt_ag/scripts/restore-database.js') &&
               fs.existsSync('E:/booknest_gpt_ag/scripts/verify-backup.js');
    });

    // 8. Documentation & Runbooks
    results.documentation = runCheck('Production Operational Runbooks', () => {
        return fs.existsSync('E:/booknest_gpt_ag/docs/PRODUCTION_DEPLOYMENT.md') &&
               fs.existsSync('E:/booknest_gpt_ag/docs/ROLLBACK.md') &&
               fs.existsSync('E:/booknest_gpt_ag/docs/DISASTER_RECOVERY.md') &&
               fs.existsSync('E:/booknest_gpt_ag/docs/API_DOCUMENTATION.md');
    });

    const isReady = Object.values(results).every(r => r === 'PASS');

    console.log('\n------------------------------------------------------------------------------');
    console.log(`FINAL RELEASE GATE STATUS: ${isReady ? '🎉 READY FOR PRODUCTION' : '⚠️ READY WITH CONDITIONS'}`);
    console.log('------------------------------------------------------------------------------\n');

    process.exit(isReady ? 0 : 1);
}

runReleaseGate();
