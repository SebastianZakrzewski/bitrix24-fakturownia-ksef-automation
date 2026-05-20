export class DatabaseConstraintError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DatabaseConstraintError';
    this.code = code;
  }
}

export function isPgErrorWithCode(
  error: unknown,
): error is { code: string; message?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

export function rethrowDatabaseError(error: unknown): never {
  if (isPgErrorWithCode(error)) {
    throw new DatabaseConstraintError(error.code, error.message ?? error.code);
  }

  throw error;
}
