import OpenAI from "openai";
import { createHash } from "node:crypto";

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

export function createOpenAiLlmClient(apiKey: string, baseURL?: string): LlmClient {
  const client = new OpenAI({ apiKey, baseURL });
  return {
    async completeJson({ model, system, user, schemaName, schema }) {
      const started = Date.now();
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: schemaName, strict: true, schema },
        },
      });
      const content = res.choices[0]?.message?.content ?? "{}";
      return {
        output: JSON.parse(content) as T,
        model,
        provider: "openai",
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
