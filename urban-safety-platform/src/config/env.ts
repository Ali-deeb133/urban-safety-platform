import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  CORS_ORIGIN: z.url(),
  // Proxies in front of the app (Render or an AWS load balancer: 1). 0 means none, so a
  // client-written X-Forwarded-For is never trusted by default.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(8),
  // Serves /api-docs and its docs-only login. 'false' removes both; the API itself is unaffected.
  ENABLE_API_DOCS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  // Shared password of the public demo accounts (npm run seed:demo). It is printed on /api-docs,
  // so it must never be reused anywhere. Unset: no demo accounts are shown.
  DEMO_ACCOUNTS_PASSWORD: z.string().min(8).max(72).optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Only names and reasons are listed: a rejected value may be a secret.
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment variables:\n${problems}`);
}

export const env: Env = parsed.data;
