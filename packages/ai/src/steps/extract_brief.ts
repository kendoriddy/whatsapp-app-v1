import { groundField, type FieldCandidate } from "../validators/grounding.js";
import type { LlmClient } from "../llm.js";
import { hashInput } from "../llm.js";
import { registerStep } from "../pipeline.js";

export const EXTRACT_PROMPT_VERSION = "extract-v1.0.0";
export const EXTRACT_STEP_VERSION = "1.0.0";

export type ExtractedField = {
  key: string;
  value: unknown;
  status: "provisional" | "assumed" | "missing";
  evidenceMessageIds: string[];
};

export async function extractBrief(
  llm: LlmClient,
  model: string,
  conversationText: string,
  evidenceById: Record<string, string>,
): Promise<{
  fields: ExtractedField[];
  inputHash: string;
  validationErrors: string[];
  aiMeta: { provider: string; model: string; latencyMs: number };
}> {
  const input = { conversationText };
  const inputHash = hashInput(input);
  const result = await llm.completeJson<{
    fields: Array<{ key: string; value: unknown; status: string; evidenceMessageIds: string[] }>;
  }>({
    model,
    system:
      "Extract order fields only when grounded in customer text. Never invent fabric/colour/qty/price. Use status provisional or missing.",
    user: conversationText,
    schemaName: "extract_brief",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        fields: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              key: { type: "string" },
              value: {},
              status: { type: "string" },
              evidenceMessageIds: { type: "array", items: { type: "string" } },
            },
            required: ["key", "value", "status", "evidenceMessageIds"],
          },
        },
      },
      required: ["fields"],
    },
  });

  const validationErrors: string[] = [];
  const fields: ExtractedField[] = [];
  for (const f of result.output.fields ?? []) {
    const evidenceTexts = (f.evidenceMessageIds ?? []).map((id) => evidenceById[id] ?? "");
    const candidate: FieldCandidate = {
      key: f.key,
      value: f.value,
      status: (f.status as FieldCandidate["status"]) || "provisional",
      evidenceTexts,
      evidenceMessageIds: f.evidenceMessageIds ?? [],
    };
    const grounded = groundField(candidate);
    if (grounded.error) validationErrors.push(`${f.key}:${grounded.error}`);
    fields.push({
      key: f.key,
      value: grounded.value,
      status: grounded.status === "confirmed" ? "provisional" : grounded.status,
      evidenceMessageIds: grounded.evidenceMessageIds,
    });
  }

  return {
    fields,
    inputHash,
    validationErrors,
    aiMeta: { provider: result.provider, model: result.model, latencyMs: result.latencyMs },
  };
}

export function registerExtractStep(run: (ctx: { conversationId?: string }) => Promise<void>): void {
  registerStep({
    key: "extract_brief",
    version: EXTRACT_STEP_VERSION,
    featureFlag: "ai.extract_brief",
    onIngest: false,
    run,
  });
}
