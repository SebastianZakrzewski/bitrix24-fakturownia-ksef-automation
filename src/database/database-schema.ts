/** V1 application tables live in this PostgreSQL schema (Supabase PROD). */
export const DEFAULT_DATABASE_SCHEMA = 'fakturownia-ksef-invoices';

export function resolveDatabaseSchema(value: string | undefined): string {
  const schema = value?.trim();
  return schema && schema.length > 0 ? schema : DEFAULT_DATABASE_SCHEMA;
}

export function quotePgIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function qualifiedSchemaName(schema: string): string {
  return quotePgIdentifier(schema);
}

/**
 * Appends libpq `options` so every pooled connection uses the app schema.
 * Schema names with hyphens must be quoted in search_path.
 */
export function withDatabaseSearchPath(
  connectionString: string,
  schema: string,
): string {
  if (connectionString.includes('search_path')) {
    return connectionString;
  }

  const quotedSchema = quotePgIdentifier(schema);
  const optionValue = `-c search_path=${quotedSchema}`;
  const encoded = encodeURIComponent(optionValue);
  const separator = connectionString.includes('?') ? '&' : '?';

  return `${connectionString}${separator}options=${encoded}`;
}
