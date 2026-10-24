import pg from 'pg';
import { config } from '../config.mjs';

const { Pool } = pg;
export const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
pool.on('error', (error) => console.error(JSON.stringify({ level: 'error', event: 'database_pool_error', message: error.message })));
