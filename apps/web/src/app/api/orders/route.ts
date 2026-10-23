import { and, desc, eq, sql } from "drizzle-orm";
import {
  contact,
  conversation,
  featureFlag,
  orders,
  paymentRequest,
  quote,
  staffUser,
} from "@mmabon/db";
import { getDb } from "@/lib/db";
import { requireRole, assertCan, jsonError } from "@/lib/auth";
import { nextOrderRef } from "@mmabon/domain";

export async function GET(req: Request) {
  try {
    await requireRole(req);
    const db = getDb();
    const rows = await db
      .select({
        order: orders,
        contactName: contact.displayName,
        profileName: contact.profileName,
        e164: contact.e164,
        waId: contact.waId,
        ownerName: staffUser.fullName,
      })
      .from(orders)
      .leftJoin(contact, eq(orders.contactId, contact.id))
      .leftJoin(staffUser, eq(orders.ownerId, staffUser.id))
      .orderBy(desc(orders.updatedAt))
      .limit(100);

    const items = [];
    for (const row of rows) {
      const [latestQuote] = await db
        .select()
        .from(quote)
        .where(eq(quote.orderId, row.order.id))
        .orderBy(desc(quote.version))
        .limit(1);

      const paidRows = await db
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

      const [latestPay] = await db
        .select()
        .from(paymentRequest)
        .where(eq(paymentRequest.orderId, row.order.id))
        .orderBy(desc(paymentRequest.createdAt))
        .limit(1);

      const invoiceTotalKobo =
        latestQuote?.totalKobo ?? row.order.budgetKobo ?? 0;
      const paidKobo = Number(paidRows[0]?.sum ?? 0);
      const remainingKobo = Math.max(0, invoiceTotalKobo - paidKobo);
      const description =
        Array.isArray(latestQuote?.items) &&
        latestQuote.items[0] &&
        typeof latestQuote.items[0] === "object" &&
        latestQuote.items[0] !== null &&
        "label" in latestQuote.items[0]
          ? String((latestQuote.items[0] as { label?: string }).label ?? "")
          : null;

      items.push({
        id: row.order.id,
        ref: row.order.ref,
        stage: row.order.stage,
        waitingOn: row.order.waitingOn,
        riskLevel: row.order.riskLevel,
        needBy: row.order.needBy,
        eventDate: row.order.eventDate,
        budgetKobo: row.order.budgetKobo,
        conversationId: row.order.conversationId,
        contactId: row.order.contactId,
        customerName:
          row.contactName ||
          row.profileName ||
          row.e164 ||
          row.waId ||
          "Unknown",
        customerPhone: row.e164,
        ownerName: row.ownerName,
        ownerId: row.order.ownerId,
        description,
        invoiceTotalKobo,
        paidKobo,
        remainingKobo,
        paymentStatus: latestPay?.status ?? null,
        paymentKind: latestPay?.kind ?? null,
        quoteRef: latestQuote?.ref ?? null,
        quoteStatus: latestQuote?.status ?? null,
        createdAt: row.order.createdAt,
        updatedAt: row.order.updatedAt,
      });
    }

    return Response.json({ items, nextCursor: null });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(req);
    assertCan(user, "orders_edit");
    const db = getDb();
    const [flag] = await db
      .select()
      .from(featureFlag)
      .where(eq(featureFlag.key, "orders.module"))
      .limit(1);
    if (!flag?.enabled) {
      return jsonError("CONFLICT", "orders.module flag is off", 409);
    }

    const body = (await req.json()) as { conversationId: string };
    const [conv] = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, body.conversationId))
      .limit(1);
    if (!conv) return jsonError("NOT_FOUND", "Conversation not found", 404);

    const year = new Date().getFullYear();
    const count = await db.select().from(orders);
    const ref = nextOrderRef(year, count.length + 1);
    const [row] = await db
      .insert(orders)
      .values({
        ref,
        contactId: conv.contactId,
        conversationId: conv.id,
        ownerId: user.id,
        stage: "new_enquiry",
      })
      .returning();
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
