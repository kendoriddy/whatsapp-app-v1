import { asc, eq } from "drizzle-orm";
import { message } from "@mmabon/db";
import { createGatewayLlmClient, summarizeThread } from "@mmabon/ai";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { requireRole, jsonError } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(req);
    const { id } = await ctx.params;
    const env = getEnv();
    const db = getDb();

    const rows = await db
      .select({
        direction: message.direction,
        textBody: message.textBody,
        caption: message.caption,
        type: message.type,
        waTimestamp: message.waTimestamp,
      })
      .from(message)
      .where(eq(message.conversationId, id))
      .orderBy(asc(message.waTimestamp))
      .limit(120);

    const lines = rows
      .map((r) => {
        const text = (r.textBody ?? r.caption ?? `[${r.type}]`).trim();
        if (!text) return null;
        return {
          direction: r.direction as "inbound" | "outbound",
          text,
          at: r.waTimestamp?.toISOString(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const llm = createGatewayLlmClient({
      primary: env.AI_PRIMARY_PROVIDER,
      cencoriApiKey: env.CENCORI_API_KEY,
      llmApiKey: env.LLM_API_KEY,
      llmBaseUrl: env.LLM_BASE_URL,
      geminiApiKey: env.GEMINI_API_KEY,
      openaiFallbackModel: env.AI_OPENAI_FALLBACK_MODEL,
      geminiFallbackModel: env.AI_GEMINI_FALLBACK_MODEL,
    });

    const model = env.AI_SUMMARY_MODEL || env.AI_CLASSIFIER_MODEL || "auto";
    const result = await summarizeThread(llm, { model, messages: lines });

    return Response.json({
      conversationId: id,
      messageCount: lines.length,
      ...result,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
