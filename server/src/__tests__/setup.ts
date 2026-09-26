import { validateTestDatabase } from '../database/testSafety';

// Runs before config/model imports and before any destructive database operation.
validateTestDatabase(process.env);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-at-least-thirty-two-characters-long';
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test-password';
process.env.FROM_EMAIL = 'test@example.com';
process.env.FRONTEND_URL = 'http://localhost:3000';

jest.setTimeout(60000);
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
  }),
}));

import { sequelize } from '../config';
import { migrateDatabase } from '../database/migrate';
import '../models';

beforeAll(async () => {
  await migrateDatabase(sequelize);
  await sequelize.query('TRUNCATE TABLE "tasks", "workspaces", "users" RESTART IDENTITY CASCADE');
});

afterEach(async () => {
  await sequelize.query('TRUNCATE TABLE "tasks", "workspaces", "users" RESTART IDENTITY CASCADE');
});

afterAll(async () => { await sequelize.close(); });
