import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(8080),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  APP_SECRET: z.string().startsWith("v4.local."),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().default(30),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  SHUTDOWN_TIMEOUT: z.coerce.number().int().default(10000),
});

// env is loaded by bun automatically from process.env
export const env = envSchema.parse(process.env);
