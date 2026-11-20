import { z } from "zod";

/**
 * Every environment variable apps/api reads, in one validated place. The app
 * refuses to boot when a required one is missing or malformed, and the error
 * names the variables only — never their values. Code reads config through
 * env(), never process.env directly, so this list stays complete.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v : undefined));

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_URL: optional,
  NEXT_PUBLIC_API_URL: optional,
  API_PUBLIC_URL: optional,

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  REDIS_URL: optional,
  INTEGRATIONS_ENCRYPTION_KEY: optional,

  PAYMENTS_TEST_MODE: optional,
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  SIFALO_API_USER: optional,
  SIFALO_API_KEY: optional,
  SIFALO_CHECKOUT_URL: optional,
  SIFALO_GATEWAY_URL: optional,
  DEPLOYMENT_ENV: z.enum(["development", "qa", "production"]).optional(),
  WAAFI_ENVIRONMENT: optional,
  WAAFI_STORE_ID: optional,
  WAAFI_HPP_KEY: optional,
  WAAFI_WEBHOOK_SECRET: optional,
  WAAFI_API_URL: optional,
  WAAFI_API_KEY: optional,
  WAAFI_API_USER_ID: optional,
  WAAFI_MERCHANT_UID: optional,
  EDAHAB_API_KEY: optional,
  EDAHAB_AGENT_CODE: optional,
  EDAHAB_API_URL: optional,
  BANK_TRANSFER_BANK_NAME: optional,
  BANK_TRANSFER_ACCOUNT_NAME: optional,
  BANK_TRANSFER_ACCOUNT_NUMBER: optional,

  DUFFEL_API_KEY: optional,
  // Legacy Amadeus REST contract. Enterprise SOAP requires its contracted adapter.
  AMADEUS_BASE_URL: optional,
  AMADEUS_CLIENT_ID: optional,
  AMADEUS_CLIENT_SECRET: optional,
  EMAIL_PROVIDER: optional,
  EMAIL_FROM: optional,
  EMAIL_REPLY_TO: optional,
  RESEND_API_KEY: optional,
  RESEND_FROM_EMAIL: optional,
  SMTP_HOST: optional,
  SMTP_PORT: optional,
  SMTP_SECURE: optional,
  SMTP_USER: optional,
  SMTP_PASS: optional,
  TWILIO_ACCOUNT_SID: optional,
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_WHATSAPP_FROM: optional,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parses raw env once; used by ConfigModule's validate hook at boot. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

/** Typed config for code outside Nest DI (plain functions, clients). */
export function env(): Env {
  return cached ?? validateEnv(process.env);
}
