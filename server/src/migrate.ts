import { sequelize } from './config';
import { migrateDatabase } from './database/migrate';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for migrations.');
  try {
    await migrateDatabase(sequelize);
    console.log('Database migrations applied.');
  } finally {
    await sequelize.close();
  }
}

main().catch((error: unknown) => {
  console.error('Database migration failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
