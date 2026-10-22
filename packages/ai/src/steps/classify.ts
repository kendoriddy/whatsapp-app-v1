import { z } from "zod";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LlmClient } from "../llm.js";
import { hashInput } from "../llm.js";
import { registerStep } from "../pipeline.js";

export const CLASSIFY_PROMPT_VERSION = "classify-v1.0.0";
export const CLASSIFY_STEP_VERSION = "1.0.0";

const outputSchema = z.object({
  label: z.enum(["inquiry", "complaint", "order", "spam"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(500),
});

export type ClassifyOutput = z.infer<typeof outputSchema>;

function loadPrompt(): string {
  try {
    return readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../prompts/classify-v1.0.0.md"),
      "utf8",
    );
  } catch {
    return "Classify the message as inquiry|complaint|order|spam with confidence 0-1.";
  }
}

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string", enum: ["inquiry", "complaint", "order", "spam"] },
    confidence: { type: "number" },
    rationale: { type: "string" },
  },
  required: ["label", "confidence", "rationale"],
};

export async function classifyMessage(
  llm: LlmClient,
  model: string,
  text: string,
  threshold: number,
): Promise<{
  output: ClassifyOutput;
  valid: boolean;
  validationErrors: string[];
  inputHash: string;
  aiMeta: { provider: string; model: string; latencyMs: number; tokensIn?: number; tokensOut?: number };
  needsReview: boolean;
}> {
  const input = { text };
  const inputHash = hashInput(input);
  const result = await llm.completeJson<ClassifyOutput>({
    model,
    system: loadPrompt(),
    user: text,
    schemaName: "classify",
    schema: jsonSchema,
  });
  const parsed = outputSchema.safeParse(result.output);
  if (!parsed.success) {
    return {
      output: { label: "inquiry", confidence: 0, rationale: "invalid" },
      valid: false,
      validationErrors: parsed.error.issues.map((i) => i.message),
      inputHash,
      aiMeta: result,
      needsReview: true,
    };
  }
  return {
    output: parsed.data,
    valid: true,
    validationErrors: [],
    inputHash,
    aiMeta: result,
    needsReview: parsed.data.confidence < threshold,
  };
}

export function registerClassifyStep(
  run: (ctx: { messageId?: string }) => Promise<void>,
): void {
  registerStep({
    key: "classify",
    version: CLASSIFY_STEP_VERSION,
    featureFlag: "ai.classify",
    onIngest: true,
    run,
  });
}
