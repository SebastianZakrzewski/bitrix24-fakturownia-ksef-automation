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
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'test' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'DATABASE_URL is required when NODE_ENV is not test',
        path: ['DATABASE_URL'],
      });
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
