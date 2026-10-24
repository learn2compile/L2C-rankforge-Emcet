import { app } from './app.mjs';
import { config } from './config.mjs';
import { pool } from './db/pool.mjs';

const server = app.listen(config.port, () => {
  console.log(JSON.stringify({ level: 'info', event: 'server_started', port: config.port, environment: config.nodeEnv }));
  if (!config.databaseUrl) console.warn('DATABASE_URL is not configured. Configure PostgreSQL and run npm run db:migrate.');
});

async function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
  server.close(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
