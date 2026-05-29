import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    N8N_API_KEY: z.string().min(1),
    ADMIN_API_KEY: z.string().min(1),
    PANEL_API_KEY: z.string().min(1),
    PANEL_ORIGIN: z.string().url().optional(),
    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_SCHEMA: z.string().min(1).default('fakturownia-ksef-invoices'),
    BITRIX24_WEBHOOK_URL: z.string().url().optional(),
    BITRIX24_PORTAL_URL: z.string().url().optional(),
    FAKTUROWNIA_BASE_URL: z.string().url().optional(),
    FAKTUROWNIA_API_TOKEN: z.string().min(1).optional(),
    FAKTUROWNIA_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30000),
    FAKTUROWNIA_KSEF_STATUS_POLL_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60000),
    FAKTUROWNIA_KSEF_STATUS_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(5000),
    FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_MONTH: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FULL: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_ADVANCE: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FINAL: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    N8N_INVOICE_EMAIL_WEBHOOK_URL: z.string().url().optional(),
    N8N_INVOICE_EMAIL_WEBHOOK_SECRET: z.string().min(1).optional(),
    N8N_INVOICE_EMAIL_WEBHOOK_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30000),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'test' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'DATABASE_URL is required when NODE_ENV is not test',
        path: ['DATABASE_URL'],
      });
    }

    if (env.NODE_ENV !== 'test' && !env.BITRIX24_WEBHOOK_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'BITRIX24_WEBHOOK_URL is required when NODE_ENV is not test',
        path: ['BITRIX24_WEBHOOK_URL'],
      });
    }

    if (env.NODE_ENV !== 'test' && !env.FAKTUROWNIA_BASE_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'FAKTUROWNIA_BASE_URL is required when NODE_ENV is not test',
        path: ['FAKTUROWNIA_BASE_URL'],
      });
    }

    if (env.NODE_ENV !== 'test' && !env.FAKTUROWNIA_API_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        message: 'FAKTUROWNIA_API_TOKEN is required when NODE_ENV is not test',
        path: ['FAKTUROWNIA_API_TOKEN'],
      });
    }

    if (env.NODE_ENV !== 'test' && !env.N8N_INVOICE_EMAIL_WEBHOOK_URL) {
      ctx.addIssue({
        code: 'custom',
        message:
          'N8N_INVOICE_EMAIL_WEBHOOK_URL is required when NODE_ENV is not test',
        path: ['N8N_INVOICE_EMAIL_WEBHOOK_URL'],
      });
    }

    if (env.NODE_ENV !== 'test' && !env.N8N_INVOICE_EMAIL_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: 'custom',
        message:
          'N8N_INVOICE_EMAIL_WEBHOOK_SECRET is required when NODE_ENV is not test',
        path: ['N8N_INVOICE_EMAIL_WEBHOOK_SECRET'],
      });
    }

    if (env.FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_MONTH) {
      const bootstrapFields = [
        ['FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FULL', env.FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FULL],
        ['FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_ADVANCE', env.FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_ADVANCE],
        ['FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FINAL', env.FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FINAL],
      ] as const;

      for (const [field, value] of bootstrapFields) {
        if (value === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} is required when FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_MONTH is set`,
            path: [field],
          });
        }
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}
