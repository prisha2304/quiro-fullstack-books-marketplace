
require('dotenv').config();
const migrationService = require('./services/migrationService');

async function main() {
    try {
        console.log('🚀 Running BookNest Unified Database Migrations...');
        const results = await migrationService.runAllMigrations();
        console.table(results);
        console.log('✔ All migrations completed successfully.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration failure:', e);
        process.exit(1);
    }
}

main();
