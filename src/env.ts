import { z } from "zod";

/**
 * Environment validation. Imported by next.config.ts so a missing or malformed
 * variable fails `next dev` and `next build` at startup.
 *
 * `env` holds server values and must never reach the browser.
 * `publicEnv` holds NEXT_PUBLIC_* values, referenced by name so Next.js inlines them.
 */

const nonEmpty = z.string().trim().min(1);

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  STORE_CURRENCY: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "STORE_CURRENCY must be an ISO 4217 code such as GBP"),
  STRIPE_SECRET_KEY: nonEmpty,
  STRIPE_WEBHOOK_SECRET: nonEmpty,
  // "fake" uses a built-in test payment page instead of Stripe (local work and tests only).
  PAYMENT_PROVIDER: z.enum(["stripe", "fake"]).default("stripe"),
  // Stripe Tax. Turn on only after the Stripe account has an active tax registration:
  // without one Stripe collects no tax and reports no error.
  STRIPE_AUTOMATIC_TAX: z
    .enum(["on", "off"])
    .default("off")
    .transform((v) => v === "on"),
  R2_ACCOUNT_ID: nonEmpty,
  R2_ACCESS_KEY_ID: nonEmpty,
  R2_SECRET_ACCESS_KEY: nonEmpty,
  R2_BUCKET: nonEmpty,
  // "local" stores uploads in .uploads/ and serves them from /api/uploads/local (dev and tests only).
  STORAGE_DRIVER: z.enum(["r2", "local"]).default("r2"),
  RESEND_API_KEY: nonEmpty,
  RESEND_WEBHOOK_SECRET: nonEmpty,
  EMAIL_FROM_ORDERS: nonEmpty,
  EMAIL_FROM_MARKETING: nonEmpty,
  // "log" writes emails to .emails/outbox.jsonl instead of calling Resend (local work and tests).
  EMAIL_TRANSPORT: z.enum(["resend", "log"]).default("resend"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
  SEED_OWNER_EMAIL: z.email(),
  SEED_OWNER_PASSWORD: z.string().min(12, "SEED_OWNER_PASSWORD must be at least 12 characters"),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_MEDIA_URL: z.url(),
});

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
}

function parsePublic() {
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_MEDIA_URL: process.env.NEXT_PUBLIC_MEDIA_URL,
  });
  if (!result.success) {
    throw new Error(`Invalid public environment variables:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

function parseServer() {
  if (typeof window !== "undefined") {
    throw new Error("Server environment variables were imported in the browser.");
  }
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

export const publicEnv = parsePublic();

export const env: z.infer<typeof serverSchema> & z.infer<typeof publicSchema> =
  typeof window === "undefined"
    ? { ...parseServer(), ...publicEnv }
    : (new Proxy({} as never, {
        get() {
          throw new Error("Server environment variables were read in the browser.");
        },
      }) as never);
