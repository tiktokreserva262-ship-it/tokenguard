/**
 * TokenGuard — Migration Runner
 * Usage: node src/migrations/run.js
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
  await client.connect();
  console.log('[Migration] Connected to database');

  const migrations = [
    '001_init.sql',
  ];

  // Create migrations tracking table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id      SERIAL PRIMARY KEY,
      name    TEXT UNIQUE NOT NULL,
      run_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  for (const file of migrations) {
    const { rows } = await client.query(
      'SELECT id FROM _migrations WHERE name = $1', [file]
    );

    if (rows.length) {
      console.log(`[Migration] ✓ ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(__dirname, file), 'utf8');
    console.log(`[Migration] ▶ Running ${file}...`);

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[Migration] ✓ ${file} applied`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[Migration] ✗ ${file} failed:`, err.message);
      process.exit(1);
    }
  }

  await client.end();
  console.log('[Migration] All migrations complete');
}

run().catch(err => {
  console.error('[Migration] Fatal:', err);
  process.exit(1);
});
