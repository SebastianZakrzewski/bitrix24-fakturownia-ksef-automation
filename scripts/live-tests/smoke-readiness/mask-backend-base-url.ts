/**
 * Returns only the URL origin for reports (no path, credentials, or query).
 */
export function maskBackendBaseUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return '[invalid-base-url]';
  }
}
