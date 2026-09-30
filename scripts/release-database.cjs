'use strict';

// Same-database data snapshot, not independent storage or PITR. Types remain shared;
// constraints/defaults/indexes are not a restore plan. Owners can remove write guards.
const BACKUP = 'release_backup_20260930_4564f8c';
const TABLES = ['users', 'workspaces', 'tasks'];
const FROZEN_TABLES = [...TABLES, '_manifest'];
const GUARD_BODY = "BEGIN RAISE EXCEPTION 'Release snapshot is read-only'; END;";
const COMMON = { id: ['uuid', true], createdAt: ['timestamp with time zone', true], updatedAt: ['timestamp with time zone', true] };
const BASELINE = {
  users: { ...COMMON, name: ['character varying(255)', true], email: ['character varying(255)', true],
    password: ['character varying(255)', true], isVerified: ['boolean', false],
    verificationOtp: ['character varying(255)', false], verificationOtpExpiry: ['timestamp with time zone', false],
    resetToken: ['character varying(255)', false], resetTokenExpiry: ['timestamp with time zone', false] },
  workspaces: { ...COMMON, name: ['character varying(255)', true], ownerId: ['uuid', true] },
  tasks: { ...COMMON, title: ['character varying(255)', true], description: ['text', true],
    status: ['enum_tasks_status', true], priority: ['enum_tasks_priority', true], dueDate: ['date', false],
    position: ['integer', true], ownerId: ['uuid', true], workspaceId: ['uuid', true] },
};

function requireSafe(condition) {
  if (!condition) throw new Error('Release safety check failed');
}

