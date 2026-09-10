import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const sqlPath = path.join(__dirname, 'db', 'migrations', '02_enhancements.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Applying migration 02_enhancements.sql...');
  await pool.query(sql);
  console.log('Migration applied successfully!');
  await pool.end();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
