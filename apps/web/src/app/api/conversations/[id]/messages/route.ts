import { asc, eq } from "drizzle-orm";
import { message } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, jsonError } from "@/lib/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req);
    const { id } = await ctx.params;
    const db = getDb();
    const items = await db
      .select()
      .from(message)
      .where(eq(message.conversationId, id))
      .orderBy(asc(message.waTimestamp))
      .limit(200);
    return Response.json({ items, nextCursor: null });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
