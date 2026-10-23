import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@mmabon/db";
import {
  webhookEvent,
  paymentRequest,
  orders,
  quote,
  changeEvent,
  conversation,
  contact,
  outboundMessage,
} from "@mmabon/db";
import { createPaystackClient } from "@mmabon/paystack";
import { isWindowOpen, loadEnv } from "@mmabon/shared";
import { handleSendOutbound } from "./send-outbound.js";

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

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

    // Deposit or full → paid (Q-7). Balance that completes also → paid.
    await db
      .update(orders)
      .set({ stage: "paid", updatedAt: new Date() })
      .where(eq(orders.id, pay.orderId));

    await db
      .update(quote)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(and(eq(quote.id, pay.quoteId), eq(quote.status, "sent")));

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
    const remainingKobo = Math.max(0, invoiceTotalKobo - paidTotalKobo);

    await db.insert(changeEvent).values({
      orderId: pay.orderId,
      actorKind: "system",
      kind: "payment",
      target: "payment_request",
      before: { status: pay.status },
      after: {
        status: "paid",
        paymentId: pay.id,
        reference,
        stage: "paid",
        kind: pay.kind,
        paid_kobo: pay.amountKobo,
        invoice_total_kobo: invoiceTotalKobo,
        remaining_kobo: remainingKobo,
      },
      reason: "paystack.charge.success",
    });

    await sendPaymentReceipt(db, {
      orderId: pay.orderId,
      paymentId: pay.id,
      reference,
      kind: pay.kind,
      paidKobo: pay.amountKobo,
      invoiceTotalKobo,
      remainingKobo,
      quoteRef: q?.ref ?? null,
      windowMarginSeconds: env.WINDOW_SAFETY_MARGIN_SECONDS,
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

async function sendPaymentReceipt(
  db: Db,
  args: {
    orderId: string;
    paymentId: string;
    reference: string;
    kind: string;
    paidKobo: number;
    invoiceTotalKobo: number;
    remainingKobo: number;
    quoteRef: string | null;
    windowMarginSeconds: number;
  },
): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, args.orderId))
    .limit(1);
  if (!order) return;

  const [conv] = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, order.conversationId))
    .limit(1);
  if (!conv) return;

  if (!isWindowOpen(conv.lastInboundAt, new Date(), args.windowMarginSeconds)) {
    return;
  }

  const [c] = await db
    .select()
    .from(contact)
    .where(eq(contact.id, order.contactId))
    .limit(1);

  const kindLabel =
    args.kind === "deposit"
      ? "Deposit"
      : args.kind === "balance"
        ? "Balance"
        : "Payment";

  const body = [
    `Payment received — thank you${c?.profileName ? `, ${c.profileName}` : ""}!`,
    ``,
    args.quoteRef ? `Invoice: ${args.quoteRef}` : null,
    `Order: ${order.ref}`,
    `${kindLabel} paid: ${formatNaira(args.paidKobo)}`,
    `Invoice total: ${formatNaira(args.invoiceTotalKobo)}`,
    args.remainingKobo > 0
      ? `Remaining balance: ${formatNaira(args.remainingKobo)}`
      : `Remaining balance: ${formatNaira(0)} — fully paid`,
    `Reference: ${args.reference}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const [outbound] = await db
    .insert(outboundMessage)
    .values({
      conversationId: order.conversationId,
      kind: "text",
      bodyText: body,
      origin: "system_auto",
      status: "approved",
      approvedAt: new Date(),
      orderId: order.id,
      idempotencyKey: `pay-receipt-${args.paymentId}`,
    })
    .returning();

  if (!outbound) return;
  try {
    await handleSendOutbound(db, outbound.id);
  } catch (err) {
    console.error("[paystack] receipt send failed", err);
  }
}
