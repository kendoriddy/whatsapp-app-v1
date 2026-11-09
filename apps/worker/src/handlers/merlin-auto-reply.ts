import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@mmabon/db";
import {
  aiRun,
  automationSetting,
  conversation,
  featureFlag,
  message,
  outboundMessage,
} from "@mmabon/db";
import {
  createGatewayLlmClient,
  merlinAutoReply,
  MERLIN_REPLY_PROMPT_VERSION,
  MERLIN_REPLY_STEP_VERSION,
} from "@mmabon/ai";
import { isWindowOpen, loadEnv } from "@mmabon/shared";
import { handleSendOutbound } from "./send-outbound.js";
import {
  KNOWLEDGE_BUDGET,
  retrieveKnowledgeMarkdown,
} from "../lib/retrieve-knowledge.js";
import { shouldAttemptMerlinReply } from "../lib/merlin-gate.js";

const AUTOMATION_KEY = "auto_send.merlin_replies";

type MerlinConfig = {
  skip_spam?: boolean;
  max_chars?: number;
  require_knowledge?: boolean;
};

/**
 * After an inbound message is classified, optionally let Merlin answer on
 * behalf of the business when AS:auto_send.merlin_replies is enabled (R-2).
 */
export async function handleMerlinAutoReply(
  db: Db,
  messageId: string,
): Promise<void> {
  const env = loadEnv();

  const [auto] = await db
    .select()
    .from(automationSetting)
    .where(eq(automationSetting.key, AUTOMATION_KEY))
    .limit(1);
  // Soft companion flag (kept in sync by Settings UI).
  const [flag] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.key, "ai.merlin_auto_reply"))
    .limit(1);

  const [msg] = await db
    .select()
    .from(message)
    .where(eq(message.id, messageId))
    .limit(1);
  if (!msg) return;

  const config = (auto?.config ?? {}) as MerlinConfig;

  const [conv] = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, msg.conversationId))
    .limit(1);
  if (!conv) return;

  const windowOpen = isWindowOpen(
    conv.lastInboundAt,
    new Date(),
    env.WINDOW_SAFETY_MARGIN_SECONDS,
  );

  if (
    !shouldAttemptMerlinReply({
      autoEnabled: Boolean(auto?.enabled),
      featureFlagEnabled: flag?.enabled,
      direction: msg.direction,
      classification: msg.classification,
      skipSpam: config.skip_spam !== false,
      windowOpen,
    })
  ) {
    return;
  }

  // Avoid double-replies: if Merlin already auto-sent after this inbound, skip.
  const recentOut = await db
    .select({ id: outboundMessage.id, createdAt: outboundMessage.createdAt })
    .from(outboundMessage)
    .where(
      and(
        eq(outboundMessage.conversationId, conv.id),
        eq(outboundMessage.origin, "ai_suggestion"),
        eq(outboundMessage.automationSettingKey, AUTOMATION_KEY),
      ),
    )
    .orderBy(desc(outboundMessage.createdAt))
    .limit(1);
  if (
    recentOut[0] &&
    recentOut[0].createdAt.getTime() >= msg.waTimestamp.getTime() - 1000
  ) {
    return;
  }

  const customerText = (msg.textBody ?? msg.caption ?? "").trim();
  const retrieved = await retrieveKnowledgeMarkdown(db, {
    query: customerText,
    budget: KNOWLEDGE_BUDGET,
  });

  const history = await db
    .select({
      direction: message.direction,
      textBody: message.textBody,
      caption: message.caption,
      type: message.type,
      waTimestamp: message.waTimestamp,
    })
    .from(message)
    .where(eq(message.conversationId, conv.id))
    .orderBy(asc(message.waTimestamp))
    .limit(40);

  const conversationText = history
    .map((m) => {
      const who = m.direction === "inbound" ? "Customer" : "Staff";
      const text = (m.textBody ?? m.caption ?? `[${m.type}]`).trim();
      return `${who}: ${text}`;
    })
    .filter((line) => !line.endsWith(": "))
    .join("\n");

  const llm = createGatewayLlmClient({
    primary: env.AI_PRIMARY_PROVIDER,
    cencoriApiKey: env.CENCORI_API_KEY,
    llmApiKey: env.LLM_API_KEY,
    llmBaseUrl: env.LLM_BASE_URL,
    geminiApiKey: env.GEMINI_API_KEY,
    openaiFallbackModel: env.AI_OPENAI_FALLBACK_MODEL,
    geminiFallbackModel: env.AI_GEMINI_FALLBACK_MODEL,
  });

  const model = env.AI_SUGGEST_MODEL || env.AI_SUMMARY_MODEL || "auto";
  const requireKnowledge = config.require_knowledge ?? true;
  const result = await merlinAutoReply(llm, {
    model,
    conversationText,
    knowledgeMarkdown: retrieved.markdown,
    maxChars: config.max_chars ?? 900,
    requireKnowledge,
  });

  await db.insert(aiRun).values({
    stepKey: "merlin_auto_reply",
    stepVersion: MERLIN_REPLY_STEP_VERSION,
    provider: result.aiMeta.provider,
    model: result.aiMeta.model,
    promptVersion: MERLIN_REPLY_PROMPT_VERSION,
    subjectType: "message",
    subjectId: messageId,
    inputHash: result.inputHash,
    input: {
      conversationId: conv.id,
      knowledgeChars: retrieved.markdown.length,
      knowledgeMode: retrieved.mode,
      requireKnowledge,
    },
    output: {
      shouldReply: result.shouldReply,
      reason: result.reason,
      reply: result.reply,
    },
    valid: true,
    validationErrors: [],
    latencyMs: result.aiMeta.latencyMs,
  });

  if (!result.shouldReply || !result.reply) return;

  let outboundId: string | null = null;
  try {
    const [outbound] = await db
      .insert(outboundMessage)
      .values({
        conversationId: conv.id,
        kind: "text",
        bodyText: result.reply,
        origin: "ai_suggestion",
        status: "approved",
        autoSent: true,
        automationSettingKey: AUTOMATION_KEY,
        idempotencyKey: `merlin-${messageId}`,
      })
      .returning();
    outboundId = outbound?.id ?? null;
  } catch (err) {
    // Duplicate idempotency key → already replied for this inbound.
    console.warn("[merlin] outbound insert skipped", err);
    return;
  }

  if (!outboundId) return;

  try {
    await handleSendOutbound(db, outboundId);
  } catch (err) {
    console.error("[merlin] auto-reply send failed", err);
  }
}
