/**
 * @file app.ts — Express application configuration
 *
 * Sets up all middleware (logging, CORS, JSON parsing, security, rate limiting)
 * and mounts the three API route groups: auth, tasks, workspaces.
 *
 * Exports the configured Express app (used by both server.ts and tests).
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import workspaceRoutes from './routes/workspaces';

const app = express();

app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : true,
  credentials: true,
}));
app.use(express.json());
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
}));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/workspaces', workspaceRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
