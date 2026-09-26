import { sequelize } from './config';
import { assertSchemaReady } from './database/schema';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for schema checks.');
  try {
    await assertSchemaReady(sequelize);
    console.log('Database schema is ready.');
  } finally {
    await sequelize.close();
  }
}
main().catch((error: unknown) => {
  console.error('Database schema check failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
