import { desc, eq } from "drizzle-orm";
import { contact, conversation, outboundMessage, staffUser } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "send_approve");
    const db = getDb();
    const rows = await db
      .select({
        outbound: outboundMessage,
        conversationId: conversation.id,
        contactName: contact.displayName,
        profileName: contact.profileName,
        e164: contact.e164,
        createdByName: staffUser.fullName,
      })
      .from(outboundMessage)
      .innerJoin(
        conversation,
        eq(outboundMessage.conversationId, conversation.id),
      )
      .innerJoin(contact, eq(conversation.contactId, contact.id))
      .leftJoin(staffUser, eq(outboundMessage.createdBy, staffUser.id))
      .where(eq(outboundMessage.status, "pending_approval"))
      .orderBy(desc(outboundMessage.createdAt))
      .limit(50);

    return Response.json({
      items: rows.map((r) => ({
        id: r.outbound.id,
        conversationId: r.conversationId,
        kind: r.outbound.kind,
        bodyText: r.outbound.bodyText,
        origin: r.outbound.origin,
        status: r.outbound.status,
        createdAt: r.outbound.createdAt,
        createdByName: r.createdByName,
        customerName: r.contactName || r.profileName || r.e164 || "Customer",
        customerPhone: r.e164,
      })),
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
