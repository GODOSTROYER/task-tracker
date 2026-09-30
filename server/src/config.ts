import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
dotenv.config();
dotenv.config({ path: 'server/.env' });
const pg = require('pg');
const databaseUrl = process.env.NODE_ENV === 'test' ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;

export const sequelize = new Sequelize(databaseUrl || 'postgres://postgres:postgres@localhost:5432/task_tracker', {
  dialect: 'postgres', dialectModule: pg, logging: false,
  pool: { max: 3, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: databaseUrl?.includes('neon.tech')
    ? { ssl: { require: true, rejectUnauthorized: true } } : undefined,
});
let connectionPromise: Promise<void> | null = null;

export function connectDB(): Promise<void> {
  if (!databaseUrl) return Promise.reject(new Error(process.env.NODE_ENV === 'test' ? 'DATABASE_URL_TEST is required' : 'DATABASE_URL is required'));
  if (!connectionPromise) {
    connectionPromise = initializeDatabase().catch(error => {
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}
async function initializeDatabase(): Promise<void> {
  await import('./models');
  await sequelize.authenticate();
  // Schema changes belong to deployment migrations, never a request/cold start.
}
