/**
 * @file server.ts — Application entry point
 *
 * Loads environment variables, connects to MongoDB and Redis,
 * then starts the Express server on the configured PORT (default: 5000).
 */

import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB, connectRedis } from './config';

const PORT = process.env.PORT || 5000;

async function start(): Promise<void> {
  try {
    await connectDB();
    await connectRedis();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
