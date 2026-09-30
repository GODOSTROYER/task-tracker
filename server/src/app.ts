import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import workspaceRoutes from './routes/workspaces';
import { errorHandler } from './middleware/errorHandler';
import { connectDB, sequelize } from './config';
import { assertSchemaReady } from './database/schema';

const app = express();
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops > 0 && proxyHops <= 5) app.set('trust proxy', proxyHops);
const allowedOrigins = new Set((process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',').map(origin => origin.trim()).filter(Boolean));
app.use(morgan('dev'));
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)) }));
app.use(helmet());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use(express.json({ limit: '100kb' }));
if (process.env.NODE_ENV !== 'test') app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }));
app.get('/api/ready', async (_req, res) => {
  try {
    await connectDB();
    await sequelize.authenticate();
    await assertSchemaReady(sequelize);
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});
app.use(async (_req, _res, next) => {
  try { await connectDB(); next(); } catch (err) { next(err); }
});
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api', (_req, res) => { res.status(404).json({ message: 'Not found' }); });
app.use(errorHandler);
export default app;
