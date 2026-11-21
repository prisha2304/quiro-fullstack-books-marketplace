
const path = require('path');
const { pool } = require('../config/db');
const logger = require('./logger');

class MigrationService {
    async initMigrationTable() {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration_name VARCHAR(100) UNIQUE NOT NULL,
                phase VARCHAR(30) NOT NULL,
                status ENUM('SUCCESS', 'FAILED') DEFAULT 'FAILED',
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    }

    async getExecutedMigrations() {
        const [rows] = await pool.execute(
            "SELECT migration_name FROM schema_migrations WHERE status = 'SUCCESS'"
        );

        return rows.map(row => row.migration_name);
    }

    async recordMigration(name, phase, status) {
        await pool.execute(
            `INSERT INTO schema_migrations
                (migration_name, phase, status)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                executed_at = CURRENT_TIMESTAMP`,
            [name, phase, status]
        );
    }

    async runMigration(migration) {
        logger.info(`Starting migration: ${migration.name}`);

        try {
            const migrationPath = path.resolve(__dirname, '..', migration.script);

            // Load the migration module.
            const migrationModule = require(migrationPath);

            // Support either module.exports = migrate
            // or module.exports = { migrate }
            const migrate =
                typeof migrationModule === 'function'
                    ? migrationModule
                    : migrationModule?.migrate;

            if (typeof migrate !== 'function') {
                throw new Error(
                    `${migration.name} must export a migrate() function`
                );
            }

            // Actually execute and wait for the migration.
            await migrate();

            // Record SUCCESS only after execution finishes.
            await this.recordMigration(
                migration.name,
                migration.phase,
                'SUCCESS'
            );

            logger.info(`Migration completed: ${migration.name}`);

            return {
                name: migration.name,
                status: 'SUCCESS'
            };

        } catch (error) {
            try {
                await this.recordMigration(
                    migration.name,
                    migration.phase,
                    'FAILED'
                );
            } catch (recordError) {
                logger.error(
                    `Could not record migration failure: ${recordError.message}`
                );
            }

            logger.error(
                `Migration failed: ${migration.name} - ${error.message}`
            );

            throw error;
        }
    }

    async runAllMigrations() {
        logger.info('Starting unified database migration runner');

        await this.initMigrationTable();

        const executed = await this.getExecutedMigrations();

        const migrations = [
            {
                name: 'migrate_phase5',
                phase: 'Phase 5',
                script: 'migrate_phase5.js'
            },
            {
                name: 'migrate_phase6',
                phase: 'Phase 6',
                script: 'migrate_phase6.js'
            },
            {
                name: 'migrate_phase7',
                phase: 'Phase 7',
                script: 'migrate_phase7.js'
            },
            {
                name: 'migrate_phase8',
                phase: 'Phase 8',
                script: 'migrate_phase8.js'
            },
            {
                name: 'migrate_phase9',
                phase: 'Phase 9',
                script: 'migrate_phase9.js'
            },
            {
                name: 'migrate_phase10',
                phase: 'Phase 10',
                script: 'migrate_phase10.js'
            },
            {
                name: 'migrate_phase11',
                phase: 'Phase 11',
                script: 'migrate_phase11.js'
            },
            {
                name: 'migrate_swap_two_party',
                phase: 'Swap',
                script: 'migrations/migrate_swap_two_party.js'
            },
            {
                name: 'migrate_swap_exchange_methods',
                phase: 'Swap',
                script: 'migrations/migrate_swap_exchange_methods.js'
            },
            {
                name: 'migrate_managed_exchange_v2',
                phase: 'Swap',
                script: 'migrations/migrate_managed_exchange_v2.js'
            },
            {
                name: 'migrate_phase18',
                phase: 'Phase 18',
                script: 'migrate_phase18.js'
            }
        ];

        const results = [];

        for (const migration of migrations) {
            if (executed.includes(migration.name)) {
                logger.info(`Skipping completed migration: ${migration.name}`);

                results.push({
                    name: migration.name,
                    status: 'SKIPPED'
                });

                continue;
            }

            // A failure stops the runner; later migrations do not execute.
            const result = await this.runMigration(migration);
            results.push(result);
        }

        logger.info('All registered migrations completed');

        return results;
    }
}

module.exports = new MigrationService();
