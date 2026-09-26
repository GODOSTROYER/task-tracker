import { assertSchemaReady } from '../database/schema';
jest.mock('../database/schema', () => ({ assertSchemaReady: jest.fn() }));
import request from 'supertest';
import app from '../app';
import { connectDB, sequelize } from '../config';
jest.mock('../config', () => ({ connectDB: jest.fn(), sequelize: { authenticate: jest.fn() } }));
jest.mock('../routes/auth', () => require('express').Router());
jest.mock('../routes/tasks', () => require('express').Router());
jest.mock('../routes/workspaces', () => require('express').Router());
jest.mock('morgan', () => () => (_req: any, _res: any, next: any) => next());
beforeEach(() => { jest.clearAllMocks(); (assertSchemaReady as jest.Mock).mockResolvedValue(undefined); });

describe('Health endpoint boundaries', () => {
  it('serves liveness without a database connection', async () => {
    (connectDB as jest.Mock).mockRejectedValue(new Error('offline'));
    const result = await request(app).get('/api/health');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: 'ok' });
    expect(connectDB).not.toHaveBeenCalled();
  });
  it('reports unavailable readiness without leaking connection errors', async () => {
    (connectDB as jest.Mock).mockRejectedValue(new Error('password secret'));
    const result = await request(app).get('/api/ready');
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ status: 'unavailable' });
  });
  it('checks readiness against the database after cached initialization', async () => {
    (connectDB as jest.Mock).mockResolvedValue(undefined);
    (sequelize.authenticate as jest.Mock).mockResolvedValue(undefined);
    expect((await request(app).get('/api/ready')).status).toBe(200);
    expect(sequelize.authenticate).toHaveBeenCalledTimes(1);
    expect(assertSchemaReady).toHaveBeenCalledWith(sequelize);
  });
});

it('returns readiness 503 when schema migrations are missing', async () => {
  (connectDB as jest.Mock).mockResolvedValue(undefined);
  (sequelize.authenticate as jest.Mock).mockResolvedValue(undefined);
  (assertSchemaReady as jest.Mock).mockRejectedValue(new Error('migration required'));
  const result = await request(app).get('/api/ready');
  expect(result.status).toBe(503);
  expect(result.body).toEqual({ status: 'unavailable' });
});
