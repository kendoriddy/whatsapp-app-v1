import { eq } from "drizzle-orm";
import { conversation } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { jsonError, requireRole } from "@/lib/auth";

/** Spec: POST /api/conversations/:id/read — reset unread_count. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(req);
    const { id } = await ctx.params;
    const db = getDb();

    const [row] = await db
      .update(conversation)
      .set({ unreadCount: 0, updatedAt: new Date() })
      .where(eq(conversation.id, id))
      .returning({
        id: conversation.id,
        unreadCount: conversation.unreadCount,
      });

    if (!row) return jsonError("NOT_FOUND", "Conversation not found", 404);
    return Response.json(row);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
