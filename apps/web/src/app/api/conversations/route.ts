import { desc, eq } from "drizzle-orm";
import { conversation, contact } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, jsonError } from "@/lib/auth";
import { windowExpiresAt } from "@mmabon/shared";

export async function GET(req: Request) {
  try {
    await requireRole(req);
    const db = getDb();
    const rows = await db
      .select({
        conversation,
        contact,
      })
      .from(conversation)
      .innerJoin(contact, eq(conversation.contactId, contact.id))
      .orderBy(desc(conversation.lastMessageAt))
      .limit(50);

    return Response.json({
      items: rows.map((r) => ({
        ...r.conversation,
        contact: r.contact,
        window_expires_at: windowExpiresAt(r.conversation.lastInboundAt),
      })),
      nextCursor: null,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
