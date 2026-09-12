/**
 * migrate_neon.js
 * ---------------
 * Runs all SmartStore migrations against the DATABASE_URL supplied via
 * environment variable.  It does NOT read .env so local dev credentials
 * are never touched and never echoed to the console.
 *
 * Usage (PowerShell — one-time session variable, never saved to a file):
 *   $env:DATABASE_URL = "<your-neon-connection-string>"
 *   node db/migrate_neon.js
 *   Remove-Item Env:\DATABASE_URL   # clear from session when done
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg   from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Credential guard ────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    '\n❌  DATABASE_URL is not set.\n' +
    '    Set it in your current PowerShell session only:\n' +
    '      $env:DATABASE_URL = "<neon-connection-string>"\n' +
    '    Then re-run: node db/migrate_neon.js\n'
  );
  process.exit(1);
}

if (DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')) {
  console.error(
    '\n❌  DATABASE_URL appears to point to localhost.\n' +
    '    This script is for the Neon production database only.\n' +
    '    Aborting to protect local dev data.\n'
  );
  process.exit(1);
}

// Never print the full URL — only show host for confirmation
try {
  const u = new URL(DATABASE_URL);
  console.log(`\n🔗  Target host: ${u.hostname}`);
} catch {
  console.error('\n❌  DATABASE_URL is not a valid URL. Aborting.\n');
  process.exit(1);
}

// ── Migration files (order matters) ─────────────────────────────────────────
const MIGRATIONS = [
  path.join(__dirname, 'migrations', '01_init.sql'),
  path.join(__dirname, 'migrations', '02_enhancements.sql'),
];

// ── Run ──────────────────────────────────────────────────────────────────────
async function runMigrations() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // required for Neon
    connectionTimeoutMillis: 10_000,
  });

  const client = await pool.connect();
  console.log('✅  Connected to Neon database.\n');

  try {
    for (const filePath of MIGRATIONS) {
      const name = path.basename(filePath);
      const sql  = fs.readFileSync(filePath, 'utf8');
      console.log(`▶  Applying ${name} …`);
      await client.query(sql);
      console.log(`✅  ${name} applied.\n`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// ── Verify ───────────────────────────────────────────────────────────────────
async function verifyTables() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  const client = await pool.connect();

  try {
    const EXPECTED_TABLES = [
      'stores', 'users', 'categories', 'suppliers', 'customers',
      'products', 'purchases', 'purchase_items',
      'sales', 'sale_items', 'expenses', 'stock_movements',
    ];

    console.log('🔍  Verifying tables …\n');

    const { rows } = await client.query(`
      SELECT table_name
      FROM   information_schema.tables
      WHERE  table_schema = 'public'
        AND  table_type   = 'BASE TABLE'
      ORDER  BY table_name
    `);

    const found = rows.map(r => r.table_name);

    let allOk = true;
    for (const t of EXPECTED_TABLES) {
      if (found.includes(t)) {
        console.log(`  ✅  ${t}`);
      } else {
        console.log(`  ❌  MISSING: ${t}`);
        allOk = false;
      }
    }

    // Check indexes
    console.log('\n🔍  Verifying indexes …\n');
    const { rows: idxRows } = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE  schemaname = 'public'
      ORDER  BY indexname
    `);
    const indexes = idxRows.map(r => r.indexname);

    const EXPECTED_INDEXES = [
      'idx_products_sku', 'idx_products_barcode', 'idx_products_name',
      'idx_sales_sale_date', 'idx_purchases_date', 'idx_stock_movements_prod',
    ];
    for (const idx of EXPECTED_INDEXES) {
      if (indexes.includes(idx)) {
        console.log(`  ✅  ${idx}`);
      } else {
        console.log(`  ❌  MISSING INDEX: ${idx}`);
        allOk = false;
      }
    }

    // Check foreign key relationships
    console.log('\n🔍  Verifying foreign key constraints …\n');
    const { rows: fkRows } = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name       AS from_table,
        kcu.column_name     AS from_col,
        ccu.table_name      AS to_table,
        ccu.column_name     AS to_col
      FROM   information_schema.table_constraints      tc
      JOIN   information_schema.key_column_usage       kcu USING (constraint_name, table_schema)
      JOIN   information_schema.constraint_column_usage ccu USING (constraint_name, table_schema)
      WHERE  tc.constraint_type = 'FOREIGN KEY'
        AND  tc.table_schema    = 'public'
      ORDER  BY from_table, from_col
    `);

    if (fkRows.length > 0) {
      fkRows.forEach(r =>
        console.log(`  ✅  ${r.from_table}.${r.from_col} → ${r.to_table}.${r.to_col}`)
      );
    } else {
      console.log('  ❌  No foreign keys found — unexpected.');
      allOk = false;
    }

    // Check default store seeded by 02_enhancements
    console.log('\n🔍  Verifying seed data (default store) …\n');
    const { rows: storeRows } = await client.query(
      `SELECT id, name FROM stores WHERE id = 1`
    );
    if (storeRows.length > 0) {
      console.log(`  ✅  Default store seeded: "${storeRows[0].name}" (id=1)`);
    } else {
      console.log('  ❌  Default store (id=1) not found.');
      allOk = false;
    }

    console.log('\n' + '─'.repeat(55));
    if (allOk) {
      console.log('✅  ALL CHECKS PASSED — Neon database is fully configured.\n');
    } else {
      console.log('⚠️   Some checks failed — review output above.\n');
      process.exitCode = 1;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
(async () => {
  try {
    await runMigrations();
    await verifyTables();
  } catch (err) {
    // Scrub the URL from any error message before printing
    const safeMsg = String(err.message || err).replace(
      /postgresql:\/\/[^@]+@/gi,
      'postgresql://[REDACTED]@'
    );
    console.error('\n❌  Error:', safeMsg);
    if (err.hint)   console.error('   Hint:', err.hint);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exit(1);
  }
})();
