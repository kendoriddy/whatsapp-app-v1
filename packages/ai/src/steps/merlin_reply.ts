import type { LlmClient } from "../llm.js";
import { hashInput } from "../llm.js";

export const MERLIN_REPLY_PROMPT_VERSION = "merlin-reply-v1.1.0";
export const MERLIN_REPLY_STEP_VERSION = "1.1.0";

export type MerlinReplyResult = {
  reply: string | null;
  shouldReply: boolean;
  reason: string;
  inputHash: string;
  aiMeta: { provider: string; model: string; latencyMs: number };
};

/**
 * Draft a customer-facing WhatsApp reply grounded in the knowledge bank + thread.
 * Answers like a staff member when the bank covers the question.
 * Stays silent when a human decision is required (unless it is a bare greeting).
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
  const requireKnowledge = args.requireKnowledge ?? true;
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
      "You are Merlin, answering WhatsApp customers on behalf of this business — like a staff member would.",
      "Voice: warm, concise, Nigerian English OK. Sign off as the business desk, not as an AI.",
      "Use ONLY facts from the knowledge bank and the conversation. Never invent prices, lead times, product specs, policies, or payment details.",
      "Do not send payment links or ask for card details.",
      `Keep reply under ${maxChars} characters.`,
      "Answer when the knowledge bank covers it: hours, products, how to order, delivery policy, published prices that appear in the bank.",
      "A bare greeting (hi/hello/good morning) may get a short acknowledgement even if no chunk matched.",
      "Set should_reply=false (and reply=null) for: spam/abuse; complaints; refunds; legal; custom quotes or prices not in the bank; order changes that need a person; anything that needs a decision a staff member must make.",
      "When should_reply=false, do not apologise at length — leave the chat for a human.",
      requireKnowledge
        ? "If the knowledge bank does not cover a factual business question, should_reply=false."
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
