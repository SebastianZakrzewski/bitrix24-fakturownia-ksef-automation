import {
  DEFAULT_DATABASE_SCHEMA,
  resolveDatabaseSchema,
  withDatabaseSearchPath,
} from './database-schema';

describe('database-schema', () => {
  it('uses default schema when DATABASE_SCHEMA is unset', () => {
    expect(resolveDatabaseSchema(undefined)).toBe(DEFAULT_DATABASE_SCHEMA);
  });

  it('appends search_path options to connection string', () => {
    const url = withDatabaseSearchPath(
      'postgresql://user:pass@localhost:5432/db',
      DEFAULT_DATABASE_SCHEMA,
    );

    expect(url).toContain('options=');
    expect(decodeURIComponent(url)).toContain('search_path');
    expect(decodeURIComponent(url)).toContain(DEFAULT_DATABASE_SCHEMA);
  });

  it('does not duplicate search_path when already present', () => {
    const existing =
      'postgresql://localhost/db?options=-c%20search_path%3Dfakturownia-ksef-invoices';
    expect(withDatabaseSearchPath(existing, DEFAULT_DATABASE_SCHEMA)).toBe(existing);
  });
});
