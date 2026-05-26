/**
 * Auth secret for live-test HTTP calls to POST /invoice-processes/bitrix-trigger.
 * Must match backend N8nApiKeyGuard (N8N_API_KEY) unless overridden explicitly.
 */
export function resolveBackendAuthSecret(
  config: Record<string, string | undefined> = process.env,
): string | undefined {
  const explicit = config.LIVE_TEST_BACKEND_AUTH_SECRET?.trim();
  if (explicit) {
    return explicit;
  }

  const n8nApiKey = config.N8N_API_KEY?.trim();
  return n8nApiKey || undefined;
}
