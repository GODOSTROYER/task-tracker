import { QueryTypes, Sequelize } from 'sequelize';

/** Read-only deployment/readiness guard; never creates or changes schema. */
export async function assertSchemaReady(database: Sequelize): Promise<void> {
  const [catalog] = await database.query<{ migrations: string | null }>(
    "SELECT to_regclass('schema_migrations')::text AS migrations", { type: QueryTypes.SELECT });
  if (!catalog?.migrations) throw new Error('Database migrations are required; run npm run db:migrate.');
  const [schema] = await database.query<{ ready: boolean }>(`
    SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '001_baseline_and_verification_attempts')
      AND EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'users'
          AND column_name = 'verificationAttempts' AND data_type = 'integer' AND is_nullable = 'NO') AS ready
  `, { type: QueryTypes.SELECT });
  if (!schema?.ready) throw new Error('Database schema is not ready; run npm run db:migrate.');
}
