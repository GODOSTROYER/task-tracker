import { Sequelize } from 'sequelize';
import { assertSchemaReady } from '../database/schema';

describe('read-only deployment schema guard', () => {
  it('fails clearly when the migration table is absent', async () => {
    const query = jest.fn().mockResolvedValue([{ migrations: null }]);
    await expect(assertSchemaReady({ query } as unknown as Sequelize)).rejects.toThrow('migrations are required');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('rejects an absent migration marker or incompatible required column', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ migrations: 'schema_migrations' }]).mockResolvedValueOnce([{ ready: false }]);
    await expect(assertSchemaReady({ query } as unknown as Sequelize)).rejects.toThrow('schema is not ready');
  });
  it('accepts the deployed schema using only SELECT queries', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ migrations: 'schema_migrations' }]).mockResolvedValueOnce([{ ready: true }]);
    await expect(assertSchemaReady({ query } as unknown as Sequelize)).resolves.toBeUndefined();
    expect(query.mock.calls.every(([sql]) => sql.trim().startsWith('SELECT'))).toBe(true);
  });
});
