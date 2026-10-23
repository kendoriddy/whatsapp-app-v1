import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import {
  contact,
  conversation,
  followup,
  orders,
  paymentRequest,
  quote,
} from "@mmabon/db";
import { getDb } from "@/lib/db";
import { jsonError, requireRole } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireRole(req);
    const db = getDb();

    const open = await db
      .select({
        followup,
        orderRef: orders.ref,
        contactName: contact.displayName,
        profileName: contact.profileName,
        e164: contact.e164,
      })
      .from(followup)
      .innerJoin(conversation, eq(followup.conversationId, conversation.id))
      .innerJoin(contact, eq(conversation.contactId, contact.id))
      .leftJoin(orders, eq(followup.orderId, orders.id))
      .where(eq(followup.status, "open"))
      .orderBy(asc(followup.dueAt))
      .limit(50);

    const activeOrders = await db
      .select({
        order: orders,
        contactName: contact.displayName,
        profileName: contact.profileName,
        e164: contact.e164,
      })
      .from(orders)
      .innerJoin(contact, eq(orders.contactId, contact.id))
      .where(and(ne(orders.stage, "lost"), ne(orders.stage, "fulfilled")))
      .orderBy(desc(orders.updatedAt))
      .limit(40);

    const suggestions = [];
    for (const row of activeOrders) {
      const [lq] = await db
        .select()
        .from(quote)
        .where(eq(quote.orderId, row.order.id))
        .orderBy(desc(quote.version))
        .limit(1);
      if (!lq) continue;
      const [paid] = await db
        .select({
          sum: sql<number>`coalesce(sum(${paymentRequest.amountKobo}), 0)`,
        })
        .from(paymentRequest)
        .where(
          and(
            eq(paymentRequest.orderId, row.order.id),
            eq(paymentRequest.status, "paid"),
          ),
        );
      const paidKobo = Number(paid?.sum ?? 0);
      const remaining = Math.max(0, lq.totalKobo - paidKobo);
      if (remaining <= 0 || paidKobo <= 0) continue;
      suggestions.push({
        id: `suggest-balance-${row.order.id}`,
        kind: "suggestion" as const,
        reason: "balance_due",
        status: "suggested",
        dueAt: null,
        orderId: row.order.id,
        orderRef: row.order.ref,
        conversationId: row.order.conversationId,
        customerName:
          row.contactName || row.profileName || row.e164 || "Customer",
        customerPhone: row.e164,
        remainingKobo: remaining,
        paidKobo,
        invoiceTotalKobo: lq.totalKobo,
      });
    }

    return Response.json({
      items: open.map((r) => ({
        id: r.followup.id,
        kind: "followup" as const,
        reason: r.followup.reason,
        status: r.followup.status,
        dueAt: r.followup.dueAt,
        orderId: r.followup.orderId,
        orderRef: r.orderRef,
        conversationId: r.followup.conversationId,
        customerName: r.contactName || r.profileName || r.e164 || "Customer",
        customerPhone: r.e164,
        remainingKobo: null as number | null,
        paidKobo: null as number | null,
        invoiceTotalKobo: null as number | null,
      })),
      suggestions,
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
