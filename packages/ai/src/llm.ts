import OpenAI from "openai";
import { createHash } from "node:crypto";
import { APIError } from "openai";

export type LlmJsonResult<T> = {
  output: T;
  model: string;
  provider: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  raw: unknown;
};

export interface LlmClient {
  completeJson<T>(args: {
    model: string;
    system: string;
    user: string;
    schemaName: string;
    schema: Record<string, unknown>;
  }): Promise<LlmJsonResult<T>>;
}

export type LlmPrimaryProvider = "openai" | "cencori" | "gemini";

export type GatewayLlmConfig = {
  /** Which provider to try first (default: openai) */
  primary?: LlmPrimaryProvider;
  /** Cencori project key (`csk_…`) */
  cencoriApiKey?: string;
  /** Direct OpenAI key (or generic OpenAI-compatible via llmBaseUrl) */
  llmApiKey?: string;
  llmBaseUrl?: string;
  /** Explicit Gemini API key (OpenAI-compat endpoint) */
  geminiApiKey?: string;
  /** Model when falling back from Cencori `auto` → OpenAI */
  openaiFallbackModel?: string;
  /** Model when falling back → Gemini */
  geminiFallbackModel?: string;
};

const CENCORI_OPENAI_BASE = "https://api.cencori.com/v1";
const GEMINI_OPENAI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

type CompleteArgs = {
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
};

function providerLabel(baseURL?: string): string {
  if (!baseURL) return "openai";
  if (baseURL.includes("cencori.com")) return "cencori";
  if (baseURL.includes("generativelanguage.googleapis.com")) return "gemini";
  return "openai-compatible";
}

/** Credit / routing / connectivity failures — try the next provider. */
export function isLlmFailoverError(err: unknown): boolean {
  const status =
    err instanceof APIError
      ? err.status
      : typeof err === "object" && err && "status" in err
        ? Number((err as { status: unknown }).status)
        : undefined;
  const msg = String(
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? (err as { message: unknown }).message
        : err,
  ).toLowerCase();
  const causeCode =
    err instanceof Error &&
    err.cause &&
    typeof err.cause === "object" &&
    "code" in err.cause
      ? String((err.cause as { code: unknown }).code).toLowerCase()
      : "";

  // Org / firewall blocks (e.g. api.openai.com) surface as Connection error / ENOTCONN.
  if (
    /connection error|fetch failed|network|econnreset|econnrefused|enotconn|etimedout|socket|tls|getaddrinfo/.test(
      msg,
    ) ||
    /econnreset|econnrefused|enotconn|etimedout|enotfound|eai_again/.test(
      causeCode,
    )
  ) {
    return true;
  }

  if (status === 402 || status === 429 || status === 503 || status === 529)
    return true;
  if (status === 401 || status === 403) {
    return /credit|quota|billing|balance|payment|byok|insufficient|plan/.test(
      msg,
    );
  }
  return /credit|quota|billing|insufficient_quota|byok_required|no.?credit|balance|payment.?required|rate.?limit/.test(
    msg,
  );
}

function remapModelForProvider(
  requested: string,
  provider: string,
  cfg: GatewayLlmConfig,
): string {
  const isAuto =
    requested === "auto" ||
    requested === "cencori-auto" ||
    requested === "cencori/auto";
  if (provider === "cencori") return requested;
  if (provider === "gemini") {
    if (
      isAuto ||
      requested.startsWith("gpt-") ||
      requested.startsWith("claude-")
    ) {
      return cfg.geminiFallbackModel ?? "gemini-2.0-flash";
    }
    return requested;
  }
  // openai / openai-compatible
  if (
    isAuto ||
    requested.startsWith("gemini-") ||
    requested.startsWith("claude-")
  ) {
    return cfg.openaiFallbackModel ?? "gpt-4o-mini";
  }
  return requested;
}

/**
 * Default primary: OpenAI. Fail over on quota/credit errors through the rest of the chain.
 * Set `primary: "cencori"` when Cencori has credit again.
 */
