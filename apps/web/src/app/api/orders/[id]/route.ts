import { and, desc, eq, sql } from "drizzle-orm";
import {
  changeEvent,
  contact,
  orders,
  paymentRequest,
  quote,
  staffUser,
} from "@mmabon/db";
import { getDb } from "@/lib/db";
import { assertCan, jsonError, requireRole } from "@/lib/auth";

function parseDateInput(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const s = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  if (!Number.isFinite(Date.parse(`${s}T12:00:00Z`))) return undefined;
  return s;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(req);
    const { id } = await ctx.params;
    const db = getDb();

    const [row] = await db
      .select({
        order: orders,
        contactName: contact.displayName,
        profileName: contact.profileName,
        e164: contact.e164,
        waId: contact.waId,
        email: contact.email,
        ownerName: staffUser.fullName,
      })
      .from(orders)
      .leftJoin(contact, eq(orders.contactId, contact.id))
      .leftJoin(staffUser, eq(orders.ownerId, staffUser.id))
      .where(eq(orders.id, id))
      .limit(1);

    if (!row) return jsonError("NOT_FOUND", "Order not found", 404);

    const quotes = await db
      .select()
      .from(quote)
      .where(eq(quote.orderId, id))
      .orderBy(desc(quote.version));

    const payments = await db
      .select()
      .from(paymentRequest)
      .where(eq(paymentRequest.orderId, id))
      .orderBy(desc(paymentRequest.createdAt));

    const changes = await db
      .select()
      .from(changeEvent)
      .where(eq(changeEvent.orderId, id))
      .orderBy(desc(changeEvent.at))
      .limit(30);

    const paidRows = await db
      .select({
        sum: sql<number>`coalesce(sum(${paymentRequest.amountKobo}), 0)`,
      })
      .from(paymentRequest)
      .where(
        and(eq(paymentRequest.orderId, id), eq(paymentRequest.status, "paid")),
      );

    const latestQuote = quotes[0] ?? null;
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

    return Response.json({
      order: row.order,
      customer: {
        name:
          row.contactName ||
          row.profileName ||
          row.e164 ||
          row.waId ||
          "Unknown",
        phone: row.e164,
        waId: row.waId,
        email: row.email,
      },
      ownerName: row.ownerName,
      description,
      invoiceTotalKobo,
      paidKobo,
      remainingKobo,
      quotes,
      payments,
      changes,
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(req);
    assertCan(user, "orders_edit");
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      need_by?: string | null;
      event_date?: string | null;
    };

    const needBy = parseDateInput(body.need_by);
    const eventDate = parseDateInput(body.event_date);
    if (body.need_by !== undefined && needBy === undefined) {
      return jsonError(
        "VALIDATION",
        "need_by must be YYYY-MM-DD or empty",
        400,
      );
    }
    if (body.event_date !== undefined && eventDate === undefined) {
      return jsonError(
        "VALIDATION",
        "event_date must be YYYY-MM-DD or empty",
        400,
      );
    }

    const patch: {
      needBy?: string | null;
      eventDate?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.need_by !== undefined) patch.needBy = needBy ?? null;
    if (body.event_date !== undefined) patch.eventDate = eventDate ?? null;

    const db = getDb();
    const [before] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    if (!before) return jsonError("NOT_FOUND", "Order not found", 404);

    const [updated] = await db
      .update(orders)
      .set(patch)
      .where(eq(orders.id, id))
      .returning();

    await db.insert(changeEvent).values({
      orderId: id,
      actorKind: "staff",
      actorId: user.id,
      kind: "field_change",
      target: "dates",
      before: { needBy: before.needBy, eventDate: before.eventDate },
      after: {
        needBy: updated!.needBy,
        eventDate: updated!.eventDate,
      },
      reason: "staff.dates_update",
    });

    return Response.json(updated);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(
      String((e as Error).message),
      (e as Error).message,
      status,
    );
  }
}