async function main() {
  let database;
  let stage = 'gate';
  const originalWarn = console.warn;
  try {
    // Check the externally supplied environment before dotenv/config can load a fallback.
    requireSafe(process.env.RELEASE_DATABASE_SNAPSHOT === '1' && process.env.VERCEL_ENV === 'production');
    requireSafe(process.env.NODE_ENV !== 'test' && Boolean(process.env.DATABASE_URL?.trim()));
    stage = 'load';
    // Sequelize can warn with raw commit/rollback errors even with SQL logging off.
    console.warn = () => {};
    process.env.DEBUG = '';
    const { createRequire } = require('node:module');
    const serverRequire = createRequire(require('node:path').resolve(__dirname, '../server/package.json'));
    const { QueryTypes, Transaction } = serverRequire('sequelize');
    database = require('../server/dist/config.js').sequelize;
    const { migrateDatabase } = require('../server/dist/database/migrate.js');
    const { assertSchemaReady } = require('../server/dist/database/schema.js');
    database.options.logging = false;
    // The unchanged migration uses unqualified names: pin every pooled connection.
    database.addHook('afterConnect', async connection => {
      await connection.query("SET search_path TO public; SET lock_timeout TO '10s'; SET statement_timeout TO '120s'; SET row_security TO off");
    });

    stage = 'snapshot';
    const snapshot = await database.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async transaction => {
      const query = (sql, bind) => database.query(sql, { transaction, bind, logging: false });
      const select = (sql, bind) => database.query(sql, { transaction, bind, logging: false, type: QueryTypes.SELECT });
      const columns = (schema, table) => select(`
        SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type,
          a.attnotnull AS required, a.attgenerated AS generated, a.attidentity AS identity
        FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum`, [schema, table]);
      const count = async (schema, table) => {
        const [row] = await select(`SELECT count(*)::text AS count FROM "${schema}"."${table}"`);
        requireSafe(/^\d+$/.test(row.count));
        return row.count;
      };
      const checkColumns = (table, actual) => {
        const expected = { ...BASELINE[table] };
        if (table === 'users' && actual.some(column => column.name === 'verificationAttempts')) {
          expected.verificationAttempts = ['integer', true];
        }
        requireSafe(actual.length === Object.keys(expected).length);
        for (const column of actual) {
          const spec = expected[column.name];
          requireSafe(spec && column.type === spec[0] && column.required === spec[1] && !column.generated && !column.identity);
        }
      };

      // Serialize with the existing migration and other invocations of this helper.
      await query('SELECT pg_advisory_xact_lock(741092183)');
      // SHARE blocks DML/DDL but permits ordinary reads. Acquire all locks before
      // reading source rows; READ COMMITTED then sees one stable, current dataset.
      await query('LOCK TABLE public.users, public.workspaces, public.tasks IN SHARE MODE');
      const relations = await select(`
        SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND c.relkind = 'r'
          AND c.relpersistence = 'p' AND NOT c.relrowsecurity
          AND NOT EXISTS (SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid OR i.inhparent = c.oid)`, [TABLES]);
      requireSafe(relations.length === TABLES.length);
      const sourceColumns = {};
      for (const table of TABLES) {
        sourceColumns[table] = await columns('public', table);
        checkColumns(table, sourceColumns[table]);
      }
      const enums = await select(`
        SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
        FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = 'public' AND t.typname IN ('enum_tasks_status', 'enum_tasks_priority') GROUP BY t.typname`);
      requireSafe(enums.length === 2 && enums.every(type => JSON.stringify(type.labels) === JSON.stringify(
        type.name === 'enum_tasks_status' ? ['todo', 'in-progress', 'in-review', 'completed'] : ['low', 'medium', 'high'])));
      // Adoption cannot repair missing keys/cascades on tables that already exist.
      const keys = await select(`
        SELECT c.relname AS name,
          EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id'
            WHERE i.indrelid = c.oid AND i.indisprimary AND i.indisvalid AND i.indkey::text = a.attnum::text) AS primary_key,
          EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'email'
            WHERE i.indrelid = c.oid AND i.indisunique AND i.indisvalid AND i.indpred IS NULL
              AND i.indexprs IS NULL AND i.indkey::text = a.attnum::text) AS unique_email
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`, [TABLES]);
      requireSafe(keys.length === 3 && keys.every(key => key.primary_key && (key.name !== 'users' || key.unique_email)));
      const foreignKeys = await select(`
        SELECT c.relname || '.' || a.attname || '>' || p.relname || '.' || b.attname AS key
        FROM pg_constraint f JOIN pg_class c ON c.oid = f.conrelid JOIN pg_class p ON p.oid = f.confrelid
        JOIN pg_attribute a ON a.attrelid = c.oid AND f.conkey = ARRAY[a.attnum]
        JOIN pg_attribute b ON b.attrelid = p.oid AND f.confkey = ARRAY[b.attnum]
        WHERE f.contype = 'f' AND f.convalidated AND f.confdeltype = 'c' AND f.confupdtype = 'c'
          AND c.relnamespace = 'public'::regnamespace AND p.relnamespace = 'public'::regnamespace
          AND c.relname = ANY($1::text[])`, [TABLES]);
      for (const key of ['workspaces.ownerId>users.id', 'tasks.ownerId>users.id', 'tasks.workspaceId>workspaces.id']) {
        requireSafe(foreignKeys.some(row => row.key === key));
      }

      const [existing] = await select('SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS present', [BACKUP]);
      if (!existing.present) {
        await query(`CREATE SCHEMA "${BACKUP}"; REVOKE ALL ON SCHEMA "${BACKUP}" FROM PUBLIC`);
        await query(`CREATE TABLE "${BACKUP}"._manifest (table_name TEXT PRIMARY KEY, row_count BIGINT NOT NULL, columns JSONB NOT NULL)`);
        for (const table of TABLES) {
          // LIKE without defaults/constraints avoids live sequence or FK dependencies.
          await query(`CREATE TABLE "${BACKUP}"."${table}" (LIKE public."${table}");
            INSERT INTO "${BACKUP}"."${table}" SELECT * FROM public."${table}"`);
          const sourceCount = await count('public', table);
          requireSafe(sourceCount === await count(BACKUP, table));
          requireSafe(JSON.stringify(sourceColumns[table]) === JSON.stringify(await columns(BACKUP, table)));
          await query(`INSERT INTO "${BACKUP}"._manifest (table_name, row_count, columns) VALUES ($1, $2::bigint, $3::jsonb)`,
            [table, sourceCount, JSON.stringify(sourceColumns[table])]);
        }
        await query(`CREATE FUNCTION "${BACKUP}".reject_writes() RETURNS trigger LANGUAGE plpgsql AS $guard$${GUARD_BODY}$guard$`);
        for (const table of FROZEN_TABLES) {
          await query(`CREATE TRIGGER freeze_snapshot BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE
            ON "${BACKUP}"."${table}" FOR EACH STATEMENT EXECUTE FUNCTION "${BACKUP}".reject_writes();
            ALTER TABLE "${BACKUP}"."${table}" ENABLE ALWAYS TRIGGER freeze_snapshot`);
        }
        await query(`REVOKE ALL ON ALL TABLES IN SCHEMA "${BACKUP}" FROM PUBLIC;
          REVOKE ALL ON FUNCTION "${BACKUP}".reject_writes() FROM PUBLIC`);
      }

      // Never rebuild an existing backup. Validate its original manifest, not live
      // counts/columns, which can legitimately change after the first migration.
      const backupRelations = await select(`
        SELECT c.relname AS name, c.relkind AS kind, c.relpersistence AS persistence, c.relrowsecurity AS rls
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind <> 'i'`, [BACKUP]);
      requireSafe(backupRelations.length === 4 && backupRelations.every(row =>
        FROZEN_TABLES.includes(row.name) && row.kind === 'r' && row.persistence === 'p' && !row.rls));
      await query(`LOCK TABLE ${FROZEN_TABLES.map(table => `"${BACKUP}"."${table}"`).join(', ')} IN SHARE MODE`);
      const guards = await select(`
        SELECT c.relname AS name FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
        JOIN pg_proc p ON p.oid = g.tgfoid
        WHERE c.relnamespace = $1::regnamespace AND g.tgname = 'freeze_snapshot'
          AND g.tgtype = 62 AND g.tgenabled = 'A' AND NOT g.tgisinternal
          AND p.pronamespace = c.relnamespace AND p.proname = 'reject_writes'
          AND p.pronargs = 0 AND p.prosrc = $2 AND p.prorettype = 'trigger'::regtype
          AND g.tgparentid = 0 AND g.tgqual IS NULL`, [BACKUP, GUARD_BODY]);
      requireSafe(guards.length === 4 && guards.every(row => FROZEN_TABLES.includes(row.name)));
      const manifest = await select(`SELECT table_name AS name, row_count::text AS count, columns FROM "${BACKUP}"._manifest ORDER BY table_name`);
      requireSafe(manifest.length === 3 && new Set(manifest.map(row => row.name)).size === 3);
      for (const entry of manifest) {
        requireSafe(TABLES.includes(entry.name));
        const actual = await columns(BACKUP, entry.name);
        checkColumns(entry.name, actual);
        // JSONB does not preserve object-key order, so compare structured fields.
        requireSafe(actual.length === entry.columns.length && actual.every((column, index) =>
          Object.keys(column).every(key => column[key] === entry.columns[index][key])));
        requireSafe(entry.count === await count(BACKUP, entry.name));
      }
      return manifest;
    });

    console.log(`${BACKUP}: snapshot verified`);
    for (const entry of snapshot) console.log(`${BACKUP}.${entry.name}: ${entry.count}`);
    stage = 'migration';
    await migrateDatabase(database);
    stage = 'schema-check';
    await assertSchemaReady(database);
    console.log(`${BACKUP}: migration and schema check succeeded`);
  } catch {
    // Never emit driver errors, SQL, row values, or environment/connection details.
    console.error(`${BACKUP}: failed (${stage})`);
    process.exitCode = 1;
  } finally {
    if (database) {
      try { await database.close(); }
      catch { console.error(`${BACKUP}: close failed`); process.exitCode = 1; }
    }
    console.warn = originalWarn;
  }
}

void main();
