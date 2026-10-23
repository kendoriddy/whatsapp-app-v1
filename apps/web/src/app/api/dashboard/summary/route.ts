import { and, count, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import {
  conversation,
  message,
  orders,
  outboundMessage,
  paymentRequest,
  quote,
} from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, assertCan, jsonError } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "dashboard");
    const db = getDb();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [openConv] = await db
      .select({ c: count() })
      .from(conversation)
      .where(eq(conversation.status, "open"));
    const [inbound] = await db
      .select({ c: count() })
      .from(message)
      .where(
        and(eq(message.direction, "inbound"), gte(message.receivedAt, weekAgo)),
      );
    const [pending] = await db
      .select({ c: count() })
      .from(outboundMessage)
      .where(eq(outboundMessage.status, "pending_approval"));
    const [needsReview] = await db
      .select({ c: count() })
      .from(message)
      .where(
        and(
          eq(message.classificationNeedsReview, true),
          isNull(message.classificationOverride),
        ),
      );
    const [ordersOpen] = await db
      .select({ c: count() })
      .from(orders)
      .where(and(ne(orders.stage, "fulfilled"), ne(orders.stage, "lost")));
    const [paid7d] = await db
      .select({
        c: count(),
        sum: sql<number>`coalesce(sum(${paymentRequest.amountKobo}), 0)`,
      })
      .from(paymentRequest)
      .where(
        and(
          eq(paymentRequest.status, "paid"),
          gte(paymentRequest.paidAt, weekAgo),
        ),
      );

    const stageRows = await db
      .select({ stage: orders.stage, c: count() })
      .from(orders)
      .groupBy(orders.stage);

    const recentMessages = await db
      .select({
        id: message.id,
        conversationId: message.conversationId,
        direction: message.direction,
        textBody: message.textBody,
        caption: message.caption,
        type: message.type,
        classification: message.classification,
        waTimestamp: message.waTimestamp,
      })
      .from(message)
      .orderBy(desc(message.waTimestamp))
      .limit(8);

    const recentPayments = await db
      .select({
        id: paymentRequest.id,
        amountKobo: paymentRequest.amountKobo,
        status: paymentRequest.status,
        kind: paymentRequest.kind,
        reference: paymentRequest.paystackReference,
        paidAt: paymentRequest.paidAt,
        orderId: paymentRequest.orderId,
      })
      .from(paymentRequest)
      .orderBy(desc(paymentRequest.createdAt))
      .limit(6);

    const recentOrders = await db
      .select({
        id: orders.id,
        ref: orders.ref,
        stage: orders.stage,
        budgetKobo: orders.budgetKobo,
        updatedAt: orders.updatedAt,
        conversationId: orders.conversationId,
      })
      .from(orders)
      .orderBy(desc(orders.updatedAt))
      .limit(6);

    const activeOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(ne(orders.stage, "fulfilled"), ne(orders.stage, "lost")))
      .limit(200);

    let outstandingKobo = 0;
    for (const o of activeOrders) {
      const [lq] = await db
        .select({ totalKobo: quote.totalKobo })
        .from(quote)
        .where(eq(quote.orderId, o.id))
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
            eq(paymentRequest.orderId, o.id),
            eq(paymentRequest.status, "paid"),
          ),
        );
      outstandingKobo += Math.max(0, lq.totalKobo - Number(paid?.sum ?? 0));
    }

    return Response.json({
      open_conversations: Number(openConv?.c ?? 0),
      inbound_7d: Number(inbound?.c ?? 0),
      pending_approvals: Number(pending?.c ?? 0),
      classification_needs_review: Number(needsReview?.c ?? 0),
      open_orders: Number(ordersOpen?.c ?? 0),
      payments_7d_count: Number(paid7d?.c ?? 0),
      payments_7d_kobo: Number(paid7d?.sum ?? 0),
      outstanding_kobo: outstandingKobo,
      orders_by_stage: Object.fromEntries(
        stageRows.map((r) => [r.stage, Number(r.c)]),
      ),
      recent_messages: recentMessages,
      recent_payments: recentPayments,
      recent_orders: recentOrders,
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
