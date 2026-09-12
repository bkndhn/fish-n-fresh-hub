/**
 * @fileoverview Environment Variable Validation
 * @module lib/env
 *
 * Validates all required environment variables at startup using Zod.
 * If any required variable is missing, the app fails fast with a clear
 * error message listing ALL missing variables — not just the first one.
 */

import { z } from "zod";

/**
 * Schema for client-side (VITE_*) environment variables.
 * These are embedded at build time and available in the browser.
 */
const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z
    .string({ required_error: "VITE_SUPABASE_URL is required" })
    .url("VITE_SUPABASE_URL must be a valid URL"),
  VITE_SUPABASE_ANON_KEY: z
    .string({ required_error: "VITE_SUPABASE_ANON_KEY is required" })
    .min(20, "VITE_SUPABASE_ANON_KEY appears invalid (too short)"),
});

/**
 * Schema for server-side environment variables.
 * These are only available in server functions and Edge Workers.
 */
const serverEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
});

/**
 * Validates client-side environment variables.
 * Call this early in the app lifecycle (e.g., in __root.tsx or router.tsx).
 * Returns validated env object or throws with clear error messages.
 */
export function validateClientEnv(): z.infer<typeof clientEnvSchema> {
  const raw = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  const result = clientEnvSchema.safeParse(raw);

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ✗ ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(
      `\n❌ Environment Validation Failed:\n${missing}\n\nPlease check your .env file.\n`
    );
    throw new Error(`Missing or invalid environment variables:\n${missing}`);
  }

  return result.data;
}

/**
 * Validates server-side environment variables.
 * Call this in server functions or the Edge Worker entry point.
 */
export function validateServerEnv(
  env: Record<string, string | undefined>
): z.infer<typeof serverEnvSchema> {
  const result = serverEnvSchema.safeParse(env);

  if (!result.success) {
    const warnings = result.error.issues
      .map((i) => `  ⚠ ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.warn(`\n⚠️ Server Environment Warnings:\n${warnings}\n`);
  }

  return result.data ?? ({} as z.infer<typeof serverEnvSchema>);
}
