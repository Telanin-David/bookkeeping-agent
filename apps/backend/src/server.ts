import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config, db } from './config';
import { errorHandler } from './middleware/errorHandler';

import authRoutes        from './routes/auth';
import shopRoutes        from './routes/shops';
import transactionRoutes from './routes/transactions';
import chatRoutes        from './routes/chat';
import reportRoutes      from './routes/reports';
import alertRoutes       from './routes/alerts';
import importRoutes      from './routes/imports';

const app = express();
if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);

// ── Security middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.cors.frontendUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// ── Global rate limit ─────────────────────────────────────────
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

// ── Health ────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/v1/auth',                        authRoutes);
app.use('/api/v1/shops',                       shopRoutes);
app.use('/api/v1/shops/:shopId/transactions',  transactionRoutes);
app.use('/api/v1/chat',                        chatRoutes);
app.use('/api/v1/reports',                     reportRoutes);
app.use('/api/v1/alerts',                      alertRoutes);
app.use('/api/v1/imports',                     importRoutes);

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint not found' }));

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
async function start() {
  await db.query('SELECT 1'); // verify DB connection before accepting traffic
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
