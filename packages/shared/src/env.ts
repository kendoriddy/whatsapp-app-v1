import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]),
  APP_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_DIRECT: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STORAGE_BUCKET_MEDIA: z.string().default("wa-media"),
  META_GRAPH_API_BASE_URL: z.string().url(),
  META_GRAPH_API_VERSION: z.string().default("v25.0"),
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(16),
  META_SYSTEM_USER_TOKEN: z.string().min(1),
  META_WABA_ID: z.string().min(1),
  META_PHONE_NUMBER_ID: z.string().min(1),
  WINDOW_SAFETY_MARGIN_SECONDS: z.coerce.number().int().default(300),
  PAYSTACK_SECRET_KEY: z.string().min(1),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_CALLBACK_URL: z.string().url(),
  PAYSTACK_FALLBACK_EMAIL_DOMAIN: z.string().min(1),
  PAYSTACK_ENFORCE_IP_ALLOWLIST: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Default Cencori (OpenAI often blocked on org networks). Failover → Gemini → OpenAI.
  AI_PRIMARY_PROVIDER: z
    .enum(["openai", "cencori", "gemini"])
    .default("cencori"),
  CENCORI_API_KEY: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  LLM_API_KEY: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  LLM_BASE_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  GEMINI_API_KEY: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  AI_CLASSIFIER_MODEL: z.string().min(1).default("auto"),
  AI_SUMMARY_MODEL: z.string().min(1).default("auto"),
  AI_OPENAI_FALLBACK_MODEL: z.string().min(1).default("gpt-4o-mini"),
  AI_GEMINI_FALLBACK_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  AI_EXTRACTOR_MODEL: z.string().optional(),
  AI_SUGGEST_MODEL: z.string().optional(),
  AI_TRANSCRIBE_MODEL: z.string().optional(),
  AI_CLASSIFY_CONFIDENCE_REVIEW_THRESHOLD: z.coerce.number().default(0.7),
  AI_CLASSIFY_MEDIA_LOOKAHEAD_SECONDS: z.coerce.number().int().default(60),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  BUSINESS_TIMEZONE: z.string().default("Africa/Lagos"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  if (
    !parsed.data.CENCORI_API_KEY &&
    !parsed.data.LLM_API_KEY &&
    !parsed.data.GEMINI_API_KEY
  ) {
    throw new Error(
      "Invalid environment: set CENCORI_API_KEY and/or LLM_API_KEY and/or GEMINI_API_KEY",
    );
  }
  cached = parsed.data;
  return cached;
}

/** Reset cache (tests only). */
export function resetEnvCache(): void {
  cached = null;
}
