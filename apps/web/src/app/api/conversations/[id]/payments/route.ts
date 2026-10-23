import { desc, eq } from "drizzle-orm";
import { orders, paymentRequest, quote } from "@mmabon/db";
import { getDb } from "@/lib/db";
import { jsonError, requireRole } from "@/lib/auth";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(req);
    const { id: conversationId } = await ctx.params;
    const db = getDb();

    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.conversationId, conversationId))
      .orderBy(desc(orders.createdAt))
      .limit(10);

    const items = [];
    for (const order of orderRows) {
      const quotes = await db
        .select()
        .from(quote)
        .where(eq(quote.orderId, order.id))
        .orderBy(desc(quote.version));
      const payments = await db
        .select()
        .from(paymentRequest)
        .where(eq(paymentRequest.orderId, order.id))
        .orderBy(desc(paymentRequest.createdAt));
      items.push({ order, quotes, payments });
    }

    return Response.json({ items });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(String((e as Error).message), (e as Error).message, status);
  }
}
