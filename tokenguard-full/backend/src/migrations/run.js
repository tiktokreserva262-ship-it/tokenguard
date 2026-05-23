import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const sql = readFileSync(join(__dirname, '001_init.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('✅ Migration executada com sucesso!');
} catch (e) {
  console.error('❌ Erro na migration:', e.message);
} finally {
  await pool.end();
}
