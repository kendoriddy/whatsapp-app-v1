import type { LlmClient } from "../llm.js";
import { hashInput } from "../llm.js";

export const MERLIN_REPLY_PROMPT_VERSION = "merlin-reply-v1.0.0";
export const MERLIN_REPLY_STEP_VERSION = "1.0.0";

export type MerlinReplyResult = {
  reply: string | null;
  shouldReply: boolean;
  reason: string;
  inputHash: string;
  aiMeta: { provider: string; model: string; latencyMs: number };
};

/**
 * Draft a customer-facing WhatsApp reply grounded in the knowledge bank + thread.
 * When the bank has no answer, Merlin may still greet / ask a clarifying question
 * unless requireKnowledge is true.
 */
export async function merlinAutoReply(
  llm: LlmClient,
  args: {
    model: string;
    conversationText: string;
    knowledgeMarkdown: string;
    maxChars?: number;
    requireKnowledge?: boolean;
  },
): Promise<MerlinReplyResult> {
  const maxChars = args.maxChars ?? 900;
  const requireKnowledge = args.requireKnowledge ?? false;
  const hasKnowledge = args.knowledgeMarkdown.trim().length > 0;
  const inputHash = hashInput({
    conversationText: args.conversationText,
    knowledge: args.knowledgeMarkdown.slice(0, 4000),
  });

  if (requireKnowledge && !hasKnowledge) {
    return {
      reply: null,
      shouldReply: false,
      reason: "no_knowledge",
      inputHash,
      aiMeta: { provider: "none", model: args.model, latencyMs: 0 },
    };
  }

  const result = await llm.completeJson<{
    should_reply: boolean;
    reply: string | null;
    reason: string;
  }>({
    model: args.model,
    system: [
      "You are Merlin, the MMABON WhatsApp order-desk assistant.",
      "Reply as staff would on WhatsApp: warm, concise, Nigerian English OK.",
      "Use ONLY facts from the knowledge bank and the conversation.",
      "Do NOT invent prices, lead times, product specs, or policies.",
      "If the customer asks for a price/quote not in the knowledge bank, say a teammate will confirm — do not guess ₦ amounts.",
      "Do not send payment links.",
      `Keep reply under ${maxChars} characters.`,
      "Set should_reply=false for spam, abuse, or when a human must handle (complex complaints, refunds, legal).",
      requireKnowledge
        ? "If the knowledge bank does not cover the question, should_reply=false."
        : "If knowledge is thin, you may still ask one clarifying question or acknowledge.",
    ].join(" "),
    user: [
      "## Knowledge bank",
      hasKnowledge ? args.knowledgeMarkdown : "(empty — no docs uploaded yet)",
      "",
      "## Conversation (oldest → newest)",
      args.conversationText || "(empty)",
    ].join("\n"),
    schemaName: "merlin_auto_reply",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        should_reply: { type: "boolean" },
        reply: { type: ["string", "null"] },
        reason: { type: "string" },
      },
      required: ["should_reply", "reply", "reason"],
    },
  });

  let reply = result.output.reply?.trim() || null;
  if (reply && reply.length > maxChars) {
    reply = reply.slice(0, maxChars - 1).trimEnd() + "…";
  }

  const shouldReply = Boolean(result.output.should_reply && reply);

  return {
    reply: shouldReply ? reply : null,
    shouldReply,
    reason: result.output.reason || (shouldReply ? "ok" : "declined"),
    inputHash,
    aiMeta: {
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
    },
  };
}
