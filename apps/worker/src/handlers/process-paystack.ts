import { and, eq } from "drizzle-orm";
import type { Db } from "@mmabon/db";
import {
  webhookEvent,
  paymentRequest,
  orders,
  quote,
  changeEvent,
} from "@mmabon/db";
import { createPaystackClient } from "@mmabon/paystack";
import { loadEnv } from "@mmabon/shared";

type PaystackWebhookBody = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    channel?: string;
    fees?: number;
    paid_at?: string;
  };
};

export async function processPaystackEvent(
  db: Db,
  webhookEventId: number,
): Promise<void> {
  const [evt] = await db
    .select()
    .from(webhookEvent)
    .where(eq(webhookEvent.id, webhookEventId))
    .limit(1);
  if (!evt) return;
  if (evt.processedAt) return;

  try {
    const body = evt.body as PaystackWebhookBody;
    if (body.event !== "charge.success") {
      await db
        .update(webhookEvent)
        .set({ processedAt: new Date(), processError: null })
        .where(eq(webhookEvent.id, webhookEventId));
      return;
    }

    const reference = body.data?.reference;
    if (!reference) throw new Error("Missing paystack reference");

    const env = loadEnv();
    const client = createPaystackClient(env.PAYSTACK_SECRET_KEY);
    const verified = await client.verifyTransaction(reference);
    const data = verified.data;
    if (!verified.status || !data || data.status !== "success") {
      throw new Error(`Paystack verify failed for ${reference}`);
    }

    const [pay] = await db
      .select()
      .from(paymentRequest)
      .where(eq(paymentRequest.paystackReference, reference))
      .limit(1);
    if (!pay) throw new Error(`Unknown payment reference ${reference}`);

    if (pay.status === "paid") {
      await db
        .update(webhookEvent)
        .set({ processedAt: new Date(), processError: null })
        .where(eq(webhookEvent.id, webhookEventId));
      return;
    }

    if (data.amount !== pay.amountKobo) {
      await db
        .update(paymentRequest)
        .set({
          status: "amount_mismatch",
          rawVerify: data,
          verifiedAt: new Date(),
        })
        .where(eq(paymentRequest.id, pay.id));
      await db
        .update(webhookEvent)
        .set({
          processedAt: new Date(),
          processError: `Amount mismatch: expected ${pay.amountKobo}, got ${data.amount}`,
        })
        .where(eq(webhookEvent.id, webhookEventId));
      return;
    }

    await db
      .update(paymentRequest)
      .set({
        status: "paid",
        paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
        channel: data.channel ?? null,
        feesKobo: data.fees ?? null,
        verifiedAt: new Date(),
        rawVerify: data,
      })
      .where(eq(paymentRequest.id, pay.id));

    await db
      .update(orders)
      .set({ stage: "paid", updatedAt: new Date() })
      .where(eq(orders.id, pay.orderId));

    await db
      .update(quote)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(and(eq(quote.id, pay.quoteId), eq(quote.status, "sent")));

    await db.insert(changeEvent).values({
      orderId: pay.orderId,
      actorKind: "system",
      kind: "payment",
      target: "payment_request",
      before: { status: pay.status },
      after: { status: "paid", paymentId: pay.id, reference, stage: "paid" },
      reason: "paystack.charge.success",
    });

    await db
      .update(webhookEvent)
      .set({ processedAt: new Date(), processError: null })
      .where(eq(webhookEvent.id, webhookEventId));
  } catch (e) {
    await db
      .update(webhookEvent)
      .set({ processError: String(e) })
      .where(eq(webhookEvent.id, webhookEventId));
    throw e;
  }
}
