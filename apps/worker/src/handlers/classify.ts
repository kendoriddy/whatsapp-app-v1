import { eq } from "drizzle-orm";
import type { Db } from "@mmabon/db";
import { message, aiRun, featureFlag, conversation } from "@mmabon/db";
import { classifyMessage, CLASSIFY_PROMPT_VERSION, CLASSIFY_STEP_VERSION, createOpenAiLlmClient, createStubLlmClient } from "@mmabon/ai";
import { loadEnv } from "@mmabon/shared";

function heuristicClassify(text: string): { label: "inquiry" | "complaint" | "order" | "spam"; confidence: number; rationale: string } {
  const t = text.toLowerCase();
  if (/buy|order|polo|qty|quantity|size|logo|need by|deadline|\d+\s*(pcs|pieces|polos)/.test(t)) {
    return { label: "order", confidence: 0.85, rationale: "order keywords" };
  }
  if (/refund|complaint|delay|wrong|defect|angry|not happy/.test(t)) {
    return { label: "complaint", confidence: 0.8, rationale: "complaint keywords" };
  }
  if (/crypto|lottery|click here|nigerian prince/.test(t)) {
    return { label: "spam", confidence: 0.9, rationale: "spam keywords" };
  }
  return { label: "inquiry", confidence: 0.6, rationale: "default" };
}

export async function handleClassify(db: Db, messageId: string): Promise<void> {
  const env = loadEnv();
  const [flag] = await db.select().from(featureFlag).where(eq(featureFlag.key, "ai.classify")).limit(1);
  if (!flag?.enabled) return;

  const [msg] = await db.select().from(message).where(eq(message.id, messageId)).limit(1);
  if (!msg || msg.direction !== "inbound") return;

  const text = msg.textBody ?? msg.caption ?? "";
  const llm =
    env.APP_ENV === "local" && env.LLM_API_KEY.startsWith("sk-replace")
      ? createStubLlmClient(() => heuristicClassify(text))
      : createOpenAiLlmClient(env.LLM_API_KEY, env.LLM_BASE_URL);

  const result = await classifyMessage(llm, env.AI_CLASSIFIER_MODEL, text || "[empty]", env.AI_CLASSIFY_CONFIDENCE_REVIEW_THRESHOLD);

  const [run] = await db
    .insert(aiRun)
    .values({
      stepKey: "classify",
      stepVersion: CLASSIFY_STEP_VERSION,
      provider: result.aiMeta.provider,
      model: result.aiMeta.model,
      promptVersion: CLASSIFY_PROMPT_VERSION,
      subjectType: "message",
      subjectId: messageId,
      inputHash: result.inputHash,
      input: { text },
      output: result.output,
      valid: result.valid,
      validationErrors: result.validationErrors,
      latencyMs: result.aiMeta.latencyMs,
      tokensIn: result.aiMeta.tokensIn,
      tokensOut: result.aiMeta.tokensOut,
    })
    .returning();

  await db
    .update(message)
    .set({
      classification: result.output.label,
      classificationConfidence: String(result.output.confidence),
      classificationModel: `${result.aiMeta.provider}:${result.aiMeta.model}`,
      classificationPromptVersion: CLASSIFY_PROMPT_VERSION,
      classificationAiRunId: run!.id,
      classifiedAt: new Date(),
      classificationNeedsReview: result.needsReview,
    })
    .where(eq(message.id, messageId));

  await db
    .update(conversation)
    .set({ lastInboundClass: result.output.label })
    .where(eq(conversation.id, msg.conversationId));
}
