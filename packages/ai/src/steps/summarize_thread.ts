import type { LlmClient } from "../llm.js";

export type ThreadSummary = {
  headline: string;
  intent: string;
  keyFacts: string[];
  openQuestions: string[];
  nextAction: string;
  urgency: "low" | "medium" | "high";
};

export type ThreadMessageLine = {
  direction: "inbound" | "outbound";
  text: string;
  at?: string;
};

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    intent: { type: "string" },
    keyFacts: { type: "array", items: { type: "string" } },
    openQuestions: { type: "array", items: { type: "string" } },
    nextAction: { type: "string" },
    urgency: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: [
    "headline",
    "intent",
    "keyFacts",
    "openQuestions",
    "nextAction",
    "urgency",
  ],
} as const;

const SYSTEM = `You are an assistant for MMABON staff on a WhatsApp sales thread (custom apparel).
Summarize ONLY what appears in the conversation transcript.
Do not invent quantities, prices (₦), dates, sizes, products, or promises that are not stated.
If something is unclear, put it in openQuestions — never invent an answer.
Be concise: keyFacts max 6 short bullets; openQuestions max 4.`;

export async function summarizeThread(
  llm: LlmClient,
  args: { model: string; messages: ThreadMessageLine[] },
): Promise<{
  summary: ThreadSummary;
  model: string;
  provider: string;
  latencyMs: number;
}> {
  const transcript = args.messages
    .map((m) => {
      const who = m.direction === "inbound" ? "Customer" : "Staff";
      const when = m.at ? ` (${m.at})` : "";
      return `${who}${when}: ${m.text}`;
    })
    .join("\n");

  const result = await llm.completeJson<ThreadSummary>({
    model: args.model,
    system: SYSTEM,
    user: transcript || "(empty conversation)",
    schemaName: "thread_summary",
    schema: SUMMARY_SCHEMA as unknown as Record<string, unknown>,
  });

  const urgency = ["low", "medium", "high"].includes(result.output.urgency)
    ? result.output.urgency
    : "low";

  return {
    summary: {
      headline: String(result.output.headline ?? "").slice(0, 200),
      intent: String(result.output.intent ?? "").slice(0, 200),
      keyFacts: (result.output.keyFacts ?? []).map(String).slice(0, 6),
      openQuestions: (result.output.openQuestions ?? [])
        .map(String)
        .slice(0, 4),
      nextAction: String(result.output.nextAction ?? "").slice(0, 240),
      urgency,
    },
    model: result.model,
    provider: result.provider,
    latencyMs: result.latencyMs,
  };
}
