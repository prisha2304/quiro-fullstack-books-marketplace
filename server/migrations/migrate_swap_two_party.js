
const { getDbConfig } = require('../config/db');
const mysql = require('mysql2/promise');

async function migrate() {
  let conn;

  try {
    conn = await mysql.createConnection(getDbConfig());

    console.log('Connected to database for swap migration');

    const [tables] = await conn.query(
      "SHOW TABLES LIKE 'swap_requests'"
    );

    if (tables.length === 0) {
      throw new Error(
        'swap_requests table does not exist. Run the base schema first.'
      );
    }

    const [cols] = await conn.query(
      'DESCRIBE swap_requests'
    );

    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('requester_confirmed')) {
      await conn.query(`
                ALTER TABLE swap_requests
                ADD COLUMN requester_confirmed TINYINT(1) DEFAULT 0
            `);
      console.log('Added requester_confirmed');
    }

    if (!colNames.includes('owner_confirmed')) {
      await conn.query(`
                ALTER TABLE swap_requests
                ADD COLUMN owner_confirmed TINYINT(1) DEFAULT 0
            `);
      console.log('Added owner_confirmed');
    }

    // payment_refunds is optional in the base schema.
    const [refundTables] = await conn.query(
      "SHOW TABLES LIKE 'payment_refunds'"
    );

    if (refundTables.length > 0) {
      const [refundCols] = await conn.query(
        'DESCRIBE payment_refunds'
      );

      const refundColNames = refundCols.map(c => c.Field);

      if (!refundColNames.includes('admin_notes')) {
        await conn.query(`
                    ALTER TABLE payment_refunds
                    ADD COLUMN admin_notes TEXT NULL
                `);
        console.log('Added admin_notes');
      }
    } else {
      console.log(
        'payment_refunds does not exist; skipping optional columns.'
      );
    }

    console.log('Swap two-party migration completed.');

  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate().catch(error => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  });
}


