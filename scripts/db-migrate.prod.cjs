'use strict';

const { Pool } = require('pg');
const {
  resolveDatabaseSchema,
  withDatabaseSearchPath,
} = require('../dist/database/database-schema');
const { migrate } = require('../dist/database/migrate');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const schema = resolveDatabaseSchema(process.env.DATABASE_SCHEMA);
  const pool = new Pool({
    connectionString: withDatabaseSearchPath(databaseUrl, schema),
  });

  try {
    await migrate(pool, schema);
    console.log(`Migrations applied successfully (schema: ${schema})`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
