import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.mjs';

const migrationPath = fileURLToPath(new URL('../../migrations/001_auth_foundation.sql', import.meta.url));
try {
  const sql = await readFile(migrationPath, 'utf8');
  await pool.query(sql);
  await pool.query("INSERT INTO schema_migrations(name) VALUES ('001_auth_foundation.sql') ON CONFLICT (name) DO NOTHING");
  console.log('Applied migration: 001_auth_foundation.sql');
} catch (error) {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
