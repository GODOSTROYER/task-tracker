jest.mock('dotenv', () => ({ __esModule: true, default: { config: jest.fn() } }));
jest.mock('../models', () => ({}));
jest.mock('pg', () => ({}));
jest.mock('sequelize', () => ({ Sequelize: jest.fn().mockImplementation(() => ({ authenticate: jest.fn(), sync: jest.fn() })) }));

describe('Database initialization', () => {
  const originalUrl = process.env.DATABASE_URL_TEST;
  afterEach(() => {
    if (originalUrl === undefined) delete process.env.DATABASE_URL_TEST;
    else process.env.DATABASE_URL_TEST = originalUrl;
  });
  it('shares initialization and retries after failure without runtime schema sync', async () => {
    jest.resetModules();
    process.env.DATABASE_URL_TEST = 'postgres://localhost/unit_test';
    const { connectDB, sequelize } = await import('../config');
    (sequelize.authenticate as jest.Mock).mockRejectedValueOnce(new Error('connection down')).mockResolvedValue(undefined);
    const first = connectDB();
    expect(connectDB()).toBe(first);
    await expect(first).rejects.toThrow('connection down');
    await expect(connectDB()).resolves.toBeUndefined();
    expect(sequelize.authenticate).toHaveBeenCalledTimes(2);
    expect(sequelize.sync).not.toHaveBeenCalled();
  });
  it('never falls back to DATABASE_URL during tests', async () => {
    jest.resetModules();
    delete process.env.DATABASE_URL_TEST;
    const { connectDB, sequelize } = await import('../config');
    await expect(connectDB()).rejects.toThrow('DATABASE_URL_TEST is required');
    expect(sequelize.authenticate).not.toHaveBeenCalled();
  });
});
