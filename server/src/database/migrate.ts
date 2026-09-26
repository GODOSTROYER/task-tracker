import { Sequelize } from 'sequelize';

/** Forward-only, transactional migrations. Existing rows and tables are retained. */
export async function migrateDatabase(database: Sequelize): Promise<void> {
  await database.transaction(async (transaction) => {
    await database.query('SELECT pg_advisory_xact_lock(741092183)', { transaction });
    await database.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      DO $$ BEGIN
        CREATE TYPE enum_tasks_status AS ENUM ('todo', 'in-progress', 'in-review', 'completed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE enum_tasks_priority AS ENUM ('low', 'medium', 'high');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL, "isVerified" BOOLEAN DEFAULT FALSE,
        "verificationOtp" VARCHAR(255), "verificationOtpExpiry" TIMESTAMPTZ,
        "resetToken" VARCHAR(255), "resetTokenExpiry" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL,
        "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT NOT NULL DEFAULT '',
        status enum_tasks_status NOT NULL DEFAULT 'todo', priority enum_tasks_priority NOT NULL DEFAULT 'medium',
        "dueDate" DATE, position INTEGER NOT NULL DEFAULT 1024,
        "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE ON UPDATE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS workspaces_owner_id ON workspaces ("ownerId");
      CREATE INDEX IF NOT EXISTS tasks_owner_id ON tasks ("ownerId");
      CREATE INDEX IF NOT EXISTS tasks_workspace_id ON tasks ("workspaceId");
      CREATE INDEX IF NOT EXISTS tasks_status ON tasks (status);
      CREATE INDEX IF NOT EXISTS tasks_workspace_id_status_position ON tasks ("workspaceId", status, position);
      CREATE INDEX IF NOT EXISTS tasks_owner_workspace_order ON tasks ("ownerId", "workspaceId", status, position);
      INSERT INTO schema_migrations(name) VALUES ('001_baseline_and_verification_attempts') ON CONFLICT DO NOTHING;
    `, { transaction });
  });
}
