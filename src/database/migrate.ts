import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';
import {
  DEFAULT_DATABASE_SCHEMA,
  qualifiedSchemaName,
  resolveDatabaseSchema,
} from './database-schema';

const MIGRATIONS_TABLE = 'schema_migrations';

function resolveMigrationsDir(): string {
  return path.join(process.cwd(), 'db', 'migrations');
}

function migrationsTableRef(schema: string): string {
  return `${qualifiedSchemaName(schema)}.${MIGRATIONS_TABLE}`;
}

async function ensureMigrationsTable(pool: Pool, schema: string): Promise<void> {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${qualifiedSchemaName(schema)}`);
  const tableRef = migrationsTableRef(schema);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableRef} (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function listMigrationFiles(): Promise<string[]> {
  const migrationsDir = resolveMigrationsDir();
  const entries = await readdir(migrationsDir);
  return entries.filter((name) => name.endsWith('.sql')).sort();
}

async function isMigrationApplied(
  pool: Pool,
  schema: string,
  filename: string,
): Promise<boolean> {
  const tableRef = migrationsTableRef(schema);
  const result = await pool.query<{ filename: string }>(
    `SELECT filename FROM ${tableRef} WHERE filename = $1`,
    [filename],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

async function applyMigrationFile(
  pool: Pool,
  schema: string,
  filename: string,
): Promise<void> {
  const migrationsDir = resolveMigrationsDir();
  const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
  const tableRef = migrationsTableRef(schema);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(`INSERT INTO ${tableRef} (filename) VALUES ($1)`, [filename]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate(
  pool: Pool,
  schema: string = DEFAULT_DATABASE_SCHEMA,
): Promise<void> {
  const resolvedSchema = resolveDatabaseSchema(schema);
  await ensureMigrationsTable(pool, resolvedSchema);
  const files = await listMigrationFiles();

  for (const filename of files) {
    const applied = await isMigrationApplied(pool, resolvedSchema, filename);
    if (!applied) {
      await applyMigrationFile(pool, resolvedSchema, filename);
    }
  }
}
