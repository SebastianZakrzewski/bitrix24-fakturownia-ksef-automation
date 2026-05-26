/**
 * Host-only hint for reports (no path tokens, webhooks, or secrets).
 */
export function maskBitrixWebhookUrl(webhookUrl: string): string {
  try {
    const parsed = new URL(webhookUrl);
    return `${parsed.origin}/[bitrix-webhook-configured]`;
  } catch {
    return '[bitrix-webhook-not-displayed]';
  }
}
