import express from 'express';
import { config } from './config.mjs';
import { pool } from './db/pool.mjs';
import { authRouter } from './routes/auth.routes.mjs';
import { corsPolicy, csrfGuard, errorHandler, originGuard, requestContext } from './middleware/security.mjs';
import { parseCookies } from './middleware/session.mjs';

export const app = express();
app.disable('x-powered-by');
if (config.isProduction) app.set('trust proxy', 1);
app.use(requestContext);
app.use(corsPolicy);
app.use(express.json({ limit: '16kb', strict: true }));
app.use(parseCookies);
app.use(originGuard);
app.use('/api/v1', csrfGuard);

app.get('/api/v1/health/live', (req, res) => res.json({ status: 'ok', service: 'rankforge-api', timestamp: new Date().toISOString() }));
app.get('/api/v1/health/ready', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', database: 'connected' });
  } catch (error) { next(Object.assign(error, { status: 503, code: 'DATABASE_UNAVAILABLE' })); }
});
app.use('/api/v1/auth', authRouter);
app.get('/api/v1/*splat', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found.', requestId: req.requestId } }));
app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: req.requestId } }));
app.use(errorHandler);
