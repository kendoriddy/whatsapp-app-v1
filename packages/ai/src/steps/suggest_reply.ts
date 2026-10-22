import { suggestionContainsUngroundedPrice } from "../validators/grounding.js";
import type { LlmClient } from "../llm.js";
import { hashInput } from "../llm.js";
import { registerStep } from "../pipeline.js";

export const SUGGEST_PROMPT_VERSION = "suggest-v1.0.0";
export const SUGGEST_STEP_VERSION = "1.0.0";

export async function suggestReply(
  llm: LlmClient,
  model: string,
  conversationText: string,
  allowedAmounts: string[],
): Promise<{ text: string | null; rejected: boolean; inputHash: string; aiMeta: { provider: string; model: string; latencyMs: number } }> {
  const inputHash = hashInput({ conversationText });
  const result = await llm.completeJson<{ reply: string }>({
    model,
    system:
      "Draft a short staff reply for MMABON. Do not invent prices, dates, quantities, or product attributes not present in the conversation or approved quote.",
    user: conversationText,
    schemaName: "suggest_reply",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { reply: { type: "string" } },
      required: ["reply"],
    },
  });
  const text = result.output.reply ?? "";
  if (suggestionContainsUngroundedPrice(text, allowedAmounts)) {
    return { text: null, rejected: true, inputHash, aiMeta: result };
  }
  return { text, rejected: false, inputHash, aiMeta: result };
}

export function registerSuggestStep(run: (ctx: { conversationId?: string }) => Promise<void>): void {
  registerStep({
    key: "suggest_reply",
    version: SUGGEST_STEP_VERSION,
    featureFlag: "ai.suggest_reply",
    onIngest: false,
    run,
  });
}
