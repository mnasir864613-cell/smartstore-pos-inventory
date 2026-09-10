import bcrypt from 'bcrypt';
import { query, pool } from './src/config/db.js';

async function seed() {
  console.log('Seeding default demo accounts...');

  const adminHash = await bcrypt.hash('Admin123!', 12);
  const cashierHash = await bcrypt.hash('Cashier123!', 12);

  // Insert or update admin
  await query(
    `INSERT INTO users (store_id, name, email, password_hash, role)
     VALUES (1, 'Store Manager', 'admin@smartstore.com', $1, 'admin')
     ON CONFLICT (email)
     DO UPDATE SET password_hash = $1, role = 'admin'`,
    [adminHash]
  );
  console.log('✓ Admin account ready: admin@smartstore.com / Admin123!');

  // Insert or update cashier
  await query(
    `INSERT INTO users (store_id, name, email, password_hash, role)
     VALUES (1, 'Cashier User', 'cashier@smartstore.com', $1, 'cashier')
     ON CONFLICT (email)
     DO UPDATE SET password_hash = $1, role = 'cashier'`,
    [cashierHash]
  );
  console.log('✓ Cashier account ready: cashier@smartstore.com / Cashier123!');

  await pool.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