export function createGatewayLlmClient(cfg: GatewayLlmConfig): LlmClient {
  const openAiKey = cfg.llmApiKey;
  const llmIsGemini = Boolean(
    cfg.llmBaseUrl?.includes("generativelanguage.googleapis.com"),
  );

  const byName = new Map<string, { client: LlmClient; provider: string }>();

  if (openAiKey && !llmIsGemini) {
    const provider = providerLabel(cfg.llmBaseUrl);
    byName.set("openai", {
      client: createOpenAiLlmClient(openAiKey, cfg.llmBaseUrl, provider),
      provider,
    });
  }
  if (cfg.cencoriApiKey) {
    byName.set("cencori", {
      client: createOpenAiLlmClient(
        cfg.cencoriApiKey,
        CENCORI_OPENAI_BASE,
        "cencori",
      ),
      provider: "cencori",
    });
  }
  if (cfg.geminiApiKey) {
    byName.set("gemini", {
      client: createOpenAiLlmClient(
        cfg.geminiApiKey,
        GEMINI_OPENAI_BASE,
        "gemini",
      ),
      provider: "gemini",
    });
  } else if (openAiKey && llmIsGemini) {
    byName.set("gemini", {
      client: createOpenAiLlmClient(openAiKey, cfg.llmBaseUrl, "gemini"),
      provider: "gemini",
    });
  }

  const primary = cfg.primary ?? "cencori";
  // Prefer Gemini over OpenAI in the failover list (OpenAI is often blocked by org networks).
  const rest: LlmPrimaryProvider[] = (
    ["gemini", "openai", "cencori"] as LlmPrimaryProvider[]
  ).filter((p) => p !== primary);
  const order: LlmPrimaryProvider[] = [primary, ...rest];

  const chain = order
    .map((name) => byName.get(name))
    .filter((x): x is { client: LlmClient; provider: string } => Boolean(x));

  if (chain.length === 0) {
    throw new Error(
      "No AI credentials: set LLM_API_KEY (OpenAI) and/or CENCORI_API_KEY and/or GEMINI_API_KEY",
    );
  }

  if (chain.length === 1) return chain[0]!.client;

  return {
    async completeJson<T>(args: CompleteArgs) {
      let lastErr: unknown;
      for (let i = 0; i < chain.length; i++) {
        const step = chain[i]!;
        const model = remapModelForProvider(args.model, step.provider, cfg);
        try {
          return await step.client.completeJson<T>({ ...args, model });
        } catch (err) {
          lastErr = err;
          const hasNext = i < chain.length - 1;
          if (!hasNext || !isLlmFailoverError(err)) throw err;
          console.warn(
            `[llm] ${step.provider} failed (${String((err as Error).message).slice(0, 120)}); trying next provider`,
          );
        }
      }
      throw lastErr;
    },
  };
}

export function createOpenAiLlmClient(
  apiKey: string,
  baseURL?: string,
  provider = "openai",
): LlmClient {
  const client = new OpenAI({ apiKey, baseURL });
  return {
    async completeJson<T>(args: CompleteArgs) {
      const { model, system, user, schemaName, schema } = args;
      const started = Date.now();
      const systemWithSchema = `${system}

Respond with a single JSON object only (no markdown). It must match this JSON Schema name "${schemaName}":
${JSON.stringify(schema)}`;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemWithSchema },
        { role: "user", content: user },
      ];

      let res: OpenAI.Chat.Completions.ChatCompletion;
      let lastErr: unknown;
      const attempts: Array<
        () => Promise<OpenAI.Chat.Completions.ChatCompletion>
      > = [
        () =>
          client.chat.completions.create({
            model,
            messages,
            response_format: {
              type: "json_schema",
              json_schema: { name: schemaName, strict: true, schema },
            },
          }),
        () =>
          client.chat.completions.create({
            model,
            messages,
            response_format: { type: "json_object" },
          }),
        () => client.chat.completions.create({ model, messages }),
      ];

      for (const attempt of attempts) {
        try {
          res = await attempt();
          lastErr = undefined;
          break;
        } catch (err) {
          lastErr = err;
          // Don't burn fallbacks on auth/credit — let the gateway chain handle it.
          if (isLlmFailoverError(err)) throw err;
        }
      }
      if (lastErr || !res!) throw lastErr ?? new Error("LLM request failed");

      const content = res.choices[0]?.message?.content ?? "{}";
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      return {
        output: JSON.parse(cleaned) as T,
        model: res.model ?? model,
        provider,
        latencyMs: Date.now() - started,
        tokensIn: res.usage?.prompt_tokens,
        tokensOut: res.usage?.completion_tokens,
        raw: res,
      };
    },
  };
}

/** Deterministic stub for tests / offline */
export function createStubLlmClient(fn: (user: string) => unknown): LlmClient {
  return {
    async completeJson({ model, user }) {
      return {
        output: fn(user) as never,
        model,
        provider: "stub",
        latencyMs: 1,
        raw: {},
      };
    },
  };
}

export function hashInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
