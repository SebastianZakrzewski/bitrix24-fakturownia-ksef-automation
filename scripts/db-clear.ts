import '../src/load-env';
import { Pool } from 'pg';
import {
  qualifiedSchemaName,
  resolveDatabaseSchema,
  withDatabaseSearchPath,
} from '../src/database/database-schema';

const PROCESS_TABLES = [
  'technical_retry_attempts',
  'bitrix_deal_snapshots',
  'invoice_records',
  'invoice_events',
  'fakturownia_orders',
  'invoice_processes',
] as const;

const PRESERVED_TABLES = ['client_configs', 'panel_admin_users'] as const;

const ALL_TABLES = [...PROCESS_TABLES, ...PRESERVED_TABLES] as const;

async function countRows(pool: Pool, schema: string): Promise<Record<string, number>> {
  const q = qualifiedSchemaName(schema);
  const counts: Record<string, number> = {};

  for (const table of ALL_TABLES) {
    const result = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM ${q}.${qualifiedSchemaName(table)}`,
    );
    counts[table] = result.rows[0]?.c ?? 0;
  }

  return counts;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to clear schema data');
  }

  const schema = resolveDatabaseSchema(process.env.DATABASE_SCHEMA);
  const q = qualifiedSchemaName(schema);
  const pool = new Pool({
    connectionString: withDatabaseSearchPath(databaseUrl, schema),
  });

  try {
    const before = await countRows(pool, schema);
    console.log(`Schema: ${schema}`);
    console.log('Before TRUNCATE:', before);

    await pool.query(`
      TRUNCATE TABLE
        ${q}.technical_retry_attempts,
        ${q}.bitrix_deal_snapshots,
        ${q}.invoice_records,
        ${q}.invoice_events,
        ${q}.fakturownia_orders,
        ${q}.invoice_processes
      RESTART IDENTITY CASCADE
    `);

    const after = await countRows(pool, schema);
    console.log('After TRUNCATE:', after);
    console.log('Preserved (not truncated):', PRESERVED_TABLES.join(', '));
    console.log('Process data cleared successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
