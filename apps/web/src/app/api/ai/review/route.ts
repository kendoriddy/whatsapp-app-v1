import { and, desc, eq, isNull } from "drizzle-orm";
import { contact, conversation, message } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "override_classification");
    const db = getDb();

    const rows = await db
      .select({
        message,
        conversationId: conversation.id,
        contactName: contact.displayName,
        profileName: contact.profileName,
        e164: contact.e164,
      })
      .from(message)
      .innerJoin(conversation, eq(message.conversationId, conversation.id))
      .innerJoin(contact, eq(conversation.contactId, contact.id))
      .where(
        and(
          eq(message.classificationNeedsReview, true),
          isNull(message.classificationOverride),
        ),
      )
      .orderBy(desc(message.waTimestamp))
      .limit(50);

    // Also show recent low-confidence or unclassified inbound for visibility.
    const recentUnclassified = await db
      .select({
        message,
        conversationId: conversation.id,
        contactName: contact.displayName,
        profileName: contact.profileName,
        e164: contact.e164,
      })
      .from(message)
      .innerJoin(conversation, eq(message.conversationId, conversation.id))
      .innerJoin(contact, eq(conversation.contactId, contact.id))
      .where(
        and(eq(message.direction, "inbound"), isNull(message.classification)),
      )
      .orderBy(desc(message.waTimestamp))
      .limit(20);

    const mapRow = (r: (typeof rows)[number]) => ({
      id: r.message.id,
      conversationId: r.conversationId,
      text: r.message.textBody ?? r.message.caption ?? `[${r.message.type}]`,
      type: r.message.type,
      classification: r.message.classification,
      confidence: r.message.classificationConfidence,
      needsReview: r.message.classificationNeedsReview,
      waTimestamp: r.message.waTimestamp,
      customerName: r.contactName || r.profileName || r.e164 || "Customer",
      customerPhone: r.e164,
    });

    const needsReviewIds = new Set(rows.map((r) => r.message.id));
    const extras = recentUnclassified.filter(
      (r) => !needsReviewIds.has(r.message.id),
    );

    return Response.json({
      items: rows.map(mapRow),
      unclassified: extras.map(mapRow),
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
