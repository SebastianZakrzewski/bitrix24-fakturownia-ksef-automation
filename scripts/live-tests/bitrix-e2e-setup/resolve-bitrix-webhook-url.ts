import { maskBitrixWebhookUrl } from './mask-bitrix-webhook-url';

export interface ResolvedBitrixWebhook {
  configured: boolean;
  webhookUrl?: string;
  webhookMasked?: string;
}

export function resolveBitrixWebhookUrl(
  config: Record<string, string | undefined> = process.env,
): ResolvedBitrixWebhook {
  const explicit = config.LIVE_TEST_BITRIX_WEBHOOK_URL?.trim();
  if (explicit) {
    return {
      configured: true,
      webhookUrl: explicit,
      webhookMasked: maskBitrixWebhookUrl(explicit),
    };
  }

  const standard = config.BITRIX24_WEBHOOK_URL?.trim();
  if (standard) {
    return {
      configured: true,
      webhookUrl: standard,
      webhookMasked: maskBitrixWebhookUrl(standard),
    };
  }

  const base = config.LIVE_TEST_BITRIX_BASE_URL?.trim();
  const secret = config.LIVE_TEST_BITRIX_AUTH_SECRET?.trim();
  if (base && secret) {
    const webhookUrl = `${base.replace(/\/$/, '')}/rest/1/${secret}/`;
    return {
      configured: true,
      webhookUrl,
      webhookMasked: maskBitrixWebhookUrl(webhookUrl),
    };
  }

  return { configured: false };
}
