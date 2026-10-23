import { and, eq, sql } from "drizzle-orm";
import { orders, paymentRequest, quote } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { jsonError } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public receipt lookup for Paystack callback redirect (?reference=…). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const reference =
      url.searchParams.get("reference")?.trim() ||
      url.searchParams.get("trxref")?.trim();
    if (!reference) {
      return jsonError("VALIDATION", "reference required", 400);
    }

    const db = getDb();
    const [pay] = await db
      .select()
      .from(paymentRequest)
      .where(eq(paymentRequest.paystackReference, reference))
      .limit(1);
    if (!pay) return jsonError("NOT_FOUND", "Payment not found", 404);

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, pay.orderId))
      .limit(1);
    const [q] = await db
      .select()
      .from(quote)
      .where(eq(quote.id, pay.quoteId))
      .limit(1);

    const paidSumRows = await db
      .select({
        sum: sql<number>`coalesce(sum(${paymentRequest.amountKobo}), 0)`,
      })
      .from(paymentRequest)
      .where(
        and(
          eq(paymentRequest.quoteId, pay.quoteId),
          eq(paymentRequest.status, "paid"),
        ),
      );
    const paidTotalKobo = Number(paidSumRows[0]?.sum ?? 0);
    const invoiceTotalKobo = q?.totalKobo ?? pay.amountKobo;

    // If webhook hasn't marked paid yet, include this charge in the remaining calc.
    const remainingDisplay =
      pay.status === "paid"
        ? Math.max(0, invoiceTotalKobo - paidTotalKobo)
        : Math.max(0, invoiceTotalKobo - paidTotalKobo - pay.amountKobo);

    const description =
      Array.isArray(q?.items) &&
      q.items[0] &&
      typeof q.items[0] === "object" &&
      q.items[0] !== null &&
      "label" in q.items[0]
        ? String((q.items[0] as { label?: string }).label ?? "")
        : null;

    return Response.json({
      reference: pay.paystackReference,
      status: pay.status,
      kind: pay.kind,
      order_ref: order?.ref ?? null,
      quote_ref: q?.ref ?? null,
      description,
      paid_kobo: pay.amountKobo,
      invoice_total_kobo: invoiceTotalKobo,
      remaining_kobo: remainingDisplay,
      paid_at: pay.paidAt,
      channel: pay.channel,
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
