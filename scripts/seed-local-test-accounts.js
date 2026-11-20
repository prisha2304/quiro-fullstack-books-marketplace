const path = require('path');
const { pool } = require('../server/config/db');
let bcrypt;
try {
  bcrypt = require('../server/node_modules/bcryptjs');
} catch (e) {
  try {
    bcrypt = require('../server/node_modules/bcrypt');
  } catch (e2) {
    bcrypt = require('bcryptjs');
  }
}

async function seedLocalAccounts() {
  console.log('====================================================');
  console.log('🌱 SEEDING LOCAL TEST ACCOUNTS (SAFE & IDEMPOTENT)');
  console.log('====================================================');

  const testAccounts = [
    {
      full_name: 'Local Test Buyer',
      username: 'local_buyer',
      email: 'buyer@booknest.local',
      role: 'USER',
      passwordPlain: 'Password@123',
      college: 'Delhi University',
      phone: '+91 9876543210',
      bio: 'Regular buyer testing BookNest local features.'
    },
    {
      full_name: 'Local Test Seller',
      username: 'local_seller',
      email: 'seller@booknest.local',
      role: 'USER',
      passwordPlain: 'Password@123',
      college: 'IIT Bombay',
      phone: '+91 9876543211',
      bio: 'Trusted seller testing marketplace fulfillment.',
      isSeller: true
    },
    {
      full_name: 'Local Test Admin',
      username: 'local_admin',
      email: 'admin@booknest.local',
      role: 'ADMIN',
      passwordPlain: 'Password@123',
      college: 'BookNest Operations',
      phone: '+91 9876543212',
      bio: 'Marketplace Administrator.'
    }
  ];

  try {
    for (const acc of testAccounts) {
      const [existing] = await pool.query('SELECT id, email, role FROM users WHERE email = ? OR username = ?', [acc.email, acc.username]);
      let userId;
      if (existing.length > 0) {
        userId = existing[0].id;
        console.log(`ℹ️ Account ${acc.email} (${acc.role}) already exists with ID ${userId}`);
      } else {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(acc.passwordPlain, salt);
        const [res] = await pool.query(
          'INSERT INTO users (full_name, username, email, password, role, status, college, phone, bio) VALUES (?, ?, ?, ?, ?, "active", ?, ?, ?)',
          [acc.full_name, acc.username, acc.email, hashedPassword, acc.role, acc.college, acc.phone, acc.bio]
        );
        userId = res.insertId;
        console.log(`✅ Created ${acc.role} account ${acc.email} (ID: ${userId})`);
      }

      if (acc.isSeller) {
        await pool.query(
          `INSERT INTO seller_onboarding (seller_id, seller_status, seller_display_name, seller_bio, seller_phone_verified, seller_email_verified, campus_department, profile_completion_percentage, onboarding_completed_at)
           VALUES (?, 'VERIFIED', 'Local Test Store', ?, 1, 1, 'Computer Science', 100, NOW())
           ON DUPLICATE KEY UPDATE seller_status = 'VERIFIED', profile_completion_percentage = 100`,
          [userId, acc.bio]
        );
        console.log(`   ↳ Seller onboarding profile verified for ID ${userId}`);
      }
    }

    console.log('\n====================================================');
    console.log('📋 LOCAL TEST ACCOUNT CREDENTIALS:');
    console.log('1. Buyer:  buyer@booknest.local  / Password@123');
    console.log('2. Seller: seller@booknest.local / Password@123');
    console.log('3. Admin:  admin@booknest.local  / Password@123');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding test accounts:', err.message);
    process.exit(1);
  }
}

seedLocalAccounts();
